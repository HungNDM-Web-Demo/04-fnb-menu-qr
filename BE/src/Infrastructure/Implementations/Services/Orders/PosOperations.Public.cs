using Application.Common.Exceptions;
using Application.DTOs.Public;
using Application.DTOs.Tables;
using Application.Interfaces.Services.Public;
using Application.Mappings.Menu;
using Application.Mappings.Orders;
using Application.Mappings.Tables;
using Application.Validators.Orders;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Implementations.Services.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

// API công khai cho trang khách (07 §2.7, UC-01…UC-04). Mã bàn trong URL là thông tin xác thực duy nhất (BR-01);
// mọi phản hồi chỉ chứa dữ liệu của bàn đó (NFR-04).

public sealed partial class PosOperations
{
    public async Task<PublicTableInfo> GetInfoAsync(string code, CancellationToken ct = default)
    {
        var now = Now;
        var table = await TableByCodeAsync(code, tracking: false, ct);
        return new PublicTableInfo
        {
            Table = new PublicTableBrief { Name = table.Name, Zone = table.Zone, Code = table.Code, IsActive = table.IsActive },
            Store = (await PosSettings.StoreAsync(settings, ct)).ToPublic(),
            Ordering = (await PosSettings.OrderingAsync(settings, now, ct)).ToDto(now),
            MenuStamp = await StampAsync(now, ct),
            AsOf = now
        };
    }

    public async Task<PublicMenu> GetMenuAsync(string code, CancellationToken ct = default)
    {
        var now = Now;
        await TableByCodeAsync(code, tracking: false, ct);
        var menu = await MenuSnapshot.LoadAsync(categories, menuItems, optionGroups, ct);
        var visible = menu.OrderedItems().Where(menu.IsVisible).ToList();
        var categoryIds = visible.Select(i => i.CategoryId).ToHashSet();
        var groupIds = visible.SelectMany(i => i.OrderedGroupIds).ToHashSet();

        return new PublicMenu
        {
            Stamp = await StampAsync(now, ct),
            Categories = menu.Categories.Values.Where(c => !c.IsHidden && categoryIds.Contains(c.Id)).OrderBy(c => c.SortOrder)
                .Select(c => new PublicCategory { Id = c.Id, Name = c.Name, NameEn = c.NameEn, SortOrder = c.SortOrder }).ToList(),
            Items = visible.Select(i => i.ToPublic(menu.IsSoldOut(i, now))).ToList(),
            OptionGroups = menu.Groups.Values.Where(g => groupIds.Contains(g.Id)).OrderBy(g => g.SortOrder).Select(g => g.ToPublic(now)).ToList()
        };
    }

    public async Task<string> GetMenuStampAsync(string code, CancellationToken ct = default)
    {
        await TableByCodeAsync(code, tracking: false, ct);
        return await StampAsync(Now, ct);
    }

    public async Task<PublicLiveState> GetLiveAsync(string code, string? deviceId, string? knownSession, CancellationToken ct = default)
    {
        var now = Now;
        var table = await TableByCodeAsync(code, tracking: false, ct);
        var device = string.IsNullOrWhiteSpace(deviceId) ? null : deviceId.Trim();

        var current = table.CurrentSessionId is { } sessionId ? await ReadSessionAsync(sessionId, ct) : null;

        // FR-24, TC-21, BR-18: phiên điện thoại đã biết, thuộc (hoặc đã chuyển từ) bàn này, kết thúc hoặc chuyển bàn trong 4 giờ qua.
        PublicSessionView? ended = null;
        var known = knownSession?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(known) && known != current?.Code)
        {
            var since = now - PosRules.GuestHistoryWindow;
            var session = await sessions.QueryNoTracking().Include(s => s.Orders).ThenInclude(o => o.Items)
                .FirstOrDefaultAsync(s => s.Code == known, ct);
            if (session is not null)
            {
                var transferredAway = session.TableId != table.Id && session.TransferredFromTableName == table.Name;
                var closedRecently = session.TableId == table.Id && !session.IsOpen && session.ClosedAt >= since;
                var movedRecently = transferredAway && (session.UpdatedAt ?? session.CreatedAt) >= since;
                if (closedRecently || movedRecently)
                    ended = await BuildPublicSessionAsync(session, device, transferredAway ? session.TableName : null, ct);
            }
        }

        var mine = new List<PublicServiceRequestView>();
        if (device is not null)
        {
            var since = now - PosRules.GuestHistoryWindow;
            mine = (await requests.QueryNoTracking()
                    .Where(r => r.TableId == table.Id && r.DeviceId == device && r.CreatedAt >= since)
                    .OrderByDescending(r => r.CreatedAt).ToListAsync(ct))
                .Select(r => r.ToPublicView()).ToList();
        }

        return new PublicLiveState
        {
            AsOf = now,
            Table = new PublicLiveTable { Name = table.Name, IsActive = table.IsActive },
            Ordering = (await PosSettings.OrderingAsync(settings, now, ct)).ToDto(now),
            MenuStamp = await StampAsync(now, ct),
            Session = current is null ? null : await BuildPublicSessionAsync(current, device, null, ct),
            EndedSession = ended,
            MyRequests = mine
        };
    }

    public Task<WriteOutcome<PublicSubmitOrderResult>> SubmitOrderAsync(string code, PublicSubmitOrderRequest request, CancellationToken ct = default) =>
        WithRetryAsync(service => service.SubmitOrderOnceAsync(code, request, ct));

    public Task<WriteOutcome<PublicServiceRequestResult>> SendRequestAsync(string code, PublicServiceRequestInput request, CancellationToken ct = default) =>
        WithRetryAsync(service => service.SendRequestOnceAsync(code, request, ct));

    /// <summary>Thứ tự kiểm tra đúng 07 §2.7 "Gửi đơn" (bước 1–10).</summary>
    private async Task<WriteOutcome<PublicSubmitOrderResult>> SubmitOrderOnceAsync(string code, PublicSubmitOrderRequest request, CancellationToken ct)
    {
        var now = Now;
        var deviceId = string.IsNullOrWhiteSpace(request.DeviceId) ? null : request.DeviceId.Trim();

        // 1. Mã bàn.
        var table = await TableByCodeAsync(code, tracking: true, ct);

        // 2. Gửi lại cùng clientRequestId.
        var requestId = string.IsNullOrWhiteSpace(request.ClientRequestId) ? null : request.ClientRequestId.Trim();
        if (requestId is not null)
        {
            var previous = await orders.QueryNoTracking().Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.ClientRequestId == requestId && o.TableId == table.Id, ct);
            if (previous is not null)
                return new WriteOutcome<PublicSubmitOrderResult>(await PublicResultAsync(previous.Id, deviceId, duplicate: true, ct), false);
        }

        // 3–5. Bàn tắt, quán tạm ngưng, ngoài giờ.
        if (!table.IsActive)
            throw PosErrors.TableInactive();
        var ordering = await PosSettings.OrderingAsync(settings, now, ct);
        if (!ordering.Accepting)
            throw PosErrors.Business(ordering.BlockReason!, ordering.Message!);

        // 6. Dữ liệu giỏ.
        var failures = CartValidation.Validate(request.Lines, request.GuestName, request.Note, request.ClientRequestId);
        if (deviceId is null)
            failures.Add(new ValidationFailure("deviceId", "Thiếu mã thiết bị"));
        else if (deviceId.Length > 64)
            failures.Add(new ValidationFailure("deviceId", "Mã thiết bị tối đa 64 ký tự"));
        if (failures.Count > 0)
            throw new ValidationException(failures);

        // 6–8. Lựa chọn, món hết, giá đổi.
        var menu = await MenuSnapshot.LoadAsync(categories, menuItems, optionGroups, ct);
        var lines = PrepareLines(request.Lines, menu, now, checkPrice: true);

        // 9. Cùng điện thoại gửi lại cùng giỏ trong 10 giây.
        var cartKey = CartKey(request.GuestName, request.Note, request.Lines);
        var since = now - PosRules.SameCartWindow;
        var sameCart = await orders.QueryNoTracking()
            .Where(o => o.TableId == table.Id && o.DeviceId == deviceId && o.CartKey == cartKey && o.SubmittedAt >= since)
            .OrderByDescending(o => o.SubmittedAt).Select(o => o.Id).FirstOrDefaultAsync(ct);
        if (sameCart != Guid.Empty)
            return new WriteOutcome<PublicSubmitOrderResult>(await PublicResultAsync(sameCart, deviceId, duplicate: true, ct), false);

        // 10. Tối đa 3 đơn chờ xác nhận mỗi bàn.
        if (table.CurrentSessionId is { } openId
            && await orders.QueryNoTracking().CountAsync(o => o.SessionId == openId && o.Status == OrderStatus.ChoXacNhan, ct) >= PosRules.MaxPendingOrdersPerTable)
        {
            throw PosErrors.Business(PosErrors.QuaSoDonCho, PosErrors.TooManyPendingMessage);
        }

        var submission = await CreateOrderAsync(table, lines, OrderSource.KhachQr, request.GuestName, request.Note, deviceId, requestId, cartKey,
            ordering.ConfirmMode, staff: null, ct);
        await PublishSubmissionAsync(submission, staffOrder: false, ct);
        return new WriteOutcome<PublicSubmitOrderResult>(await PublicResultAsync(submission.Order.Id, deviceId, duplicate: false, ct), true);
    }

    /// <summary>Thứ tự kiểm tra đúng 07 §2.7 "Gửi yêu cầu"; gọi nhân viên lặp cùng lý do trong 60 giây trả yêu cầu cũ (BR-12, TC-15).</summary>
    private async Task<WriteOutcome<PublicServiceRequestResult>> SendRequestOnceAsync(string code, PublicServiceRequestInput request, CancellationToken ct)
    {
        var now = Now;
        var deviceId = string.IsNullOrWhiteSpace(request.DeviceId) ? null : request.DeviceId.Trim();
        var table = await TableByCodeAsync(code, tracking: true, ct);

        var requestId = string.IsNullOrWhiteSpace(request.ClientRequestId) ? null : request.ClientRequestId.Trim();
        if (requestId is not null)
        {
            var previous = await requests.QueryNoTracking().FirstOrDefaultAsync(r => r.ClientRequestId == requestId && r.TableId == table.Id, ct);
            if (previous is not null)
                return Duplicate(previous);
        }

        if (!table.IsActive)
            throw PosErrors.TableInactive();

        var failures = new List<ValidationFailure>();
        if (requestId is null)
            failures.Add(new ValidationFailure("clientRequestId", "Thiếu mã yêu cầu"));
        if (request.Type == ServiceRequestType.GoiNhanVien)
        {
            if (request.Reason is null)
                failures.Add(new ValidationFailure("reason", "Chọn lý do"));
            else if (request.Reason == CallReason.Khac && string.IsNullOrWhiteSpace(request.Note))
                failures.Add(new ValidationFailure("note", "Nhập nội dung cần hỗ trợ"));
        }
        else if (request.PaymentMethod is null)
        {
            failures.Add(new ValidationFailure("paymentMethod", "Chọn phương thức thanh toán"));
        }

        if (request.Note is { } note && note.Trim().Length > PosRules.OrderNoteMaxLength)
            failures.Add(new ValidationFailure("note", "Ghi chú tối đa 200 ký tự"));
        if (failures.Count > 0)
            throw new ValidationException(failures);

        var session = table.CurrentSessionId is { } sessionId ? await LoadSessionAsync(sessionId, ct) : null;
        ServiceRequest result;
        if (request.Type == ServiceRequestType.GoiNhanVien)
        {
            var ordering = await PosSettings.OrderingAsync(settings, now, ct);
            if (!ordering.WithinHours && session is null)
                throw PosErrors.Business(PosErrors.NgoaiGioNhanDon, PosErrors.OutOfHoursMessage(ordering.OpenTime, ordering.CloseTime));

            var since = now - PosRules.CallRepeatWindow;
            var repeated = await requests.QueryNoTracking()
                .Where(r => r.TableId == table.Id && r.Type == ServiceRequestType.GoiNhanVien && r.Reason == request.Reason
                            && r.Status == ServiceRequestStatus.DangCho && r.CreatedAt >= since)
                .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync(ct);
            if (repeated is not null)
                return Duplicate(repeated);

            result = ServiceRequest.CreateCall(table.Id, table.Name, session?.Id, request.Reason!.Value, request.Note, deviceId, requestId);
            await requests.AddAsync(result, ct);
            await unitOfWork.SaveChangesAsync(ct);
        }
        else
        {
            if (session is null || OrderPricing.SessionSubtotal(session.Orders) <= 0)
                throw PosErrors.Business(PosErrors.ChuaCoMonXacNhan, PosErrors.NothingConfirmedMessage);

            var pending = await PendingPaymentAsync(session.Id, tracking: true, ct);
            if (pending is not null)
            {
                pending.UpdatePayment(request.PaymentMethod!.Value, request.NeedVatInvoice ?? false);
                session.Touch();
                await unitOfWork.SaveChangesAsync(ct);
                await events.RequestsChangedAsync([pending.Id], [table.Id], null, ct);
                await events.TablesChangedAsync([table.Id], ct);
                return new WriteOutcome<PublicServiceRequestResult>(new PublicServiceRequestResult { Request = pending.ToPublicView(), Duplicate = true }, false);
            }

            result = ServiceRequest.CreatePayment(table.Id, table.Name, session.Id, request.PaymentMethod!.Value, request.NeedVatInvoice ?? false, deviceId, requestId);
            await requests.AddAsync(result, ct);
            session.MarkPaymentRequested();
            await unitOfWork.SaveChangesAsync(ct);
        }

        await events.RequestsChangedAsync([result.Id], [table.Id], [result.Id], ct);
        await events.TablesChangedAsync([table.Id], ct);
        return new WriteOutcome<PublicServiceRequestResult>(new PublicServiceRequestResult { Request = result.ToPublicView(), Duplicate = false }, true);

        static WriteOutcome<PublicServiceRequestResult> Duplicate(ServiceRequest existing) =>
            new(new PublicServiceRequestResult { Request = existing.ToPublicView(), Duplicate = true }, false);
    }

    /// <summary>Bàn chưa xóa theo mã (so không phân biệt hoa thường); sai hoặc đã đổi → 404 <c>MaQrKhongHopLe</c>.</summary>
    private async Task<DiningTable> TableByCodeAsync(string code, bool tracking, CancellationToken ct)
    {
        var normalized = code?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!PosRules.IsValidTableCode(normalized))
            throw PosConflicts.InvalidQr();
        return await (tracking ? tables.Query() : tables.QueryNoTracking()).FirstOrDefaultAsync(t => t.Code == normalized, ct)
            ?? throw PosConflicts.InvalidQr();
    }

    private Task<string> StampAsync(DateTime now, CancellationToken ct) =>
        MenuSnapshot.StampAsync(categories, menuItems, optionGroups, optionChoices, now, ct);

    private async Task<PublicSubmitOrderResult> PublicResultAsync(Guid orderId, string? deviceId, bool duplicate, CancellationToken ct)
    {
        var order = await orders.QueryNoTracking().Include(o => o.Items).FirstAsync(o => o.Id == orderId, ct);
        var sessionCode = await sessions.QueryNoTracking().Where(s => s.Id == order.SessionId).Select(s => s.Code).FirstAsync(ct);
        return new PublicSubmitOrderResult { Order = order.ToPublicView(deviceId), SessionCode = sessionCode, Duplicate = duplicate };
    }
}
