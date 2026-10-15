using API.Base;
using API.Filters;
using Application.DTOs.Public;
using Application.Interfaces.Services.Public;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Public;

/// <summary>
/// API công khai cho trang khách (07 §2.7). Khách không đăng nhập; mã bàn trong đường dẫn là thông tin xác thực duy nhất (BR-01):
/// sai, đã đổi → 404 <c>MaQrKhongHopLe</c>. Header <c>X-Device-Id</c> đánh dấu <c>isMine</c>, lọc <c>myRequests</c>.
/// Giới hạn tần suất theo IP + mã bàn: ghi 30, đọc 120 yêu cầu mỗi phút → 429 <c>QuaNhieuYeuCau</c>.
/// </summary>
[Route("api/public/tables/{code}")]
[AllowAnonymous]
[PosNotFoundCode]
public sealed class PublicTablesController(IPublicTableService publicService) : BaseApiController
{
    private const string DeviceHeader = "X-Device-Id";

    /// <summary>Bàn, quán, trạng thái nhận đơn (FR-02).</summary>
    [HttpGet]
    [PublicRateLimit(PublicRatePolicies.Read)]
    [ProducesResponseType<PublicTableInfo>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicTableInfo>> GetInfo(string code, CancellationToken ct) => Ok(await publicService.GetInfoAsync(code, ct));

    /// <summary>Thực đơn cho khách; header <c>ETag</c> = <c>stamp</c>, gửi <c>If-None-Match</c> trùng → 304.</summary>
    [HttpGet("menu")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    [ProducesResponseType<PublicMenu>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public async Task<ActionResult<PublicMenu>> GetMenu(string code, CancellationToken ct)
    {
        var stamp = await publicService.GetMenuStampAsync(code, ct);
        var etag = $"\"{stamp}\"";
        Response.Headers.ETag = etag;
        var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
        if (ifNoneMatch.Length > 0 && ifNoneMatch.Split(',').Select(v => v.Trim().Replace("W/", string.Empty).Trim('"')).Contains(stamp))
            return StatusCode(StatusCodes.Status304NotModified);

        return Ok(await publicService.GetMenuAsync(code, ct));
    }

    /// <summary>Trạng thái để hỏi lại mỗi 5 giây (FR-10, FR-14, FR-24).</summary>
    [HttpGet("live")]
    [PublicRateLimit(PublicRatePolicies.Read)]
    [ProducesResponseType<PublicLiveState>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicLiveState>> GetLive(string code, [FromQuery] string? knownSession, CancellationToken ct) =>
        Ok(await publicService.GetLiveAsync(code, Request.Headers[DeviceHeader].ToString(), knownSession, ct));

    /// <summary>Gửi đơn (FR-08): 201; trùng → 200 cùng kết quả, <c>duplicate = true</c>.</summary>
    [HttpPost("orders")]
    [PublicRateLimit(PublicRatePolicies.Write)]
    [ProducesResponseType<PublicSubmitOrderResult>(StatusCodes.Status201Created)]
    [ProducesResponseType<PublicSubmitOrderResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicSubmitOrderResult>> SubmitOrder(string code, PublicSubmitOrderRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId))
            request.DeviceId = Request.Headers[DeviceHeader].ToString();
        var outcome = await publicService.SubmitOrderAsync(code, request, ct);
        return outcome.Created ? StatusCode(StatusCodes.Status201Created, outcome.Value) : Ok(outcome.Value);
    }

    /// <summary>Gọi nhân viên, yêu cầu thanh toán (FR-11, FR-12): 201; trùng → 200, <c>duplicate = true</c>.</summary>
    [HttpPost("service-requests")]
    [PublicRateLimit(PublicRatePolicies.Write)]
    [ProducesResponseType<PublicServiceRequestResult>(StatusCodes.Status201Created)]
    [ProducesResponseType<PublicServiceRequestResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicServiceRequestResult>> SendRequest(string code, PublicServiceRequestInput request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId))
            request.DeviceId = Request.Headers[DeviceHeader].ToString();
        var outcome = await publicService.SendRequestAsync(code, request, ct);
        return outcome.Created ? StatusCode(StatusCodes.Status201Created, outcome.Value) : Ok(outcome.Value);
    }
}
