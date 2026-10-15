using Application.Common.Models;
using Application.DTOs.Orders;
using Application.DTOs.Sessions;
using Application.Interfaces.Services.Public;

namespace Application.Interfaces.Services.Orders;

/// <summary>Đơn phía nhân viên (07 §2.8, UC-05, UC-06, UC-07, UC-15).</summary>
public interface IOrderService
{
    Task<LiveOrdersDto> GetLiveAsync(CancellationToken ct = default);

    Task<StaffOrderDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Gọi món hộ (FR-20); trùng <c>clientRequestId</c> → kết quả cũ, <see cref="WriteOutcome{T}.Created"/> false.</summary>
    Task<WriteOutcome<StaffOrderDto>> CreateAsync(CreateStaffOrderRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> ConfirmAsync(Guid id, ConfirmOrderRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> RejectAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> ServeAsync(Guid id, ServeOrderRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> UnserveAsync(Guid id, UnserveOrderRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> CancelItemAsync(Guid id, Guid itemId, CancelOrderItemRequest request, CancellationToken ct = default);

    Task<StaffOrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default);
}

/// <summary>Phiên bàn và thu tiền (07 §2.9, UC-08, FR-22–FR-25).</summary>
public interface ITableSessionService
{
    Task<IReadOnlyList<TableBoardItem>> GetBoardAsync(CancellationToken ct = default);

    Task<PaginatedResult<TableSessionListItem>> GetPagedAsync(TableSessionQuery query, CancellationToken ct = default);

    Task<TableSessionDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<CheckoutResultDto> CheckoutAsync(Guid id, CheckoutRequest request, CancellationToken ct = default);

    Task<TableSessionDto> TransferAsync(Guid id, TransferSessionRequest request, CancellationToken ct = default);
}

/// <summary>Yêu cầu từ bàn phía nhân viên (07 §2.10, FR-14).</summary>
public interface IServiceRequestService
{
    Task<IReadOnlyList<ServiceRequestDto>> GetPendingAsync(CancellationToken ct = default);

    Task<ServiceRequestDto> HandleAsync(Guid id, CancellationToken ct = default);
}
