using Application.Common.Exceptions;
using Application.DTOs.Tables;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Realtime;
using Application.Interfaces.Services.Tables;
using Application.Mappings.Tables;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Tables;
using Domain.Entities.System.Settings;
using Domain.Enums.Pos.Orders;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Tables;

/// <summary>Bàn và mã QR (07 §2.5, UC-11, BR-01, BR-17).</summary>
public sealed class TableService(
    IGenericRepository<DiningTable> tables,
    IGenericRepository<TableSession> sessions,
    IUnitOfWork unitOfWork,
    IPosEventPublisher events,
    TimeProvider time) : ITableService
{
    public async Task<IReadOnlyList<DiningTableDto>> GetListAsync(CancellationToken ct = default)
    {
        var list = await tables.QueryNoTracking().ToListAsync(ct);
        var open = await OpenSessionsAsync(list, ct);
        return Ordered(list).Select(t => ToDto(t, open)).ToList();
    }

    public async Task<DiningTableDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var table = await tables.QueryNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy bàn.");
        return ToDto(table, await OpenSessionsAsync([table], ct));
    }

    public async Task<DiningTableDto> CreateAsync(SaveTableRequest request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (await NameTakenAsync(name, null, ct))
            throw new ConflictException("Tên bàn đã tồn tại", "name");

        var sortOrder = request.SortOrder
            ?? (await tables.Query().IgnoreQueryFilters().MaxAsync(t => (int?)t.SortOrder, ct) ?? 0) + PosRules.SortOrderStep;
        var table = DiningTable.Create(name, request.Zone, request.Capacity, await PosCodes.NewTableCodeAsync(tables, ct), sortOrder);
        await tables.AddAsync(table, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await events.TablesChangedAsync([table.Id], ct);
        return ToDto(table, new Dictionary<Guid, TableSession>());
    }

    public async Task<DiningTableDto> UpdateAsync(Guid id, SaveTableRequest request, CancellationToken ct = default)
    {
        var table = await LoadAsync(id, ct);
        var name = request.Name.Trim();
        if (await NameTakenAsync(name, id, ct))
            throw new ConflictException("Tên bàn đã tồn tại", "name");

        // Mã giữ nguyên (UC-11 1a).
        table.Update(name, request.Zone, request.Capacity, request.SortOrder ?? table.SortOrder);
        await unitOfWork.SaveChangesAsync(ct);
        await events.TablesChangedAsync([id], ct);
        return ToDto(table, await OpenSessionsAsync([table], ct));
    }

    public async Task SetActiveAsync(Guid id, SetTableActiveRequest request, CancellationToken ct = default)
    {
        var table = await LoadAsync(id, ct);
        table.SetActive(request.IsActive);
        await unitOfWork.SaveChangesAsync(ct);
        await events.TablesChangedAsync([id], ct);
    }

    public async Task<DiningTableDto> RegenerateCodeAsync(Guid id, CancellationToken ct = default)
    {
        var table = await LoadAsync(id, ct);
        table.EnsureDeletable();
        table.ChangeCode(await PosCodes.NewTableCodeAsync(tables, ct), time.GetUtcNow().UtcDateTime);
        await unitOfWork.SaveChangesAsync(ct);
        await events.TablesChangedAsync([id], ct);
        return ToDto(table, new Dictionary<Guid, TableSession>());
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var table = await LoadAsync(id, ct);
        table.EnsureDeletable();
        tables.Delete(table);
        await unitOfWork.SaveChangesAsync(ct);
        await events.TablesChangedAsync([id], ct);
    }

    public async Task<IReadOnlyList<GuestTableLink>> GetGuestLinksAsync(CancellationToken ct = default)
    {
        var list = await tables.QueryNoTracking().ToListAsync(ct);
        var open = await OpenSessionsAsync(list, ct);
        return Ordered(list).Select(t => new GuestTableLink
        {
            Name = t.Name,
            Zone = t.Zone,
            Code = t.Code,
            Status = t.StatusOf(StatusOf(t, open))
        }).ToList();
    }

    /// <summary>Theo khu (thứ tự <c>SortOrder</c> nhỏ nhất của khu) rồi <c>SortOrder</c> (07 §2.5).</summary>
    internal static IEnumerable<DiningTable> Ordered(IEnumerable<DiningTable> list)
    {
        var all = list.ToList();
        var zoneOrder = all.GroupBy(t => t.Zone).ToDictionary(g => g.Key, g => g.Min(t => t.SortOrder));
        return all.OrderBy(t => zoneOrder[t.Zone]).ThenBy(t => t.Zone).ThenBy(t => t.SortOrder).ThenBy(t => t.Name);
    }

    /// <summary>Tên bàn trùng: so không phân biệt hoa thường (Postgres: cả dấu, qua <c>unaccent</c>).</summary>
    private Task<bool> NameTakenAsync(string name, Guid? exceptId, CancellationToken ct)
    {
        var pattern = LikePattern.Escape(name);
        return tables.QueryNoTracking().AnyAsync(t => AppDbFunctions.Matches(t.Name, pattern) && (exceptId == null || t.Id != exceptId), ct);
    }

    private async Task<DiningTable> LoadAsync(Guid id, CancellationToken ct) =>
        await tables.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy bàn.");

    private async Task<Dictionary<Guid, TableSession>> OpenSessionsAsync(IEnumerable<DiningTable> list, CancellationToken ct)
    {
        var ids = list.Where(t => t.CurrentSessionId is not null).Select(t => t.CurrentSessionId!.Value).ToList();
        return ids.Count == 0
            ? new Dictionary<Guid, TableSession>()
            : await sessions.QueryNoTracking().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
    }

    private static SessionStatus? StatusOf(DiningTable table, Dictionary<Guid, TableSession> open) =>
        table.CurrentSessionId is { } sid && open.TryGetValue(sid, out var session) ? session.Status : null;

    private static DiningTableDto ToDto(DiningTable table, Dictionary<Guid, TableSession> open)
    {
        var session = table.CurrentSessionId is { } sid ? open.GetValueOrDefault(sid) : null;
        return table.ToDto(session?.Status, session?.Code);
    }
}

/// <summary>Cài đặt nhận đơn (07 §2.6, UC-13, BR-07, BR-08): đọc, ghi các khóa <c>Ordering.*</c> của System_Settings.</summary>
public sealed class OrderSettingsService(
    IGenericRepository<Setting> settings,
    IUnitOfWork unitOfWork,
    IPosEventPublisher events,
    TimeProvider time) : IOrderSettingsService, IStoreProfileService
{
    public async Task<OrderingStatusDto> GetAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow().UtcDateTime;
        return (await PosSettings.OrderingAsync(settings, now, ct)).ToDto(now);
    }

    public Task<OrderingStatusDto> UpdateAsync(UpdateOrderSettingsRequest request, CancellationToken ct = default) =>
        WriteAsync(new Dictionary<string, string>
        {
            [OrderingClock.OpenTimeKey] = request.OpenTime.Trim(),
            [OrderingClock.CloseTimeKey] = request.CloseTime.Trim(),
            [OrderingClock.ConfirmModeKey] = request.ConfirmMode!.Value.ToString()
        }, ct);

    /// <summary>15/30 phút ghi thời điểm ISO UTC; null ghi <c>manual</c>.</summary>
    public Task<OrderingStatusDto> PauseAsync(PauseOrderingRequest request, CancellationToken ct = default) =>
        WriteAsync(new Dictionary<string, string>
        {
            [OrderingClock.PausedUntilKey] = request.Minutes is { } minutes
                ? time.GetUtcNow().UtcDateTime.AddMinutes(minutes).ToString("yyyy-MM-ddTHH:mm:ss.fffZ", System.Globalization.CultureInfo.InvariantCulture)
                : OrderingClock.PausedManual
        }, ct);

    public Task<OrderingStatusDto> ResumeAsync(CancellationToken ct = default) =>
        WriteAsync(new Dictionary<string, string> { [OrderingClock.PausedUntilKey] = string.Empty }, ct);

    public Task<OrderingStatusDto> AcceptAllDayAsync(CancellationToken ct = default) =>
        WriteAsync(new Dictionary<string, string>
        {
            [OrderingClock.OpenTimeKey] = "00:00",
            [OrderingClock.CloseTimeKey] = "00:00",
            [OrderingClock.PausedUntilKey] = string.Empty
        }, ct);

    Task<StoreProfileDto> IStoreProfileService.GetAsync(CancellationToken ct) => PosSettings.StoreAsync(settings, ct);

    private async Task<OrderingStatusDto> WriteAsync(Dictionary<string, string> values, CancellationToken ct)
    {
        var keys = values.Keys.ToList();
        var existing = await settings.Query().Where(s => keys.Contains(s.Key)).ToDictionaryAsync(s => s.Key, ct);
        foreach (var (key, value) in values)
        {
            if (existing.TryGetValue(key, out var setting))
                setting.SetValue(value);
            else
                await settings.AddAsync(Setting.Create(key, value, "Nhận đơn QR"), ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await events.OrderingChangedAsync(ct);
        return await GetAsync(ct);
    }
}
