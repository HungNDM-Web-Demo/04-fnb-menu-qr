using Application.DTOs.Public;

namespace Application.Interfaces.Services.Public;

/// <summary>Kết quả ghi có thể trùng: <see cref="Created"/> false khi trả lại kết quả cũ (200 thay vì 201).</summary>
public sealed record WriteOutcome<T>(T Value, bool Created);

/// <summary>
/// API công khai cho trang khách (07 §2.7). Mã bàn trong đường dẫn là thông tin xác thực duy nhất (BR-01): sai, đã đổi
/// hoặc bàn đã xóa → 404 <c>MaQrKhongHopLe</c>. <c>deviceId</c> lấy từ header <c>X-Device-Id</c>.
/// </summary>
public interface IPublicTableService
{
    Task<PublicTableInfo> GetInfoAsync(string code, CancellationToken ct = default);

    Task<PublicMenu> GetMenuAsync(string code, CancellationToken ct = default);

    /// <summary>Dấu thực đơn (cho <c>ETag</c>), không cần dựng cả thực đơn.</summary>
    Task<string> GetMenuStampAsync(string code, CancellationToken ct = default);

    Task<PublicLiveState> GetLiveAsync(string code, string? deviceId, string? knownSession, CancellationToken ct = default);

    Task<WriteOutcome<PublicSubmitOrderResult>> SubmitOrderAsync(string code, PublicSubmitOrderRequest request, CancellationToken ct = default);

    Task<WriteOutcome<PublicServiceRequestResult>> SendRequestAsync(string code, PublicServiceRequestInput request, CancellationToken ct = default);
}

/// <summary>
/// Giới hạn tần suất API công khai (NFR-04, 07 §2.7): cửa sổ cố định 1 phút, khóa = IP + mã bàn;
/// <c>public-write</c> 30, <c>public-read</c> 120 yêu cầu mỗi phút.
/// </summary>
public interface IPublicRateLimiter
{
    /// <summary>Trả false khi vượt giới hạn, kèm số giây cần chờ (header <c>Retry-After</c>).</summary>
    bool TryAcquire(string policy, string key, out int retryAfterSeconds);
}

/// <summary>Tên chính sách giới hạn tần suất.</summary>
public static class PublicRatePolicies
{
    public const string Read = "public-read";
    public const string Write = "public-write";
    public const int ReadPerMinute = 120;
    public const int WritePerMinute = 30;
}
