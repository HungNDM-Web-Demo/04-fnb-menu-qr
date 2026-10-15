using Application.Common.Exceptions;
using Application.DTOs.Orders;
using Application.DTOs.Public;
using Application.DTOs.Sessions;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Public;
using Application.Interfaces.Services.Realtime;
using Application.Mappings.Orders;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Nghiệp vụ phục vụ tại bàn: API công khai cho khách (07 §2.7), đơn phía nhân viên (§2.8), phiên bàn và thu tiền (§2.9),
/// yêu cầu từ bàn (§2.10). Một lớp chia nhiều file vì dùng chung phần gửi đơn (kiểm dòng, chụp giá, mở phiên, BR-08) và phần
/// dựng DTO phiên. Mọi ghi chạy trong transaction, phát sự kiện sau khi lưu. Tranh chấp ghi (hai điện thoại cùng mở phiên,
/// trùng mã chứng từ, trùng <c>clientRequestId</c>) thì chạy lại một lần trong scope mới để đọc dữ liệu mới nhất.
/// </summary>
public sealed partial class PosOperations(
    IGenericRepository<DiningTable> tables,
    IGenericRepository<TableSession> sessions,
    IGenericRepository<Order> orders,
    IGenericRepository<ServiceRequest> requests,
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<OptionGroup> optionGroups,
    IGenericRepository<OptionChoice> optionChoices,
    IGenericRepository<Setting> settings,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IPosEventPublisher events,
    IServiceScopeFactory scopeFactory,
    TimeProvider time) : IPublicTableService, IOrderService, ITableSessionService, IServiceRequestService
{
    private bool _isRetry;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    /// <summary>Chạy lại một lần trong scope mới khi gặp tranh chấp ghi (DbUpdateException).</summary>
    private async Task<T> WithRetryAsync<T>(Func<PosOperations, Task<T>> action)
    {
        try
        {
            return await action(this);
        }
        catch (DbUpdateException) when (!_isRetry)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var fresh = (PosOperations)scope.ServiceProvider.GetRequiredService<IOrderService>();
            fresh._isRetry = true;
            return await action(fresh);
        }
    }

    /// <summary>Đọc lại trong scope mới (sau tranh chấp ghi, DbContext hiện tại giữ bản cũ).</summary>
    private async Task<T> ReadFreshAsync<T>(Func<PosOperations, Task<T>> read)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        return await read((PosOperations)scope.ServiceProvider.GetRequiredService<IOrderService>());
    }

    /// <summary>Phiên kèm đơn, dòng đơn (có theo dõi để sửa).</summary>
    private Task<TableSession?> LoadSessionAsync(Guid sessionId, CancellationToken ct) =>
        sessions.Query().Include(s => s.Orders).ThenInclude(o => o.Items).FirstOrDefaultAsync(s => s.Id == sessionId, ct);

    private Task<TableSession?> ReadSessionAsync(Guid sessionId, CancellationToken ct) =>
        sessions.QueryNoTracking().Include(s => s.Orders).ThenInclude(o => o.Items).FirstOrDefaultAsync(s => s.Id == sessionId, ct);

    /// <summary>Bàn kể cả đã xóa (phiên cũ của bàn đã xóa vẫn xem được).</summary>
    private Task<DiningTable?> TableAnyAsync(Guid tableId, CancellationToken ct) =>
        tables.QueryNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == tableId, ct);

    /// <summary>Yêu cầu thanh toán đang chờ của phiên (BR-12: tối đa một).</summary>
    private Task<ServiceRequest?> PendingPaymentAsync(Guid sessionId, bool tracking, CancellationToken ct) =>
        (tracking ? requests.Query() : requests.QueryNoTracking())
            .Where(r => r.SessionId == sessionId && r.Type == ServiceRequestType.ThanhToan && r.Status == ServiceRequestStatus.DangCho)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);

    private static int UnservedLines(TableSession session) =>
        session.Orders.Where(o => o.Status == OrderStatus.DaXacNhan).SelectMany(o => o.Items).Count(i => i.Status == OrderItemStatus.DaXacNhan);

    /// <summary>Ngăn kéo chi tiết phiên (07 §2.9 <c>TableSessionDto</c>).</summary>
    private async Task<TableSessionDto> BuildSessionDtoAsync(Guid sessionId, CancellationToken ct)
    {
        var now = Now;
        var session = await ReadSessionAsync(sessionId, ct) ?? throw new NotFoundException("Không tìm thấy phiên bàn.");
        var table = await TableAnyAsync(session.TableId, ct);
        var sessionRequests = await requests.QueryNoTracking().Where(r => r.SessionId == sessionId)
            .OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        var payment = sessionRequests.FirstOrDefault(r => r.Type == ServiceRequestType.ThanhToan && r.IsPending);

        return new TableSessionDto
        {
            Id = session.Id,
            Code = session.Code,
            TableId = session.TableId,
            TableName = session.TableName,
            Zone = table?.Zone ?? string.Empty,
            Status = session.Status,
            Version = session.Version,
            OpenedAt = session.OpenedAt,
            ClosedAt = session.ClosedAt,
            Subtotal = session.IsOpen ? OrderPricing.SessionSubtotal(session.Orders) : session.Total ?? OrderPricing.SessionSubtotal(session.Orders),
            PendingTotal = OrderPricing.PendingTotal(session.Orders),
            Orders = session.Orders.OrderBy(o => o.SubmittedAt).ThenBy(o => o.Code).Select(o => o.ToStaffDto(session.Code, now)).ToList(),
            Counts = new SessionCounts
            {
                PendingOrders = session.Orders.Count(o => o.Status == OrderStatus.ChoXacNhan),
                UnservedItems = UnservedLines(session)
            },
            PaymentRequest = payment?.ToBrief(),
            Payment = session.Status == SessionStatus.DaDong && session.PaymentMethod is { } method
                ? new SessionPaymentDto
                {
                    Method = method,
                    Total = session.Total ?? 0,
                    CashReceived = session.CashReceived,
                    ChangeAmount = session.ChangeAmount,
                    NeedVatInvoice = session.NeedVatInvoice,
                    ClosedAt = session.ClosedAt ?? now,
                    ClosedByName = session.ClosedByName ?? string.Empty
                }
                : null,
            Requests = sessionRequests.Select(r => r.ToDto(session.Code, now)).ToList(),
            TransferredFromTableName = session.TransferredFromTableName,
            AsOf = now
        };
    }

    /// <summary>Phiên cho trang khách (07 §2.7 <c>PublicSessionView</c>), đơn mới nhất trước.</summary>
    private async Task<PublicSessionView> BuildPublicSessionAsync(TableSession session, string? deviceId, string? transferredTo, CancellationToken ct)
    {
        var payment = session.IsOpen ? await PendingPaymentAsync(session.Id, tracking: false, ct) : null;
        return new PublicSessionView
        {
            Code = session.Code,
            Status = session.Status,
            OpenedAt = session.OpenedAt,
            ClosedAt = session.ClosedAt,
            Subtotal = session.IsOpen ? OrderPricing.SessionSubtotal(session.Orders) : session.Total ?? OrderPricing.SessionSubtotal(session.Orders),
            PendingTotal = OrderPricing.PendingTotal(session.Orders),
            Orders = session.Orders.OrderByDescending(o => o.SubmittedAt).ThenByDescending(o => o.Code).Select(o => o.ToPublicView(deviceId)).ToList(),
            PaymentRequest = payment?.ToBrief(),
            TransferredToTableName = transferredTo
        };
    }

    private async Task<StaffOrderDto> BuildStaffOrderAsync(Guid orderId, CancellationToken ct)
    {
        var order = await orders.QueryNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new NotFoundException("Không tìm thấy đơn.");
        var code = await sessions.QueryNoTracking().Where(s => s.Id == order.SessionId).Select(s => s.Code).FirstAsync(ct);
        return order.ToStaffDto(code, Now);
    }
}
