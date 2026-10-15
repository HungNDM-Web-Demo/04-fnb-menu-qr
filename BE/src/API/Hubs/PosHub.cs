using Application.Interfaces.Services.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace API.Hubs;

/// <summary>
/// Kênh thời gian thực cho nhân viên <c>/hubs/pos</c> (07 §2.14, NFR-03): mọi người dùng đã đăng nhập vào một nhóm chung.
/// Chỉ máy chủ đẩy sự kiện; client không gọi method nào. WebSocket gửi access token qua query <c>access_token</c>.
/// Khách không dùng hub này, hỏi lại <c>GET …/live</c> (07 §5 quyết định 7).
/// </summary>
[Authorize]
public sealed class PosHub : Hub
{
    public const string Path = "/hubs/pos";
    public const string Group = "pos";

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, Group);
        await base.OnConnectedAsync();
    }
}

/// <summary>Phát sự kiện qua SignalR tới nhóm chung; lỗi gửi không làm hỏng thao tác đã lưu.</summary>
public sealed class SignalRPosEventPublisher(IHubContext<PosHub> hub, ILogger<SignalRPosEventPublisher> logger) : IPosEventPublisher
{
    public async Task PublishAsync(string eventName, object payload, CancellationToken ct = default)
    {
        try
        {
            await hub.Clients.Group(PosHub.Group).SendAsync(eventName, payload, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Không phát được sự kiện {Event}.", eventName);
        }
    }
}
