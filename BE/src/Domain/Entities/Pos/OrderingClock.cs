using System.Globalization;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos;

/// <summary>Trạng thái nhận đơn QR tại một thời điểm (07 §2.6 <c>OrderingStatus</c>, §3.4).</summary>
public sealed record OrderingState(
    bool Accepting,
    string? BlockReason,
    string? Message,
    string OpenTime,
    string CloseTime,
    DateTime? PausedUntil,
    bool PausedIndefinitely,
    ConfirmMode ConfirmMode,
    bool WithinHours);

/// <summary>
/// Giờ nhận đơn, tạm ngưng, chế độ xác nhận (BR-07, BR-08, 07 §3.4), đọc từ các khóa <c>Ordering.*</c> của System_Settings.
/// Giờ Việt Nam là UTC+7 cố định (không có giờ mùa hè). Thuần, không đọc DB.
/// </summary>
public static class OrderingClock
{
    public const string OpenTimeKey = "Ordering.OpenTime";
    public const string CloseTimeKey = "Ordering.CloseTime";
    public const string ConfirmModeKey = "Ordering.ConfirmMode";
    public const string PausedUntilKey = "Ordering.PausedUntil";

    /// <summary>Giá trị <c>Ordering.PausedUntil</c> khi tạm ngưng tới khi mở lại.</summary>
    public const string PausedManual = "manual";

    public const string DefaultOpenTime = "09:00";
    public const string DefaultCloseTime = "22:00";

    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    /// <summary>Đọc <c>HH:mm</c> (00:00–23:59) thành số phút trong ngày.</summary>
    public static bool TryParseTime(string? value, out int minutes)
    {
        minutes = 0;
        if (!TimeOnly.TryParseExact(value?.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return false;

        minutes = time.Hour * 60 + time.Minute;
        return true;
    }

    /// <summary>Đọc <c>Ordering.PausedUntil</c>: rỗng, <c>manual</c> hoặc thời điểm ISO.</summary>
    public static bool TryParsePausedUntil(string? value, out bool manual, out DateTime? until)
    {
        manual = false;
        until = null;
        var text = value?.Trim() ?? string.Empty;
        if (text.Length == 0)
            return true;
        if (string.Equals(text, PausedManual, StringComparison.OrdinalIgnoreCase))
        {
            manual = true;
            return true;
        }

        if (!DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
            return false;

        until = parsed.UtcDateTime;
        return true;
    }

    public static bool TryParseConfirmMode(string? value, out ConfirmMode mode) =>
        Enum.TryParse(value?.Trim(), ignoreCase: false, out mode) && Enum.IsDefined(mode);

    /// <summary>Giờ Việt Nam <c>HH:mm</c> của một thời điểm UTC.</summary>
    public static string VietnamHhmm(DateTime utc) =>
        DateTime.SpecifyKind(utc, DateTimeKind.Utc).Add(VietnamOffset).ToString("HH:mm", CultureInfo.InvariantCulture);

    /// <summary>
    /// <c>o == c</c>: nhận cả ngày; <c>o &lt; c</c>: <c>o ≤ m &lt; c</c>; <c>o &gt; c</c>: qua đêm <c>m ≥ o</c> hoặc <c>m &lt; c</c>.
    /// </summary>
    public static bool IsWithinHours(int openMinutes, int closeMinutes, DateTime nowUtc)
    {
        var local = DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc).Add(VietnamOffset);
        var m = local.Hour * 60 + local.Minute;
        if (openMinutes == closeMinutes)
            return true;
        return openMinutes < closeMinutes
            ? m >= openMinutes && m < closeMinutes
            : m >= openMinutes || m < closeMinutes;
    }

    /// <summary>Trạng thái nhận đơn; giá trị cài đặt sai thì dùng mặc định (09:00–22:00, tự xác nhận, không tạm ngưng).</summary>
    public static OrderingState Evaluate(string? openTime, string? closeTime, string? confirmMode, string? pausedUntil, DateTime nowUtc)
    {
        var open = TryParseTime(openTime, out var o) ? openTime!.Trim() : DefaultOpenTime;
        if (!TryParseTime(open, out o))
            o = 9 * 60;
        var close = TryParseTime(closeTime, out var c) ? closeTime!.Trim() : DefaultCloseTime;
        if (!TryParseTime(close, out c))
            c = 22 * 60;
        var mode = TryParseConfirmMode(confirmMode, out var parsedMode) ? parsedMode : ConfirmMode.TuXacNhan;
        TryParsePausedUntil(pausedUntil, out var manual, out var until);

        var paused = manual || (until is not null && nowUtc < until.Value);
        var within = IsWithinHours(o, c, nowUtc);
        string? reason = null, message = null;
        if (paused)
        {
            reason = PosErrors.QuanTamNgung;
            message = manual ? PosErrors.PausedIndefinitelyMessage : PosErrors.PausedUntilMessage(VietnamHhmm(until!.Value));
        }
        else if (!within)
        {
            reason = PosErrors.NgoaiGioNhanDon;
            message = PosErrors.OutOfHoursMessage(open, close);
        }

        return new OrderingState(
            Accepting: reason is null,
            BlockReason: reason,
            Message: message,
            OpenTime: open,
            CloseTime: close,
            PausedUntil: !manual && until is not null && nowUtc < until.Value ? until : null,
            PausedIndefinitely: manual,
            ConfirmMode: mode,
            WithinHours: within);
    }
}
