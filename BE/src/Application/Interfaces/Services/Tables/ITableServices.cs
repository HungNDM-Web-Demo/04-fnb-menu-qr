using Application.DTOs.Tables;

namespace Application.Interfaces.Services.Tables;

/// <summary>Bàn và mã QR (07 §2.5, UC-11).</summary>
public interface ITableService
{
    Task<IReadOnlyList<DiningTableDto>> GetListAsync(CancellationToken ct = default);

    Task<DiningTableDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Cấp mã 6 ký tự theo BR-01 (TC-37).</summary>
    Task<DiningTableDto> CreateAsync(SaveTableRequest request, CancellationToken ct = default);

    Task<DiningTableDto> UpdateAsync(Guid id, SaveTableRequest request, CancellationToken ct = default);

    Task SetActiveAsync(Guid id, SetTableActiveRequest request, CancellationToken ct = default);

    /// <summary>Đổi mã QR, mã cũ hết hiệu lực ngay (FR-32, TC-38).</summary>
    Task<DiningTableDto> RegenerateCodeAsync(Guid id, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Lối vào "Xem như khách" của demo (07 §2.12).</summary>
    Task<IReadOnlyList<GuestTableLink>> GetGuestLinksAsync(CancellationToken ct = default);
}

/// <summary>Giờ nhận đơn, chế độ xác nhận, tạm ngưng (07 §2.6, UC-13), lưu ở <c>System_Settings</c> nhóm "Nhận đơn QR".</summary>
public interface IOrderSettingsService
{
    Task<OrderingStatusDto> GetAsync(CancellationToken ct = default);

    Task<OrderingStatusDto> UpdateAsync(UpdateOrderSettingsRequest request, CancellationToken ct = default);

    Task<OrderingStatusDto> PauseAsync(PauseOrderingRequest request, CancellationToken ct = default);

    Task<OrderingStatusDto> ResumeAsync(CancellationToken ct = default);

    /// <summary>Demo: nhận đơn cả ngày (<c>OpenTime = CloseTime = 00:00</c>) và bỏ tạm ngưng (07 §2.12).</summary>
    Task<OrderingStatusDto> AcceptAllDayAsync(CancellationToken ct = default);
}

/// <summary>Thông tin quán: khóa <c>Store.*</c>, <c>Brand.LogoUrl</c>, <c>Brand.PrimaryColor</c> (07 §2.6).</summary>
public interface IStoreProfileService
{
    Task<StoreProfileDto> GetAsync(CancellationToken ct = default);
}
