using System.Text.Json;
using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>Lựa chọn chụp vào dòng đơn lúc gửi (cột JSON <c>Pos_OrderItems.Options</c>).</summary>
public sealed record OrderItemOption(Guid GroupId, string GroupName, Guid ChoiceId, string Name, decimal Price);

/// <summary>
/// Dòng đơn (bảng <c>Pos_OrderItems</c>): chụp mã, tên, giá món, tên và giá lựa chọn lúc gửi (BR-16).
/// <see cref="LineTotal"/> = (giá món + giá lựa chọn) × số lượng (BR-03). Hủy một phần tách dòng (TC-30).
/// </summary>
public class OrderItem : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 150;
    public const int NoteMaxLength = 100;
    public const int ReasonMaxLength = 200;
    public const int UserNameMaxLength = 150;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private OrderItem()
    {
    }

    public Guid OrderId { get; private set; }
    public Guid MenuItemId { get; private set; }
    public string ItemCode { get; private set; } = string.Empty;
    public string ItemName { get; private set; } = string.Empty;
    public decimal ItemPrice { get; private set; }

    /// <summary>Mảng JSON <see cref="OrderItemOption"/> theo thứ tự nhóm của món; <c>[]</c> khi không có.</summary>
    public string Options { get; private set; } = "[]";

    public decimal OptionsPrice { get; private set; }
    public int Quantity { get; private set; }
    public decimal LineTotal { get; private set; }
    public string? Note { get; private set; }
    public OrderItemStatus Status { get; private set; }
    public RemoveReason? RemoveReason { get; private set; }
    public string? RemoveNote { get; private set; }
    public string? CancelReason { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledById { get; private set; }
    public string? CancelledByName { get; private set; }
    public DateTime? ServedAt { get; private set; }
    public Guid? ServedById { get; private set; }
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public decimal UnitPrice => ItemPrice + OptionsPrice;

    /// <summary>Dòng còn hiệu lực: không bị bỏ, không bị hủy.</summary>
    public bool IsEffective => Status is not (OrderItemStatus.BiBo or OrderItemStatus.DaHuy);

    public static OrderItem Create(
        Guid menuItemId, string itemCode, string itemName, decimal itemPrice, IReadOnlyList<OrderItemOption> options,
        int quantity, string? note, int sortOrder)
    {
        if (quantity is < PosRules.QuantityMin or > PosRules.QuantityMax)
            throw new DomainException("Số lượng từ 1 đến 20");

        var optionsPrice = options.Sum(o => o.Price);
        return new OrderItem
        {
            MenuItemId = menuItemId,
            ItemCode = itemCode,
            ItemName = itemName,
            ItemPrice = itemPrice,
            Options = JsonSerializer.Serialize(options, JsonOptions),
            OptionsPrice = optionsPrice,
            Quantity = quantity,
            LineTotal = OrderPricing.LineTotal(itemPrice, optionsPrice, quantity),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            Status = OrderItemStatus.ChoXacNhan,
            SortOrder = sortOrder
        };
    }

    public IReadOnlyList<OrderItemOption> GetOptions()
    {
        try
        {
            return JsonSerializer.Deserialize<List<OrderItemOption>>(Options, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    internal void Confirm()
    {
        if (Status == OrderItemStatus.ChoXacNhan)
            Status = OrderItemStatus.DaXacNhan;
    }

    internal void Remove(RemoveReason reason, string? note)
    {
        Status = OrderItemStatus.BiBo;
        RemoveReason = reason;
        RemoveNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    internal bool Serve(DateTime atUtc, Guid? userId)
    {
        if (Status != OrderItemStatus.DaXacNhan)
            return false;
        Status = OrderItemStatus.DaPhucVu;
        ServedAt = atUtc;
        ServedById = userId;
        return true;
    }

    internal void Unserve(DateTime nowUtc)
    {
        if (Status != OrderItemStatus.DaPhucVu)
            throw PosErrors.Business(PosErrors.MonChuaPhucVu, PosErrors.NotServedMessage);
        if (ServedAt is null || nowUtc - ServedAt.Value > PosRules.UnserveWindow)
            throw PosErrors.Business(PosErrors.HetThoiGianHoanTac, PosErrors.UndoExpiredMessage);
        Status = OrderItemStatus.DaXacNhan;
        ServedAt = null;
        ServedById = null;
    }

    /// <summary>
    /// Hủy <paramref name="quantity"/> phần (BR-15). Hủy cả dòng thì dòng này thành <c>DaHuy</c> và trả null; hủy một phần thì
    /// dòng này giảm số lượng và trả dòng mới <c>DaHuy</c> chép mọi cột, <c>SortOrder</c> ngay sau dòng cũ.
    /// </summary>
    internal OrderItem? Cancel(int quantity, string reason, DateTime atUtc, Guid? userId, string? userName)
    {
        if (Status is not (OrderItemStatus.DaXacNhan or OrderItemStatus.DaPhucVu))
            throw PosErrors.Business(PosErrors.MonKhongHuyDuoc, PosErrors.NotCancellableMessage);
        if (quantity < 1 || quantity > Quantity)
            throw new DomainException($"Số lượng hủy từ 1 đến {Quantity}");

        if (quantity == Quantity)
        {
            MarkCancelled(reason, atUtc, userId, userName);
            return null;
        }

        var split = (OrderItem)MemberwiseClone();
        split.Id = Guid.NewGuid();
        split.Quantity = quantity;
        split.LineTotal = OrderPricing.LineTotal(ItemPrice, OptionsPrice, quantity);
        split.SortOrder = SortOrder + 1;
        split.MarkCancelled(reason, atUtc, userId, userName);

        Quantity -= quantity;
        LineTotal = OrderPricing.LineTotal(ItemPrice, OptionsPrice, Quantity);
        return split;
    }

    private void MarkCancelled(string reason, DateTime atUtc, Guid? userId, string? userName)
    {
        Status = OrderItemStatus.DaHuy;
        CancelReason = reason.Trim();
        CancelledAt = atUtc;
        CancelledById = userId;
        CancelledByName = userName;
        ServedAt = null;
        ServedById = null;
    }
}
