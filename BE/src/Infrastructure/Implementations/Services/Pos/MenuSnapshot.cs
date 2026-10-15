using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Application.Common.Time;
using Application.Interfaces.Repositories;
using Domain.Entities.Pos.Menu;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Pos;

/// <summary>
/// Toàn bộ thực đơn chưa xóa (danh mục, món kèm nhóm, nhóm kèm lựa chọn), đọc một lần cho mỗi request. Thực đơn nhỏ
/// (vài chục món) nên tính hết món, kiểm lựa chọn, dấu thực đơn trong bộ nhớ (07 §3.8).
/// </summary>
internal sealed class MenuSnapshot
{
    private MenuSnapshot(List<Category> categories, List<MenuItem> items, List<OptionGroup> groups)
    {
        Categories = categories.ToDictionary(c => c.Id);
        Items = items.ToDictionary(i => i.Id);
        Groups = groups.ToDictionary(g => g.Id);
    }

    public Dictionary<Guid, Category> Categories { get; }
    public Dictionary<Guid, MenuItem> Items { get; }
    public Dictionary<Guid, OptionGroup> Groups { get; }

    public static async Task<MenuSnapshot> LoadAsync(
        IGenericRepository<Category> categories,
        IGenericRepository<MenuItem> items,
        IGenericRepository<OptionGroup> groups,
        CancellationToken ct)
    {
        var categoryList = await categories.QueryNoTracking().ToListAsync(ct);
        var itemList = await items.QueryNoTracking().Include(i => i.OptionGroups).ToListAsync(ct);
        var groupList = await groups.QueryNoTracking().Include(g => g.Choices).ToListAsync(ct);
        return new MenuSnapshot(categoryList, itemList, groupList);
    }

    /// <summary>Nhóm của món theo thứ tự hiển thị (bỏ nhóm đã xóa).</summary>
    public IReadOnlyList<OptionGroup> GroupsOf(MenuItem item) =>
        item.OrderedGroupIds.Select(id => Groups.GetValueOrDefault(id)).Where(g => g is not null).Select(g => g!).ToList();

    /// <summary>BR-14: món hết hiệu lực, hoặc có nhóm chọn một bắt buộc mà mọi lựa chọn đều hết.</summary>
    public bool IsSoldOut(MenuItem item, DateTime nowUtc) => item.IsSoldOutAt(nowUtc) || GroupsOf(item).Any(g => g.BlocksItem(nowUtc));

    /// <summary>Món khách thấy: chưa ẩn, danh mục còn và chưa ẩn.</summary>
    public bool IsVisible(MenuItem item) =>
        !item.IsHidden && Categories.TryGetValue(item.CategoryId, out var category) && !category.IsHidden;

    /// <summary>Món theo (thứ tự danh mục, thứ tự món).</summary>
    public IEnumerable<MenuItem> OrderedItems() =>
        Items.Values
            .OrderBy(i => Categories.TryGetValue(i.CategoryId, out var c) ? c.SortOrder : int.MaxValue)
            .ThenBy(i => i.SortOrder)
            .ThenBy(i => i.Code, StringComparer.Ordinal);

    /// <summary>
    /// 07 §3.8: băm ngắn của (giờ sửa gần nhất các bảng thực đơn, kể cả bản ghi đã xóa; số món, số gán nhóm, số lựa chọn chưa xóa;
    /// ngày hiện tại giờ Việt Nam). Đổi khi thực đơn đổi hoặc qua 00:00.
    /// </summary>
    public static async Task<string> StampAsync(
        IGenericRepository<Category> categories,
        IGenericRepository<MenuItem> items,
        IGenericRepository<OptionGroup> groups,
        IGenericRepository<OptionChoice> choices,
        DateTime nowUtc,
        CancellationToken ct)
    {
        var stamps = new List<DateTime>();
        stamps.AddRange(await categories.QueryNoTracking().IgnoreQueryFilters().Select(x => x.UpdatedAt ?? x.CreatedAt).ToListAsync(ct));
        stamps.AddRange(await items.QueryNoTracking().IgnoreQueryFilters().Select(x => x.UpdatedAt ?? x.CreatedAt).ToListAsync(ct));
        stamps.AddRange(await groups.QueryNoTracking().IgnoreQueryFilters().Select(x => x.UpdatedAt ?? x.CreatedAt).ToListAsync(ct));
        stamps.AddRange(await choices.QueryNoTracking().IgnoreQueryFilters().Select(x => x.UpdatedAt ?? x.CreatedAt).ToListAsync(ct));
        var itemCount = await items.QueryNoTracking().CountAsync(ct);
        var linkCount = await items.QueryNoTracking().SelectMany(i => i.OptionGroups).CountAsync(ct);
        var choiceCount = await choices.QueryNoTracking().CountAsync(ct);

        var source = string.Join('|',
            (stamps.Count == 0 ? DateTime.MinValue : stamps.Max()).ToString("O", CultureInfo.InvariantCulture),
            itemCount, linkCount, choiceCount,
            VietnamDates.Format(VietnamDates.DateOf(nowUtc)));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(source)))[..12].ToLowerInvariant();
    }
}
