using Application.Common.Models;
using Application.DTOs.Orders;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Tables;

namespace Application.DTOs.Sessions;

// Phiên bàn và thu tiền (07 §2.9).

public sealed class TableBoardSession
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public SessionStatus Status { get; init; }
    public DateTime OpenedAt { get; init; }

    /// <summary>Đơn không bị từ chối.</summary>
    public int OrderCount { get; init; }

    public decimal Subtotal { get; init; }
    public int PendingOrderCount { get; init; }
    public int UnservedCount { get; init; }
    public PaymentRequestBrief? PaymentRequest { get; init; }
}

public sealed class TableBoardItem
{
    public Guid TableId { get; init; }
    public string TableName { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public int Capacity { get; init; }
    public string Code { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public TableStatus Status { get; init; }
    public TableBoardSession? Session { get; init; }
    public int PendingRequestCount { get; init; }
}

public sealed class SessionPaymentDto
{
    public PaymentMethod Method { get; init; }
    public decimal Total { get; init; }
    public decimal? CashReceived { get; init; }
    public decimal? ChangeAmount { get; init; }
    public bool NeedVatInvoice { get; init; }
    public DateTime ClosedAt { get; init; }
    public string ClosedByName { get; init; } = string.Empty;
}

public sealed class SessionCounts
{
    public int PendingOrders { get; init; }
    public int UnservedItems { get; init; }
}

public sealed class TableSessionDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid TableId { get; init; }
    public string TableName { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public SessionStatus Status { get; init; }
    public int Version { get; init; }
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public decimal Subtotal { get; init; }
    public decimal PendingTotal { get; init; }

    /// <summary>Giờ gửi tăng dần.</summary>
    public IReadOnlyList<StaffOrderDto> Orders { get; init; } = [];

    public SessionCounts Counts { get; init; } = new();
    public PaymentRequestBrief? PaymentRequest { get; init; }
    public SessionPaymentDto? Payment { get; init; }

    /// <summary>Yêu cầu của phiên, mới nhất trước.</summary>
    public IReadOnlyList<ServiceRequestDto> Requests { get; init; } = [];

    public string? TransferredFromTableName { get; init; }
    public DateTime AsOf { get; init; }
}

public sealed class TableSessionListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string TableName { get; init; } = string.Empty;
    public SessionStatus Status { get; init; }
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public decimal Total { get; init; }
    public int OrderCount { get; init; }
    public PaymentMethod? Method { get; init; }
    public string? ClosedByName { get; init; }
}

public sealed class TableSessionQuery : PaginationQuery
{
    /// <summary><c>yyyy-MM-dd</c> giờ Việt Nam, lọc theo giờ mở phiên; không gửi thì hôm nay.</summary>
    public string? From { get; set; }

    public string? To { get; set; }
    public SessionStatus? Status { get; set; }
}

public sealed class CheckoutRequest
{
    public string ClientRequestId { get; set; } = string.Empty;
    public int Version { get; set; }
    public PaymentMethod Method { get; set; }

    /// <summary>Bắt buộc với tiền mặt.</summary>
    public decimal? CashReceived { get; set; }

    /// <summary>Vắng = theo yêu cầu thanh toán.</summary>
    public bool? NeedVatInvoice { get; set; }

    /// <summary>Đã xác nhận cảnh báo món chưa phục vụ.</summary>
    public bool? AcknowledgeUnserved { get; set; }
}

public sealed class CheckoutResultDto
{
    public TableSessionDto Session { get; init; } = new();
    public decimal ChangeAmount { get; init; }
    public bool Duplicate { get; init; }
}

public sealed class TransferSessionRequest
{
    public Guid TargetTableId { get; set; }
    public int Version { get; set; }
}
