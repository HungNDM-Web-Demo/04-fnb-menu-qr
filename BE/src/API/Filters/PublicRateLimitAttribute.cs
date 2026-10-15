using System.Globalization;
using API.Middlewares;
using Application.Interfaces.Services.Public;
using Domain.Entities.Pos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Giới hạn tần suất API công khai (NFR-04, 07 §2.7): khóa = IP + mã bàn trong route (<c>{code}</c>), cửa sổ cố định 1 phút.
/// Vượt → 429 ProblemDetails <c>code = QuaNhieuYeuCau</c> kèm header <c>Retry-After</c> (giây). Chạy trước khi đọc body.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class PublicRateLimitAttribute(string policy) : Attribute, IAsyncResourceFilter
{
    public string Policy { get; } = policy;

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var http = context.HttpContext;
        var limiter = http.RequestServices.GetRequiredService<IPublicRateLimiter>();
        var code = (context.RouteData.Values["code"] as string ?? string.Empty).Trim().ToUpperInvariant();
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        if (!limiter.TryAcquire(Policy, $"{ip}|{code}", out var retryAfter))
        {
            http.Response.Headers.RetryAfter = retryAfter.ToString(CultureInfo.InvariantCulture);
            var problem = ApiProblemDetails.Create(http, StatusCodes.Status429TooManyRequests, PosErrors.TooManyRequestsMessage);
            problem.Extensions["code"] = PosErrors.QuaNhieuYeuCau;
            context.Result = new ObjectResult(problem)
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
                ContentTypes = { ApiProblemDetails.ContentType }
            };
            return;
        }

        await next();
    }
}

/// <summary>404 có <c>code</c> (vd <c>MaQrKhongHopLe</c>, 07 §2.13): đưa <c>code</c> vào ProblemDetails, các lỗi khác để ExceptionMiddleware xử lý.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class PosNotFoundCodeAttribute : Attribute, IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not Application.Common.Exceptions.PosNotFoundException notFound)
            return;

        var problem = ApiProblemDetails.Create(context.HttpContext, StatusCodes.Status404NotFound, notFound.Message);
        problem.Extensions["code"] = notFound.Code;
        context.Result = new ObjectResult(problem)
        {
            StatusCode = StatusCodes.Status404NotFound,
            ContentTypes = { ApiProblemDetails.ContentType }
        };
        context.ExceptionHandled = true;
    }
}
