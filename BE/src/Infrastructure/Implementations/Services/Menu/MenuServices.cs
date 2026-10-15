using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Menu;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Menu;
using Application.Interfaces.Services.Realtime;
using Application.Interfaces.Services.Uploads;
using Application.Mappings.Menu;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Menu;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Pos;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Menu;

/// <summary>Danh mục món (07 §2.2, FR-26).</summary>
public sealed class CategoryService(
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> items,
    IUnitOfWork unitOfWork,
    IPosEventPublisher events) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetListAsync(CancellationToken ct = default)
    {
        var counts = await items.QueryNoTracking().GroupBy(i => i.CategoryId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var list = await categories.QueryNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Code).ToListAsync(ct);
        return list.Select(c => c.ToDto(counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await categories.AnyAsync(c => c.Code == code, ct))
            throw new ConflictException("Mã danh mục đã tồn tại", "code");

        var maxSort = await categories.QueryNoTracking().MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;
        var category = Category.Create(code, request.Name, request.NameEn, request.Color, request.IsHidden, maxSort + PosRules.SortOrderStep);
        await categories.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [], ct);
        return category.ToDto(0);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default)
    {
        var category = await categories.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy danh mục.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await categories.AnyAsync(c => c.Code == code && c.Id != id, ct))
            throw new ConflictException("Mã danh mục đã tồn tại", "code");

        category.Update(code, request.Name, request.NameEn, request.Color, request.IsHidden);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [], ct);
        return category.ToDto(await items.QueryNoTracking().CountAsync(i => i.CategoryId == id, ct));
    }

    public async Task ReorderAsync(ReorderRequest request, CancellationToken ct = default)
    {
        var all = await categories.Query().ToListAsync(ct);
        if (request.Ids.Count != all.Count || request.Ids.Distinct().Count() != all.Count || all.Any(c => !request.Ids.Contains(c.Id)))
            throw FieldErrors.Single("ids", "Danh sách sắp xếp không đầy đủ");

        for (var i = 0; i < request.Ids.Count; i++)
            all.Single(c => c.Id == request.Ids[i]).SetSortOrder((i + 1) * PosRules.SortOrderStep);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [], ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await categories.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy danh mục.");
        var itemCount = await items.QueryNoTracking().CountAsync(i => i.CategoryId == id, ct);
        if (itemCount > 0)
        {
            throw PosErrors.Business(PosErrors.DanhMucConMon, $"Danh mục đang có {itemCount} món, chuyển món sang danh mục khác trước",
                new Dictionary<string, object?> { ["itemCount"] = itemCount });
        }

        categories.Delete(category);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [], ct);
    }
}

/// <summary>Món (07 §2.3, UC-09, UC-10, BR-14, BR-16).</summary>
public sealed class MenuItemService(
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> items,
    IGenericRepository<OptionGroup> groups,
    IGenericRepository<OrderItem> orderItems,
    IUnitOfWork unitOfWork,
    IImageInspector imageInspector,
    IFileStorage fileStorage,
    IPosEventPublisher events,
    TimeProvider time) : IMenuItemService
{
    /// <summary>Thư mục ảnh món trong <c>wwwroot/uploads</c> (06 §3).</summary>
    public const string UploadFolder = "menu";

    private const string UploadsPrefix = "/uploads/";

    public async Task<PaginatedResult<MenuItemDto>> GetPagedAsync(MenuItemQuery query, CancellationToken ct = default)
    {
        var now = Now;
        var snapshot = await MenuSnapshot.LoadAsync(categories, items, groups, ct);

        // Tìm theo mã, tên ở DB (không dấu trên Postgres); trạng thái, sắp xếp mặc định tính trong bộ nhớ (thực đơn nhỏ).
        IEnumerable<MenuItem> source = snapshot.OrderedItems();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            var ids = await items.QueryNoTracking()
                .Where(i => AppDbFunctions.Matches(i.Code, pattern) || AppDbFunctions.Matches(i.Name, pattern)
                            || (i.NameEn != null && AppDbFunctions.Matches(i.NameEn, pattern)))
                .Select(i => i.Id).ToListAsync(ct);
            source = source.Where(i => ids.Contains(i.Id));
        }

        if (query.CategoryId is { } categoryId)
            source = source.Where(i => i.CategoryId == categoryId);

        var everOrdered = await EverOrderedAsync(ct);
        var dtos = source.Select(i => ToDto(i, snapshot, everOrdered, now)).ToList();
        if (query.Status is { } status)
            dtos = dtos.Where(d => d.Status == status).ToList();

        if (!string.IsNullOrWhiteSpace(query.SortBy))
        {
            Func<MenuItemDto, object> key = query.SortBy.Trim().ToLowerInvariant() switch
            {
                "code" => d => d.Code,
                "name" => d => d.Name,
                "price" => d => d.Price,
                "updatedat" => d => d.UpdatedAt,
                _ => d => d.SortOrder
            };
            dtos = (query.IsDescending() ? dtos.OrderByDescending(key) : dtos.OrderBy(key)).ToList();
        }

        var page = query.GetPage();
        var pageSize = query.GetPageSize();
        return new PaginatedResult<MenuItemDto>
        {
            Items = dtos.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = dtos.Count
        };
    }

    public async Task<MenuItemDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var snapshot = await MenuSnapshot.LoadAsync(categories, items, groups, ct);
        var item = snapshot.Items.GetValueOrDefault(id) ?? throw new NotFoundException("Không tìm thấy món.");
        return ToDto(item, snapshot, await EverOrderedAsync(ct, id), Now);
    }

    public async Task<MenuItemDto> CreateAsync(SaveMenuItemRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        await CheckReferencesAsync(request, ct);
        if (await items.AnyAsync(i => i.Code == code, ct))
            throw new ConflictException("Mã món đã tồn tại", "code");

        var sortOrder = request.SortOrder
            ?? (await items.QueryNoTracking().Where(i => i.CategoryId == request.CategoryId).MaxAsync(i => (int?)i.SortOrder, ct) ?? 0) + PosRules.SortOrderStep;
        var item = MenuItem.Create(code, request.Name, request.NameEn, request.CategoryId, request.Description, request.DescriptionEn,
            request.Unit, request.Price, request.Tags, sortOrder);
        item.SetOptionGroups(request.OptionGroupIds);
        await items.AddAsync(item, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([item.Id], [], ct);
        return await GetByIdAsync(item.Id, ct);
    }

    public async Task<MenuItemDto> UpdateAsync(Guid id, SaveMenuItemRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        var code = request.Code.Trim().ToUpperInvariant();
        await CheckReferencesAsync(request, ct);
        if (await items.AnyAsync(i => i.Code == code && i.Id != id, ct))
            throw new ConflictException("Mã món đã tồn tại", "code");

        // Đổi danh mục mà không gửi thứ tự thì xuống cuối danh mục mới.
        var sortOrder = request.SortOrder ?? (request.CategoryId == item.CategoryId
            ? item.SortOrder
            : (await items.QueryNoTracking().Where(i => i.CategoryId == request.CategoryId).MaxAsync(i => (int?)i.SortOrder, ct) ?? 0) + PosRules.SortOrderStep);

        // Đơn đã gửi giữ giá cũ: dòng đơn đã chụp giá (UC-09 3a).
        item.Update(code, request.Name, request.NameEn, request.CategoryId, request.Description, request.DescriptionEn,
            request.Unit, request.Price, request.Tags, sortOrder);
        item.SetOptionGroups(request.OptionGroupIds);
        item.ClearExpiredSoldOut(Now);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([id], [], ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        if (request.IsSoldOut)
            item.MarkSoldOut(request.Mode!.Value, PosSettings.EndOfTodayUtc(Now));
        else
            item.MarkAvailable();
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([id], [], ct);
    }

    public async Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        item.SetHidden(request.IsHidden);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([id], [], ct);
    }

    public async Task<MenuItemImageResult> UploadImageAsync(Guid id, Stream content, long sizeBytes, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        if (sizeBytes <= 0)
            throw FieldErrors.Single("file", "Chưa chọn file ảnh.");
        if (sizeBytes > UploadLimits.MaxImageBytes)
            throw FieldErrors.Single("file", "Ảnh tối đa 2 MB.");

        using var buffer = new MemoryStream((int)sizeBytes);
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > UploadLimits.MaxImageBytes)
            throw FieldErrors.Single("file", "Ảnh tối đa 2 MB.");

        var image = imageInspector.Inspect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        if (image is null || image.Format == ImageFormat.Svg)
            throw FieldErrors.Single("file", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");

        buffer.Position = 0;
        var url = await fileStorage.SaveAsync(buffer, UploadFolder, image.Extension, ct);
        var previous = item.ImageUrl;
        item.SetImage(url);
        await unitOfWork.SaveChangesAsync(ct);

        // Ảnh tải lên trước đó không còn dùng; ảnh mẫu /seed/... nằm ở FE nên không đụng tới.
        if (previous is not null && previous.StartsWith(UploadsPrefix, StringComparison.OrdinalIgnoreCase))
            await fileStorage.DeleteAsync(previous, ct);

        await events.MenuChangedAsync([id], [], ct);
        return new MenuItemImageResult { ImageUrl = url };
    }

    public async Task ReorderAsync(ReorderMenuItemsRequest request, CancellationToken ct = default)
    {
        var inCategory = await items.Query().Where(i => i.CategoryId == request.CategoryId).ToListAsync(ct);
        if (request.Ids.Count != inCategory.Count || request.Ids.Distinct().Count() != inCategory.Count || inCategory.Any(i => !request.Ids.Contains(i.Id)))
            throw FieldErrors.Single("ids", "Danh sách sắp xếp không đầy đủ");

        for (var i = 0; i < request.Ids.Count; i++)
            inCategory.Single(x => x.Id == request.Ids[i]).SetSortOrder((i + 1) * PosRules.SortOrderStep);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync(request.Ids, [], ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var item = await LoadAsync(id, ct);
        if (await orderItems.AnyAsync(i => i.MenuItemId == id, ct))
            throw PosErrors.Business(PosErrors.MonDaDuocGoi, PosErrors.ItemOrderedMessage);

        items.Delete(item);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([id], [], ct);
    }

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private async Task<MenuItem> LoadAsync(Guid id, CancellationToken ct) =>
        await items.Query().Include(i => i.OptionGroups).FirstOrDefaultAsync(i => i.Id == id, ct)
        ?? throw new NotFoundException("Không tìm thấy món.");

    private async Task CheckReferencesAsync(SaveMenuItemRequest request, CancellationToken ct)
    {
        if (!await categories.AnyAsync(c => c.Id == request.CategoryId, ct))
            throw FieldErrors.Single("categoryId", "Danh mục không tồn tại");

        var groupIds = request.OptionGroupIds.Distinct().ToList();
        if (groupIds.Count > 0 && await groups.QueryNoTracking().CountAsync(g => groupIds.Contains(g.Id), ct) != groupIds.Count)
            throw FieldErrors.Single("optionGroupIds", "Nhóm tùy chọn không tồn tại");
    }

    private async Task<HashSet<Guid>> EverOrderedAsync(CancellationToken ct, Guid? only = null)
    {
        var query = orderItems.QueryNoTracking();
        if (only is { } id)
            query = query.Where(i => i.MenuItemId == id);
        return (await query.Select(i => i.MenuItemId).Distinct().ToListAsync(ct)).ToHashSet();
    }

    private static MenuItemDto ToDto(MenuItem item, MenuSnapshot snapshot, HashSet<Guid> everOrdered, DateTime now) =>
        item.ToDto(
            snapshot.Categories.TryGetValue(item.CategoryId, out var category) ? category.Name : string.Empty,
            snapshot.IsSoldOut(item, now),
            everOrdered.Contains(item.Id),
            now);
}

/// <summary>Nhóm tùy chọn dùng chung (07 §2.4, FR-28, FR-30, TC-35).</summary>
public sealed class OptionGroupService(
    IGenericRepository<MenuItem> items,
    IGenericRepository<OptionGroup> groups,
    IGenericRepository<OptionChoice> choices,
    IUnitOfWork unitOfWork,
    IPosEventPublisher events,
    TimeProvider time) : IOptionGroupService
{
    public async Task<IReadOnlyList<OptionGroupDto>> GetListAsync(CancellationToken ct = default)
    {
        var counts = await CountsAsync(ct);
        var list = await groups.QueryNoTracking().Include(g => g.Choices).OrderBy(g => g.SortOrder).ThenBy(g => g.Name).ToListAsync(ct);
        return list.Select(g => g.ToDto(counts.GetValueOrDefault(g.Id), Now)).ToList();
    }

    public async Task<OptionGroupDto> CreateAsync(SaveOptionGroupRequest request, CancellationToken ct = default)
    {
        var maxSort = await groups.QueryNoTracking().MaxAsync(g => (int?)g.SortOrder, ct) ?? 0;
        var group = OptionGroup.Create(request.Name, request.NameEn, request.SelectionType, request.IsRequired, request.MaxSelect, maxSort + PosRules.SortOrderStep);
        for (var i = 0; i < request.Choices.Count; i++)
        {
            var input = request.Choices[i];
            group.Choices.Add(OptionChoice.Create(group.Id, input.Name, input.NameEn, input.Price,
                request.SelectionType == SelectionType.ChonMot && input.IsDefault, (i + 1) * PosRules.SortOrderStep));
        }

        await groups.AddAsync(group, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [group.Id], ct);
        return group.ToDto(0, Now);
    }

    public async Task<OptionGroupDto> UpdateAsync(Guid id, SaveOptionGroupRequest request, CancellationToken ct = default)
    {
        var group = await groups.Query().Include(g => g.Choices).FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhóm tùy chọn.");

        var keepIds = request.Choices.Where(c => c.Id is not null).Select(c => c.Id!.Value).ToHashSet();
        if (keepIds.Any(cid => group.Choices.All(c => c.Id != cid)))
            throw FieldErrors.Single("choices", "Lựa chọn không thuộc nhóm");

        group.Update(request.Name, request.NameEn, request.SelectionType, request.IsRequired, request.MaxSelect);

        // Có id thì sửa, không có thì thêm, vắng mặt thì xóa mềm (dòng đơn cũ vẫn giữ bản chụp).
        foreach (var removed in group.Choices.Where(c => !keepIds.Contains(c.Id)).ToList())
            choices.Delete(removed);
        for (var i = 0; i < request.Choices.Count; i++)
        {
            var input = request.Choices[i];
            var isDefault = request.SelectionType == SelectionType.ChonMot && input.IsDefault;
            var sortOrder = (i + 1) * PosRules.SortOrderStep;
            if (input.Id is { } choiceId)
                group.Choices.Single(c => c.Id == choiceId).Update(input.Name, input.NameEn, input.Price, isDefault, sortOrder);
            else
                await choices.AddAsync(OptionChoice.Create(group.Id, input.Name, input.NameEn, input.Price, isDefault, sortOrder), ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [id], ct);
        return await GetDtoAsync(id, ct);
    }

    public async Task SetChoiceAvailabilityAsync(Guid id, Guid choiceId, SetAvailabilityRequest request, CancellationToken ct = default)
    {
        var choice = await choices.Query().FirstOrDefaultAsync(c => c.Id == choiceId && c.OptionGroupId == id, ct)
            ?? throw new NotFoundException("Không tìm thấy lựa chọn.");
        if (request.IsSoldOut)
            choice.MarkSoldOut(request.Mode!.Value, PosSettings.EndOfTodayUtc(Now));
        else
            choice.MarkAvailable();
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [id], ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var group = await groups.Query().Include(g => g.Choices).FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhóm tùy chọn.");
        var itemCount = (await CountsAsync(ct)).GetValueOrDefault(id);
        if (itemCount > 0)
        {
            throw PosErrors.Business(PosErrors.NhomDangDung, $"Nhóm tùy chọn đang gắn với {itemCount} món, gỡ khỏi món trước",
                new Dictionary<string, object?> { ["itemCount"] = itemCount });
        }

        foreach (var choice in group.Choices.ToList())
            choices.Delete(choice);
        groups.Delete(group);
        await unitOfWork.SaveChangesAsync(ct);
        await events.MenuChangedAsync([], [id], ct);
    }

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private async Task<OptionGroupDto> GetDtoAsync(Guid id, CancellationToken ct)
    {
        var group = await groups.QueryNoTracking().Include(g => g.Choices).FirstAsync(g => g.Id == id, ct);
        return group.ToDto((await CountsAsync(ct)).GetValueOrDefault(id), Now);
    }

    /// <summary>Số món chưa xóa đang gắn mỗi nhóm.</summary>
    private async Task<Dictionary<Guid, int>> CountsAsync(CancellationToken ct) =>
        await items.QueryNoTracking().SelectMany(i => i.OptionGroups)
            .GroupBy(l => l.OptionGroupId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
}

/// <summary>Thực đơn gộp cho Gọi món hộ (07 §2.1): danh mục, món, nhóm chưa ẩn trong một lần gọi.</summary>
public sealed class MenuQueryService(
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> items,
    IGenericRepository<OptionGroup> groups,
    IGenericRepository<OrderItem> orderItems,
    TimeProvider time) : IMenuQueryService
{
    public async Task<MenuBundle> GetBundleAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var snapshot = await MenuSnapshot.LoadAsync(categories, items, groups, ct);
        var everOrdered = (await orderItems.QueryNoTracking().Select(i => i.MenuItemId).Distinct().ToListAsync(ct)).ToHashSet();
        var visibleItems = snapshot.OrderedItems().Where(snapshot.IsVisible).ToList();
        var counts = snapshot.Items.Values.GroupBy(i => i.CategoryId).ToDictionary(g => g.Key, g => g.Count());
        var groupIds = visibleItems.SelectMany(i => i.OrderedGroupIds).ToHashSet();

        return new MenuBundle
        {
            Categories = snapshot.Categories.Values.Where(c => !c.IsHidden).OrderBy(c => c.SortOrder)
                .Select(c => c.ToDto(counts.GetValueOrDefault(c.Id))).ToList(),
            Items = visibleItems.Select(i => i.ToDto(snapshot.Categories[i.CategoryId].Name, snapshot.IsSoldOut(i, now), everOrdered.Contains(i.Id), now)).ToList(),
            OptionGroups = snapshot.Groups.Values.Where(g => groupIds.Contains(g.Id)).OrderBy(g => g.SortOrder)
                .Select(g => g.ToDto(0, now)).ToList()
        };
    }
}
