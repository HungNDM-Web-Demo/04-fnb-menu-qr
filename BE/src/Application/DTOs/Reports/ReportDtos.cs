using Domain.Enums.Pos.Orders;

namespace Application.DTOs.Reports;

// Báo cáo (07 §2.11). Doanh thu chỉ tính phiên DaDong theo closedAt (BR-19).

public sealed class ReportQuery
{
    /// <summary><c>yyyy-MM-dd</c> giờ Việt Nam; không gửi cả hai thì 30 ngày tới hôm nay.</summary>
    public string? From { get; set; }

    public string? To { get; set; }
    public Guid? CategoryId { get; set; }
}

public sealed class HourStat
{
    public int Hour { get; init; }
    public int Orders { get; init; }
    public decimal Revenue { get; init; }
}

public sealed class DashboardReport
{
    public string Date { get; init; } = string.Empty;
    public DateTime AsOf { get; init; }
    public int OpenSessions { get; init; }
    public int ActiveTables { get; init; }
    public int PendingOrders { get; init; }
    public int PendingRequests { get; init; }
    public int OverdueRequests { get; init; }
    public decimal Revenue { get; init; }
    public int ClosedSessions { get; init; }
    public decimal AvgSessionValue { get; init; }
    public double? AvgConfirmMinutes { get; init; }
    public IReadOnlyList<HourStat> ByHour { get; init; } = [];
}

public class RevenueTotals
{
    public decimal Revenue { get; init; }
    public int SessionCount { get; init; }
    public int OrderCount { get; init; }
    public decimal AvgSessionValue { get; init; }
}

public sealed class RevenuePeriodTotals : RevenueTotals
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
}

public sealed class RevenueDay : RevenueTotals
{
    public string Date { get; init; } = string.Empty;
    public decimal PreviousRevenue { get; init; }
}

public sealed class RevenueReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public RevenueTotals Totals { get; init; } = new();
    public RevenuePeriodTotals Previous { get; init; } = new();
    public double? RevenueChangePercent { get; init; }
    public IReadOnlyList<RevenueDay> Daily { get; init; } = [];
}

public sealed class ItemSale
{
    public Guid MenuItemId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal Revenue { get; init; }
    public double Share { get; init; }
}

public sealed class ProblemReason
{
    /// <summary><c>BiBo</c> hoặc <c>DaHuy</c>.</summary>
    public string Kind { get; init; } = string.Empty;

    public string ReasonText { get; init; } = string.Empty;
    public int Quantity { get; init; }
}

public sealed class ItemProblem
{
    public Guid MenuItemId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int RemovedQty { get; init; }
    public int CancelledQty { get; init; }
    public decimal Value { get; init; }
    public IReadOnlyList<ProblemReason> Reasons { get; init; } = [];
}

public sealed class ReasonSummary
{
    public string Kind { get; init; } = string.Empty;
    public string ReasonText { get; init; } = string.Empty;
    public int LineCount { get; init; }
    public int Quantity { get; init; }
    public decimal Value { get; init; }
}

public sealed class ItemsReport
{
    public decimal TotalRevenue { get; init; }
    public IReadOnlyList<ItemSale> Items { get; init; } = [];
    public IReadOnlyList<ItemProblem> Problems { get; init; } = [];
    public IReadOnlyList<ReasonSummary> ReasonSummary { get; init; } = [];
}

public sealed class RejectReasonStat
{
    public RejectReason Reason { get; init; }
    public string ReasonText { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class HourOrders
{
    public int Hour { get; init; }
    public int Orders { get; init; }
}

public sealed class HeatCell
{
    /// <summary>1 = Thứ Hai … 7 = Chủ nhật.</summary>
    public int Weekday { get; init; }

    public int Hour { get; init; }
    public int Orders { get; init; }
}

public sealed class OperationsReport
{
    public int OrderCount { get; init; }
    public int CustomerOrders { get; init; }
    public int StaffOrders { get; init; }
    public double SelfOrderRate { get; init; }
    public int AutoConfirmedOrders { get; init; }
    public double AutoConfirmRate { get; init; }
    public int RejectedOrders { get; init; }
    public double RejectRate { get; init; }
    public double? AvgConfirmMinutes { get; init; }
    public double? AvgRequestMinutes { get; init; }
    public int RequestCount { get; init; }
    public IReadOnlyList<RejectReasonStat> RejectReasons { get; init; } = [];
    public IReadOnlyList<HourOrders> ByHour { get; init; } = [];
    public IReadOnlyList<HeatCell> Heatmap { get; init; } = [];
}
