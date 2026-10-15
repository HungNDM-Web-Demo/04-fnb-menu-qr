using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Tables;
using Application.Interfaces.Services.Tables;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Tables;

/// <summary>Bàn và mã QR (07 §2.5, UC-11). Đường dẫn QR do FE ghép, API không trả URL.</summary>
[Route("api/tables")]
public sealed class TablesController(ITableService tableService) : BaseApiController
{
    /// <summary>Bàn chưa xóa, theo khu (thứ tự nhỏ nhất của khu) rồi <c>sortOrder</c>.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Tables.View)]
    [ProducesResponseType<IReadOnlyList<DiningTableDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DiningTableDto>>> GetAll(CancellationToken ct) => Ok(await tableService.GetListAsync(ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Tables.View)]
    [ProducesResponseType<DiningTableDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DiningTableDto>> GetById(Guid id, CancellationToken ct) => Ok(await tableService.GetByIdAsync(id, ct));

    /// <summary>Cấp mã 6 ký tự theo BR-01 (TC-37). Trùng tên → 409 <c>errors.name</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Tables.Create)]
    [ProducesResponseType<DiningTableDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<DiningTableDto>> Create(SaveTableRequest request, CancellationToken ct)
    {
        var table = await tableService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = table.Id }, table);
    }

    /// <summary>Tên, khu, sức chứa; mã giữ nguyên (UC-11 1a).</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Tables.Update)]
    [ProducesResponseType<DiningTableDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DiningTableDto>> Update(Guid id, SaveTableRequest request, CancellationToken ct) =>
        Ok(await tableService.UpdateAsync(id, request, ct));

    /// <summary>Bàn có phiên mở không tắt được → 400 <c>BanDangCoKhach</c> (TC-39).</summary>
    [HttpPatch("{id:guid}/active")]
    [AuthorizePermission(ProjectPermissions.Tables.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetActive(Guid id, SetTableActiveRequest request, CancellationToken ct)
    {
        await tableService.SetActiveAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Đổi mã QR, mã cũ hết hiệu lực ngay (FR-32, TC-38); bàn có phiên mở → <c>BanDangCoKhach</c>.</summary>
    [HttpPost("{id:guid}/regenerate-code")]
    [AuthorizePermission(ProjectPermissions.Tables.Update)]
    [ProducesResponseType<DiningTableDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DiningTableDto>> RegenerateCode(Guid id, CancellationToken ct) => Ok(await tableService.RegenerateCodeAsync(id, ct));

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Tables.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await tableService.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Cài đặt nhận đơn (07 §2.6, UC-13): giờ nhận đơn, chế độ xác nhận, tạm ngưng.</summary>
[Route("api/order-settings")]
public sealed class OrderSettingsController(IOrderSettingsService orderSettingsService) : BaseApiController
{
    /// <summary>Đã đăng nhập: thanh trạng thái màn nhận đơn, tab Cài đặt nhận đơn.</summary>
    [HttpGet]
    [ProducesResponseType<OrderingStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderingStatusDto>> Get(CancellationToken ct) => Ok(await orderSettingsService.GetAsync(ct));

    [HttpPut]
    [AuthorizePermission(ProjectPermissions.OrderSettings.Update)]
    [ProducesResponseType<OrderingStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderingStatusDto>> Update(UpdateOrderSettingsRequest request, CancellationToken ct) =>
        Ok(await orderSettingsService.UpdateAsync(request, ct));

    /// <summary><c>minutes</c> 15, 30 hoặc null (tới khi mở lại).</summary>
    [HttpPost("pause")]
    [AuthorizePermission(ProjectPermissions.OrderSettings.Update)]
    [ProducesResponseType<OrderingStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderingStatusDto>> Pause(PauseOrderingRequest request, CancellationToken ct) =>
        Ok(await orderSettingsService.PauseAsync(request, ct));

    [HttpPost("resume")]
    [AuthorizePermission(ProjectPermissions.OrderSettings.Update)]
    [ProducesResponseType<OrderingStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderingStatusDto>> Resume(CancellationToken ct) => Ok(await orderSettingsService.ResumeAsync(ct));
}

/// <summary>Thông tin quán cho bản in, QR chuyển khoản, khung xem trước (07 §2.6).</summary>
[Route("api/store-profile")]
public sealed class StoreProfileController(IStoreProfileService storeProfileService) : BaseApiController
{
    [HttpGet]
    [ProducesResponseType<StoreProfileDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StoreProfileDto>> Get(CancellationToken ct) => Ok(await storeProfileService.GetAsync(ct));
}
