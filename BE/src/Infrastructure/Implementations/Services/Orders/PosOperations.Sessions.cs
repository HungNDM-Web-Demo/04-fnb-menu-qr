using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Orders;
using Application.DTOs.Sessions;
using Application.Interfaces.Services.Orders;
using Application.Mappings.Orders;
using Application.Mappings.Tables;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Pos;
using Infrastructure.Implementations.Services.Tables;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

// Phiên bàn, thu tiền, chuyển bàn (07 §2.9, UC-08, FR-22–FR-25) và yêu cầu từ bàn phía nhân viên (07 §2.10, FR-14).

public sealed partial class PosOperations
{
    public async Task<IReadOnlyList<TableBoardItem>> GetBoardAsync(CancellationToken ct = default)
    {
        var list = await tables.QueryNoTracking().ToListAsync(ct);
        var openIds = list.Where(t => t.CurrentSessionId is not null).Select(t => t.CurrentSessionId!.Value).ToList();
        var open = await sessions.QueryNoTracking().Include(s => s.Orders).ThenInclude(o => o.Items)
            .Where(s => openIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var pending = await requests.QueryNoTracking().Where(r => r.Status == ServiceRequestStatus.DangCho).ToListAsync(ct);

        return TableService.Ordered(list).Select(table =>
        {
            var session = table.CurrentSessionId is { } sid ? open.GetValueOrDefault(sid) : null;
            var payment = session is null ? null
                : pending.Where(r => r.SessionId == session.Id && r.Type == ServiceRequestType.ThanhToan).MaxBy(r => r.CreatedAt);
            return new TableBoardItem
            {
                TableId = table.Id,
                TableName = table.Name,
                Zone = table.Zone,
                Capacity = table.Capacity,
                Code = table.Code,
                IsActive = table.IsActive,
                Status = table.StatusOf(session?.Status),
                Session = session is null ? null : new TableBoardSession
                {
                    Id = session.Id,
                    Code = session.Code,
                    Status = session.Status,
                    OpenedAt = session.OpenedAt,
                    OrderCount = session.Orders.Count(o => o.Status != OrderStatus.BiTuChoi),
                    Subtotal = OrderPricing.SessionSubtotal(session.Orders),
                    PendingOrderCount = session.Orders.Count(o => o.Status == OrderStatus.ChoXacNhan),
                    UnservedCount = UnservedLines(session),
                    PaymentRequest = payment?.ToBrief()
                },
                PendingRequestCount = pending.Count(r => r.TableId == table.Id)
            };
        }).ToList();
    }

    public async Task<PaginatedResult<TableSessionListItem>> GetPagedAsync(TableSessionQuery query, CancellationToken ct = default)
    {
        var today = Application.Common.Time.VietnamDates.Today(time);
        var (fromUtc, toUtc) = PosDates.Range(query.From, query.To, today, today);
        var source = sessions.QueryNoTracking().Where(s => s.OpenedAt >= fromUtc && s.OpenedAt < toUtc);
        if (query.Status is { } status)
            source = source.Where(s => s.Status == status);
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(s => AppDbFunctions.Matches(s.Code, pattern) || AppDbFunctions.Matches(s.TableName, pattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(TableSession.OpenedAt);
        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var ids = page.Items.Select(s => s.Id).ToList();
        var pageOrders = await orders.QueryNoTracking().Include(o => o.Items).Where(o => ids.Contains(o.SessionId)).ToListAsync(ct);

        return page.Map(items => items.Select(s =>
        {
            var own = pageOrders.Where(o => o.SessionId == s.Id).ToList();
            return new TableSessionListItem
            {
                Id = s.Id,
                Code = s.Code,
                TableName = s.TableName,
                Status = s.Status,
                OpenedAt = s.OpenedAt,
                ClosedAt = s.ClosedAt,
                Total = s.Total ?? OrderPricing.SessionSubtotal(own),
                OrderCount = own.Count(o => o.Status != OrderStatus.BiTuChoi),
                Method = s.PaymentMethod,
                ClosedByName = s.ClosedByName
            };
        }).ToList());
    }

    Task<TableSessionDto> ITableSessionService.GetByIdAsync(Guid id, CancellationToken ct) => BuildSessionDtoAsync(id, ct);

    /// <summary>Thu tiền, đóng phiên: thứ tự kiểm tra đúng 07 §2.9 (bước 1–7), một transaction (BR-13, TC-27…TC-29).</summary>
    public async Task<CheckoutResultDto> CheckoutAsync(Guid id, CheckoutRequest request, CancellationToken ct = default)
    {
        // 1. Cùng clientRequestId đã thu: trả kết quả cũ, không xét version.
        var requestId = string.IsNullOrWhiteSpace(request.ClientRequestId) ? null : request.ClientRequestId.Trim();
        if (requestId is not null)
        {
            var previous = await sessions.QueryNoTracking().Where(s => s.CheckoutRequestId == requestId)
                .Select(s => new { s.Id, s.ChangeAmount }).FirstOrDefaultAsync(ct);
            if (previous is not null)
                return new CheckoutResultDto { Session = await BuildSessionDtoAsync(previous.Id, ct), ChangeAmount = previous.ChangeAmount ?? 0, Duplicate = true };
        }

        var session = await LoadSessionAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy phiên bàn.");

        // 2–5. Phiên mở, đúng phiên bản, không còn đơn chờ, món chưa phục vụ đã được xác nhận cảnh báo.
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();
        if (request.Version != session.Version)
            throw PosConflicts.Stale(session.Version);
        var pendingCount = session.Orders.Count(o => o.Status == OrderStatus.ChoXacNhan);
        if (pendingCount > 0)
        {
            throw PosErrors.Business(PosErrors.ConDonChoXacNhan, $"Còn {pendingCount} đơn chờ xác nhận",
                new Dictionary<string, object?> { ["pendingCount"] = pendingCount });
        }

        var unserved = UnservedLines(session);
        if (unserved > 0 && request.AcknowledgeUnserved != true)
        {
            throw PosErrors.Business(PosErrors.ConMonChuaPhucVu, $"Còn {unserved} món chưa phục vụ",
                new Dictionary<string, object?> { ["unservedCount"] = unserved });
        }

        // 6–7. Tiền khách đưa.
        var subtotal = OrderPricing.SessionSubtotal(session.Orders);
        if (!Enum.IsDefined(request.Method))
            throw FieldErrors.Single("method", "Chọn phương thức thanh toán");
        if (request.Method == PaymentMethod.TienMat)
        {
            if (request.CashReceived is null)
                throw FieldErrors.Single("cashReceived", "Nhập tiền khách đưa");
            if (request.CashReceived.Value < subtotal)
            {
                var message = $"Còn thiếu {PosRules.FormatVnd(subtotal - request.CashReceived.Value)}";
                throw PosErrors.WithErrors(PosErrors.TienKhachDuaThieu, message, new Dictionary<string, string[]> { ["cashReceived"] = [message] });
            }
        }

        var now = Now;
        var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
        var table = await tables.Query().IgnoreQueryFilters().FirstAsync(t => t.Id == session.TableId, ct);
        var pendingRequests = await requests.Query()
            .Where(r => r.Status == ServiceRequestStatus.DangCho && (r.TableId == session.TableId || r.SessionId == session.Id))
            .ToListAsync(ct);
        var paymentRequest = pendingRequests.Where(r => r.SessionId == session.Id && r.Type == ServiceRequestType.ThanhToan).MaxBy(r => r.CreatedAt);

        session.Close(subtotal, request.Method, request.CashReceived, request.NeedVatInvoice ?? paymentRequest?.NeedVatInvoice ?? false,
            now, user.Id, user.FullName, requestId);
        if (table.CurrentSessionId == session.Id)
            table.DetachSession();
        foreach (var pendingRequest in pendingRequests)
            pendingRequest.Handle(now, user.Id, user.FullName, auto: true);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Khách vừa gọi thêm, nhân viên khác vừa xác nhận trong lúc thu tiền (07 §5 quyết định 23).
            var current = await ReadFreshAsync(service => service.SessionVersionAsync(id, ct));
            throw PosConflicts.Stale(current);
        }

        await events.TablesChangedAsync([session.TableId], ct);
        await events.RequestsChangedAsync(pendingRequests.Select(r => r.Id), [session.TableId], null, ct);
        await events.OrdersChangedAsync(session.Orders.Select(o => o.Id), [session.TableId], ct);
        return new CheckoutResultDto { Session = await BuildSessionDtoAsync(id, ct), ChangeAmount = session.ChangeAmount ?? 0, Duplicate = false };
    }

    /// <summary>Chuyển bàn (BR-18, P3): chỉ sang bàn trống đang bật; phiên giữ mã; yêu cầu đang chờ chuyển theo.</summary>
    public async Task<TableSessionDto> TransferAsync(Guid id, TransferSessionRequest request, CancellationToken ct = default)
    {
        var session = await LoadSessionAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy phiên bàn.");
        if (!session.IsOpen)
            throw PosErrors.SessionClosed();
        var target = await tables.Query().FirstOrDefaultAsync(t => t.Id == request.TargetTableId, ct) ?? throw new NotFoundException("Không tìm thấy bàn");
        if (!target.IsActive || target.CurrentSessionId is not null || target.Id == session.TableId)
            throw PosErrors.Business(PosErrors.BanDichKhongHopLe, PosErrors.TransferTargetMessage);
        if (request.Version != session.Version)
            throw PosConflicts.Stale(session.Version);

        var source = await tables.Query().IgnoreQueryFilters().FirstAsync(t => t.Id == session.TableId, ct);
        var moving = await requests.Query().Where(r => r.SessionId == session.Id && r.Status == ServiceRequestStatus.DangCho).ToListAsync(ct);

        session.TransferTo(target.Id, target.Name);
        if (source.CurrentSessionId == session.Id)
            source.DetachSession();
        target.AttachSession(session.Id);
        foreach (var request2 in moving)
            request2.MoveToTable(target.Id, target.Name);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            var current = await ReadFreshAsync(service => service.SessionVersionAsync(id, ct));
            throw PosConflicts.Stale(current);
        }

        await events.TablesChangedAsync([source.Id, target.Id], ct);
        if (moving.Count > 0)
            await events.RequestsChangedAsync(moving.Select(r => r.Id), [source.Id, target.Id], null, ct);
        await events.OrdersChangedAsync(session.Orders.Select(o => o.Id), [source.Id, target.Id], ct);
        return await BuildSessionDtoAsync(id, ct);
    }

    public async Task<IReadOnlyList<ServiceRequestDto>> GetPendingAsync(CancellationToken ct = default)
    {
        var now = Now;
        var pending = await requests.QueryNoTracking().Where(r => r.Status == ServiceRequestStatus.DangCho).ToListAsync(ct);
        var codes = await SessionCodesAsync(pending.Select(r => r.SessionId), ct);
        return pending.OrderBy(r => r.CreatedAt)
            .Select(r => r.ToDto(r.SessionId is { } sid ? codes.GetValueOrDefault(sid) : null, now)).ToList();
    }

    /// <summary>"Đã xử lý" (FR-14): đã xử lý → trả như cũ; đã hủy → <c>YeuCauDaHuy</c>. Không đổi trạng thái phiên.</summary>
    public async Task<ServiceRequestDto> HandleAsync(Guid id, CancellationToken ct = default)
    {
        var request = await requests.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy yêu cầu.");
        if (request.Status == ServiceRequestStatus.DaHuy)
            throw PosErrors.Business(PosErrors.YeuCauDaHuy, PosErrors.RequestCancelledMessage);

        if (request.IsPending)
        {
            var user = await PosCodes.CurrentUserAsync(users, currentUser, ct);
            request.Handle(Now, user.Id, user.FullName);
            await unitOfWork.SaveChangesAsync(ct);
            await events.RequestsChangedAsync([request.Id], [request.TableId], null, ct);
            await events.TablesChangedAsync([request.TableId], ct);
        }

        var codes = await SessionCodesAsync([request.SessionId], ct);
        return request.ToDto(request.SessionId is { } sid ? codes.GetValueOrDefault(sid) : null, Now);
    }

    private Task<int> SessionVersionAsync(Guid id, CancellationToken ct) =>
        sessions.QueryNoTracking().Where(s => s.Id == id).Select(s => s.Version).FirstAsync(ct);

    private async Task<Dictionary<Guid, string>> SessionCodesAsync(IEnumerable<Guid?> sessionIds, CancellationToken ct)
    {
        var ids = sessionIds.Where(s => s is not null).Select(s => s!.Value).Distinct().ToList();
        return ids.Count == 0
            ? new Dictionary<Guid, string>()
            : await sessions.QueryNoTracking().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Code, ct);
    }
}
