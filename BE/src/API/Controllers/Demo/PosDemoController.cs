using API.Base;
using API.Filters;
using Application.DTOs.Tables;
using Application.Interfaces.Services.Tables;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Demo;

/// <summary>Bổ sung cho <c>/api/demo</c> của Menu QR (07 §2.12, §4.2). Chỉ có khi <c>DEMO_MODE=true</c>.</summary>
[Route("api/demo")]
[DemoOnly]
public sealed class PosDemoController(ITableService tableService, IOrderSettingsService orderSettingsService) : BaseApiController
{
    /// <summary>Bàn chưa xóa kèm mã, trạng thái cho lối vào "Xem như khách" ở trang đăng nhập.</summary>
    [HttpGet("guest-tables")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<GuestTableLink>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<GuestTableLink>>> GetGuestTables(CancellationToken ct) => Ok(await tableService.GetGuestLinksAsync(ct));

    /// <summary>Nhận đơn cả ngày (<c>Ordering.OpenTime = Ordering.CloseTime = "00:00"</c>) và bỏ tạm ngưng.</summary>
    [HttpPost("ordering-all-day")]
    [ProducesResponseType<OrderingStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderingStatusDto>> OrderingAllDay(CancellationToken ct) => Ok(await orderSettingsService.AcceptAllDayAsync(ct));
}
