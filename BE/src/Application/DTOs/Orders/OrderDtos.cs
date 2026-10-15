using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;

namespace Application.DTOs.Orders;

// Đơn (nhân viên) 07 §2.8, phiên bàn và thu tiền §2.9, yêu cầu từ bàn §2.10.

public sealed class OrderItemOptionDto
{
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public Guid ChoiceId { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public sealed class OrderItemDto
{
    public Guid Id { get; init; }
    public Guid MenuItemId { get; init; }
    public string ItemCode { get; init; } = string.Empty;
    public string ItemName { get; init; } = string.Empty;
    public decimal ItemPrice { get; init; }
    public IReadOnlyList<OrderItemOptionDto> Options { get; init; } = [];
    public decimal OptionsPrice { get; init; }
    public decimal UnitPrice { get; init; }
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
    public string? Note { get; init; }
    public OrderItemStatus Status { get; init; }
    public RemoveReason? RemoveReason { get; init; }
    public string? RemoveNote { get; init; }
    public string? CancelReason { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancelledByName { get; init; }
    public DateTime? ServedAt { get; init; }
    public string? StatusText { get; init; }
    public int SortOrder { get; init; }
}

public sealed class StaffOrderDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid SessionId { get; init; }
    public string SessionCode { get; init; } = string.Empty;
    public Guid TableId { get; init; }
    public string TableName { get; init; } = string.Empty;
    public OrderSource Source { get; init; }
    public OrderStatus Status { get; init; }
    public bool AutoConfirmed { get; init; }
    public string? GuestName { get; init; }
    public string? Note { get; init; }
    public DateTime SubmittedAt { get; init; }
    public DateTime? HandledAt { get; init; }
    public string? HandledByName { get; init; }
    public RejectReason? RejectReason { get; init; }
    public string? RejectNote { get; init; }
    public string? RejectText { get; init; }
    public decimal Total { get; init; }

    /// <summary>Dòng còn hiệu lực.</summary>
    public int ItemCount { get; init; }

    /// <summary>Dòng <c>DaXacNhan</c>.</summary>
    public int UnservedCount { get; init; }

    public IReadOnlyList<OrderItemDto> Items { get; init; } = [];
    public int WaitMinutes { get; init; }
    public WaitLevel WaitLevel { get; init; }
    public DateTime AsOf { get; init; }
}

public sealed class LiveOrdersDto
{
    public DateTime AsOf { get; init; }
    public IReadOnlyList<StaffOrderDto> Pending { get; init; } = [];
    public IReadOnlyList<StaffOrderDto> Serving { get; init; } = [];
}

public sealed class RemovedItemInput
{
    public Guid ItemId { get; set; }
    public RemoveReason Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class ConfirmOrderRequest
{
    public List<RemovedItemInput> RemovedItems { get; set; } = [];
}

public sealed class RejectOrderRequest
{
    /// <summary>Bắt buộc; vắng → 400 <c>errors.reason</c> "Chọn lý do từ chối".</summary>
    public RejectReason? Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class ServeOrderRequest
{
    /// <summary>Vắng = mọi dòng <c>DaXacNhan</c> ("Phục vụ cả đơn").</summary>
    public List<Guid>? ItemIds { get; set; }
}

public sealed class UnserveOrderRequest
{
    public List<Guid> ItemIds { get; set; } = [];
}

public sealed class CancelOrderItemRequest
{
    public int Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class CancelOrderRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class CartLineInput
{
    public Guid MenuItemId { get; set; }
    public List<Guid> ChoiceIds { get; set; } = [];
    public int Quantity { get; set; }
    public string? Note { get; set; }

    /// <summary>Bắt buộc ở API công khai: giá món + lựa chọn khách đang thấy.</summary>
    public decimal? ExpectedUnitPrice { get; set; }
}

public sealed class CreateStaffOrderRequest
{
    public string ClientRequestId { get; set; } = string.Empty;
    public Guid TableId { get; set; }
    public string? GuestName { get; set; }
    public string? Note { get; set; }
    public List<CartLineInput> Lines { get; set; } = [];
}

public sealed class PaymentRequestBrief
{
    public Guid Id { get; init; }
    public PaymentMethod Method { get; init; }
    public bool NeedVatInvoice { get; init; }
    public DateTime CreatedAt { get; init; }
    public ServiceRequestStatus Status { get; init; }
}

public sealed class ServiceRequestDto
{
    public Guid Id { get; init; }
    public Guid TableId { get; init; }
    public string TableName { get; init; } = string.Empty;
    public Guid? SessionId { get; init; }
    public string? SessionCode { get; init; }
    public ServiceRequestType Type { get; init; }
    public CallReason? Reason { get; init; }
    public string? Note { get; init; }
    public PaymentMethod? PaymentMethod { get; init; }
    public bool NeedVatInvoice { get; init; }

    /// <summary>"Thêm đá"; "Thanh toán · Chuyển khoản · Cần HĐ GTGT".</summary>
    public string ReasonText { get; init; } = string.Empty;

    public ServiceRequestStatus Status { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? HandledAt { get; init; }
    public string? HandledByName { get; init; }
    public bool AutoHandled { get; init; }
    public int WaitMinutes { get; init; }

    /// <summary>Đang chờ từ 3 phút (BR-12).</summary>
    public bool IsOverdue { get; init; }
}
