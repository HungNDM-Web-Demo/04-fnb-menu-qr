using Application.Interfaces.Services.Realtime;
using Domain.Entities.Pos.Orders;

namespace Infrastructure.Implementations.Services.Pos;

/// <summary>Phát sự kiện thời gian thực (07 §2.14) với payload đúng hình dạng hợp đồng. Gọi sau khi lưu xong.</summary>
internal static class PosPublish
{
    public static Task OrderSubmittedAsync(this IPosEventPublisher publisher, Order order, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.OrderSubmitted, new
        {
            orderId = order.Id,
            tableId = order.TableId,
            tableName = order.TableName,
            status = order.Status,
            autoConfirmed = order.AutoConfirmed,
            source = order.Source
        }, ct);

    public static Task OrdersChangedAsync(this IPosEventPublisher publisher, IEnumerable<Guid> orderIds, IEnumerable<Guid> tableIds, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.OrdersChanged, new { orderIds = orderIds.Distinct().ToArray(), tableIds = tableIds.Distinct().ToArray() }, ct);

    public static Task RequestsChangedAsync(
        this IPosEventPublisher publisher, IEnumerable<Guid> requestIds, IEnumerable<Guid> tableIds, IEnumerable<Guid>? newRequestIds, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.RequestsChanged, new
        {
            requestIds = requestIds.Distinct().ToArray(),
            tableIds = tableIds.Distinct().ToArray(),
            newRequestIds = (newRequestIds ?? []).Distinct().ToArray()
        }, ct);

    public static Task TablesChangedAsync(this IPosEventPublisher publisher, IEnumerable<Guid> tableIds, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.TablesChanged, new { tableIds = tableIds.Distinct().ToArray() }, ct);

    public static Task MenuChangedAsync(this IPosEventPublisher publisher, IEnumerable<Guid> menuItemIds, IEnumerable<Guid> optionGroupIds, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.MenuChanged, new { menuItemIds = menuItemIds.Distinct().ToArray(), optionGroupIds = optionGroupIds.Distinct().ToArray() }, ct);

    public static Task OrderingChangedAsync(this IPosEventPublisher publisher, CancellationToken ct) =>
        publisher.PublishAsync(PosEvents.OrderingChanged, new { }, ct);
}
