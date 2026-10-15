using System.Text.Json;
using System.Text.RegularExpressions;
using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Menu;

namespace Domain.Entities.Pos.Menu;

/// <summary>
/// Món (bảng <c>Pos_MenuItems</c>, FR-27). Giá bội số 1.000 ₫ và lớn hơn 0 (BR-16); món đã từng được gọi không xóa được, chỉ ẩn.
/// Hết món theo <see cref="SoldOutMode"/>/<see cref="SoldOutUntil"/> (BR-14), quá hạn thì đọc lười, lần ghi kế tiếp xóa.
/// </summary>
public partial class MenuItem : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 150;
    public const int ImageUrlMaxLength = 500;
    public const int DescriptionMaxLength = 500;
    public const int UnitMaxLength = 20;
    public const int TagsMaxLength = 100;

    private MenuItem()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public Guid CategoryId { get; private set; }
    public string? ImageUrl { get; private set; }
    public string? Description { get; private set; }
    public string? DescriptionEn { get; private set; }
    public string Unit { get; private set; } = string.Empty;
    public decimal Price { get; private set; }

    /// <summary>Mảng JSON tên <see cref="MenuTag"/>, vd <c>["BanChay","Cay"]</c>.</summary>
    public string Tags { get; private set; } = "[]";

    public SoldOutMode? SoldOutMode { get; private set; }
    public DateTime? SoldOutUntil { get; private set; }
    public bool IsHidden { get; private set; }
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public Category? Category { get; private set; }

    /// <summary>Nhóm tùy chọn áp dụng cho món, theo <see cref="MenuItemOptionGroup.SortOrder"/>.</summary>
    public List<MenuItemOptionGroup> OptionGroups { get; private set; } = [];

    public static bool IsValidCode(string? code) => code is not null && CodePattern().IsMatch(code);

    public static MenuItem Create(
        string code, string name, string? nameEn, Guid categoryId, string? description, string? descriptionEn,
        string unit, decimal price, IEnumerable<MenuTag> tags, int sortOrder)
    {
        var item = new MenuItem();
        item.Update(code, name, nameEn, categoryId, description, descriptionEn, unit, price, tags, sortOrder);
        return item;
    }

    public void Update(
        string code, string name, string? nameEn, Guid categoryId, string? description, string? descriptionEn,
        string unit, decimal price, IEnumerable<MenuTag> tags, int sortOrder)
    {
        code = code.Trim().ToUpperInvariant();
        if (!IsValidCode(code))
            throw new DomainException("Mã món dạng M001");
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Nhập tên món");
        if (price <= 0)
            throw new DomainException("Giá món phải lớn hơn 0");
        if (!PosRules.IsThousandMultiple(price))
            throw new DomainException("Giá phải là bội số 1.000 ₫");
        if (string.IsNullOrWhiteSpace(unit))
            throw new DomainException("Nhập đơn vị tính");

        Code = code;
        Name = name.Trim();
        NameEn = Clean(nameEn);
        CategoryId = categoryId;
        Description = Clean(description);
        DescriptionEn = Clean(descriptionEn);
        Unit = unit.Trim();
        Price = price;
        Tags = JsonSerializer.Serialize(tags.Distinct().Select(t => t.ToString()));
        SortOrder = sortOrder;
    }

    public IReadOnlyList<MenuTag> GetTags()
    {
        try
        {
            return (JsonSerializer.Deserialize<string[]>(Tags) ?? [])
                .Select(t => Enum.TryParse<MenuTag>(t, out var tag) ? (MenuTag?)tag : null)
                .Where(t => t is not null)
                .Select(t => t!.Value)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>Thay bộ nhóm tùy chọn, thứ tự 10, 20, 30… theo danh sách.</summary>
    public void SetOptionGroups(IReadOnlyList<Guid> groupIds)
    {
        OptionGroups.RemoveAll(g => !groupIds.Contains(g.OptionGroupId));
        for (var i = 0; i < groupIds.Count; i++)
        {
            var sortOrder = (i + 1) * PosRules.SortOrderStep;
            var existing = OptionGroups.FirstOrDefault(g => g.OptionGroupId == groupIds[i]);
            if (existing is null)
                OptionGroups.Add(new MenuItemOptionGroup(Id, groupIds[i], sortOrder));
            else
                existing.SortOrder = sortOrder;
        }
    }

    /// <summary>Id nhóm theo thứ tự hiển thị.</summary>
    public IReadOnlyList<Guid> OrderedGroupIds => OptionGroups.OrderBy(g => g.SortOrder).Select(g => g.OptionGroupId).ToList();

    public void SetImage(string? imageUrl) => ImageUrl = Clean(imageUrl);

    public void SetHidden(bool isHidden) => IsHidden = isHidden;

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    public bool IsSoldOutAt(DateTime nowUtc) => PosRules.IsSoldOut(SoldOutMode, SoldOutUntil, nowUtc);

    /// <summary>Báo hết (UC-10): <c>HetHomNay</c> hết tới <paramref name="untilUtc"/> (00:00 hôm sau giờ Việt Nam).</summary>
    public void MarkSoldOut(SoldOutMode mode, DateTime? untilUtc)
    {
        SoldOutMode = mode;
        SoldOutUntil = mode == Enums.Pos.Menu.SoldOutMode.HetHomNay ? untilUtc : null;
    }

    public void MarkAvailable()
    {
        SoldOutMode = null;
        SoldOutUntil = null;
    }

    /// <summary>Xóa hai cột hết món đã quá hạn (đọc lười, 06 §4).</summary>
    public void ClearExpiredSoldOut(DateTime nowUtc)
    {
        if (SoldOutMode is not null && !IsSoldOutAt(nowUtc))
            MarkAvailable();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^M\d{3}$")]
    private static partial Regex CodePattern();
}

/// <summary>Nhóm tùy chọn áp dụng cho món, có thứ tự (bảng nối <c>Pos_MenuItemOptionGroups</c>, khóa ghép).</summary>
public class MenuItemOptionGroup
{
    private MenuItemOptionGroup()
    {
    }

    public MenuItemOptionGroup(Guid menuItemId, Guid optionGroupId, int sortOrder)
    {
        MenuItemId = menuItemId;
        OptionGroupId = optionGroupId;
        SortOrder = sortOrder;
    }

    public Guid MenuItemId { get; private set; }
    public Guid OptionGroupId { get; private set; }
    public int SortOrder { get; set; }

    public OptionGroup? OptionGroup { get; private set; }
}
