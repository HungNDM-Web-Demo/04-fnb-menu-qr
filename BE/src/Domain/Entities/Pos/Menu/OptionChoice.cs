using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Menu;

namespace Domain.Entities.Pos.Menu;

/// <summary>
/// Lựa chọn trong nhóm tùy chọn (bảng <c>Pos_OptionChoices</c>). Giá cộng thêm bội số 1.000 ₫, từ 0 (BR-16).
/// Bỏ khỏi nhóm thì xóa mềm; dòng đơn cũ vẫn giữ bản chụp.
/// </summary>
public class OptionChoice : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int NameMaxLength = 100;

    private OptionChoice()
    {
    }

    public Guid OptionGroupId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public decimal Price { get; private set; }
    public bool IsDefault { get; private set; }
    public SoldOutMode? SoldOutMode { get; private set; }
    public DateTime? SoldOutUntil { get; private set; }
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static OptionChoice Create(Guid groupId, string name, string? nameEn, decimal price, bool isDefault, int sortOrder)
    {
        var choice = new OptionChoice { OptionGroupId = groupId };
        choice.Update(name, nameEn, price, isDefault, sortOrder);
        return choice;
    }

    public void Update(string name, string? nameEn, decimal price, bool isDefault, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Nhập tên lựa chọn");
        if (price < 0 || !PosRules.IsThousandMultiple(price))
            throw new DomainException("Giá phải là bội số 1.000 ₫");

        Name = name.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? null : nameEn.Trim();
        Price = price;
        IsDefault = isDefault;
        SortOrder = sortOrder;
    }

    public bool IsSoldOutAt(DateTime nowUtc) => PosRules.IsSoldOut(SoldOutMode, SoldOutUntil, nowUtc);

    /// <summary>Báo hết (FR-30): <c>HetHomNay</c> hết tới <paramref name="untilUtc"/> (00:00 hôm sau giờ Việt Nam).</summary>
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
}
