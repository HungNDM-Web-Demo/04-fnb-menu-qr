using System.Text.Json.Serialization;
using API.Hubs;
using Application.Interfaces.Services.Realtime;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace API.Configuration;

/// <summary>
/// SignalR cho nhà hàng (07 §2.14): hub <c>/hubs/pos</c>, payload JSON camelCase, enum dạng chuỗi như API;
/// thay bản phát sự kiện rỗng của Infrastructure bằng bản SignalR.
/// </summary>
public static class RealtimeSetup
{
    public static IServiceCollection AddPosRealtime(this IServiceCollection services)
    {
        services.AddSignalR()
            .AddJsonProtocol(options => options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.Replace(ServiceDescriptor.Scoped<IPosEventPublisher, SignalRPosEventPublisher>());
        return services;
    }

    public static IEndpointRouteBuilder MapPosHub(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHub<PosHub>(PosHub.Path);
        return endpoints;
    }
}
