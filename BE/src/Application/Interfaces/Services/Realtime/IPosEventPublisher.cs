namespace Application.Interfaces.Services.Realtime;

/// <summary>
/// Đẩy sự kiện thời gian thực tới mọi người dùng đã đăng nhập (SignalR <c>/hubs/pos</c>, 07 §2.14, NFR-03).
/// Service gọi sau khi lưu xong. Bản mặc định không làm gì (test, job nền); tầng API thay bằng bản SignalR.
/// Khách không dùng SignalR, hỏi lại <c>GET …/live</c> (07 §5 quyết định 7).
/// </summary>
public interface IPosEventPublisher
{
    Task PublishAsync(string eventName, object payload, CancellationToken ct = default);
}

/// <summary>Tên sự kiện (07 §2.14), payload camelCase.</summary>
public static class PosEvents
{
    /// <summary><c>{ orderId, tableId, tableName, status, autoConfirmed, source }</c>.</summary>
    public const string OrderSubmitted = "order-submitted";

    /// <summary><c>{ orderIds, tableIds }</c>.</summary>
    public const string OrdersChanged = "orders-changed";

    /// <summary><c>{ requestIds, tableIds, newRequestIds }</c>.</summary>
    public const string RequestsChanged = "requests-changed";

    /// <summary><c>{ tableIds }</c>.</summary>
    public const string TablesChanged = "tables-changed";

    /// <summary><c>{ menuItemIds, optionGroupIds }</c>.</summary>
    public const string MenuChanged = "menu-changed";

    /// <summary><c>{}</c>.</summary>
    public const string OrderingChanged = "ordering-changed";
}
