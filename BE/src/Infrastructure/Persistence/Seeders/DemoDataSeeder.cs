using System.Globalization;
using System.Text.Json;
using Application.Common.Time;
using Domain.Base;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Infrastructure.Implementations.Services.Menu;
using Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu của Quán Vườn Dừa (bảng <c>Pos_*</c>), đọc từ <c>FE/src/mock/seed/demo-data.json</c> (nguồn duy nhất,
/// FE mock nạp cùng file; cấu trúc, khóa gọn và cách suy ra trường: 06 §5).
/// </summary>
/// <remarks>
/// <list type="bullet">
/// <item><c>now</c> = lúc nạp làm tròn xuống tới phút; giờ dạng số là <c>now + N phút</c>, giờ <c>HH:mm</c> là giờ Việt Nam của
/// ngày thật ứng với ô ngày (<see cref="SeedSlots.DayOffsetOfSlot"/>, giống demo Quản lý Nhà hàng).</item>
/// <item>Dòng đơn chụp tên, giá hiện tại của thực đơn mẫu; trạng thái đơn, phiên, yêu cầu suy ra bằng chính các method của entity
/// (xác nhận, bỏ món, phục vụ, hủy món tách dòng, thu tiền) nên dữ liệu mẫu đi qua đúng quy tắc nghiệp vụ.</item>
/// <item>Mã phiên theo (giờ mở, số bàn) trong ngày; mã đơn theo (giờ gửi, số bàn, thứ tự trong phiên) trong ngày.</item>
/// </list>
/// Số liệu phải khớp 06 §5.6 (test <c>MenuQrSeedTests</c>).
/// </remarks>
public sealed class DemoDataSeeder(
    AppDbContext db,
    TimeProvider timeProvider,
    IOptions<FileStorageOptions> fileStorageOptions,
    ILogger<DemoDataSeeder> logger) : IDemoDataSeeder
{
    public const string SeedFileName = "demo-data.json";

    private const string ImageFolder = "/seed/menu/";
    private const int MasterDataDaysAgo = 100;
    private const string FallbackServer = "nhanvien";
    private static readonly TimeSpan MasterDataTime = new(8, 0, 0);

    public async Task<bool> HasDataAsync(CancellationToken ct = default) =>
        await db.Set<Category>().IgnoreQueryFilters().AnyAsync(ct) || await db.Set<DiningTable>().IgnoreQueryFilters().AnyAsync(ct);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = SeedJson.Read<MenuQrSeedFile>(SeedFileName, timeProvider);
        var context = new SeedContext(timeProvider, await LoadUsersAsync(ct));

        var masterCreatedAt = SeedDates.DaysAgo(timeProvider, MasterDataDaysAgo, MasterDataTime);
        var categories = SeedCategories(seed.Categories ?? [], masterCreatedAt);
        var (groups, choices) = SeedOptionGroups(seed.OptionGroups ?? [], masterCreatedAt);
        var menu = SeedMenuItems(seed.MenuItems ?? [], categories, groups, context, masterCreatedAt);
        var tables = SeedTables(seed.Tables ?? [], masterCreatedAt);
        await db.SaveChangesAsync(ct);

        var plans = PlanSessions(seed, tables, menu, choices, groups, context);
        var counts = BuildSessions(plans, context);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Đã nạp dữ liệu mẫu Menu QR: {Categories} danh mục, {Items} món, {Tables} bàn, {Sessions} phiên, {Orders} đơn, {Lines} dòng, {Requests} yêu cầu.",
            categories.Count, menu.Count, tables.Count, plans.Count, counts.Orders, counts.Lines, counts.Requests);
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        // Bảng con trước, bảng cha sau; gỡ khóa ngoại vòng bàn ↔ phiên trước khi xóa.
        await db.Set<DiningTable>().IgnoreQueryFilters().ExecuteUpdateAsync(s => s.SetProperty(t => t.CurrentSessionId, t => null), ct);
        await db.Set<ServiceRequest>().ExecuteDeleteAsync(ct);
        await db.Set<OrderItem>().ExecuteDeleteAsync(ct);
        await db.Set<Order>().ExecuteDeleteAsync(ct);
        await db.Set<TableSession>().ExecuteDeleteAsync(ct);
        await db.Set<MenuItemOptionGroup>().ExecuteDeleteAsync(ct);
        await db.Set<OptionChoice>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<OptionGroup>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<MenuItem>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Category>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<DiningTable>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);

        DeleteUploadedImages();
    }

    // ---------- Thực đơn, bàn ----------

    private Dictionary<string, Category> SeedCategories(List<CategorySeed> items, DateTime createdAt)
    {
        var result = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var category = Category.Create(item.Code, item.Name, item.NameEn, item.Color, isHidden: false, item.SortOrder);
            Add(category, createdAt);
            result[category.Code] = category;
        }

        return result;
    }

    private (Dictionary<string, OptionGroup> Groups, Dictionary<string, OptionChoice> Choices) SeedOptionGroups(List<OptionGroupSeed> items, DateTime createdAt)
    {
        var groups = new Dictionary<string, OptionGroup>(StringComparer.OrdinalIgnoreCase);
        var choices = new Dictionary<string, OptionChoice>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var group = OptionGroup.Create(item.Name, item.NameEn, item.Type, item.Required, item.Max, item.SortOrder);
            var list = item.Choices ?? [];
            for (var i = 0; i < list.Count; i++)
            {
                var choice = OptionChoice.Create(group.Id, list[i].Name, list[i].NameEn, list[i].Price, list[i].Default ?? false, (i + 1) * PosRules.SortOrderStep);
                group.Choices.Add(choice);
                choices[list[i].Key] = choice;
            }

            Add(group, createdAt);
            foreach (var choice in group.Choices)
                db.Entry(choice).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = createdAt;
            groups[item.Key] = group;
        }

        return (groups, choices);
    }

    private Dictionary<string, MenuItem> SeedMenuItems(
        List<MenuItemSeed> items,
        Dictionary<string, Category> categories,
        Dictionary<string, OptionGroup> groups,
        SeedContext context,
        DateTime createdAt)
    {
        var result = new Dictionary<string, MenuItem>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var category = categories.GetValueOrDefault(item.Category) ?? throw Invalid($"món '{item.Code}' trỏ tới danh mục '{item.Category}' không có.");
            var menuItem = MenuItem.Create(item.Code, item.Name, item.NameEn, category.Id, item.Description, null, item.Unit, item.Price,
                item.Tags ?? [], item.SortOrder);
            if (!string.IsNullOrWhiteSpace(item.Image))
                menuItem.SetImage(ImageFolder + item.Image.Trim());
            menuItem.SetOptionGroups((item.Groups ?? [])
                .Select(key => groups.GetValueOrDefault(key)?.Id ?? throw Invalid($"món '{item.Code}' trỏ tới nhóm '{key}' không có."))
                .ToList());
            if (item.SoldOut is { } mode)
                menuItem.MarkSoldOut(mode, VietnamDates.EndOfDayExclusiveUtc(context.Today));
            menuItem.SetHidden(item.Hidden ?? false);
            Add(menuItem, createdAt);
            result[menuItem.Code] = menuItem;
        }

        return result;
    }

    private Dictionary<int, DiningTable> SeedTables(List<TableSeed> items, DateTime createdAt)
    {
        var result = new Dictionary<int, DiningTable>();
        foreach (var item in items)
        {
            var table = DiningTable.Create(item.Name, item.Zone, item.Capacity, item.Code, item.No * PosRules.SortOrderStep);
            if (item.Active == false)
                table.SetActive(false);
            Add(table, createdAt);
            result[item.No] = table;
        }

        return result;
    }

    // ---------- Phiên, đơn, yêu cầu ----------

    private sealed record LinePlan(MenuItem Item, int Quantity, IReadOnlyList<OrderItemOption> Options, LineExtraSeed? Extra);

    private sealed record OrderPlan(OrderSeed Seed, int Index, DateTime SubmittedAt, List<LinePlan> Lines)
    {
        public string Code { get; set; } = string.Empty;
    }

    private sealed record SessionPlan(SessionSeed Seed, DiningTable Table, int TableNo, int Day, bool Live, List<OrderPlan> Orders)
    {
        public DateTime OpenedAt => Orders[0].SubmittedAt;

        public string Code { get; set; } = string.Empty;
    }

    private static List<SessionPlan> PlanSessions(
        MenuQrSeedFile seed,
        Dictionary<int, DiningTable> tables,
        Dictionary<string, MenuItem> menu,
        Dictionary<string, OptionChoice> choices,
        Dictionary<string, OptionGroup> groups,
        SeedContext context)
    {
        var groupOfChoice = groups.Values.SelectMany(g => g.Choices.Select(c => (c.Id, Group: g))).ToDictionary(x => x.Id, x => x.Group);
        var plans = new List<SessionPlan>();
        foreach (var (source, live) in (seed.Sessions ?? []).Select(s => (s, false)).Concat((seed.LiveSessions ?? []).Select(s => (s, true))))
        {
            var table = tables.GetValueOrDefault(source.Tb) ?? throw Invalid($"phiên trỏ tới bàn số {source.Tb} không có.");
            var day = source.D ?? 0;
            var orderPlans = source.Od.Select((order, index) => new OrderPlan(order, index, context.Time(order.T, day),
                order.It.Select(line => ParseLine(line, menu, choices, groupOfChoice)).ToList())).ToList();
            if (orderPlans.Count == 0)
                throw Invalid($"phiên của bàn số {source.Tb} không có đơn.");
            plans.Add(new SessionPlan(source, table, source.Tb, day, live, orderPlans));
        }

        // Mã phiên: PB + yyMMdd (ngày mở) + số thứ tự theo (giờ mở, số bàn) trong ngày.
        foreach (var group in plans.GroupBy(p => VietnamDates.DateOf(p.OpenedAt)))
        {
            var sequence = 0;
            foreach (var plan in group.OrderBy(p => p.OpenedAt).ThenBy(p => p.TableNo))
                plan.Code = Code("PB", group.Key, ++sequence);
        }

        // Mã đơn: DH + yyMMdd (ngày gửi) + số thứ tự theo (giờ gửi, số bàn, thứ tự trong phiên) trong ngày.
        var allOrders = plans.SelectMany(p => p.Orders.Select(o => (Plan: p, Order: o))).ToList();
        foreach (var group in allOrders.GroupBy(x => VietnamDates.DateOf(x.Order.SubmittedAt)))
        {
            var sequence = 0;
            foreach (var entry in group.OrderBy(x => x.Order.SubmittedAt).ThenBy(x => x.Plan.TableNo).ThenBy(x => x.Order.Index))
                entry.Order.Code = Code("DH", group.Key, ++sequence);
        }

        return plans;
    }

    private static LinePlan ParseLine(
        JsonElement line,
        Dictionary<string, MenuItem> menu,
        Dictionary<string, OptionChoice> choices,
        Dictionary<Guid, OptionGroup> groupOfChoice)
    {
        if (line.ValueKind != JsonValueKind.Array || line.GetArrayLength() < 2)
            throw Invalid($"dòng đơn '{line}' không đúng dạng [mã món, số lượng, ...].");

        var code = line[0].GetString() ?? string.Empty;
        var item = menu.GetValueOrDefault(code) ?? throw Invalid($"dòng đơn trỏ tới món '{code}' không có.");
        var quantity = line[1].GetInt32();
        var keys = line.GetArrayLength() > 2 && line[2].ValueKind == JsonValueKind.Array
            ? line[2].EnumerateArray().Select(k => k.GetString() ?? string.Empty).ToList()
            : [];
        var extra = line.GetArrayLength() > 3 ? line[3].Deserialize<LineExtraSeed>(SeedJson.Options) : null;

        // Lựa chọn chụp theo thứ tự nhóm của món, rồi thứ tự lựa chọn (07 §3.8).
        var picked = keys.Select(k => choices.GetValueOrDefault(k) ?? throw Invalid($"món '{code}' có lựa chọn '{k}' không có.")).ToList();
        var options = item.OrderedGroupIds
            .SelectMany(groupId => picked.Where(c => groupOfChoice[c.Id].Id == groupId).OrderBy(c => c.SortOrder)
                .Select(c => new OrderItemOption(groupId, groupOfChoice[c.Id].Name, c.Id, c.Name, c.Price)))
            .ToList();
        if (options.Count != picked.Count)
            throw Invalid($"món '{code}' có lựa chọn không thuộc nhóm của món.");

        return new LinePlan(item, quantity, options, extra);
    }

    private (int Orders, int Lines, int Requests) BuildSessions(List<SessionPlan> plans, SeedContext context)
    {
        int orderCount = 0, lineCount = 0, requestCount = 0;
        foreach (var plan in plans)
        {
            var source = plan.Seed;
            var table = plan.Table;
            var session = TableSession.Open(plan.Code, table.Id, table.Name, plan.OpenedAt);
            DateTime? closedAt = source.C is { } c && c.ValueKind != JsonValueKind.Null ? context.Time(c, plan.Day) : null;
            var closer = source.By is { } closerName ? context.User(closerName) : null;

            var builtOrders = new List<Order>();
            foreach (var orderPlan in plan.Orders)
            {
                var order = BuildOrder(orderPlan, session, table, closer, context);
                session.Orders.Add(order);
                builtOrders.Add(order);
            }

            // Phiên: mọi đơn bị từ chối → tự hủy; có giờ đóng → đã thu tiền; còn lại đang mở (liveSessions).
            if (builtOrders.All(o => o.Status == OrderStatus.BiTuChoi))
            {
                session.CancelAutomatically(builtOrders.Max(o => o.HandledAt!.Value));
            }
            else if (closedAt is { } closed)
            {
                var method = Enum.Parse<PaymentMethod>(source.Pm?[0].GetString() ?? nameof(PaymentMethod.TienMat));
                decimal? cash = source.Pm is { Count: > 1 } pm && pm[1].ValueKind == JsonValueKind.Number ? pm[1].GetDecimal() : null;
                session.Close(OrderPricing.SessionSubtotal(builtOrders), method, cash, source.Vat == 1, closed, closer?.Id, closer?.FullName, null);
            }

            var builtRequests = BuildRequests(plan, session, closedAt, closer, builtOrders, context);
            if (session.IsOpen)
            {
                if (builtRequests.Any(r => r.Type == ServiceRequestType.ThanhToan && r.IsPending))
                    session.MarkPaymentRequested();
                table.AttachSession(session.Id);
            }

            Add(session, session.OpenedAt, session.ClosedAt);
            foreach (var order in builtOrders)
            {
                db.Entry(order).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = order.SubmittedAt;
                db.Entry(order).Property(nameof(BaseEntity.UpdatedAt)).CurrentValue = order.HandledAt;
                foreach (var item in order.Items)
                    db.Entry(item).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = order.SubmittedAt;
            }

            orderCount += builtOrders.Count;
            lineCount += builtOrders.Sum(o => o.Items.Count);
            requestCount += builtRequests.Count;
        }

        return (orderCount, lineCount, requestCount);
    }

    private static Order BuildOrder(OrderPlan plan, TableSession session, DiningTable table, SeedUser? closer, SeedContext context)
    {
        var seed = plan.Seed;
        var t = plan.SubmittedAt;
        var items = plan.Lines.Select((line, index) => OrderItem.Create(
            line.Item.Id, line.Item.Code, line.Item.Name, line.Item.Price, line.Options, line.Quantity, line.Extra?.N,
            (index + 1) * PosRules.SortOrderStep)).ToList();
        var staffOrder = seed.S == "N";
        var order = Order.Create(plan.Code, session.Id, table.Id, table.Name, staffOrder ? OrderSource.NhanVien : OrderSource.KhachQr,
            seed.G, null, t, null, null, null, items);
        var by = seed.By is { } username ? context.User(username) : null;

        if (seed.Rj is { Count: >= 2 } rj)
        {
            var reason = Enum.Parse<RejectReason>(rj[0].GetString() ?? nameof(RejectReason.Khac));
            order.Reject(t.AddMinutes(rj[1].GetInt32()), by?.Id, by?.FullName, reason, rj.Count > 2 ? rj[2].GetString() : null);
            return order;
        }

        var removals = new Dictionary<Guid, (RemoveReason, string?)>();
        for (var i = 0; i < plan.Lines.Count; i++)
        {
            if (plan.Lines[i].Extra?.Rm is { Count: >= 1 } rm)
                removals[items[i].Id] = (Enum.Parse<RemoveReason>(rm[0]), rm.Count > 1 ? rm[1] : null);
        }

        SeedUser? server;
        if (staffOrder)
        {
            order.Confirm(t, by?.Id, by?.FullName, removals);
            server = by;
        }
        else if (seed.Cf is { ValueKind: JsonValueKind.String })
        {
            order.AutoConfirm();
            server = closer ?? context.User(FallbackServer);
        }
        else if (seed.Cf is { ValueKind: JsonValueKind.Number } cf)
        {
            order.Confirm(t.AddMinutes(cf.GetInt32()), by?.Id, by?.FullName, removals);
            server = by;
        }
        else
        {
            return order;
        }

        for (var i = 0; i < plan.Lines.Count; i++)
        {
            var served = plan.Lines[i].Extra?.Sv ?? seed.Sv;
            if (served is { } minutes && !removals.ContainsKey(items[i].Id))
                order.Serve([items[i].Id], t.AddMinutes(minutes), server?.Id);
        }

        for (var i = 0; i < plan.Lines.Count; i++)
        {
            if (plan.Lines[i].Extra?.Cx is not { Count: >= 4 } cx)
                continue;
            var user = context.User(cx[3].GetString() ?? string.Empty);
            order.CancelItem(items[i].Id, cx[0].GetInt32(), cx[1].GetString() ?? string.Empty, t.AddMinutes(cx[2].GetInt32()), user.Id, user.FullName);
        }

        return order;
    }

    private List<ServiceRequest> BuildRequests(
        SessionPlan plan, TableSession session, DateTime? closedAt, SeedUser? closer, List<Order> builtOrders, SeedContext context)
    {
        var result = new List<ServiceRequest>();
        foreach (var rq in plan.Seed.Rq ?? [])
        {
            var createdAt = context.Time(rq.T, plan.Day);
            var request = rq.Ty == "T"
                ? ServiceRequest.CreatePayment(plan.Table.Id, plan.Table.Name, session.Id, rq.Pm ?? PaymentMethod.TienMat, rq.Vat == 1, null, null)
                : ServiceRequest.CreateCall(plan.Table.Id, plan.Table.Name, session.Id, rq.R ?? CallReason.Khac, rq.N, null, null);

            if (rq.Cx == 1)
            {
                var next = builtOrders.Where(o => o.SubmittedAt > createdAt).Min(o => (DateTime?)o.SubmittedAt) ?? createdAt;
                request.CancelAutomatically(next);
            }
            else if (rq.H is { } minutes)
            {
                var by = rq.By is { } username ? context.User(username) : closer;
                request.Handle(createdAt.AddMinutes(minutes), by?.Id, by?.FullName);
            }
            else if (!plan.Live && closedAt is { } closed)
            {
                request.Handle(closed, closer?.Id, closer?.FullName, auto: true);
            }

            Add(request, createdAt, request.HandledAt);
            result.Add(request);
        }

        return result;
    }

    // ---------- Tiện ích ----------

    private static string Code(string prefix, DateOnly date, int sequence) =>
        prefix + date.ToString("yyMMdd", CultureInfo.InvariantCulture) + sequence.ToString("0000", CultureInfo.InvariantCulture);

    private sealed record SeedUser(Guid Id, string Username, string FullName);

    private sealed class SeedContext
    {
        private readonly Dictionary<string, SeedUser> _users;
        private readonly int _isoToday;

        public SeedContext(TimeProvider timeProvider, Dictionary<string, SeedUser> users)
        {
            var utc = timeProvider.GetUtcNow().UtcDateTime;
            Now = new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute, 0, DateTimeKind.Utc);
            Today = VietnamDates.DateOf(Now);
            _isoToday = SeedSlots.IsoDayOfWeek(Today);
            _users = users;
        }

        /// <summary>Lúc nạp, làm tròn xuống tới phút.</summary>
        public DateTime Now { get; }

        public DateOnly Today { get; }

        /// <summary>Giờ dạng số là phút so với <see cref="Now"/>; dạng chuỗi là <c>HH:mm</c> của ô ngày <paramref name="d"/>.</summary>
        public DateTime Time(JsonElement value, int d) => value.ValueKind switch
        {
            JsonValueKind.Number => Now.AddMinutes(value.GetInt32()),
            JsonValueKind.String => VietnamDates.StartOfDayUtc(Today.AddDays(SeedSlots.DayOffsetOfSlot(d, _isoToday))).AddMinutes(Minutes(value.GetString() ?? string.Empty)),
            _ => throw Invalid($"giờ '{value}' không phải số phút hoặc HH:mm.")
        };

        public SeedUser User(string username) =>
            _users.GetValueOrDefault(username) ?? throw Invalid($"tài khoản '{username}' không có trong System_Users (project.json).");

        private static int Minutes(string hhmm)
        {
            var parts = hhmm.Trim().Split(':');
            if (parts.Length != 2
                || !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var hour)
                || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var minute))
            {
                throw Invalid($"giờ '{hhmm}' không đúng định dạng HH:mm.");
            }

            return hour * 60 + minute;
        }
    }

    private async Task<Dictionary<string, SeedUser>> LoadUsersAsync(CancellationToken ct) =>
        await db.Set<User>().AsNoTracking()
            .Select(u => new SeedUser(u.Id, u.Username, u.FullName))
            .ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);

    /// <summary>Thêm entity với ngày tạo, ngày sửa gán sẵn; interceptor giữ nguyên giá trị đã gán khi thêm mới.</summary>
    private void Add(BaseEntity entity, DateTime createdAt, DateTime? updatedAt = null)
    {
        var entry = db.Add((object)entity);
        entry.Property(nameof(BaseEntity.CreatedAt)).CurrentValue = createdAt;
        entry.Property(nameof(BaseEntity.UpdatedAt)).CurrentValue = updatedAt;
    }

    /// <summary>Xóa ảnh món đã tải lên (<c>wwwroot/uploads/menu</c>); ảnh mẫu <c>/seed/...</c> nằm ở FE nên không đụng tới.</summary>
    private void DeleteUploadedImages()
    {
        var folder = Path.Combine(fileStorageOptions.Value.RootPath, MenuItemService.UploadFolder);
        try
        {
            if (Directory.Exists(folder))
                Directory.Delete(folder, recursive: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Không xóa được thư mục ảnh tải lên {Folder}.", folder);
        }
    }

    private static InvalidOperationException Invalid(string message) =>
        new($"Dữ liệu seed không hợp lệ (FE/src/mock/seed/{SeedFileName}): {message}");
}
