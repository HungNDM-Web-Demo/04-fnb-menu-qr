using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Reports;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Tables;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.MenuQr;

/// <summary>Dữ liệu mẫu nạp đúng số ở 06 §5.1, §5.5, §5.6 (BE và FE mock đối chiếu cùng tổng).</summary>
public sealed class MenuQrSeedTests : IAsyncLifetime
{
    private PosTestHost _host = null!;

    public async Task InitializeAsync() => _host = await PosTestHost.StartAsync();

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Counts_MatchDesign()
    {
        Assert.Equal(6, await _host.QueryAsync<Category, int>(q => q.CountAsync()));
        Assert.Equal(50, await _host.QueryAsync<MenuItem, int>(q => q.CountAsync()));
        Assert.Equal(6, await _host.QueryAsync<OptionGroup, int>(q => q.CountAsync()));
        Assert.Equal(16, await _host.QueryAsync<OptionChoice, int>(q => q.CountAsync()));
        Assert.Equal(25, await _host.QueryAsync<MenuItem, int>(q => q.SelectMany(i => i.OptionGroups).CountAsync()));
        Assert.Equal(20, await _host.QueryAsync<DiningTable, int>(q => q.CountAsync()));
        Assert.Equal(1335, await _host.QueryAsync<TableSession, int>(q => q.CountAsync()));
        Assert.Equal(26, await _host.QueryAsync<TableSession, int>(q => q.CountAsync(s => s.Status == SessionStatus.DaHuy)));
        Assert.Equal(2127, await _host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(1843, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.Source == OrderSource.KhachQr)));
        Assert.Equal(625, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.AutoConfirmed)));
        Assert.Equal(45, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.Status == OrderStatus.BiTuChoi)));
        Assert.Equal(6618, await _host.QueryAsync<OrderItem, int>(q => q.CountAsync()));
        Assert.Equal(98, await _host.QueryAsync<OrderItem, int>(q => q.CountAsync(i => i.Status == OrderItemStatus.BiBo)));
        Assert.Equal(51, await _host.QueryAsync<OrderItem, int>(q => q.CountAsync(i => i.Status == OrderItemStatus.DaHuy)));
        Assert.Equal(1498, await _host.QueryAsync<ServiceRequest, int>(q => q.CountAsync()));
        Assert.Equal(555, await _host.QueryAsync<ServiceRequest, int>(q => q.CountAsync(r => r.AutoHandled)));
        Assert.Equal(29, await _host.QueryAsync<ServiceRequest, int>(q => q.CountAsync(r => r.Status == Domain.Enums.Pos.Requests.ServiceRequestStatus.DaHuy)));
    }

    [Fact]
    public async Task Revenue_89DaysBeforeToday_Is686200000()
    {
        await _host.SignInAsync("quanly");
        var today = VietnamDates.Today(_host.Time);
        var report = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new ReportQuery
        {
            From = VietnamDates.Format(today.AddDays(-89)),
            To = VietnamDates.Format(today.AddDays(-1))
        }));

        Assert.Equal(686_200_000m, report.Totals.Revenue);
        Assert.Equal(1294, report.Totals.SessionCount);
        Assert.Equal(530_294m, report.Totals.AvgSessionValue);
        Assert.Equal(89, report.Daily.Count);

        // Ba phiên lịch sử đầu tiên (ô −89): 142.000, 196.000, 265.000 ₫.
        var first = await _host.QueryAsync<TableSession, List<decimal?>>(q => q.Where(s => s.Status == SessionStatus.DaDong)
            .OrderBy(s => s.OpenedAt).Take(3).Select(s => s.Total).ToListAsync());
        Assert.Equal([142_000m, 196_000m, 265_000m], first);
    }

    [Fact]
    public async Task Dashboard_Today_MatchesDesign()
    {
        await _host.SignInAsync("quanly");
        var dashboard = await _host.CallAsync<IReportService, DashboardReport>(s => s.GetDashboardAsync());

        Assert.Equal(7, dashboard.OpenSessions);
        Assert.Equal(19, dashboard.ActiveTables);
        Assert.Equal(2, dashboard.PendingOrders);
        Assert.Equal(2, dashboard.PendingRequests);
        Assert.Equal(1, dashboard.OverdueRequests);
        Assert.Equal(8, dashboard.ClosedSessions);
        Assert.Equal(3_106_000m, dashboard.Revenue);
        Assert.Equal(388_250m, dashboard.AvgSessionValue);
        Assert.Equal(2.1, dashboard.AvgConfirmMinutes);
        Assert.Equal(24, dashboard.ByHour.Count);
    }

    [Fact]
    public async Task Operations_90Days_MatchRates()
    {
        await _host.SignInAsync("quanly");
        var today = VietnamDates.Today(_host.Time);
        var report = await _host.CallAsync<IReportService, OperationsReport>(s => s.GetOperationsAsync(new ReportQuery
        {
            From = VietnamDates.Format(today.AddDays(-89)),
            To = VietnamDates.Format(today)
        }));

        Assert.Equal(2127, report.OrderCount);
        Assert.Equal(86.6, report.SelfOrderRate);
        Assert.Equal(625, report.AutoConfirmedOrders);
        Assert.Equal(33.9, report.AutoConfirmRate);
        Assert.Equal(45, report.RejectedOrders);
        Assert.Equal(3.1, report.AvgConfirmMinutes);
        Assert.Equal(1498, report.RequestCount);
        Assert.Equal(7 * 24, report.Heatmap.Count);
    }

    [Fact]
    public async Task Board_LiveTables_MatchSection55()
    {
        await _host.SignInAsync("nhanvien");
        var board = await _host.CallAsync<ITableSessionService, IReadOnlyList<Application.DTOs.Sessions.TableBoardItem>>(s => s.GetBoardAsync());
        var byName = board.ToDictionary(b => b.TableName);

        Assert.Equal(20, board.Count);
        Assert.Equal(2_589_000m, board.Where(b => b.Session is not null).Sum(b => b.Session!.Subtotal));
        Assert.Equal(TableStatus.Trong, byName["Bàn 05"].Status);
        Assert.Equal(TableStatus.Trong, byName["Bàn 12"].Status);
        Assert.Equal(TableStatus.Tat, byName["Bàn 20"].Status);
        Assert.Equal(233_000m, byName["Bàn 03"].Session!.Subtotal);
        Assert.Equal(677_000m, byName["Bàn 07"].Session!.Subtotal);
        Assert.Equal((0m, 1), (byName["Bàn 08"].Session!.Subtotal, byName["Bàn 08"].Session!.PendingOrderCount));
        Assert.Equal(TableStatus.ChoThanhToan, byName["Bàn 10"].Status);
        Assert.Equal(942_000m, byName["Bàn 10"].Session!.Subtotal);
        Assert.Equal(PaymentMethod.ChuyenKhoan, byName["Bàn 10"].Session!.PaymentRequest!.Method);
        Assert.Equal(414_000m, byName["Bàn 14"].Session!.Subtotal);
        Assert.Equal(1, byName["Bàn 14"].PendingRequestCount);
        Assert.Equal(0m, byName["Bàn 16"].Session!.Subtotal);
        Assert.Equal(323_000m, byName["Bàn 18"].Session!.Subtotal);

        var live = await _host.CallAsync<IOrderService, Application.DTOs.Orders.LiveOrdersDto>(s => s.GetLiveAsync());
        Assert.Equal(["Bàn 08", "Bàn 16"], live.Pending.Select(o => o.TableName));
        Assert.Equal(208_000m, live.Pending[0].Total);
        Assert.Equal((11, WaitLevel.Do), (live.Pending[0].WaitMinutes, live.Pending[0].WaitLevel));
        Assert.Equal(679_000m, live.Pending[1].Total);
    }

    [Fact]
    public async Task Menu_SoldOutAndHidden_AsDesigned()
    {
        var khoai = await _host.QueryAsync<MenuItem, MenuItem>(q => q.SingleAsync(i => i.Code == "M003"));
        Assert.Equal(Domain.Enums.Pos.Menu.SoldOutMode.HetToiKhiMoLai, khoai.SoldOutMode);
        Assert.True((await _host.QueryAsync<MenuItem, MenuItem>(q => q.SingleAsync(i => i.Code == "M029"))).IsHidden);
        Assert.Equal(1, await _host.QueryAsync<MenuItem, int>(q => q.CountAsync(i => i.SoldOutMode != null)));
        Assert.False(await _host.QueryAsync<MenuItem, bool>(q => q.AnyAsync(i => i.Code == "M051")));
        Assert.False(await _host.QueryAsync<DiningTable, bool>(q => q.AnyAsync(t => t.Code == "ABCDEF")));

        // Mã phiên, mã đơn theo ngày giờ Việt Nam.
        var todayPrefix = "PB" + VietnamDates.Today(_host.Time).ToString("yyMMdd", System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal(15, await _host.QueryAsync<TableSession, int>(q => q.CountAsync(s => s.Code.StartsWith(todayPrefix))));
    }
}
