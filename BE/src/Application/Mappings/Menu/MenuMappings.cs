using Application.DTOs.Menu;
using Application.DTOs.Public;
using Domain.Entities.Pos.Menu;
using Domain.Enums.Pos.Menu;

namespace Application.Mappings.Menu;

/// <summary>Ánh xạ thực đơn sang DTO (07 §2.1–2.4, §2.7). Trường suy ra (đếm, hết món) do service tính rồi truyền vào.</summary>
public static class MenuMappings
{
    public static CategoryDto ToDto(this Category category, int itemCount) => new()
    {
        Id = category.Id,
        Code = category.Code,
        Name = category.Name,
        NameEn = category.NameEn,
        Color = category.Color,
        SortOrder = category.SortOrder,
        IsHidden = category.IsHidden,
        ItemCount = itemCount
    };

    /// <summary>
    /// <paramref name="isSoldOut"/>: hết hiệu lực của món hoặc nhóm bắt buộc hết mọi lựa chọn (07 §3.8).
    /// <c>status</c>: <c>An</c> &gt; <c>HetMon</c> &gt; <c>DangBan</c>.
    /// </summary>
    public static MenuItemDto ToDto(this MenuItem item, string categoryName, bool isSoldOut, bool everOrdered, DateTime nowUtc) => new()
    {
        Id = item.Id,
        Code = item.Code,
        Name = item.Name,
        NameEn = item.NameEn,
        CategoryId = item.CategoryId,
        CategoryName = categoryName,
        ImageUrl = item.ImageUrl,
        Description = item.Description,
        DescriptionEn = item.DescriptionEn,
        Unit = item.Unit,
        Price = item.Price,
        Tags = item.GetTags(),
        OptionGroupIds = item.OrderedGroupIds,
        IsHidden = item.IsHidden,
        SoldOutMode = item.IsSoldOutAt(nowUtc) ? item.SoldOutMode : null,
        SoldOutUntil = item.IsSoldOutAt(nowUtc) ? item.SoldOutUntil : null,
        IsSoldOut = isSoldOut,
        Status = item.IsHidden ? MenuItemStatus.An : isSoldOut ? MenuItemStatus.HetMon : MenuItemStatus.DangBan,
        SortOrder = item.SortOrder,
        EverOrdered = everOrdered,
        UpdatedAt = item.UpdatedAt ?? item.CreatedAt
    };

    public static OptionChoiceDto ToDto(this OptionChoice choice, DateTime nowUtc)
    {
        var soldOut = choice.IsSoldOutAt(nowUtc);
        return new OptionChoiceDto
        {
            Id = choice.Id,
            Name = choice.Name,
            NameEn = choice.NameEn,
            Price = choice.Price,
            IsDefault = choice.IsDefault,
            IsSoldOut = soldOut,
            SoldOutMode = soldOut ? choice.SoldOutMode : null,
            SoldOutUntil = soldOut ? choice.SoldOutUntil : null,
            SortOrder = choice.SortOrder
        };
    }

    public static OptionGroupDto ToDto(this OptionGroup group, int itemCount, DateTime nowUtc) => new()
    {
        Id = group.Id,
        Name = group.Name,
        NameEn = group.NameEn,
        SelectionType = group.SelectionType,
        IsRequired = group.IsRequired,
        MaxSelect = group.MaxSelect,
        SortOrder = group.SortOrder,
        Choices = group.ActiveChoices.Select(c => c.ToDto(nowUtc)).ToList(),
        ItemCount = itemCount
    };

    public static PublicOptionGroup ToPublic(this OptionGroup group, DateTime nowUtc) => new()
    {
        Id = group.Id,
        Name = group.Name,
        NameEn = group.NameEn,
        SelectionType = group.SelectionType,
        IsRequired = group.IsRequired,
        MaxSelect = group.MaxSelect,
        Choices = group.ActiveChoices.Select(c => new PublicChoice
        {
            Id = c.Id,
            Name = c.Name,
            NameEn = c.NameEn,
            Price = c.Price,
            IsDefault = c.IsDefault,
            IsSoldOut = c.IsSoldOutAt(nowUtc)
        }).ToList()
    };

    public static PublicMenuItem ToPublic(this MenuItem item, bool isSoldOut) => new()
    {
        Id = item.Id,
        Code = item.Code,
        CategoryId = item.CategoryId,
        Name = item.Name,
        NameEn = item.NameEn,
        Description = item.Description,
        DescriptionEn = item.DescriptionEn,
        ImageUrl = item.ImageUrl,
        Unit = item.Unit,
        Price = item.Price,
        Tags = item.GetTags(),
        OptionGroupIds = item.OrderedGroupIds,
        IsSoldOut = isSoldOut
    };
}
