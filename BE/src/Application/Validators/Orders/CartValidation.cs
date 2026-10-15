using Application.DTOs.Orders;
using Domain.Entities.Pos;
using FluentValidation.Results;

namespace Application.Validators.Orders;

/// <summary>
/// Kiểm dữ liệu giỏ khi gửi đơn, gọi món hộ (07 §2.7 bước 6, BR-03, BR-06). Không phải validator tự chạy: service gọi đúng
/// thứ tự kiểm tra của hợp đồng (mã bàn, trùng mã yêu cầu, bàn tắt, giờ nhận đơn rồi mới tới dữ liệu).
/// Lựa chọn theo BR-04 cần thực đơn nên service kiểm tiếp.
/// </summary>
public static class CartValidation
{
    public static List<ValidationFailure> Validate(IReadOnlyList<CartLineInput>? lines, string? guestName, string? note, string? clientRequestId)
    {
        var failures = new List<ValidationFailure>();
        if (string.IsNullOrWhiteSpace(clientRequestId))
            failures.Add(new ValidationFailure("clientRequestId", "Thiếu mã yêu cầu"));
        else if (clientRequestId.Trim().Length > 64)
            failures.Add(new ValidationFailure("clientRequestId", "Mã yêu cầu tối đa 64 ký tự"));

        if (guestName is { Length: > PosRules.GuestNameMaxLength } && guestName.Trim().Length > PosRules.GuestNameMaxLength)
            failures.Add(new ValidationFailure("guestName", "Tên gọi tối đa 30 ký tự"));
        if (note is { Length: > PosRules.OrderNoteMaxLength } && note.Trim().Length > PosRules.OrderNoteMaxLength)
            failures.Add(new ValidationFailure("note", "Ghi chú tối đa 200 ký tự"));

        if (lines is null || lines.Count == 0)
        {
            failures.Add(new ValidationFailure("lines", "Giỏ món đang trống"));
            return failures;
        }

        if (lines.Count > PosRules.MaxLinesPerOrder)
            failures.Add(new ValidationFailure("lines", "Mỗi đơn tối đa 30 món"));

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (line.Quantity is < PosRules.QuantityMin or > PosRules.QuantityMax)
                failures.Add(new ValidationFailure($"lines[{i}].quantity", "Số lượng từ 1 đến 20"));
            if (line.Note is { Length: > PosRules.LineNoteMaxLength } && line.Note.Trim().Length > PosRules.LineNoteMaxLength)
                failures.Add(new ValidationFailure($"lines[{i}].note", "Ghi chú món tối đa 100 ký tự"));
            if ((line.ChoiceIds ?? []).Distinct().Count() != (line.ChoiceIds ?? []).Count)
                failures.Add(new ValidationFailure($"lines[{i}].choiceIds", "Lựa chọn không hợp lệ"));
        }

        return failures;
    }
}
