using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Reports;
using Application.Mappings.Orders;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Infrastructure.Implementations.Services.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Reports;

/// <summary>
/// Tổng quan và báo cáo (07 §2.11, BR-19). Đọc phiên, đơn, yêu cầu trong khoảng ngày rồi tổng hợp trong bộ nhớ (vài nghìn dòng
/// mỗi quý ở quy mô một quán), cùng một cách cho mọi provider. Doanh thu chỉ tính phiên <c>DaDong</c> theo <c>closedAt</c>.
/// Số tiền làm tròn tới đồng, phút và phần trăm 1 chữ số.
/// </summary>
public sealed class ReportService(
    IGenericRepository<TableSession> sessions,
    IGenericRepository<Order> orders,
    IGenericRepository<ServiceRequest> requests,
    IGenericRepository<DiningTable> tables,
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<Category> categories,
    TimeProvider time) : IReportService
{
    private const int DefaultDays = 30;

    public async Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var today = VietnamDates.DateOf(now);
        var start = VietnamDates.StartOfDayUtc(today);
        var end = VietnamDates.EndOfDayExclusiveUtc(today);

        var openSessions = await sessions.QueryNoTracking()
            .CountAsync(s => s.Status == SessionStatus.DangPhucVu || s.Status == SessionStatus.ChoThanhToan, ct);
        var activeTables = await tables.QueryNoTracking().CountAsync(t => t.IsActive, ct);
        var openIds = await sessions.QueryNoTracking()
            .Where(s => s.Status == SessionStatus.DangPhucVu || s.Status == SessionStatus.ChoThanhToan).Select(s => s.Id).ToListAsync(ct);
        var pendingOrders = await orders.QueryNoTracking().CountAsync(o => o.Status == OrderStatus.ChoXacNhan && openIds.Contains(o.SessionId), ct);
        var pendingRequests = await requests.QueryNoTracking().Where(r => r.Status == ServiceRequestStatus.DangCho).Select(r => r.CreatedAt).ToListAsync(ct);
        var closed = await ClosedSessionsAsync(start, end, ct);
        var todayOrders = await orders.QueryNoTracking().Where(o => o.SubmittedAt >= start && o.SubmittedAt < end).ToListAsync(ct);

        var revenue = closed.Sum(s => s.Total ?? 0);
        return new DashboardReport
        {
            Date = VietnamDates.Format(today),
            AsOf = now,
            OpenSessions = openSessions,
            ActiveTables = activeTables,
            PendingOrders = pendingOrders,
            PendingRequests = pendingRequests.Count,
            OverdueRequests = pendingRequests.Count(c => (now - c).TotalMinutes >= PosRules.RequestOverdueMinutes),
            Revenue = revenue,
            ClosedSessions = closed.Count,
            AvgSessionValue = closed.Count == 0 ? 0 : Math.Round(revenue / closed.Count, 0, MidpointRounding.AwayFromZero),
            AvgConfirmMinutes = AvgConfirmMinutes(todayOrders),
            ByHour = Enumerable.Range(0, 24).Select(hour => new HourStat
            {
                Hour = hour,
                Orders = todayOrders.Count(o => HourOf(o.SubmittedAt) == hour),
                Revenue = closed.Where(s => HourOf(s.ClosedAt!.Value) == hour).Sum(s => s.Total ?? 0)
            }).ToList()
        };
    }

    public async Task<RevenueReport> GetRevenueAsync(ReportQuery query, CancellationToken ct = default)
    {
        var (from, to) = Period(query);
        var days = to.DayNumber - from.DayNumber + 1;
        var prevFrom = from.AddDays(-days);
        var prevTo = from.AddDays(-1);

        var closed = await ClosedSessionsAsync(VietnamDates.StartOfDayUtc(prevFrom), VietnamDates.EndOfDayExclusiveUtc(to), ct);
        var ids = closed.Select(s => s.Id).ToList();
        var orderCounts = (await orders.QueryNoTracking().Where(o => ids.Contains(o.SessionId) && o.Status != OrderStatus.BiTuChoi)
                .Select(o => o.SessionId).ToListAsync(ct))
            .GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());
        var byDate = closed.GroupBy(s => VietnamDates.DateOf(s.ClosedAt!.Value)).ToDictionary(g => g.Key, g => g.ToList());

        RevenueTotals Totals(DateOnly a, DateOnly b)
        {
            var list = closed.Where(s => VietnamDates.DateOf(s.ClosedAt!.Value) is var d && d >= a && d <= b).ToList();
            return MakeTotals(list, orderCounts);
        }

        var totals = Totals(from, to);
        var previous = Totals(prevFrom, prevTo);
        return new RevenueReport
        {
            From = VietnamDates.Format(from),
            To = VietnamDates.Format(to),
            Totals = totals,
            Previous = new RevenuePeriodTotals
            {
                From = VietnamDates.Format(prevFrom),
                To = VietnamDates.Format(prevTo),
                Revenue = previous.Revenue,
                SessionCount = previous.SessionCount,
                OrderCount = previous.OrderCount,
                AvgSessionValue = previous.AvgSessionValue
            },
            RevenueChangePercent = previous.Revenue == 0 ? null : Round1((double)((totals.Revenue - previous.Revenue) / previous.Revenue * 100)),
            Daily = Enumerable.Range(0, days).Select(offset =>
            {
                var date = from.AddDays(offset);
                var day = MakeTotals(byDate.GetValueOrDefault(date) ?? [], orderCounts);
                return new RevenueDay
                {
                    Date = VietnamDates.Format(date),
                    Revenue = day.Revenue,
                    SessionCount = day.SessionCount,
                    OrderCount = day.OrderCount,
                    AvgSessionValue = day.AvgSessionValue,
                    PreviousRevenue = (byDate.GetValueOrDefault(date.AddDays(-days)) ?? []).Sum(s => s.Total ?? 0)
                };
            }).ToList()
        };
    }

    public async Task<ItemsReport> GetItemsAsync(ReportQuery query, CancellationToken ct = default)
    {
        var (from, to) = Period(query);
        var start = VietnamDates.StartOfDayUtc(from);
        var end = VietnamDates.EndOfDayExclusiveUtc(to);

        var menu = await menuItems.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(m => m.Id, ct);
        var categoryNames = await categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        bool InCategory(Guid menuItemId) => query.CategoryId is not { } cid || (menu.TryGetValue(menuItemId, out var m) && m.CategoryId == cid);

        // Món bán: dòng DaXacNhan, DaPhucVu của phiên đã đóng trong khoảng (theo closedAt).
        var closedIds = (await ClosedSessionsAsync(start, end, ct)).Select(s => s.Id).ToList();
        var sold = await orders.QueryNoTracking().Where(o => closedIds.Contains(o.SessionId))
            .SelectMany(o => o.Items)
            .Where(i => i.Status == OrderItemStatus.DaXacNhan || i.Status == OrderItemStatus.DaPhucVu)
            .ToListAsync(ct);
        sold = sold.Where(i => InCategory(i.MenuItemId)).ToList();
        var totalRevenue = sold.Sum(i => i.LineTotal);

        // Món có vấn đề: bị bỏ (theo giờ xử lý đơn), bị hủy (theo giờ hủy).
        var removed = await orders.QueryNoTracking().Where(o => o.HandledAt >= start && o.HandledAt < end)
            .SelectMany(o => o.Items).Where(i => i.Status == OrderItemStatus.BiBo).ToListAsync(ct);
        var cancelled = await orders.QueryNoTracking().SelectMany(o => o.Items)
            .Where(i => i.Status == OrderItemStatus.DaHuy && i.CancelledAt >= start && i.CancelledAt < end).ToListAsync(ct);
        var problems = removed.Select(i => (Kind: "BiBo", Item: i, Reason: PosLabels.Of(i.RemoveReason ?? Domain.Enums.Pos.Orders.RemoveReason.HetMon)))
            .Concat(cancelled.Select(i => (Kind: "DaHuy", Item: i, Reason: string.IsNullOrWhiteSpace(i.CancelReason) ? "Khác" : i.CancelReason)))
            .Where(p => InCategory(p.Item.MenuItemId))
            .ToList();

        string NameOf(OrderItem line) => menu.TryGetValue(line.MenuItemId, out var m) ? m.Name : line.ItemName;
        string CodeOf(OrderItem line) => menu.TryGetValue(line.MenuItemId, out var m) ? m.Code : line.ItemCode;

        return new ItemsReport
        {
            TotalRevenue = totalRevenue,
            Items = sold.GroupBy(i => i.MenuItemId).Select(g =>
            {
                var first = g.First();
                var categoryId = menu.TryGetValue(g.Key, out var m) ? m.CategoryId : Guid.Empty;
                var revenue = g.Sum(i => i.LineTotal);
                return new ItemSale
                {
                    MenuItemId = g.Key,
                    Code = CodeOf(first),
                    Name = NameOf(first),
                    CategoryId = categoryId,
                    CategoryName = categoryNames.GetValueOrDefault(categoryId) ?? string.Empty,
                    Quantity = g.Sum(i => i.Quantity),
                    Revenue = revenue,
                    Share = totalRevenue == 0 ? 0 : Round1((double)(revenue / totalRevenue * 100))
                };
            }).OrderByDescending(x => x.Quantity).ThenByDescending(x => x.Revenue).ThenBy(x => x.Code).ToList(),
            Problems = problems.GroupBy(p => p.Item.MenuItemId).Select(g => new ItemProblem
            {
                MenuItemId = g.Key,
                Code = CodeOf(g.First().Item),
                Name = NameOf(g.First().Item),
                RemovedQty = g.Where(p => p.Kind == "BiBo").Sum(p => p.Item.Quantity),
                CancelledQty = g.Where(p => p.Kind == "DaHuy").Sum(p => p.Item.Quantity),
                Value = g.Sum(p => p.Item.LineTotal),
                Reasons = g.GroupBy(p => (p.Kind, p.Reason))
                    .Select(r => new ProblemReason { Kind = r.Key.Kind, ReasonText = r.Key.Reason, Quantity = r.Sum(p => p.Item.Quantity) })
                    .OrderByDescending(r => r.Quantity).ToList()
            }).OrderByDescending(p => p.RemovedQty + p.CancelledQty).ThenBy(p => p.Code).ToList(),
            ReasonSummary = problems.GroupBy(p => (p.Kind, p.Reason)).Select(g => new ReasonSummary
            {
                Kind = g.Key.Kind,
                ReasonText = g.Key.Reason,
                LineCount = g.Count(),
                Quantity = g.Sum(p => p.Item.Quantity),
                Value = g.Sum(p => p.Item.LineTotal)
            }).OrderByDescending(r => r.Quantity).ToList()
        };
    }

    public async Task<OperationsReport> GetOperationsAsync(ReportQuery query, CancellationToken ct = default)
    {
        var (from, to) = Period(query);
        var start = VietnamDates.StartOfDayUtc(from);
        var end = VietnamDates.EndOfDayExclusiveUtc(to);

        var list = await orders.QueryNoTracking().Where(o => o.SubmittedAt >= start && o.SubmittedAt < end).ToListAsync(ct);
        var requestList = await requests.QueryNoTracking().Where(r => r.CreatedAt >= start && r.CreatedAt < end).ToListAsync(ct);
        var customer = list.Where(o => o.Source == OrderSource.KhachQr).ToList();
        var auto = customer.Count(o => o.AutoConfirmed);
        var rejected = customer.Count(o => o.Status == OrderStatus.BiTuChoi);
        var handled = requestList.Where(r => r.Status == ServiceRequestStatus.DaXuLy && !r.AutoHandled && r.HandledAt is not null).ToList();

        return new OperationsReport
        {
            OrderCount = list.Count,
            CustomerOrders = customer.Count,
            StaffOrders = list.Count - customer.Count,
            SelfOrderRate = Percent(customer.Count, list.Count),
            AutoConfirmedOrders = auto,
            AutoConfirmRate = Percent(auto, customer.Count),
            RejectedOrders = rejected,
            RejectRate = Percent(rejected, customer.Count),
            AvgConfirmMinutes = AvgConfirmMinutes(list),
            AvgRequestMinutes = handled.Count == 0 ? null : Round1(handled.Average(r => (r.HandledAt!.Value - r.CreatedAt).TotalMinutes)),
            RequestCount = requestList.Count,
            RejectReasons = customer.Concat(list.Where(o => o.Source == OrderSource.NhanVien))
                .Where(o => o.Status == OrderStatus.BiTuChoi && o.RejectReason is not null)
                .GroupBy(o => o.RejectReason!.Value)
                .Select(g => new RejectReasonStat { Reason = g.Key, ReasonText = PosLabels.Of(g.Key), Count = g.Count() })
                .OrderByDescending(r => r.Count).ToList(),
            ByHour = Enumerable.Range(0, 24).Select(hour => new HourOrders { Hour = hour, Orders = list.Count(o => HourOf(o.SubmittedAt) == hour) }).ToList(),
            Heatmap = Enumerable.Range(1, 7).SelectMany(weekday => Enumerable.Range(0, 24).Select(hour => new HeatCell
            {
                Weekday = weekday,
                Hour = hour,
                Orders = list.Count(o => HourOf(o.SubmittedAt) == hour && WeekdayOf(o.SubmittedAt) == weekday)
            })).ToList()
        };
    }

    /// <summary>Mặc định 30 ngày tới hôm nay; khoảng tối đa 366 ngày.</summary>
    private (DateOnly From, DateOnly To) Period(ReportQuery query)
    {
        var today = VietnamDates.Today(time);
        return PosDates.Dates(query.From, query.To, today.AddDays(-(DefaultDays - 1)), today);
    }

    private Task<List<TableSession>> ClosedSessionsAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct) =>
        sessions.QueryNoTracking()
            .Where(s => s.Status == SessionStatus.DaDong && s.ClosedAt >= startUtc && s.ClosedAt < endUtc)
            .ToListAsync(ct);

    private static RevenueTotals MakeTotals(IReadOnlyCollection<TableSession> closed, IReadOnlyDictionary<Guid, int> orderCounts)
    {
        var revenue = closed.Sum(s => s.Total ?? 0);
        return new RevenueTotals
        {
            Revenue = revenue,
            SessionCount = closed.Count,
            OrderCount = closed.Sum(s => orderCounts.GetValueOrDefault(s.Id)),
            AvgSessionValue = closed.Count == 0 ? 0 : Math.Round(revenue / closed.Count, 0, MidpointRounding.AwayFromZero)
        };
    }

    /// <summary>BR-19: giờ xác nhận hoặc từ chối − giờ gửi, chỉ đơn khách gửi phải chờ nhân viên (không tự xác nhận).</summary>
    private static double? AvgConfirmMinutes(IEnumerable<Order> list)
    {
        var waited = list.Where(o => o.Source == OrderSource.KhachQr && !o.AutoConfirmed && o.HandledAt is not null).ToList();
        return waited.Count == 0 ? null : Round1(waited.Average(o => (o.HandledAt!.Value - o.SubmittedAt).TotalMinutes));
    }

    private static int HourOf(DateTime utc) => VietnamDates.ToVietnam(utc).Hour;

    private static int WeekdayOf(DateTime utc) => VietnamDates.ToVietnam(utc).DayOfWeek is var d && d == DayOfWeek.Sunday ? 7 : (int)d;

    private static double Percent(int part, int whole) => whole == 0 ? 0 : Round1(part * 100.0 / whole);

    private static double Round1(double value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);
}
