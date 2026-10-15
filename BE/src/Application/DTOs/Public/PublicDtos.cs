using Application.DTOs.Orders;
using Application.DTOs.Tables;
using Domain.Enums.Pos.Menu;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;

namespace Application.DTOs.Public;

// API công khai cho trang khách (07 §2.7). Mọi phản hồi chỉ chứa dữ liệu của bàn đó và phiên của bàn đó (NFR-04).

public sealed class PublicStoreInfo
{
    public string Name { get; init; } = string.Empty;
    public string? Tagline { get; init; }
    public string LogoUrl { get; init; } = string.Empty;
    public string PrimaryColor { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string BankBin { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
}

public sealed class PublicTableBrief
{
    public string Name { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed class PublicTableInfo
{
    public PublicTableBrief Table { get; init; } = new();
    public PublicStoreInfo Store { get; init; } = new();
    public OrderingStatusDto Ordering { get; init; } = new();
    public string MenuStamp { get; init; } = string.Empty;
    public DateTime AsOf { get; init; }
}

public sealed class PublicChoice
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public decimal Price { get; init; }
    public bool IsDefault { get; init; }
    public bool IsSoldOut { get; init; }
}

public sealed class PublicOptionGroup
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public SelectionType SelectionType { get; init; }
    public bool IsRequired { get; init; }
    public int MaxSelect { get; init; }
    public IReadOnlyList<PublicChoice> Choices { get; init; } = [];
}

public sealed class PublicMenuItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public string? Description { get; init; }
    public string? DescriptionEn { get; init; }
    public string? ImageUrl { get; init; }
    public string Unit { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public IReadOnlyList<MenuTag> Tags { get; init; } = [];
    public IReadOnlyList<Guid> OptionGroupIds { get; init; } = [];
    public bool IsSoldOut { get; init; }
}

public sealed class PublicCategory
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public int SortOrder { get; init; }
}

public sealed class PublicMenu
{
    /// <summary>Đổi khi thực đơn đổi hoặc qua 00:00 (07 §3.8).</summary>
    public string Stamp { get; init; } = string.Empty;

    public IReadOnlyList<PublicCategory> Categories { get; init; } = [];
    public IReadOnlyList<PublicMenuItem> Items { get; init; } = [];
    public IReadOnlyList<PublicOptionGroup> OptionGroups { get; init; } = [];
}

public sealed class PublicOrderItemOption
{
    public string GroupName { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public sealed class PublicOrderItemView
{
    public string ItemName { get; init; } = string.Empty;
    public IReadOnlyList<PublicOrderItemOption> Options { get; init; } = [];
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
    public string? Note { get; init; }
    public OrderItemStatus Status { get; init; }
    public string? StatusText { get; init; }
}

public sealed class PublicOrderView
{
    public string Code { get; init; } = string.Empty;
    public OrderSource Source { get; init; }
    public OrderStatus Status { get; init; }
    public bool AutoConfirmed { get; init; }
    public string? GuestName { get; init; }
    public string? Note { get; init; }
    public DateTime SubmittedAt { get; init; }
    public DateTime? HandledAt { get; init; }
    public string? RejectText { get; init; }
    public decimal Total { get; init; }
    public bool IsMine { get; init; }
    public IReadOnlyList<PublicOrderItemView> Items { get; init; } = [];
}

public sealed class PublicSessionView
{
    public string Code { get; init; } = string.Empty;
    public SessionStatus Status { get; init; }
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }

    /// <summary>BR-11.</summary>
    public decimal Subtotal { get; init; }

    /// <summary>Đơn chờ xác nhận, chưa tính (UC-03 E2).</summary>
    public decimal PendingTotal { get; init; }

    /// <summary>Mới nhất trước.</summary>
    public IReadOnlyList<PublicOrderView> Orders { get; init; } = [];

    public PaymentRequestBrief? PaymentRequest { get; init; }

    /// <summary>BR-18.</summary>
    public string? TransferredToTableName { get; init; }
}

public sealed class PublicServiceRequestView
{
    public Guid Id { get; init; }
    public ServiceRequestType Type { get; init; }
    public string ReasonText { get; init; } = string.Empty;
    public ServiceRequestStatus Status { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? HandledAt { get; init; }
}

public sealed class PublicLiveTable
{
    public string Name { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed class PublicLiveState
{
    public DateTime AsOf { get; init; }
    public PublicLiveTable Table { get; init; } = new();
    public OrderingStatusDto Ordering { get; init; } = new();
    public string MenuStamp { get; init; } = string.Empty;

    /// <summary>Phiên đang mở của bàn.</summary>
    public PublicSessionView? Session { get; init; }

    /// <summary>Phiên <c>knownSession</c> nếu đã đóng, tự hủy hoặc chuyển bàn trong 4 giờ qua.</summary>
    public PublicSessionView? EndedSession { get; init; }

    /// <summary>Của <c>X-Device-Id</c> trong 4 giờ qua, mới nhất trước.</summary>
    public IReadOnlyList<PublicServiceRequestView> MyRequests { get; init; } = [];
}

public sealed class PublicSubmitOrderRequest
{
    public string ClientRequestId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string? GuestName { get; set; }
    public string? Note { get; set; }
    public List<CartLineInput> Lines { get; set; } = [];
}

public sealed class PublicSubmitOrderResult
{
    public PublicOrderView Order { get; init; } = new();
    public string SessionCode { get; init; } = string.Empty;
    public bool Duplicate { get; init; }
}

public sealed class PublicServiceRequestInput
{
    public string ClientRequestId { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public ServiceRequestType Type { get; set; }
    public CallReason? Reason { get; set; }
    public string? Note { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public bool? NeedVatInvoice { get; set; }
}

public sealed class PublicServiceRequestResult
{
    public PublicServiceRequestView Request { get; init; } = new();
    public bool Duplicate { get; init; }
}

public sealed class PriceChange
{
    public int Index { get; init; }
    public Guid MenuItemId { get; init; }
    public string ItemName { get; init; } = string.Empty;
    public decimal OldUnitPrice { get; init; }
    public decimal NewUnitPrice { get; init; }
}
