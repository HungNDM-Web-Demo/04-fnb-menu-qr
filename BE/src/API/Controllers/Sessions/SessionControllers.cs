using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Orders;
using Application.DTOs.Sessions;
using Application.Interfaces.Services.Orders;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Sessions;

/// <summary>Phiên bàn và thu tiền (07 §2.9, UC-08, FR-22–FR-25).</summary>
[Route("api/table-sessions")]
public sealed class TableSessionsController(ITableSessionService sessionService) : BaseApiController
{
    /// <summary>Tab Bàn: mọi bàn chưa xóa kèm phiên đang mở (FR-22).</summary>
    [HttpGet("board")]
    [AuthorizePermission(ProjectPermissions.TableSessions.View)]
    [ProducesResponseType<IReadOnlyList<TableBoardItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TableBoardItem>>> GetBoard(CancellationToken ct) => Ok(await sessionService.GetBoardAsync(ct));

    /// <summary>Tra cứu phiên theo giờ mở (không gửi <c>from</c>, <c>to</c> → hôm nay); mặc định <c>openedAt desc</c>.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.TableSessions.View)]
    [ProducesResponseType<PaginatedResult<TableSessionListItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<TableSessionListItem>>> GetPaged([FromQuery] TableSessionQuery query, CancellationToken ct) =>
        Ok(await sessionService.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.TableSessions.View)]
    [ProducesResponseType<TableSessionDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TableSessionDto>> GetById(Guid id, CancellationToken ct) => Ok(await sessionService.GetByIdAsync(id, ct));

    /// <summary>Thu tiền, đóng phiên (FR-23): trùng <c>clientRequestId</c> → kết quả cũ; <c>version</c> lệch → 409 <c>DuLieuCu</c>.</summary>
    [HttpPost("{id:guid}/checkout")]
    [AuthorizePermission(ProjectPermissions.TableSessions.Checkout)]
    [ProducesResponseType<CheckoutResultDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CheckoutResultDto>> Checkout(Guid id, CheckoutRequest request, CancellationToken ct) =>
        Ok(await sessionService.CheckoutAsync(id, request, ct));

    /// <summary>Chuyển bàn (BR-18, P3).</summary>
    [HttpPost("{id:guid}/transfer")]
    [AuthorizePermission(ProjectPermissions.TableSessions.Transfer)]
    [ProducesResponseType<TableSessionDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TableSessionDto>> Transfer(Guid id, TransferSessionRequest request, CancellationToken ct) =>
        Ok(await sessionService.TransferAsync(id, request, ct));
}

/// <summary>Yêu cầu từ bàn (07 §2.10, FR-14).</summary>
[Route("api/service-requests")]
public sealed class ServiceRequestsController(IServiceRequestService requestService) : BaseApiController
{
    /// <summary>Yêu cầu đang chờ, giờ gửi tăng dần.</summary>
    [HttpGet("pending")]
    [AuthorizePermission(ProjectPermissions.ServiceRequests.View)]
    [ProducesResponseType<IReadOnlyList<ServiceRequestDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ServiceRequestDto>>> GetPending(CancellationToken ct) => Ok(await requestService.GetPendingAsync(ct));

    /// <summary>"Đã xử lý"; đã xử lý → 200 như cũ; đã hủy → 400 <c>YeuCauDaHuy</c>.</summary>
    [HttpPost("{id:guid}/handle")]
    [AuthorizePermission(ProjectPermissions.ServiceRequests.Update)]
    [ProducesResponseType<ServiceRequestDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ServiceRequestDto>> Handle(Guid id, CancellationToken ct) => Ok(await requestService.HandleAsync(id, ct));
}
