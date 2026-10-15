using Application.Common.Exceptions;
using Application.DTOs.Orders;
using Application.Interfaces.Services.Public;
using Application.Mappings.Orders;
using Application.Validators.Orders;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Menu;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

// Đơn phía nhân viên (07 §2.8): màn nhận đơn, gọi món hộ, xác nhận, từ chối, phục vụ, hoàn tác, hủy món (UC-05…UC-07, UC-15).

public sealed partial class PosOperations
{
    public async Task<LiveOrdersDto> GetLiveAsync(CancellationToken ct = default)
    {
        var now = Now;
        var open = await sessions.QueryNoTracking()
            .Where(s => s.Status == SessionStatus.DangPhucVu || s.Status == SessionStatus.ChoThanhToan)
            .Select(s => new { s.Id, s.Code }).ToDictionaryAsync(s => s.Id, s => s.Code, ct);
        var openIds = open.Keys.ToList();
        var active = await orders.QueryNoTracking().Include(o => o.Items)
            .Where(o => openIds.Contains(o.SessionId) && (o.Status == OrderStatus.ChoXacNhan || o.Status == OrderStatus.DaXacNhan))
            .ToListAsync(ct);

        return new LiveOrdersDto
        {
            AsOf = now,
            Pending = active.Where(o => o.Status == OrderStatus.ChoXacNhan).OrderBy(o => o.SubmittedAt).ThenBy(o => o.Code)
                .Select(o => o.ToStaffDto(open[o.SessionId], now)).ToList(),
            Serving = active.Where(o => o.Status == OrderStatus.DaXacNhan).OrderBy(o => o.HandledAt).ThenBy(o => o.Code)
                .Select(o => o.ToStaffDto(open[o.SessionId], now)).ToList()
        };
    }

    public Task<StaffOrderDto> GetByIdAsync(Guid id, CancellationToken ct = default) => BuildStaffOrderAsync(id, ct);

    public Task<WriteOutcome<StaffOrderDto>> CreateAsync(CreateStaffOrderRequest request, CancellationToken ct = default) =>
        WithRetryAsync(service => service.CreateOnceAsync(request, ct));

    /// <summary>Gọi món hộ (FR-20, TC-26): không xét giờ nhận đơn, tạm ngưng, giới hạn 3 đơn chờ, không cần giá khách thấy.</summary>
    private async Task<WriteOutcome<StaffOrderDto>> CreateOnceAsync(CreateStaffOrderRequest request, CancellationToken ct)
    {
        var table = await tables.Query().FirstOrDefaultAsync(t => t.Id == request.TableId, ct) ?? throw new NotFoundException("Không tìm thấy bàn");

        var requestId = string.IsNullOrWhiteSpace(request.ClientRequestId) ? null : request.ClientRequestId.Trim();
        if (requestId is not null)
        {
            var previous = await orders.QueryNoTracking().Where(o => o.ClientRequestId == requestId).Select(o => o.Id).FirstOrDefaultAsync(ct);
            if (previous != Guid.Empty)
                return new WriteOutcome<StaffOrderDto>(await BuildStaffOrderAsync(previous, ct), false);
        }

        if (!table.IsActive)
            throw PosErrors.Business(PosErrors.BanDangTat, PosErrors.TableOffMessage);

        var failures = CartValidation.Validate(request.Lines, request.GuestName, request.Note, request.ClientRequestId);
        if (failures.Count > 0)
            throw new ValidationException(failures);

        var staff = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        var menu = await MenuSnapshot.LoadAsync(categories, menuItems, optionGroups, ct);
        var lines = PrepareLines(request.Lines, menu, Now, checkPrice: false);
        var submission = await CreateOrderAsync(table, lines, OrderSource.NhanVien, request.GuestName, request.Note, null, requestId, null,
            ConfirmMode.ThuCong, staff, ct);
        await PublishSubmissionAsync(submission, staffOrder: true, ct);
        return new WriteOutcome<StaffOrderDto>(await BuildStaffOrderAsync(submission.Order.Id, ct), true);
    }

    /// <summary>FR-16, TC-19, TC-20: bỏ món kèm lý do; bỏ lý do "Hết món" làm món đó "Hết trong hôm nay" nếu đang còn (BR-10).</summary>
    public async Task<StaffOrderDto> ConfirmAsync(Guid id, ConfirmOrderRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        await EnsurePendingAsync(order, ct);

        var failures = new List<ValidationFailure>();
        var removals = new Dictionary<Guid, (RemoveReason, string?)>();
        var removed = request.RemovedItems ?? [];
        for (var i = 0; i < removed.Count; i++)
        {
            var input = removed[i];
            if (order.Items.All(item => item.Id != input.ItemId))
                failures.Add(new ValidationFailure($"removedItems[{i}].itemId", "Dòng không thuộc đơn"));
            else if (input.Reason == RemoveReason.Khac && string.IsNullOrWhiteSpace(input.Note))
                failures.Add(new ValidationFailure($"removedItems[{i}].note", "Nhập lý do bỏ món"));
            else
                removals[input.ItemId] = (input.Reason, input.Note);
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);

        var now = Now;
        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        order.Confirm(now, user.Id, user.FullName, removals);
        session.Touch();

        // BR-10: món bị bỏ vì hết thì hết trong hôm nay; món đã "Hết tới khi mở lại" giữ nguyên (07 §5 quyết định 17).
        var soldOutIds = order.Items.Where(i => removals.TryGetValue(i.Id, out var r) && r.Item1 == RemoveReason.HetMon)
            .Select(i => i.MenuItemId).Distinct().ToList();
        var changedMenu = new List<Guid>();
        if (soldOutIds.Count > 0)
        {
            foreach (var item in await menuItems.Query().Where(m => soldOutIds.Contains(m.Id)).ToListAsync(ct))
            {
                if (item.IsSoldOutAt(now))
                    continue;
                item.MarkSoldOut(SoldOutMode.HetHomNay, PosSettings.EndOfTodayUtc(now));
                changedMenu.Add(item.Id);
            }
        }

        await SaveOrderAsync(order, ct);
        await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
        await events.TablesChangedAsync([order.TableId], ct);
        if (changedMenu.Count > 0)
            await events.MenuChangedAsync(changedMenu, [], ct);
        return await BuildStaffOrderAsync(id, ct);
    }

    /// <summary>FR-17, TC-21: mọi đơn của phiên bị từ chối thì phiên tự hủy, bàn về Trống (BR-02).</summary>
    public async Task<StaffOrderDto> RejectAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        await EnsurePendingAsync(order, ct);
        if (request.Reason is not { } reason || !Enum.IsDefined(reason))
            throw FieldErrors.Single("reason", "Chọn lý do từ chối");
        if (reason == RejectReason.Khac && string.IsNullOrWhiteSpace(request.Note))
            throw FieldErrors.Single("note", "Nhập lý do từ chối");
        if (request.Note is { } note && note.Trim().Length > PosRules.ReasonMaxLength)
            throw FieldErrors.Single("note", "Ghi chú tối đa 200 ký tự");

        var now = Now;
        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        order.Reject(now, user.Id, user.FullName, reason, request.Note);
        if (session.Orders.All(o => o.Status == OrderStatus.BiTuChoi))
        {
            session.CancelAutomatically(now);
            var table = await tables.Query().IgnoreQueryFilters().FirstAsync(t => t.Id == session.TableId, ct);
            if (table.CurrentSessionId == session.Id)
                table.DetachSession();
        }
        else
        {
            session.Touch();
        }

        await SaveOrderAsync(order, ct);
        await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
        await events.TablesChangedAsync([order.TableId], ct);
        return await BuildStaffOrderAsync(id, ct);
    }

    /// <summary>FR-19, TC-24, TC-25: dòng không ở <c>DaXacNhan</c> bỏ qua; không tăng phiên bản phiên.</summary>
    public async Task<StaffOrderDto> ServeAsync(Guid id, ServeOrderRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        if (order.Status == OrderStatus.ChoXacNhan)
            throw PosErrors.NotConfirmed();
        if (order.Status is OrderStatus.BiTuChoi or OrderStatus.DaHuy)
            throw PosErrors.Business(PosErrors.DonKhongPhucVuDuoc, PosErrors.NotServableMessage);
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();

        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        if (order.Serve(request.ItemIds, Now, user.Id) > 0)
        {
            await SaveOrderAsync(order, ct);
            await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
            await events.TablesChangedAsync([order.TableId], ct);
        }

        return await BuildStaffOrderAsync(id, ct);
    }

    /// <summary>UC-06 2a: hoàn tác trong 60 giây kể từ <c>servedAt</c> (07 §5 quyết định 32).</summary>
    public async Task<StaffOrderDto> UnserveAsync(Guid id, UnserveOrderRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();
        var itemIds = request.ItemIds ?? [];
        if (itemIds.Count == 0 || itemIds.Any(itemId => order.Items.All(i => i.Id != itemId)))
            throw FieldErrors.Single("itemIds", "Dòng không thuộc đơn");

        order.Unserve(itemIds, Now);
        await SaveOrderAsync(order, ct);
        await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
        await events.TablesChangedAsync([order.TableId], ct);
        return await BuildStaffOrderAsync(id, ct);
    }

    /// <summary>FR-21, BR-15, TC-30: hủy một phần thì tách dòng.</summary>
    public async Task<StaffOrderDto> CancelItemAsync(Guid id, Guid itemId, CancelOrderItemRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();
        order.EnsureConfirmed();
        var item = order.Items.FirstOrDefault(i => i.Id == itemId) ?? throw new NotFoundException("Không tìm thấy dòng đơn.");
        if (item.Status is not (OrderItemStatus.DaXacNhan or OrderItemStatus.DaPhucVu))
            throw PosErrors.Business(PosErrors.MonKhongHuyDuoc, PosErrors.NotCancellableMessage);
        ValidateCancelReason(request.Reason);
        if (request.Quantity < 1 || request.Quantity > item.Quantity)
            throw FieldErrors.Single("quantity", $"Số lượng hủy từ 1 đến {item.Quantity}");

        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        order.CancelItem(itemId, request.Quantity, request.Reason, Now, user.Id, user.FullName);
        session.Touch();
        await SaveOrderAsync(order, ct);
        await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
        await events.TablesChangedAsync([order.TableId], ct);
        return await BuildStaffOrderAsync(id, ct);
    }

    /// <summary>Hủy cả đơn: mọi dòng còn hiệu lực (BR-15).</summary>
    public async Task<StaffOrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default)
    {
        var (session, order) = await LoadOrderAsync(id, ct);
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();
        order.EnsureConfirmed();
        ValidateCancelReason(request.Reason);

        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        order.CancelAll(request.Reason, Now, user.Id, user.FullName);
        session.Touch();
        await SaveOrderAsync(order, ct);
        await events.OrdersChangedAsync([order.Id], [order.TableId], ct);
        await events.TablesChangedAsync([order.TableId], ct);
        return await BuildStaffOrderAsync(id, ct);
    }

    private static void ValidateCancelReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw FieldErrors.Single("reason", "Nhập lý do hủy");
        if (reason.Trim().Length > PosRules.ReasonMaxLength)
            throw FieldErrors.Single("reason", "Lý do tối đa 200 ký tự");
    }

    /// <summary>Đơn (có theo dõi) cùng phiên của nó kèm mọi đơn, dòng đơn.</summary>
    private async Task<(TableSession Session, Order Order)> LoadOrderAsync(Guid id, CancellationToken ct)
    {
        var sessionId = await orders.QueryNoTracking().Where(o => o.Id == id).Select(o => (Guid?)o.SessionId).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Không tìm thấy đơn.");
        var session = await LoadSessionAsync(sessionId, ct) ?? throw new NotFoundException("Không tìm thấy phiên bàn.");
        return (session, session.Orders.Single(o => o.Id == id));
    }

    /// <summary>UC-05 E3: đơn đã được xử lý → 409 <c>DonDaXuLy</c> kèm đơn mới nhất.</summary>
    private async Task EnsurePendingAsync(Order order, CancellationToken ct)
    {
        if (order.IsPending)
            return;
        throw PosConflicts.OrderHandled(order.HandledByName, order.AutoConfirmed, await BuildStaffOrderAsync(order.Id, ct));
    }

    /// <summary>Lưu; hai nhân viên cùng thao tác một đơn thì người sau nhận 409 <c>DonDaXuLy</c> kèm đơn mới nhất.</summary>
    private async Task SaveOrderAsync(Order order, CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            var latest = await ReadFreshAsync(service => service.BuildStaffOrderAsync(order.Id, ct));
            if (latest.Status != OrderStatus.ChoXacNhan && order.Status != OrderStatus.ChoXacNhan)
                throw PosConflicts.OrderHandled(latest.HandledByName, latest.AutoConfirmed, latest);
            throw new DomainException("Đơn vừa thay đổi, vui lòng thử lại");
        }
    }
}
