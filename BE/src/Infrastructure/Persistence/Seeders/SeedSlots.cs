namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Ánh xạ ô ngày lịch sử sang ngày thật (06 §5.3), cài giống hệt FE <c>dayOffsetOfSlot</c>: mỗi khối 7 ô (−1…−7, −8…−14…)
/// chứa đủ 7 "vai thứ" nên hàm là song ánh; ô có vai Thứ Sáu, Thứ Bảy, Chủ nhật rơi đúng ngày cuối tuần thật dù nạp vào ngày nào.
/// Hôm nay, tương lai và 5 ô lẻ −85…−89 giữ nguyên.
/// </summary>
public static class SeedSlots
{
    /// <param name="d">Ô ngày: −89…−1 lịch sử, 0 hôm nay, dương là tương lai.</param>
    /// <param name="isoToday">Thứ của hôm nay theo giờ Việt Nam, 1 = Thứ Hai … 7 = Chủ nhật.</param>
    /// <returns>Số ngày so với hôm nay.</returns>
    public static int DayOffsetOfSlot(int d, int isoToday)
    {
        if (d >= 0 || d < -84)
            return d;

        var block = (-d - 1) / 7;
        var role = (-d - 1) % 7;
        var @base = -(7 * block + 7);
        var baseIdx = (((isoToday - 1 + @base) % 7) + 7) % 7;
        return @base + (((role - baseIdx) % 7) + 7) % 7;
    }

    /// <summary>Thứ ISO (1 = Thứ Hai … 7 = Chủ nhật).</summary>
    public static int IsoDayOfWeek(DateOnly date) => date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
}
