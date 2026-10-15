using Application.DTOs.Menu;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Enums.Pos.Menu;
using FluentValidation;

namespace Application.Validators.Menu;

// Kiểm định dạng của thực đơn (07 §2.2–2.4). Tham chiếu (danh mục, nhóm tùy chọn) và trùng mã kiểm ở service.

public sealed class SaveCategoryRequestValidator : AppValidator<SaveCategoryRequest>
{
    public SaveCategoryRequestValidator()
    {
        RuleFor(x => x.Code).Must(c => Category.IsValidCode(c?.Trim().ToUpperInvariant())).WithMessage("Mã danh mục gồm 2–10 chữ in hoa hoặc số");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên danh mục")
            .MaximumLength(Category.NameMaxLength).WithMessage("Tên danh mục tối đa 100 ký tự");
        RuleFor(x => x.NameEn).MaximumLength(Category.NameMaxLength).WithMessage("Tên tiếng Anh tối đa 100 ký tự");
        RuleFor(x => x.Color).Must(c => Category.IsValidColor(c?.Trim())).WithMessage("Màu dạng #RRGGBB");
    }
}

public sealed class SaveMenuItemRequestValidator : AppValidator<SaveMenuItemRequest>
{
    public SaveMenuItemRequestValidator()
    {
        RuleFor(x => x.Code).Must(c => MenuItem.IsValidCode(c?.Trim().ToUpperInvariant())).WithMessage("Mã món dạng M001");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên món")
            .MaximumLength(MenuItem.NameMaxLength).WithMessage("Tên món tối đa 150 ký tự");
        RuleFor(x => x.NameEn).MaximumLength(MenuItem.NameMaxLength).WithMessage("Tên tiếng Anh tối đa 150 ký tự");
        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Giá món phải lớn hơn 0")
            .Must(PosRules.IsThousandMultiple).WithMessage("Giá phải là bội số 1.000 ₫");
        RuleFor(x => x.Unit).NotEmpty().WithMessage("Nhập đơn vị tính")
            .MaximumLength(MenuItem.UnitMaxLength).WithMessage("Đơn vị tính tối đa 20 ký tự");
        RuleFor(x => x.Description).MaximumLength(MenuItem.DescriptionMaxLength).WithMessage("Mô tả tối đa 500 ký tự");
        RuleFor(x => x.DescriptionEn).MaximumLength(MenuItem.DescriptionMaxLength).WithMessage("Mô tả tối đa 500 ký tự");
        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("Danh mục không tồn tại");
        RuleFor(x => x.OptionGroupIds).Must(ids => ids.Distinct().Count() == ids.Count).WithMessage("Nhóm tùy chọn bị lặp");
    }
}

public sealed class SetAvailabilityRequestValidator : AppValidator<SetAvailabilityRequest>
{
    public SetAvailabilityRequestValidator()
    {
        RuleFor(x => x.Mode).NotNull().When(x => x.IsSoldOut).WithMessage("Chọn Hết trong hôm nay hoặc Hết tới khi mở lại");
    }
}

public sealed class SaveOptionGroupRequestValidator : AppValidator<SaveOptionGroupRequest>
{
    public SaveOptionGroupRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên nhóm")
            .MaximumLength(OptionGroup.NameMaxLength).WithMessage("Tên nhóm tối đa 100 ký tự");
        RuleFor(x => x.SelectionType).IsInEnum().WithMessage("Chọn kiểu nhóm");
        RuleFor(x => x.Choices).NotEmpty().WithMessage("Thêm ít nhất 1 lựa chọn");
        RuleForEach(x => x.Choices).ChildRules(choice =>
        {
            choice.RuleFor(c => c.Name).NotEmpty().WithMessage("Nhập tên lựa chọn")
                .MaximumLength(OptionChoice.NameMaxLength).WithMessage("Tên lựa chọn tối đa 100 ký tự");
            choice.RuleFor(c => c.Price).Must(p => p >= 0 && PosRules.IsThousandMultiple(p)).WithMessage("Giá phải là bội số 1.000 ₫");
        });

        When(x => x.SelectionType == SelectionType.ChonNhieu, () =>
        {
            RuleFor(x => x.MaxSelect)
                .InclusiveBetween(1, PosRules.MaxSelectLimit).WithMessage("Số chọn tối đa từ 1 đến 10")
                .Must((request, max) => max <= request.Choices.Count).WithMessage("Số chọn tối đa không lớn hơn số lựa chọn");
            RuleFor(x => x.Choices).Must(choices => !choices.Any(c => c.IsDefault))
                .When(x => x.Choices.Count > 0)
                .WithMessage("Nhóm chọn nhiều không có lựa chọn mặc định");
        });

        When(x => x.SelectionType == SelectionType.ChonMot, () =>
            RuleFor(x => x.Choices).Must(choices => choices.Count(c => c.IsDefault) <= 1)
                .When(x => x.Choices.Count > 0)
                .WithMessage("Chỉ chọn một lựa chọn mặc định"));
    }
}
