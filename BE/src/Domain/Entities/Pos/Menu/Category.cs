using System.Text.RegularExpressions;
using Domain.Base;
using Domain.Common;

namespace Domain.Entities.Pos.Menu;

/// <summary>Danh mục món trên trang khách (bảng <c>Pos_Categories</c>, FR-26). Chỉ xóa khi không còn món chưa xóa.</summary>
public partial class Category : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;
    public const int ColorMaxLength = 7;

    private Category()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string Color { get; private set; } = "#64748B";
    public int SortOrder { get; private set; }
    public bool IsHidden { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static bool IsValidCode(string? code) => code is not null && CodePattern().IsMatch(code);

    public static bool IsValidColor(string? color) => color is not null && ColorPattern().IsMatch(color);

    public static Category Create(string code, string name, string? nameEn, string color, bool isHidden, int sortOrder)
    {
        var category = new Category { SortOrder = sortOrder };
        category.Update(code, name, nameEn, color, isHidden);
        return category;
    }

    public void Update(string code, string name, string? nameEn, string color, bool isHidden)
    {
        code = code.Trim().ToUpperInvariant();
        if (!IsValidCode(code))
            throw new DomainException("Mã danh mục gồm 2–10 chữ in hoa hoặc số");
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Nhập tên danh mục");
        if (!IsValidColor(color?.Trim()))
            throw new DomainException("Màu dạng #RRGGBB");

        Code = code;
        Name = name.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? null : nameEn.Trim();
        Color = color!.Trim().ToUpperInvariant();
        IsHidden = isHidden;
    }

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    [GeneratedRegex("^[A-Z0-9]{2,10}$")]
    private static partial Regex CodePattern();

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorPattern();
}
