using Application.Common.Time;
using Application.DTOs.Public;
using Application.DTOs.Tables;
using Application.Interfaces.Repositories;
using Domain.Entities.Pos;
using Domain.Entities.System.Settings;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Pos;

/// <summary>Đọc cài đặt nhận đơn (<c>Ordering.*</c>) và thông tin quán (<c>Store.*</c>, <c>Brand.*</c>) từ System_Settings (06 §3).</summary>
internal static class PosSettings
{
    public static async Task<OrderingState> OrderingAsync(IGenericRepository<Setting> settings, DateTime nowUtc, CancellationToken ct)
    {
        var values = await settings.QueryNoTracking().Where(s => s.Key.StartsWith("Ordering."))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        return OrderingClock.Evaluate(
            values.GetValueOrDefault(OrderingClock.OpenTimeKey),
            values.GetValueOrDefault(OrderingClock.CloseTimeKey),
            values.GetValueOrDefault(OrderingClock.ConfirmModeKey),
            values.GetValueOrDefault(OrderingClock.PausedUntilKey),
            nowUtc);
    }

    public static async Task<StoreProfileDto> StoreAsync(IGenericRepository<Setting> settings, CancellationToken ct)
    {
        var values = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith("Store.") || s.Key.StartsWith("Brand."))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        string Text(string key, string fallback = "") => values.TryGetValue(key, out var value) && value is not null ? value : fallback;

        var tagline = Text("Store.Tagline");
        return new StoreProfileDto
        {
            Name = Text(StoreProfileDto.NameKey),
            Tagline = string.IsNullOrWhiteSpace(tagline) ? null : tagline,
            Address = Text("Store.Address"),
            Phone = Text("Store.Phone"),
            TaxCode = Text("Store.TaxCode"),
            ReceiptFooter = Text("Store.ReceiptFooter"),
            BankBin = Text("Store.BankBin"),
            BankAccount = Text("Store.BankAccount"),
            BankAccountName = Text("Store.BankAccountName"),
            LogoUrl = Text("Brand.LogoUrl", "/logo/logo-mark.svg"),
            PrimaryColor = Text("Brand.PrimaryColor", "#15803D")
        };
    }

    public static PublicStoreInfo ToPublic(this StoreProfileDto store) => new()
    {
        Name = store.Name,
        Tagline = store.Tagline,
        LogoUrl = store.LogoUrl,
        PrimaryColor = store.PrimaryColor,
        Address = store.Address,
        Phone = store.Phone,
        BankBin = store.BankBin,
        BankAccount = store.BankAccount,
        BankAccountName = store.BankAccountName
    };

    /// <summary>00:00 ngày kế tiếp giờ Việt Nam: hạn của "Hết trong hôm nay" (BR-14).</summary>
    public static DateTime EndOfTodayUtc(DateTime nowUtc) => VietnamDates.EndOfDayExclusiveUtc(VietnamDates.DateOf(nowUtc));
}
