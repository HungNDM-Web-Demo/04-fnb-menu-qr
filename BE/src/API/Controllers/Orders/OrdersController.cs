using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Services.Orders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace API.Controllers.Orders;

/// <summary>Đơn phía nhân viên (07 §2.8, UC-05…UC-07, UC-15). Thao tác đổi đơn trả 200 kèm DTO mới.</summary>
[Route("api/orders")]
public sealed class OrdersController(IOrderService orderService) : BaseApiController
{
    /// <summary>Cột "Chờ xác nhận" (giờ gửi tăng dần) và "Chờ phục vụ" (giờ xác nhận tăng dần).</summary>
    [HttpGet("live")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    [ProducesResponseType<LiveOrdersDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<LiveOrdersDto>> GetLive(CancellationToken ct) => Ok(await orderService.GetLiveAsync(ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> GetById(Guid id, CancellationToken ct) => Ok(await orderService.GetByIdAsync(id, ct));

    /// <summary>Gọi món hộ (FR-20, TC-26): 201; trùng <c>clientRequestId</c> → 200 đơn cũ.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Create(CreateStaffOrderRequest request, CancellationToken ct)
    {
        var outcome = await orderService.CreateAsync(request, ct);
        return outcome.Created ? CreatedAtAction(nameof(GetById), new { id = outcome.Value.Id }, outcome.Value) : Ok(outcome.Value);
    }

    /// <summary>Xác nhận kèm dòng bỏ (FR-16, TC-19); đã xử lý → 409 <c>DonDaXuLy</c> kèm <c>order</c>.</summary>
    [HttpPost("{id:guid}/confirm")]
    [AuthorizePermission(ProjectPermissions.Orders.Confirm)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Confirm(Guid id, ConfirmOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.ConfirmAsync(id, request, ct));

    /// <summary>Từ chối (FR-17, TC-21); mọi đơn của phiên bị từ chối thì phiên tự hủy.</summary>
    [HttpPost("{id:guid}/reject")]
    [AuthorizePermission(ProjectPermissions.Orders.Confirm)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Reject(Guid id, RejectOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.RejectAsync(id, request, ct));

    /// <summary>Phục vụ dòng hoặc cả đơn (vắng <c>itemIds</c>) (FR-19, TC-24).</summary>
    [HttpPost("{id:guid}/serve")]
    [AuthorizePermission(ProjectPermissions.Orders.Serve)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Serve(Guid id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ServeOrderRequest? request, CancellationToken ct) =>
        Ok(await orderService.ServeAsync(id, request ?? new ServeOrderRequest(), ct));

    /// <summary>Hoàn tác trong 60 giây từ <c>servedAt</c> (UC-06 2a).</summary>
    [HttpPost("{id:guid}/unserve")]
    [AuthorizePermission(ProjectPermissions.Orders.Serve)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Unserve(Guid id, UnserveOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.UnserveAsync(id, request, ct));

    /// <summary>Quản lý hủy món (FR-21, BR-15, TC-30); hủy một phần tách dòng.</summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/cancel")]
    [AuthorizePermission(ProjectPermissions.Orders.Cancel)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> CancelItem(Guid id, Guid itemId, CancelOrderItemRequest request, CancellationToken ct) =>
        Ok(await orderService.CancelItemAsync(id, itemId, request, ct));

    /// <summary>Hủy cả đơn (mọi dòng còn hiệu lực).</summary>
    [HttpPost("{id:guid}/cancel")]
    [AuthorizePermission(ProjectPermissions.Orders.Cancel)]
    [ProducesResponseType<StaffOrderDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StaffOrderDto>> Cancel(Guid id, CancelOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.CancelAsync(id, request, ct));
}
