using Application.DTOs.Settings;
using Application.DTOs.Tables;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using FluentValidation;
using FluentValidation.Results;

namespace Application.Validators.Tables;

// Bàn (07 §2.5, UC-11 E1), cài đặt nhận đơn (07 §2.6, UC-13) và khóa Ordering.*, Store.* khi PUT /api/settings.

public sealed class SaveTableRequestValidator : AppValidator<SaveTableRequest>
{
    public SaveTableRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên bàn")
            .MaximumLength(DiningTable.NameMaxLength).WithMessage("Tên bàn tối đa 50 ký tự");
        RuleFor(x => x.Zone).NotEmpty().WithMessage("Nhập khu vực")
            .MaximumLength(DiningTable.ZoneMaxLength).WithMessage("Khu vực tối đa 50 ký tự");
        RuleFor(x => x.Capacity).InclusiveBetween(PosRules.CapacityMin, PosRules.CapacityMax).WithMessage("Sức chứa từ 1 đến 20");
    }
}

public sealed class UpdateOrderSettingsRequestValidator : AppValidator<UpdateOrderSettingsRequest>
{
    public UpdateOrderSettingsRequestValidator()
    {
        RuleFor(x => x.OpenTime).Must(v => OrderingClock.TryParseTime(v, out _)).WithMessage("Giờ dạng HH:mm");
        RuleFor(x => x.CloseTime).Must(v => OrderingClock.TryParseTime(v, out _)).WithMessage("Giờ dạng HH:mm");
        RuleFor(x => x.ConfirmMode).NotNull().IsInEnum().WithMessage("Chọn chế độ xác nhận");
    }
}

public sealed class PauseOrderingRequestValidator : AppValidator<PauseOrderingRequest>
{
    public PauseOrderingRequestValidator()
    {
        RuleFor(x => x.Minutes).Must(m => m is null or 15 or 30).WithMessage("Chọn 15 phút, 30 phút hoặc tới khi mở lại");
    }
}

/// <summary>
/// Kiểm thêm khóa của dự án khi <c>PUT /api/settings</c> (Cài đặt chung), chạy cùng validator nền; cùng quy tắc với FE
/// <c>validateProjectSettings</c> (<c>config/setting-labels.ts</c>). Lỗi gắn <c>items[i].value</c>.
/// </summary>
public sealed class ProjectSettingsValidator : AbstractValidator<UpdateSettingsRequest>
{
    public ProjectSettingsValidator()
    {
        RuleFor(x => x).Custom((request, context) =>
        {
            var items = request.Items ?? [];
            for (var i = 0; i < items.Count; i++)
            {
                var message = Check(items[i].Key?.Trim() ?? string.Empty, items[i].Value?.Trim() ?? string.Empty);
                if (message is not null)
                    context.AddFailure(new ValidationFailure($"items[{i}].value", message));
            }
        });
    }

    private static string? Check(string key, string value) => key switch
    {
        "Store.Name" when value.Length == 0 => "Nhập tên quán",
        "Store.BankBin" when !(value.Length == 6 && value.All(char.IsAsciiDigit)) => "Mã ngân hàng gồm 6 chữ số",
        "Store.BankAccount" when !(value.Length is >= 6 and <= 19 && value.All(char.IsAsciiDigit)) => "Số tài khoản gồm 6 đến 19 chữ số",
        OrderingClock.OpenTimeKey or OrderingClock.CloseTimeKey when !OrderingClock.TryParseTime(value, out _) => "Giờ dạng HH:mm",
        OrderingClock.ConfirmModeKey when value is not (nameof(ConfirmMode.ThuCong) or nameof(ConfirmMode.TuXacNhan)) => "Chế độ là ThuCong hoặc TuXacNhan",
        OrderingClock.PausedUntilKey when !OrderingClock.TryParsePausedUntil(value, out _, out _) => "Để trống, \"manual\" hoặc thời điểm ISO",
        _ => null
    };
}
