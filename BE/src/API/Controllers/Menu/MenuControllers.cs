using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Menu;
using Application.Interfaces.Services.Menu;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Menu;

/// <summary>Thực đơn gộp cho Gọi món hộ (07 §2.1, SCR-07).</summary>
[Route("api/menu")]
public sealed class MenuController(IMenuQueryService menuService) : BaseApiController
{
    /// <summary>Danh mục, món, nhóm tùy chọn chưa ẩn trong một lần gọi; món hết vẫn trả để hiện mờ.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.Create, ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<MenuBundle>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuBundle>> Get(CancellationToken ct) => Ok(await menuService.GetBundleAsync(ct));
}

/// <summary>Danh mục món (07 §2.2, FR-26).</summary>
[Route("api/categories")]
public sealed class CategoriesController(ICategoryService categoryService) : BaseApiController
{
    /// <summary>Tất cả (kể cả ẩn), theo <c>sortOrder</c>.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<IReadOnlyList<CategoryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken ct) => Ok(await categoryService.GetListAsync(ct));

    /// <summary>Thêm danh mục, xếp cuối. Trùng mã → 409 <c>errors.code</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.MenuItems.Create)]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryRequest request, CancellationToken ct)
    {
        var item = await categoryService.CreateAsync(request, ct);
        return Created($"/api/categories/{item.Id}", item);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, SaveCategoryRequest request, CancellationToken ct) =>
        Ok(await categoryService.UpdateAsync(id, request, ct));

    /// <summary>Đủ mọi danh mục theo thứ tự mới, đánh lại 10, 20, 30…; thiếu, thừa id → 400 <c>errors.ids</c>.</summary>
    [HttpPut("order")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder(ReorderRequest request, CancellationToken ct)
    {
        await categoryService.ReorderAsync(request, ct);
        return NoContent();
    }

    /// <summary>Còn món → 400 <c>DanhMucConMon</c> kèm <c>itemCount</c>.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await categoryService.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Món (07 §2.3, UC-09, UC-10).</summary>
[Route("api/menu-items")]
public sealed class MenuItemsController(IMenuItemService menuItemService) : BaseApiController
{
    /// <summary><c>search</c> theo mã, tên (không dấu); mặc định theo (thứ tự danh mục, <c>sortOrder</c>).</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<PaginatedResult<MenuItemDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<MenuItemDto>>> GetPaged([FromQuery] MenuItemQuery query, CancellationToken ct) =>
        Ok(await menuItemService.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuItemDto>> GetById(Guid id, CancellationToken ct) => Ok(await menuItemService.GetByIdAsync(id, ct));

    /// <summary>Trùng mã → 409 <c>errors.code</c> (UC-09 E1).</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.MenuItems.Create)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<MenuItemDto>> Create(SaveMenuItemRequest request, CancellationToken ct)
    {
        var item = await menuItemService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    /// <summary>Đơn đã gửi giữ giá cũ (UC-09 3a); phát <c>menu-changed</c>.</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuItemDto>> Update(Guid id, SaveMenuItemRequest request, CancellationToken ct) =>
        Ok(await menuItemService.UpdateAsync(id, request, ct));

    /// <summary>Báo hết, bán lại (UC-10): <c>HetHomNay</c> hết tới 00:00 ngày mai giờ Việt Nam.</summary>
    [HttpPatch("{id:guid}/availability")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Availability)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetAvailability(Guid id, SetAvailabilityRequest request, CancellationToken ct)
    {
        await menuItemService.SetAvailabilityAsync(id, request, ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/hidden")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetHidden(Guid id, SetHiddenRequest request, CancellationToken ct)
    {
        await menuItemService.SetHiddenAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Multipart field <c>file</c>, JPG/PNG/WebP tối đa 2 MB.</summary>
    [HttpPost("{id:guid}/image")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadLimits.MaxImageRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadLimits.MaxImageRequestBytes)]
    [ProducesResponseType<MenuItemImageResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuItemImageResult>> UploadImage(Guid id, IFormFile? file, CancellationToken ct)
    {
        await using var content = file?.OpenReadStream() ?? Stream.Null;
        return Ok(await menuItemService.UploadImageAsync(id, content, file?.Length ?? 0, ct));
    }

    /// <summary><c>{ categoryId, ids }</c> đủ món của danh mục.</summary>
    [HttpPut("order")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder(ReorderMenuItemsRequest request, CancellationToken ct)
    {
        await menuItemService.ReorderAsync(request, ct);
        return NoContent();
    }

    /// <summary>Đã từng được gọi → 400 <c>MonDaDuocGoi</c> (BR-16, TC-33).</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await menuItemService.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Nhóm tùy chọn dùng chung (07 §2.4, FR-28, FR-30).</summary>
[Route("api/option-groups")]
public sealed class OptionGroupsController(IOptionGroupService optionGroupService) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<IReadOnlyList<OptionGroupDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<OptionGroupDto>>> GetAll(CancellationToken ct) => Ok(await optionGroupService.GetListAsync(ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.MenuItems.Create)]
    [ProducesResponseType<OptionGroupDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<OptionGroupDto>> Create(SaveOptionGroupRequest request, CancellationToken ct)
    {
        var group = await optionGroupService.CreateAsync(request, ct);
        return Created($"/api/option-groups/{group.Id}", group);
    }

    /// <summary>Thay cả bộ lựa chọn: có <c>id</c> thì sửa, không có thì thêm, vắng mặt thì xóa mềm.</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType<OptionGroupDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OptionGroupDto>> Update(Guid id, SaveOptionGroupRequest request, CancellationToken ct) =>
        Ok(await optionGroupService.UpdateAsync(id, request, ct));

    /// <summary>Lựa chọn hết áp cho mọi món dùng nhóm (FR-30, TC-35).</summary>
    [HttpPatch("{id:guid}/choices/{choiceId:guid}/availability")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Availability)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetChoiceAvailability(Guid id, Guid choiceId, SetAvailabilityRequest request, CancellationToken ct)
    {
        await optionGroupService.SetChoiceAvailabilityAsync(id, choiceId, request, ct);
        return NoContent();
    }

    /// <summary>Còn món gắn nhóm → 400 <c>NhomDangDung</c> kèm <c>itemCount</c>.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await optionGroupService.DeleteAsync(id, ct);
        return NoContent();
    }
}
