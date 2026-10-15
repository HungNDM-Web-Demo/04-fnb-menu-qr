using Application.Common.Models;
using Domain.Enums.Pos.Menu;

namespace Application.DTOs.Menu;

// Thực đơn (07 §2.1–2.4): danh mục, món, nhóm tùy chọn, thực đơn gộp.

public sealed class CategoryDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsHidden { get; init; }

    /// <summary>Món chưa xóa, kể cả ẩn.</summary>
    public int ItemCount { get; init; }
}

public sealed class SaveCategoryRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string Color { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
}

public sealed class ReorderRequest
{
    public List<Guid> Ids { get; set; } = [];
}

public sealed class ReorderMenuItemsRequest
{
    public Guid CategoryId { get; set; }
    public List<Guid> Ids { get; set; } = [];
}

public sealed class MenuItemDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string? Description { get; init; }
    public string? DescriptionEn { get; init; }
    public string Unit { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public IReadOnlyList<MenuTag> Tags { get; init; } = [];
    public IReadOnlyList<Guid> OptionGroupIds { get; init; } = [];
    public bool IsHidden { get; init; }
    public SoldOutMode? SoldOutMode { get; init; }
    public DateTime? SoldOutUntil { get; init; }

    /// <summary>Hết hiệu lực của món, hoặc nhóm bắt buộc hết mọi lựa chọn (07 §3.8).</summary>
    public bool IsSoldOut { get; init; }

    public MenuItemStatus Status { get; init; }
    public int SortOrder { get; init; }

    /// <summary>Đã có trong Pos_OrderItems: FE khóa Xóa, gợi ý Ẩn.</summary>
    public bool EverOrdered { get; init; }

    public DateTime UpdatedAt { get; init; }
}

public sealed class MenuItemQuery : PaginationQuery
{
    public Guid? CategoryId { get; set; }
    public MenuItemStatus? Status { get; set; }
}

public sealed class SaveMenuItemRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public Guid CategoryId { get; set; }
    public string? Description { get; set; }
    public string? DescriptionEn { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public List<MenuTag> Tags { get; set; } = [];
    public List<Guid> OptionGroupIds { get; set; } = [];

    /// <summary>Bỏ trống khi tạo: cuối danh mục.</summary>
    public int? SortOrder { get; set; }
}

public sealed class SetAvailabilityRequest
{
    public bool IsSoldOut { get; set; }

    /// <summary>Bắt buộc khi <see cref="IsSoldOut"/>.</summary>
    public SoldOutMode? Mode { get; set; }
}

public sealed class SetHiddenRequest
{
    public bool IsHidden { get; set; }
}

public sealed class MenuItemImageResult
{
    public string ImageUrl { get; init; } = string.Empty;
}

public sealed class OptionChoiceDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public decimal Price { get; init; }
    public bool IsDefault { get; init; }
    public bool IsSoldOut { get; init; }
    public SoldOutMode? SoldOutMode { get; init; }
    public DateTime? SoldOutUntil { get; init; }
    public int SortOrder { get; init; }
}

public sealed class OptionGroupDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public SelectionType SelectionType { get; init; }
    public bool IsRequired { get; init; }
    public int MaxSelect { get; init; }
    public int SortOrder { get; init; }
    public IReadOnlyList<OptionChoiceDto> Choices { get; init; } = [];

    /// <summary>Món chưa xóa đang gắn nhóm.</summary>
    public int ItemCount { get; init; }
}

public sealed class SaveOptionChoiceInput
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public decimal Price { get; set; }
    public bool IsDefault { get; set; }
}

public sealed class SaveOptionGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public SelectionType SelectionType { get; set; }
    public bool IsRequired { get; set; }
    public int MaxSelect { get; set; } = 1;
    public List<SaveOptionChoiceInput> Choices { get; set; } = [];
}

/// <summary>Thực đơn gộp cho Gọi món hộ (07 §2.1).</summary>
public sealed class MenuBundle
{
    public IReadOnlyList<CategoryDto> Categories { get; init; } = [];
    public IReadOnlyList<MenuItemDto> Items { get; init; } = [];
    public IReadOnlyList<OptionGroupDto> OptionGroups { get; init; } = [];
}
