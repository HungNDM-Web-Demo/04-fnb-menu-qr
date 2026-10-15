using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>
/// Phiên bàn, cũng là hóa đơn khi đóng (bảng <c>Pos_TableSessions</c>, BR-02, BR-11, BR-13). <see cref="Version"/> tăng khi
/// tạm tính hoặc trạng thái có thể đổi (07 §3.6), thu tiền và chuyển bàn gửi kèm để chặn thao tác trên số cũ.
/// </summary>
public class TableSession : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int TableNameMaxLength = 50;
    public const int UserNameMaxLength = 150;
    public const int KeyMaxLength = 64;

    private TableSession()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid TableId { get; private set; }
    public string TableName { get; private set; } = string.Empty;
    public string? TransferredFromTableName { get; private set; }
    public SessionStatus Status { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public decimal? Total { get; private set; }
    public PaymentMethod? PaymentMethod { get; private set; }
    public decimal? CashReceived { get; private set; }
    public decimal? ChangeAmount { get; private set; }
    public bool NeedVatInvoice { get; private set; }
    public Guid? ClosedById { get; private set; }
    public string? ClosedByName { get; private set; }
    public string? CheckoutRequestId { get; private set; }
    public int Version { get; private set; } = 1;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<Order> Orders { get; private set; } = [];

    public bool IsOpen => Status is SessionStatus.DangPhucVu or SessionStatus.ChoThanhToan;

    public static TableSession Open(string code, Guid tableId, string tableName, DateTime openedAt) => new()
    {
        Code = code,
        TableId = tableId,
        TableName = tableName,
        Status = SessionStatus.DangPhucVu,
        OpenedAt = openedAt
    };

    /// <summary>Tạm tính hoặc trạng thái có thể đổi (07 §3.6).</summary>
    public void Touch() => Version++;

    /// <summary>Có yêu cầu thanh toán đang chờ (BR-12).</summary>
    public void MarkPaymentRequested()
    {
        EnsureOpen();
        Status = SessionStatus.ChoThanhToan;
        Version++;
    }

    /// <summary>Bàn gửi thêm đơn khi đang chờ thanh toán: về "Đang phục vụ" (BR-12, UC-04 E3).</summary>
    public void ResumeServing()
    {
        EnsureOpen();
        Status = SessionStatus.DangPhucVu;
        Version++;
    }

    /// <summary>Thu tiền, đóng phiên (FR-23): chốt <see cref="Total"/> bằng tạm tính lúc đóng.</summary>
    public void Close(
        decimal total, PaymentMethod method, decimal? cashReceived, bool needVatInvoice, DateTime atUtc, Guid? userId, string? userName,
        string? checkoutRequestId)
    {
        EnsureOpen();
        Status = SessionStatus.DaDong;
        Total = total;
        PaymentMethod = method;
        CashReceived = method == Enums.Pos.Orders.PaymentMethod.TienMat ? cashReceived ?? total : null;
        ChangeAmount = CashReceived is { } cash ? OrderPricing.Change(cash, total) : null;
        NeedVatInvoice = needVatInvoice;
        ClosedAt = atUtc;
        ClosedById = userId;
        ClosedByName = userName;
        CheckoutRequestId = checkoutRequestId;
        Version++;
    }

    /// <summary>Mọi đơn bị từ chối: phiên tự hủy, không tính doanh thu (BR-02).</summary>
    public void CancelAutomatically(DateTime atUtc)
    {
        EnsureOpen();
        Status = SessionStatus.DaHuy;
        ClosedAt = atUtc;
        Version++;
    }

    /// <summary>Chuyển bàn (BR-18): giữ mã phiên, ghi bàn cũ.</summary>
    public void TransferTo(Guid tableId, string tableName)
    {
        EnsureOpen();
        TransferredFromTableName = TableName;
        TableId = tableId;
        TableName = tableName;
        Version++;
    }

    private void EnsureOpen()
    {
        if (!IsOpen)
            throw PosErrors.SessionClosed();
    }
}
