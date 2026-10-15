using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Menu;

namespace Domain.Entities.Pos.Menu;

/// <summary>
/// Nhóm tùy chọn dùng chung cho nhiều món (bảng <c>Pos_OptionGroups</c>, FR-28, BR-04). <c>ChonMot</c> luôn lưu
/// <see cref="MaxSelect"/> = 1; <c>ChonNhieu</c> luôn không bắt buộc, không có lựa chọn mặc định.
/// </summary>
public class OptionGroup : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int NameMaxLength = 100;

    private OptionGroup()
    {
    }

    public string Name { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public SelectionType SelectionType { get; private set; }
    public bool IsRequired { get; private set; }
    public int MaxSelect { get; private set; } = 1;
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public List<OptionChoice> Choices { get; private set; } = [];

    public static OptionGroup Create(string name, string? nameEn, SelectionType type, bool isRequired, int maxSelect, int sortOrder)
    {
        var group = new OptionGroup { SortOrder = sortOrder };
        group.Update(name, nameEn, type, isRequired, maxSelect);
        return group;
    }

    public void Update(string name, string? nameEn, SelectionType type, bool isRequired, int maxSelect)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Nhập tên nhóm");
        if (type == SelectionType.ChonNhieu && maxSelect is < 1 or > PosRules.MaxSelectLimit)
            throw new DomainException("Số chọn tối đa từ 1 đến 10");

        Name = name.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? null : nameEn.Trim();
        SelectionType = type;
        IsRequired = type == SelectionType.ChonMot && isRequired;
        MaxSelect = type == SelectionType.ChonMot ? 1 : maxSelect;
    }

    /// <summary>Lựa chọn chưa xóa theo thứ tự.</summary>
    public IEnumerable<OptionChoice> ActiveChoices => Choices.Where(c => !c.IsDeleted).OrderBy(c => c.SortOrder);

    /// <summary>Nhóm chọn một bắt buộc mà mọi lựa chọn đều hết làm món hết (BR-14).</summary>
    public bool BlocksItem(DateTime nowUtc) =>
        SelectionType == SelectionType.ChonMot && IsRequired && ActiveChoices.All(c => c.IsSoldOutAt(nowUtc));
}
