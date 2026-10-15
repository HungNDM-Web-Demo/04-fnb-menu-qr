using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>
/// Đơn: một lần gửi món từ bàn (khách tự gọi) hoặc nhân viên gọi hộ (bảng <c>Pos_Orders</c>, BR-08, BR-09).
/// Trạng thái chỉ đổi qua các method dưới đây, mỗi lần đổi tăng <see cref="Version"/> (concurrency token, UC-05 E3).
/// </summary>
public class Order : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int TableNameMaxLength = 50;
    public const int GuestNameMaxLength = 30;
    public const int NoteMaxLength = 200;
    public const int UserNameMaxLength = 150;
    public const int KeyMaxLength = 64;

    private Order()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid SessionId { get; private set; }
    public Guid TableId { get; private set; }
    public string TableName { get; private set; } = string.Empty;
    public OrderSource Source { get; private set; }
    public OrderStatus Status { get; private set; }
    public bool AutoConfirmed { get; private set; }
    public string? GuestName { get; private set; }
    public string? Note { get; private set; }
    public DateTime SubmittedAt { get; private set; }
    public DateTime? HandledAt { get; private set; }
    public Guid? HandledById { get; private set; }
    public string? HandledByName { get; private set; }
    public RejectReason? RejectReason { get; private set; }
    public string? RejectNote { get; private set; }
    public decimal Total { get; private set; }
    public string? DeviceId { get; private set; }
    public string? ClientRequestId { get; private set; }
    public string? CartKey { get; private set; }
    public int Version { get; private set; } = 1;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<OrderItem> Items { get; private set; } = [];

    public static Order Create(
        string code, Guid sessionId, Guid tableId, string tableName, OrderSource source, string? guestName, string? note,
        DateTime submittedAt, string? deviceId, string? clientRequestId, string? cartKey, IEnumerable<OrderItem> items)
    {
        var order = new Order
        {
            Code = code,
            SessionId = sessionId,
            TableId = tableId,
            TableName = tableName,
            Source = source,
            Status = OrderStatus.ChoXacNhan,
            GuestName = Clean(guestName),
            Note = Clean(note),
            SubmittedAt = submittedAt,
            DeviceId = Clean(deviceId),
            ClientRequestId = Clean(clientRequestId),
            CartKey = cartKey
        };
        order.Items.AddRange(items);
        if (order.Items.Count == 0)
            throw new DomainException("Giỏ món đang trống");
        order.Total = OrderPricing.OrderTotal(order.Items);
        return order;
    }

    public IEnumerable<OrderItem> SortedItems => Items.OrderBy(i => i.SortOrder).ThenBy(i => i.CreatedAt);

    public bool IsPending => Status == OrderStatus.ChoXacNhan;

    /// <summary>BR-08: tự xác nhận lúc gửi (phiên đã có đơn được xác nhận và chế độ <c>TuXacNhan</c>).</summary>
    public void AutoConfirm()
    {
        EnsurePending();
        AutoConfirmed = true;
        HandledAt = SubmittedAt;
        ConfirmItems();
    }

    /// <summary>
    /// Nhân viên xác nhận (FR-16), bỏ các dòng trong <paramref name="removals"/>; đơn gọi hộ xác nhận ngay lúc gửi.
    /// Bỏ hết dòng → <c>DonPhaiConMon</c> (BR-10).
    /// </summary>
    public void Confirm(DateTime atUtc, Guid? userId, string? userName, IReadOnlyDictionary<Guid, (RemoveReason Reason, string? Note)>? removals = null)
    {
        EnsurePending();
        removals ??= new Dictionary<Guid, (RemoveReason, string?)>();
        if (Items.All(i => removals.ContainsKey(i.Id)))
            throw PosErrors.Business(PosErrors.DonPhaiConMon, PosErrors.MustKeepItemMessage);

        foreach (var item in Items)
        {
            if (removals.TryGetValue(item.Id, out var removal))
                item.Remove(removal.Reason, removal.Note);
        }

        HandledAt = atUtc;
        HandledById = userId;
        HandledByName = userName;
        ConfirmItems();
    }

    /// <summary>Từ chối (FR-17): dòng giữ <c>ChoXacNhan</c>, đơn giữ tổng lúc gửi (07 §5 quyết định 20).</summary>
    public void Reject(DateTime atUtc, Guid? userId, string? userName, RejectReason reason, string? note)
    {
        EnsurePending();
        Status = OrderStatus.BiTuChoi;
        RejectReason = reason;
        RejectNote = Clean(note);
        HandledAt = atUtc;
        HandledById = userId;
        HandledByName = userName;
        Version++;
    }

    /// <summary>Phục vụ các dòng <c>DaXacNhan</c> (vắng <paramref name="itemIds"/> = cả đơn); dòng khác bỏ qua (TC-24, TC-25).</summary>
    public int Serve(IReadOnlyCollection<Guid>? itemIds, DateTime atUtc, Guid? userId)
    {
        if (Status == OrderStatus.ChoXacNhan)
            throw PosErrors.NotConfirmed();
        if (Status is OrderStatus.BiTuChoi or OrderStatus.DaHuy)
            throw PosErrors.Business(PosErrors.DonKhongPhucVuDuoc, PosErrors.NotServableMessage);

        var changed = Items.Where(i => itemIds is null || itemIds.Contains(i.Id)).Count(i => i.Serve(atUtc, userId));
        if (changed > 0)
            Refresh();
        return changed;
    }

    /// <summary>Hoàn tác phục vụ trong 60 giây (UC-06 2a); đơn <c>DaPhucVu</c> về <c>DaXacNhan</c>.</summary>
    public void Unserve(IReadOnlyCollection<Guid> itemIds, DateTime nowUtc)
    {
        foreach (var item in Items.Where(i => itemIds.Contains(i.Id)))
            item.Unserve(nowUtc);
        Refresh();
    }

    /// <summary>Quản lý hủy món (BR-15); trả dòng tách khi hủy một phần.</summary>
    public OrderItem? CancelItem(Guid itemId, int quantity, string reason, DateTime atUtc, Guid? userId, string? userName)
    {
        EnsureConfirmed();
        var item = Items.FirstOrDefault(i => i.Id == itemId) ?? throw new DomainException("Dòng không thuộc đơn");
        var split = item.Cancel(quantity, reason, atUtc, userId, userName);
        if (split is not null)
            Items.Add(split);
        Refresh();
        return split;
    }

    /// <summary>Hủy cả đơn: mọi dòng còn hiệu lực.</summary>
    public void CancelAll(string reason, DateTime atUtc, Guid? userId, string? userName)
    {
        EnsureConfirmed();
        foreach (var item in Items.Where(i => i.IsEffective).ToList())
            item.Cancel(item.Quantity, reason, atUtc, userId, userName);
        Refresh();
    }

    /// <summary>Hủy món chỉ với đơn đã xác nhận hoặc đã phục vụ; còn lại <c>DonChuaXacNhan</c>.</summary>
    public void EnsureConfirmed()
    {
        if (Status is not (OrderStatus.DaXacNhan or OrderStatus.DaPhucVu))
            throw PosErrors.NotConfirmed();
    }

    private void EnsurePending()
    {
        if (Status != OrderStatus.ChoXacNhan)
            throw new DomainException("Đơn đã được xử lý");
    }

    private void ConfirmItems()
    {
        foreach (var item in Items)
            item.Confirm();
        Status = OrderStatus.DaXacNhan;
        Refresh();
    }

    /// <summary>Tính lại tổng và trạng thái đơn đã xác nhận: hết dòng hiệu lực → <c>DaHuy</c>; mọi dòng đã phục vụ → <c>DaPhucVu</c>.</summary>
    private void Refresh()
    {
        Total = OrderPricing.OrderTotal(Items);
        if (Status is OrderStatus.DaXacNhan or OrderStatus.DaPhucVu)
        {
            var effective = Items.Where(i => i.IsEffective).ToList();
            Status = effective.Count == 0 ? OrderStatus.DaHuy
                : effective.All(i => i.Status == OrderItemStatus.DaPhucVu) ? OrderStatus.DaPhucVu
                : OrderStatus.DaXacNhan;
        }

        Version++;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
