using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;

namespace Application.Mappings.Orders;

/// <summary>
/// Chữ hiển thị đã ghép trả kèm DTO (07 §2): <c>statusText</c> của dòng bỏ, dòng hủy; <c>rejectText</c>; <c>reasonText</c> của yêu cầu.
/// Cùng chữ với FE <c>config/menu-qr-labels.ts</c>.
/// </summary>
public static class PosLabels
{
    public static string Of(RemoveReason reason) => reason switch
    {
        RemoveReason.HetMon => "Hết món",
        _ => "Khác"
    };

    public static string Of(RejectReason reason) => reason switch
    {
        RejectReason.BanKhongCoKhach => "Bàn không có khách",
        RejectReason.DonTrung => "Đơn trùng",
        RejectReason.HetMon => "Hết món",
        _ => "Khác"
    };

    public static string Of(CallReason reason) => reason switch
    {
        CallReason.ThemDa => "Thêm đá",
        CallReason.LayChenBat => "Lấy chén bát",
        CallReason.DonBan => "Dọn bàn",
        CallReason.TuVanMon => "Tư vấn món",
        _ => "Khác"
    };

    public static string Of(PaymentMethod method) => method == PaymentMethod.TienMat ? "Tiền mặt" : "Chuyển khoản";

    /// <summary>"Không phục vụ được: {Hết món | ghi chú}"; "Đã hủy: {lý do}".</summary>
    public static string? ItemStatusText(OrderItemStatus status, RemoveReason? removeReason, string? removeNote, string? cancelReason) => status switch
    {
        OrderItemStatus.BiBo => "Không phục vụ được: " + (removeReason == RemoveReason.Khac && !string.IsNullOrWhiteSpace(removeNote)
            ? removeNote
            : Of(removeReason ?? RemoveReason.HetMon)),
        OrderItemStatus.DaHuy => "Đã hủy: " + cancelReason,
        _ => null
    };

    /// <summary>"{tên lý do}" hoặc "Khác: {ghi chú}".</summary>
    public static string? RejectText(RejectReason? reason, string? note) => reason switch
    {
        null => null,
        RejectReason.Khac => string.IsNullOrWhiteSpace(note) ? "Khác" : $"Khác: {note}",
        _ => Of(reason.Value)
    };

    /// <summary>Gọi nhân viên "{lý do}" hoặc "Khác: {ghi chú}"; thanh toán "Thanh toán · {phương thức}" thêm " · Cần HĐ GTGT".</summary>
    public static string RequestText(ServiceRequestType type, CallReason? reason, string? note, PaymentMethod? method, bool needVat)
    {
        if (type == ServiceRequestType.ThanhToan)
            return $"Thanh toán · {Of(method ?? PaymentMethod.TienMat)}" + (needVat ? " · Cần HĐ GTGT" : string.Empty);

        if (reason == CallReason.Khac)
            return string.IsNullOrWhiteSpace(note) ? "Khác" : $"Khác: {note}";
        return Of(reason ?? CallReason.Khac);
    }
}
