using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Reports;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Reports;

/// <summary>
/// Tổng quan và báo cáo (07 §2.11). Gắn <c>reports.view</c>, không dùng <c>dashboard.view</c> của nền (07 §5 quyết định 1).
/// <c>from</c>, <c>to</c> dạng <c>yyyy-MM-dd</c> giờ Việt Nam; không gửi → 30 ngày tới hôm nay.
/// </summary>
[Route("api/reports")]
[AuthorizePermission(ProjectPermissions.Reports.View)]
public sealed class ReportsController(IReportService reportService) : BaseApiController
{
    [HttpGet("dashboard")]
    [ProducesResponseType<DashboardReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardReport>> Dashboard(CancellationToken ct) => Ok(await reportService.GetDashboardAsync(ct));

    [HttpGet("revenue")]
    [ProducesResponseType<RevenueReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RevenueReport>> Revenue([FromQuery] ReportQuery query, CancellationToken ct) =>
        Ok(await reportService.GetRevenueAsync(query, ct));

    [HttpGet("items")]
    [ProducesResponseType<ItemsReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ItemsReport>> Items([FromQuery] ReportQuery query, CancellationToken ct) =>
        Ok(await reportService.GetItemsAsync(query, ct));

    [HttpGet("operations")]
    [ProducesResponseType<OperationsReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OperationsReport>> Operations([FromQuery] ReportQuery query, CancellationToken ct) =>
        Ok(await reportService.GetOperationsAsync(query, ct));
}
