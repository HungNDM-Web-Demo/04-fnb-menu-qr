using Application.Common.Time;
using Infrastructure.Extensions;

namespace Infrastructure.Implementations.Services.Pos;

/// <summary>
/// Tham số ngày <c>from</c>, <c>to</c> dạng <c>yyyy-MM-dd</c> giờ Việt Nam (07 §2): 00:00 <c>from</c> tới hết ngày <c>to</c>;
/// khoảng dài hơn 366 ngày hoặc <c>to</c> trước <c>from</c> báo lỗi theo trường.
/// </summary>
internal static class PosDates
{
    public const int MaxRangeDays = 366;

    public static (DateOnly From, DateOnly To) Dates(string? from, string? to, DateOnly defaultFrom, DateOnly defaultTo)
    {
        var fromDate = defaultFrom;
        var toDate = defaultTo;
        if (!string.IsNullOrWhiteSpace(from) && !VietnamDates.TryParse(from, out fromDate))
            throw FieldErrors.Single("from", "Ngày dạng yyyy-MM-dd");
        if (!string.IsNullOrWhiteSpace(to) && !VietnamDates.TryParse(to, out toDate))
            throw FieldErrors.Single("to", "Ngày dạng yyyy-MM-dd");
        if (string.IsNullOrWhiteSpace(to) && !string.IsNullOrWhiteSpace(from) && toDate < fromDate)
            toDate = fromDate;
        if (toDate < fromDate)
            throw FieldErrors.Single("to", "Ngày kết thúc phải sau ngày bắt đầu");
        if (toDate.DayNumber - fromDate.DayNumber + 1 > MaxRangeDays)
            throw FieldErrors.Single("from", "Khoảng ngày tối đa 366 ngày");
        return (fromDate, toDate);
    }

    /// <summary>Mốc UTC: 00:00 ngày đầu, 00:00 ngày sau ngày cuối (không gồm).</summary>
    public static (DateTime FromUtc, DateTime ToUtcExclusive) Range(string? from, string? to, DateOnly defaultFrom, DateOnly defaultTo)
    {
        var (fromDate, toDate) = Dates(from, to, defaultFrom, defaultTo);
        return (VietnamDates.StartOfDayUtc(fromDate), VietnamDates.EndOfDayExclusiveUtc(toDate));
    }
}
