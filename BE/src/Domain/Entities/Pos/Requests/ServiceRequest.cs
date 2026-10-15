using Domain.Base;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;

namespace Domain.Entities.Pos.Requests;

/// <summary>
/// Yêu cầu từ bàn: gọi nhân viên, yêu cầu thanh toán (bảng <c>Pos_ServiceRequests</c>, FR-11, FR-12, BR-12).
/// Giờ gửi là <see cref="BaseEntity.CreatedAt"/>.
/// </summary>
public class ServiceRequest : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int TableNameMaxLength = 50;
    public const int NoteMaxLength = 200;
    public const int UserNameMaxLength = 150;
    public const int KeyMaxLength = 64;

    private ServiceRequest()
    {
    }

    public Guid TableId { get; private set; }
    public string TableName { get; private set; } = string.Empty;
    public Guid? SessionId { get; private set; }
    public ServiceRequestType Type { get; private set; }
    public CallReason? Reason { get; private set; }
    public string? Note { get; private set; }
    public PaymentMethod? PaymentMethod { get; private set; }
    public bool NeedVatInvoice { get; private set; }
    public ServiceRequestStatus Status { get; private set; }
    public DateTime? HandledAt { get; private set; }
    public Guid? HandledById { get; private set; }
    public string? HandledByName { get; private set; }
    public bool AutoHandled { get; private set; }
    public string? DeviceId { get; private set; }
    public string? ClientRequestId { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static ServiceRequest CreateCall(Guid tableId, string tableName, Guid? sessionId, CallReason reason, string? note, string? deviceId, string? clientRequestId) =>
        new()
        {
            TableId = tableId,
            TableName = tableName,
            SessionId = sessionId,
            Type = ServiceRequestType.GoiNhanVien,
            Reason = reason,
            Note = Clean(note),
            Status = ServiceRequestStatus.DangCho,
            DeviceId = Clean(deviceId),
            ClientRequestId = Clean(clientRequestId)
        };

    public static ServiceRequest CreatePayment(Guid tableId, string tableName, Guid sessionId, PaymentMethod method, bool needVatInvoice, string? deviceId, string? clientRequestId) =>
        new()
        {
            TableId = tableId,
            TableName = tableName,
            SessionId = sessionId,
            Type = ServiceRequestType.ThanhToan,
            PaymentMethod = method,
            NeedVatInvoice = needVatInvoice,
            Status = ServiceRequestStatus.DangCho,
            DeviceId = Clean(deviceId),
            ClientRequestId = Clean(clientRequestId)
        };

    public bool IsPending => Status == ServiceRequestStatus.DangCho;

    /// <summary>Nhân viên bấm "Đã xử lý", hoặc tự xử lý khi đóng phiên (<paramref name="auto"/>, BR-13).</summary>
    public void Handle(DateTime atUtc, Guid? userId, string? userName, bool auto = false)
    {
        if (!IsPending)
            return;
        Status = ServiceRequestStatus.DaXuLy;
        HandledAt = atUtc;
        HandledById = userId;
        HandledByName = userName;
        AutoHandled = auto;
    }

    /// <summary>Yêu cầu thanh toán tự hủy khi bàn gửi thêm đơn (BR-12).</summary>
    public void CancelAutomatically(DateTime atUtc)
    {
        if (!IsPending)
            return;
        Status = ServiceRequestStatus.DaHuy;
        HandledAt = atUtc;
    }

    /// <summary>Khách gửi lại yêu cầu thanh toán khi đã có yêu cầu đang chờ: cập nhật phương thức, cờ HĐ GTGT.</summary>
    public void UpdatePayment(PaymentMethod method, bool needVatInvoice)
    {
        PaymentMethod = method;
        NeedVatInvoice = needVatInvoice;
    }

    /// <summary>Chuyển bàn: yêu cầu đang chờ của phiên chuyển theo.</summary>
    public void MoveToTable(Guid tableId, string tableName)
    {
        TableId = tableId;
        TableName = tableName;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
