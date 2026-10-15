using Domain.Common;

namespace Domain.Entities.Pos;

/// <summary>
/// Mã lỗi nghiệp vụ (07 §2.13): ProblemDetails có trường <c>code</c> để FE rẽ nhánh không cần so chuỗi; <c>detail</c> đúng câu
/// trong bảng. Lỗi 400 ném <see cref="DomainException"/> qua <see cref="Business"/>; 404, 409, 429 ném ở Application.
/// </summary>
public static class PosErrors
{
    public const string MaQrKhongHopLe = "MaQrKhongHopLe";
    public const string BanTamNgung = "BanTamNgung";
    public const string QuanTamNgung = "QuanTamNgung";
    public const string NgoaiGioNhanDon = "NgoaiGioNhanDon";
    public const string MonVuaHet = "MonVuaHet";
    public const string GiaDaThayDoi = "GiaDaThayDoi";
    public const string QuaSoDonCho = "QuaSoDonCho";
    public const string ChuaCoMonXacNhan = "ChuaCoMonXacNhan";
    public const string DonDaXuLy = "DonDaXuLy";
    public const string DonPhaiConMon = "DonPhaiConMon";
    public const string DonChuaXacNhan = "DonChuaXacNhan";
    public const string DonKhongPhucVuDuoc = "DonKhongPhucVuDuoc";
    public const string MonChuaPhucVu = "MonChuaPhucVu";
    public const string HetThoiGianHoanTac = "HetThoiGianHoanTac";
    public const string MonKhongHuyDuoc = "MonKhongHuyDuoc";
    public const string PhienDaDong = "PhienDaDong";
    public const string DuLieuCu = "DuLieuCu";
    public const string ConDonChoXacNhan = "ConDonChoXacNhan";
    public const string ConMonChuaPhucVu = "ConMonChuaPhucVu";
    public const string TienKhachDuaThieu = "TienKhachDuaThieu";
    public const string BanDangCoKhach = "BanDangCoKhach";
    public const string BanDangTat = "BanDangTat";
    public const string BanDichKhongHopLe = "BanDichKhongHopLe";
    public const string MonDaDuocGoi = "MonDaDuocGoi";
    public const string DanhMucConMon = "DanhMucConMon";
    public const string NhomDangDung = "NhomDangDung";
    public const string YeuCauDaHuy = "YeuCauDaHuy";
    public const string QuaNhieuYeuCau = "QuaNhieuYeuCau";

    public const string InvalidQrMessage = "Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên";
    public const string TableInactiveMessage = "Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên";
    public const string PausedIndefinitelyMessage = "Quán tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên";
    public const string SoldOutMessage = "Có món vừa hết, vui lòng xóa khỏi giỏ rồi gửi lại";
    public const string PriceChangedMessage = "Giá đã thay đổi, vui lòng kiểm tra giỏ món rồi gửi lại";
    public const string TooManyPendingMessage = "Bàn đang có 3 đơn chờ quán xác nhận, vui lòng chờ";
    public const string NothingConfirmedMessage = "Chưa có món được quán xác nhận";
    public const string MustKeepItemMessage = "Đơn phải còn ít nhất 1 món, bỏ hết thì dùng Từ chối";
    public const string NotConfirmedMessage = "Đơn chưa được xác nhận";
    public const string NotServableMessage = "Đơn đã bị từ chối hoặc đã hủy";
    public const string NotServedMessage = "Món chưa phục vụ, không hoàn tác được";
    public const string UndoExpiredMessage = "Hết thời gian hoàn tác";
    public const string NotCancellableMessage = "Món đã bị bỏ hoặc đã hủy";
    public const string SessionClosedMessage = "Phiên bàn đã đóng";
    public const string StaleMessage = "Phiên bàn vừa thay đổi, đang tải lại";
    public const string TableOccupiedMessage = "Bàn đang có khách";
    public const string TableOffMessage = "Bàn đang tắt, bật bàn trước khi gọi món";
    public const string TransferTargetMessage = "Chỉ chuyển sang bàn đang trống và đang bật";
    public const string ItemOrderedMessage = "Món đã từng được gọi, không xóa được. Hãy dùng Ẩn";
    public const string RequestCancelledMessage = "Yêu cầu đã hủy";
    public const string TooManyRequestsMessage = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút";

    public static string PausedUntilMessage(string hhmm) => $"Quán tạm ngưng nhận đơn qua QR tới {hhmm}, vui lòng gọi nhân viên";

    public static string OutOfHoursMessage(string open, string close) => $"Quán nhận đơn qua QR từ {open} đến {close}, vui lòng gọi nhân viên";

    public static DomainException Business(string code, string message, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new DomainException(message, extensions);
    }

    /// <summary>Lỗi 400 vừa có <c>code</c> vừa gắn <c>errors</c> theo trường.</summary>
    public static DomainException WithErrors(string code, string message, IDictionary<string, string[]> errors, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var all = new Dictionary<string, object?>(extra ?? new Dictionary<string, object?>()) { ["errors"] = errors };
        return Business(code, message, all);
    }

    public static DomainException TableInactive() => Business(BanTamNgung, TableInactiveMessage);

    public static DomainException TableOccupied() => Business(BanDangCoKhach, TableOccupiedMessage);

    public static DomainException SessionClosed() => Business(PhienDaDong, SessionClosedMessage);

    public static DomainException NotConfirmed() => Business(DonChuaXacNhan, NotConfirmedMessage);
}
