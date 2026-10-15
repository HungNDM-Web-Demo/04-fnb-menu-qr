using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos;

/// <summary>
/// Công thức tính tiền (07 §3.1–3.2, BR-03, BR-11), thuần, không đọc DB. FE <c>features/pos/lib/pricing.ts</c> cho cùng số với
/// cùng đầu vào. Mọi số tiền là số nguyên đồng, không làm tròn.
/// </summary>
public static class OrderPricing
{
    /// <summary><c>unitPrice = itemPrice + optionsPrice</c>.</summary>
    public static decimal UnitPrice(decimal itemPrice, decimal optionsPrice) => itemPrice + optionsPrice;

    /// <summary>BR-03: <c>lineTotal = (itemPrice + optionsPrice) × quantity</c>.</summary>
    public static decimal LineTotal(decimal itemPrice, decimal optionsPrice, int quantity) => UnitPrice(itemPrice, optionsPrice) * quantity;

    /// <summary>Tổng đơn: Σ thành tiền dòng không bị bỏ, không bị hủy (đơn chờ: mọi dòng; đơn bị từ chối giữ tổng lúc gửi).</summary>
    public static decimal OrderTotal(IEnumerable<OrderItem> items) => items.Where(i => i.IsEffective).Sum(i => i.LineTotal);

    /// <summary>Đơn được tính vào tạm tính: đã xác nhận hoặc đã phục vụ.</summary>
    public static bool CountsTowardSubtotal(OrderStatus status) => status is OrderStatus.DaXacNhan or OrderStatus.DaPhucVu;

    /// <summary>BR-11: Σ thành tiền dòng <c>DaXacNhan</c>, <c>DaPhucVu</c> của đơn <c>DaXacNhan</c>, <c>DaPhucVu</c>.</summary>
    public static decimal SessionSubtotal(IEnumerable<Order> orders) =>
        orders.Where(o => CountsTowardSubtotal(o.Status))
            .SelectMany(o => o.Items)
            .Where(i => i.Status is OrderItemStatus.DaXacNhan or OrderItemStatus.DaPhucVu)
            .Sum(i => i.LineTotal);

    /// <summary>UC-03 E2: Σ tổng đơn đang chờ xác nhận (chưa tính vào tạm tính).</summary>
    public static decimal PendingTotal(IEnumerable<Order> orders) =>
        orders.Where(o => o.Status == OrderStatus.ChoXacNhan).Sum(o => o.Total);

    /// <summary>BR-13: tiền thối khi trả tiền mặt.</summary>
    public static decimal Change(decimal cashReceived, decimal subtotal) => cashReceived - subtotal;
}
