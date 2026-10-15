using Application.DTOs.Reports;

namespace Application.Interfaces.Services.Reports;

/// <summary>Tổng quan và báo cáo (07 §2.11, FR-01, FR-35–FR-37, BR-19).</summary>
public interface IReportService
{
    Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default);

    Task<RevenueReport> GetRevenueAsync(ReportQuery query, CancellationToken ct = default);

    Task<ItemsReport> GetItemsAsync(ReportQuery query, CancellationToken ct = default);

    Task<OperationsReport> GetOperationsAsync(ReportQuery query, CancellationToken ct = default);
}
