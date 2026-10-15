using Application.Common.Models;
using Application.DTOs.Menu;

namespace Application.Interfaces.Services.Menu;

/// <summary>Danh mục món (07 §2.2, FR-26).</summary>
public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetListAsync(CancellationToken ct = default);

    Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default);

    Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default);

    /// <summary>Đánh lại 10, 20, 30… theo thứ tự gửi lên; thiếu, thừa id → 400.</summary>
    Task ReorderAsync(ReorderRequest request, CancellationToken ct = default);

    /// <summary>Còn món chưa xóa → <c>DanhMucConMon</c>.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Món (07 §2.3, UC-09, UC-10).</summary>
public interface IMenuItemService
{
    Task<PaginatedResult<MenuItemDto>> GetPagedAsync(MenuItemQuery query, CancellationToken ct = default);

    Task<MenuItemDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<MenuItemDto> CreateAsync(SaveMenuItemRequest request, CancellationToken ct = default);

    Task<MenuItemDto> UpdateAsync(Guid id, SaveMenuItemRequest request, CancellationToken ct = default);

    Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default);

    Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default);

    Task<MenuItemImageResult> UploadImageAsync(Guid id, Stream content, long sizeBytes, CancellationToken ct = default);

    Task ReorderAsync(ReorderMenuItemsRequest request, CancellationToken ct = default);

    /// <summary>Đã từng được gọi → <c>MonDaDuocGoi</c> (BR-16, TC-33).</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Nhóm tùy chọn dùng chung (07 §2.4, FR-28, FR-30).</summary>
public interface IOptionGroupService
{
    Task<IReadOnlyList<OptionGroupDto>> GetListAsync(CancellationToken ct = default);

    Task<OptionGroupDto> CreateAsync(SaveOptionGroupRequest request, CancellationToken ct = default);

    Task<OptionGroupDto> UpdateAsync(Guid id, SaveOptionGroupRequest request, CancellationToken ct = default);

    Task SetChoiceAvailabilityAsync(Guid id, Guid choiceId, SetAvailabilityRequest request, CancellationToken ct = default);

    /// <summary>Còn món gắn nhóm → <c>NhomDangDung</c>.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Thực đơn gộp cho Gọi món hộ (07 §2.1).</summary>
public interface IMenuQueryService
{
    Task<MenuBundle> GetBundleAsync(CancellationToken ct = default);
}
