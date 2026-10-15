using Domain.Entities.Pos;

namespace Application.Common.Exceptions;

/// <summary>Lỗi 404, 409 có mã <c>code</c> của nghiệp vụ Menu QR (07 §2.13).</summary>
public static class PosConflicts
{
    /// <summary>07 §3.6: thu tiền, chuyển bàn trên phiên bản cũ, kèm <c>currentVersion</c>.</summary>
    public static ConflictException Stale(int currentVersion) =>
        new(PosErrors.StaleMessage, null, new Dictionary<string, object?>
        {
            ["code"] = PosErrors.DuLieuCu,
            ["currentVersion"] = currentVersion
        });

    /// <summary>UC-05 E3: đơn đã được người khác xử lý, kèm <c>order</c> mới nhất.</summary>
    public static ConflictException OrderHandled(string? handledByName, bool autoConfirmed, object order) =>
        new(autoConfirmed ? "Đơn đã được tự xác nhận" : $"Đơn đã được {handledByName ?? "người khác"} xử lý", null,
            new Dictionary<string, object?>
            {
                ["code"] = PosErrors.DonDaXuLy,
                ["order"] = order
            });

    /// <summary>BR-05, TC-32: giá đã đổi, kèm <c>priceChanges</c>; không tạo đơn.</summary>
    public static ConflictException PriceChanged(object priceChanges) =>
        new(PosErrors.PriceChangedMessage, null, new Dictionary<string, object?>
        {
            ["code"] = PosErrors.GiaDaThayDoi,
            ["priceChanges"] = priceChanges
        });

    /// <summary>BR-01, TC-02, TC-38: mã bàn sai hoặc đã đổi.</summary>
    public static PosNotFoundException InvalidQr() => new(PosErrors.InvalidQrMessage, PosErrors.MaQrKhongHopLe);
}

/// <summary>404 kèm <c>code</c> (vd <c>MaQrKhongHopLe</c>); bộ lọc <c>PosProblemFilter</c> của API đưa <c>code</c> vào ProblemDetails.</summary>
public sealed class PosNotFoundException(string message, string code) : NotFoundException(message)
{
    public string Code { get; } = code;
}
