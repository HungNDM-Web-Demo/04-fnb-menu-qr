using System.Globalization;
using Domain.Enums.Pos.Menu;

namespace Domain.Entities.Pos;

/// <summary>
/// Hằng số nghiệp vụ cố định (06 §3, BE và FE cùng giá trị): không phải cài đặt, không đổi qua giao diện.
/// Giờ nhận đơn, chế độ xác nhận, tạm ngưng là cài đặt <c>Ordering.*</c> (xem <see cref="OrderingClock"/>).
/// </summary>
public static class PosRules
{
    /// <summary>BR-06: mỗi đơn tối đa 30 dòng.</summary>
    public const int MaxLinesPerOrder = 30;

    /// <summary>BR-03: số lượng mỗi dòng 1–20.</summary>
    public const int QuantityMin = 1;

    public const int QuantityMax = 20;

    /// <summary>BR-06: mỗi bàn tối đa 3 đơn chờ xác nhận.</summary>
    public const int MaxPendingOrdersPerTable = 3;

    /// <summary>BR-06: cùng giỏ gửi lại trong 10 giây không tạo đơn mới.</summary>
    public static readonly TimeSpan SameCartWindow = TimeSpan.FromSeconds(10);

    /// <summary>BR-12: gọi nhân viên lặp (cùng lý do) trong 60 giây.</summary>
    public static readonly TimeSpan CallRepeatWindow = TimeSpan.FromSeconds(60);

    /// <summary>BR-12: yêu cầu chờ từ 3 phút chuyển đỏ.</summary>
    public const int RequestOverdueMinutes = 3;

    /// <summary>BR-09: đơn chờ xác nhận từ 5 phút vàng, 10 phút đỏ.</summary>
    public const int PendingWarnMinutes = 5;

    public const int PendingLateMinutes = 10;

    /// <summary>07 §5 quyết định 13: đơn chờ phục vụ từ 15 phút vàng, 25 phút đỏ (tính từ lúc xác nhận).</summary>
    public const int ServingWarnMinutes = 15;

    public const int ServingLateMinutes = 25;

    /// <summary>Hoàn tác "Đã phục vụ" trong 60 giây phía máy chủ (07 §5 quyết định 32).</summary>
    public static readonly TimeSpan UnserveWindow = TimeSpan.FromSeconds(60);

    /// <summary>Khách xem phiên vừa kết thúc, yêu cầu của mình trong 4 giờ.</summary>
    public static readonly TimeSpan GuestHistoryWindow = TimeSpan.FromHours(4);

    /// <summary>BR-17: sức chứa 1–20.</summary>
    public const int CapacityMin = 1;

    public const int CapacityMax = 20;

    /// <summary>Bước đánh lại thứ tự khi sắp xếp: 10, 20, 30…</summary>
    public const int SortOrderStep = 10;

    /// <summary>BR-01: mã bàn 6 ký tự, A–Z bỏ O, I, L và 2–9.</summary>
    public const string TableCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public const int TableCodeLength = 6;

    /// <summary>Nhóm chọn nhiều tối đa 1–10 lựa chọn (BR-04).</summary>
    public const int MaxSelectLimit = 10;

    /// <summary>Độ dài ghi chú, tên gọi (07 §2.13).</summary>
    public const int GuestNameMaxLength = 30;

    public const int OrderNoteMaxLength = 200;
    public const int LineNoteMaxLength = 100;
    public const int ReasonMaxLength = 200;

    /// <summary>Giá món, giá cộng thêm là bội số 1.000 ₫ (BR-16).</summary>
    public static bool IsThousandMultiple(decimal amount) => amount % 1000m == 0;

    /// <summary>Hết hiệu lực khi có chế độ hết và (không có hạn hoặc chưa tới hạn) (07 §3.8).</summary>
    public static bool IsSoldOut(SoldOutMode? mode, DateTime? until, DateTime nowUtc) =>
        mode is not null && (until is null || nowUtc < until.Value);

    /// <summary>Mã bàn đúng BR-01.</summary>
    public static bool IsValidTableCode(string? code) =>
        code is { Length: TableCodeLength } && code.All(c => TableCodeAlphabet.Contains(c));

    /// <summary>Định dạng tiền trong câu thông báo, giống FE <c>formatVnd</c>: <c>68.000 ₫</c>.</summary>
    public static string FormatVnd(decimal amount) =>
        amount.ToString("#,0", CultureInfo.InvariantCulture).Replace(',', '.') + " ₫";
}
