using Application.Interfaces.Services.Public;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using Infrastructure.Implementations.Services.Public;
using Microsoft.Extensions.Caching.Memory;
using UnitTests.TestSupport;

namespace UnitTests.MenuQr;

/// <summary>Công thức thuần: số tính sẵn 07 §3.10, giờ nhận đơn 07 §3.4, mã bàn BR-01, giới hạn tần suất NFR-04.</summary>
public sealed class PricingAndClockTests
{
    private static OrderItem Line(decimal price, int quantity, params decimal[] options) =>
        OrderItem.Create(Guid.NewGuid(), "M000", "Món", price,
            options.Select(p => new OrderItemOption(Guid.NewGuid(), "Nhóm", Guid.NewGuid(), "Lựa chọn", p)).ToList(), quantity, null, 10);

    [Fact]
    public void PrecomputedNumbers_Section310()
    {
        Assert.Equal(90_000m, Line(65_000, 1, 10_000, 15_000).LineTotal);
        Assert.Equal(50_000m, Line(20_000, 2, 5_000).LineTotal);
        Assert.Equal(20_000m, Line(20_000, 1, 0).LineTotal);
        Assert.Equal(150_000m, Line(75_000, 2).LineTotal);
        Assert.Equal(79_000m, Line(79_000, 1).LineTotal);

        var goi = Line(45_000, 2);
        var com = Line(65_000, 1, 10_000, 15_000);
        var tra = Line(20_000, 2, 5_000);
        var standard = Order.Create("DH2610140001", Guid.NewGuid(), Guid.NewGuid(), "Bàn 05", OrderSource.KhachQr, "Anh Tuấn", null,
            DateTime.UtcNow, "a", "r1", null, [goi, com, tra]);
        Assert.Equal(230_000m, standard.Total);
        Assert.Equal(0m, OrderPricing.SessionSubtotal([standard]));
        Assert.Equal(230_000m, OrderPricing.PendingTotal([standard]));

        standard.Confirm(DateTime.UtcNow, null, "Nam", new Dictionary<Guid, (RemoveReason, string?)> { [tra.Id] = (RemoveReason.HetMon, null) });
        Assert.Equal(180_000m, standard.Total);

        var beer = Order.Create("DH2610140002", Guid.NewGuid(), Guid.NewGuid(), "Bàn 05", OrderSource.KhachQr, null, null,
            DateTime.UtcNow, "b", "r2", null, [Line(22_000, 4)]);
        beer.AutoConfirm();
        Assert.Equal(88_000m, beer.Total);
        Assert.Equal(268_000m, OrderPricing.SessionSubtotal([standard, beer]));
        Assert.Equal(32_000m, OrderPricing.Change(300_000, 268_000));
        Assert.Equal("68.000 ₫", PosRules.FormatVnd(268_000 - 200_000));

        var split = beer.CancelItem(beer.Items[0].Id, 1, "Khách đổi ý", DateTime.UtcNow, null, "Mai");
        Assert.Equal(66_000m, beer.Items[0].LineTotal);
        Assert.Equal((1, OrderItemStatus.DaHuy, 22_000m), (split!.Quantity, split.Status, split.LineTotal));
        Assert.Equal(246_000m, OrderPricing.SessionSubtotal([standard, beer]));
    }

    [Theory]
    [InlineData("09:00", "22:00", 12, true)]
    [InlineData("09:00", "22:00", 22, false)]
    [InlineData("09:00", "22:00", 8, false)]
    [InlineData("16:00", "02:00", 23, true)]
    [InlineData("16:00", "02:00", 1, true)]
    [InlineData("16:00", "02:00", 12, false)]
    [InlineData("00:00", "00:00", 3, true)]
    public void OrderingHours_SameDay_Overnight_AllDay(string open, string close, int vietnamHour, bool accepting)
    {
        var now = new DateTime(2026, 10, 14, 0, 30, 0, DateTimeKind.Utc).AddHours(vietnamHour - 7);
        var state = OrderingClock.Evaluate(open, close, "TuXacNhan", "", now);
        Assert.Equal(accepting, state.Accepting);
        if (!accepting)
            Assert.Equal(($"Quán nhận đơn qua QR từ {open} đến {close}, vui lòng gọi nhân viên", PosErrors.NgoaiGioNhanDon), (state.Message, state.BlockReason));
    }

    [Fact]
    public void Pause_Timed_Manual_Expired()
    {
        var now = new DateTime(2026, 10, 14, 5, 0, 0, DateTimeKind.Utc);
        var timed = OrderingClock.Evaluate("09:00", "22:00", "ThuCong", "2026-10-14T05:15:00Z", now);
        Assert.Equal((false, "Quán tạm ngưng nhận đơn qua QR tới 12:15, vui lòng gọi nhân viên", ConfirmMode.ThuCong),
            (timed.Accepting, timed.Message, timed.ConfirmMode));

        var manual = OrderingClock.Evaluate("09:00", "22:00", "TuXacNhan", "manual", now);
        Assert.Equal((false, true, PosErrors.PausedIndefinitelyMessage), (manual.Accepting, manual.PausedIndefinitely, manual.Message));

        // Quá giờ tạm ngưng thì tự nhận lại, kể cả khi đang ngoài giờ thì báo ngoài giờ.
        Assert.True(OrderingClock.Evaluate("09:00", "22:00", "TuXacNhan", "2026-10-14T04:00:00Z", now).Accepting);
    }

    [Fact]
    public void TableCode_FollowsBr01()
    {
        for (var i = 0; i < 500; i++)
        {
            var code = Infrastructure.Implementations.Services.Pos.PosCodes.RandomTableCode();
            Assert.True(PosRules.IsValidTableCode(code), code);
            Assert.DoesNotContain(code, c => "OIL01".Contains(c));
        }
    }

    [Fact]
    public void RateLimiter_FixedWindowPerIpAndTable()
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 14, 5, 0, 10, TimeSpan.Zero));
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var limiter = new PublicRateLimiter(cache, time);

        for (var i = 0; i < PublicRatePolicies.WritePerMinute; i++)
            Assert.True(limiter.TryAcquire(PublicRatePolicies.Write, "1.2.3.4|K7M2QX", out _));
        Assert.False(limiter.TryAcquire(PublicRatePolicies.Write, "1.2.3.4|K7M2QX", out var retryAfter));
        Assert.Equal(50, retryAfter);

        // Cùng IP khác bàn, đọc có hạn mức riêng.
        Assert.True(limiter.TryAcquire(PublicRatePolicies.Write, "1.2.3.4|R4TZ8N", out _));
        for (var i = 0; i < PublicRatePolicies.ReadPerMinute; i++)
            Assert.True(limiter.TryAcquire(PublicRatePolicies.Read, "1.2.3.4|K7M2QX", out _));
        Assert.False(limiter.TryAcquire(PublicRatePolicies.Read, "1.2.3.4|K7M2QX", out _));

        time.Advance(TimeSpan.FromSeconds(50));
        Assert.True(limiter.TryAcquire(PublicRatePolicies.Write, "1.2.3.4|K7M2QX", out _));
    }
}
