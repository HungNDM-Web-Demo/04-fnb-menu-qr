using System.Globalization;
using System.Security.Cryptography;
using Application.Common.Time;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Tables;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Pos;

/// <summary>
/// Mã chứng từ theo ngày giờ Việt Nam (BR-20, 06 §3): đơn <c>DH</c> + <c>yyMMdd</c> + 4 số; phiên <c>PB</c> + <c>yyMMdd</c> + 4 số.
/// Số tiếp theo = số lớn nhất trong ngày + 1; trùng do hai request cùng lúc thì index unique báo lỗi, service thử lại một lần.
/// Mã bàn 6 ký tự ngẫu nhiên theo BR-01.
/// </summary>
internal static class PosCodes
{
    public const string OrderPrefix = "DH";
    public const string SessionPrefix = "PB";

    public static string Code(string prefix, DateOnly date, int sequence) =>
        prefix + date.ToString("yyMMdd", CultureInfo.InvariantCulture) + sequence.ToString("0000", CultureInfo.InvariantCulture);

    public static async Task<string> NextOrderCodeAsync(IGenericRepository<Order> orders, DateTime atUtc, CancellationToken ct)
    {
        var prefix = Code(OrderPrefix, VietnamDates.DateOf(atUtc), 0)[..^4];
        var last = await orders.QueryNoTracking().Where(o => o.Code.StartsWith(prefix))
            .OrderByDescending(o => o.Code).Select(o => o.Code).FirstOrDefaultAsync(ct);
        return prefix + (Sequence(last, prefix) + 1).ToString("0000", CultureInfo.InvariantCulture);
    }

    public static async Task<string> NextSessionCodeAsync(IGenericRepository<TableSession> sessions, DateTime atUtc, CancellationToken ct)
    {
        var prefix = Code(SessionPrefix, VietnamDates.DateOf(atUtc), 0)[..^4];
        var last = await sessions.QueryNoTracking().Where(s => s.Code.StartsWith(prefix))
            .OrderByDescending(s => s.Code).Select(s => s.Code).FirstOrDefaultAsync(ct);
        return prefix + (Sequence(last, prefix) + 1).ToString("0000", CultureInfo.InvariantCulture);
    }

    /// <summary>BR-01: 6 ký tự lấy ngẫu nhiên (bộ sinh mật mã) từ A–Z bỏ O, I, L và 2–9, không trùng mọi mã đã cấp kể cả bàn đã xóa.</summary>
    public static async Task<string> NewTableCodeAsync(IGenericRepository<DiningTable> tables, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 50; attempt++)
        {
            var code = RandomTableCode();
            if (!await tables.Query().IgnoreQueryFilters().AnyAsync(t => t.Code == code, ct))
                return code;
        }

        throw new InvalidOperationException("Không sinh được mã bàn mới.");
    }

    public static string RandomTableCode()
    {
        Span<char> chars = stackalloc char[PosRules.TableCodeLength];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = PosRules.TableCodeAlphabet[RandomNumberGenerator.GetInt32(PosRules.TableCodeAlphabet.Length)];
        return new string(chars);
    }

    /// <summary>Người dùng hiện tại: Id, họ tên (chụp vào đơn, phiên, yêu cầu).</summary>
    public static async Task<(Guid Id, string FullName)> CurrentUserAsync(IGenericRepository<User> users, ICurrentUserService currentUser, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");
        var fullName = await users.QueryNoTracking().Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");
        return (userId, fullName);
    }

    private static int Sequence(string? code, string prefix) =>
        code is not null && int.TryParse(code[prefix.Length..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0;
}
