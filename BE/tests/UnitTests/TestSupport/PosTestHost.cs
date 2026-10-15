using Application;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Realtime;
using Domain.Entities.System.Users;
using Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace UnitTests.TestSupport;

/// <summary>
/// DI thật của Application + Infrastructure trên SQLite trong bộ nhớ, <c>DEMO_MODE=true</c> nên <c>demo-data.json</c> được nạp
/// như khi chạy thật (theo mẫu <c>RestaurantTestHost</c> của dự án 03). Đồng hồ giả: 12:00 thứ Tư 14/10/2026 giờ Việt Nam.
/// Dữ liệu mẫu (~12 nghìn dòng) chỉ nạp một lần vào DB mẫu rồi sao chép (SQLite backup) cho từng test để chạy nhanh.
/// Người dùng hiện tại đổi bằng <see cref="SignInAsync"/>; sự kiện thời gian thực ghi vào <see cref="Events"/>.
/// </summary>
public sealed class PosTestHost : IAsyncDisposable
{
    public const string DemoPassword = "Demo@123";

    /// <summary>05:00 UTC = 12:00 giờ Việt Nam, thứ Tư.</summary>
    public static readonly DateTimeOffset Start = new(2026, 10, 14, 5, 0, 0, TimeSpan.Zero);

    private static readonly SemaphoreSlim TemplateGate = new(1, 1);
    private static SqliteConnection? _template;

    private readonly SqliteConnection _keepAlive;
    private readonly ServiceProvider _services;

    private PosTestHost(SqliteConnection keepAlive, ServiceProvider services, FakeTimeProvider time, TestCurrentUser currentUser, RecordingPublisher events)
    {
        _keepAlive = keepAlive;
        _services = services;
        Time = time;
        CurrentUser = currentUser;
        Events = events;
    }

    public FakeTimeProvider Time { get; }

    public TestCurrentUser CurrentUser { get; }

    public RecordingPublisher Events { get; }

    public IServiceProvider Services => _services;

    /// <summary>
    /// Mặc định dùng bản sao của DB mẫu đã nạp lúc <see cref="Start"/>; truyền <paramref name="start"/> khác thì nạp mới
    /// (dữ liệu tương đối theo giờ nạp).
    /// </summary>
    public static async Task<PosTestHost> StartAsync(DateTimeOffset? start = null)
    {
        if (start is null || start == Start)
        {
            var (connection, provider, time, user, events) = Build(Start);
            await TemplateGate.WaitAsync();
            try
            {
                // SqliteConnection không an toàn đa luồng: sao chép DB mẫu tuần tự.
                (await TemplateAsync()).BackupDatabase(connection);
            }
            finally
            {
                TemplateGate.Release();
            }

            await provider.InitializeDatabaseAsync();
            return new PosTestHost(connection, provider, time, user, events);
        }

        var fresh = Build(start.Value);
        await fresh.Provider.InitializeDatabaseAsync();
        return new PosTestHost(fresh.Connection, fresh.Provider, fresh.Time, fresh.User, fresh.Events);
    }

    public async Task<T> RunAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    public async Task RunAsync(Func<IServiceProvider, Task> action)
    {
        await using var scope = _services.CreateAsyncScope();
        await action(scope.ServiceProvider);
    }

    /// <summary>Lấy service trong scope mới (như một request) rồi gọi.</summary>
    public Task<T> CallAsync<TService, T>(Func<TService, Task<T>> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    public Task CallAsync<TService>(Func<TService, Task> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    /// <summary>Truy vấn chỉ đọc một bảng qua repository.</summary>
    public Task<T> QueryAsync<TEntity, T>(Func<IQueryable<TEntity>, Task<T>> query)
        where TEntity : Domain.Base.BaseEntity =>
        RunAsync(sp => query(sp.GetRequiredService<IGenericRepository<TEntity>>().QueryNoTracking()));

    /// <summary>Đặt người dùng hiện tại là tài khoản demo <paramref name="username"/>; null là khách.</summary>
    public async Task<Guid?> SignInAsync(string? username)
    {
        if (username is null)
        {
            CurrentUser.Set(null, null);
            return null;
        }

        var userId = await QueryAsync<User, Guid>(q => q.Where(u => u.Username == username).Select(u => u.Id).SingleAsync());
        CurrentUser.Set(userId, username);
        return userId;
    }

    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    /// <summary>DB mẫu đã nạp dữ liệu lúc <see cref="Start"/>; gọi khi đang giữ <see cref="TemplateGate"/>.</summary>
    private static async Task<SqliteConnection> TemplateAsync()
    {
        if (_template is not null)
            return _template;

        var (connection, provider, _, _, _) = Build(Start);
        await provider.InitializeDatabaseAsync();
        await provider.DisposeAsync();
        _template = connection;
        return connection;
    }

    private static (SqliteConnection Connection, ServiceProvider Provider, FakeTimeProvider Time, TestCurrentUser User, RecordingPublisher Events) Build(DateTimeOffset start)
    {
        var time = new FakeTimeProvider(start);
        var connectionString = $"Data Source=menuqr-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";

        // Giữ một kết nối mở để DB SQLite trong bộ nhớ tồn tại suốt bài test.
        var keepAlive = new SqliteConnection(connectionString);
        keepAlive.Open();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["Database:ConnectionString"] = connectionString,
                ["Jwt:Key"] = new string('k', 48),
                ["Jwt:Issuer"] = "unit-test",
                ["Jwt:Audience"] = "unit-test",
                ["Demo:Enabled"] = "true",
                ["Demo:Password"] = DemoPassword
            })
            .Build();

        var currentUser = new TestCurrentUser();
        var events = new RecordingPublisher();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(time);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());

        // Đăng ký trước AddInfrastructure: bản quét tự động dùng TryAdd nên giữ bản giả này.
        services.AddSingleton<ICurrentUserService>(currentUser);
        services.AddSingleton<IPosEventPublisher>(events);
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        return (keepAlive, provider, time, currentUser, events);
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "UnitTests";
        public string ContentRootPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "menuqr-test-root");
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

/// <summary>Người dùng hiện tại giả, đổi được giữa các bước test.</summary>
public sealed class TestCurrentUser : ICurrentUserService
{
    public Guid? UserId { get; private set; }
    public string? Username { get; private set; }
    public Guid? SessionId => null;
    public bool IsAuthenticated => UserId.HasValue;
    public string? IpAddress => "127.0.0.1";

    public void Set(Guid? userId, string? username)
    {
        UserId = userId;
        Username = username;
    }
}

/// <summary>Ghi lại sự kiện thời gian thực để kiểm tên và payload (07 §2.14).</summary>
public sealed class RecordingPublisher : IPosEventPublisher
{
    private readonly List<(string Name, object Payload)> _events = [];

    public IReadOnlyList<(string Name, object Payload)> All
    {
        get
        {
            lock (_events)
                return _events.ToList();
        }
    }

    public Task PublishAsync(string eventName, object payload, CancellationToken ct = default)
    {
        lock (_events)
            _events.Add((eventName, payload));
        return Task.CompletedTask;
    }

    public void Clear()
    {
        lock (_events)
            _events.Clear();
    }

    public IReadOnlyList<object> Of(string name) => All.Where(e => e.Name == name).Select(e => e.Payload).ToList();
}
