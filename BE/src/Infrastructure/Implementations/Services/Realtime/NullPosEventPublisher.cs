using Application.Interfaces.Services.Realtime;

namespace Infrastructure.Implementations.Services.Realtime;

/// <summary>
/// Bản mặc định không phát gì (test, job nền, chạy không có tầng API). Tầng API thay bằng bản SignalR <c>/hubs/pos</c>.
/// </summary>
public sealed class NullPosEventPublisher : IPosEventPublisher
{
    public Task PublishAsync(string eventName, object payload, CancellationToken ct = default) => Task.CompletedTask;
}
