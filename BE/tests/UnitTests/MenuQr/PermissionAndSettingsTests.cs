using System.Reflection;
using Application.Constants;
using Application.DTOs.Settings;
using Application.Interfaces.Services.Roles;
using Application.Validators.Tables;
using Infrastructure.Persistence.Seeders;
using UnitTests.TestSupport;

namespace UnitTests.MenuQr;

/// <summary>Quyền theo vai trò (07 §1, TC-36, TC-43) và kiểm khóa <c>Ordering.*</c>, <c>Store.*</c> khi <c>PUT /api/settings</c>.</summary>
public sealed class PermissionAndSettingsTests : IAsyncLifetime
{
    private PosTestHost _host = null!;

    public async Task InitializeAsync() => _host = await PosTestHost.StartAsync();

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private static IReadOnlyList<string> ProjectCodes() =>
        typeof(ProjectPermissions).GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();

    [Fact]
    public void ProjectPermissions_DeclaredInSeedAndFe()
    {
        var codes = ProjectCodes();
        Assert.Equal(22, codes.Count);
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        Assert.All(codes, c => Assert.Contains(c, seeded));

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "FE", "src", "config", "permissions.ts")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var fe = File.ReadAllText(Path.Combine(dir!.FullName, "FE", "src", "config", "permissions.ts"));
        Assert.All(codes, c => Assert.Contains($"'{c}'", fe));
    }

    [Theory]
    [InlineData("nhanvien", "orders.confirm", true)]
    [InlineData("nhanvien", "orders.serve", true)]
    [InlineData("nhanvien", "orders.create", true)]
    [InlineData("nhanvien", "table-sessions.checkout", true)]
    [InlineData("nhanvien", "menu-items.availability", true)]
    [InlineData("nhanvien", "orders.cancel", false)]
    [InlineData("nhanvien", "reports.view", false)]
    [InlineData("nhanvien", "tables.view", false)]
    [InlineData("nhanvien", "menu-items.update", false)]
    [InlineData("nhanvien", "order-settings.update", false)]
    [InlineData("quanly", "orders.cancel", true)]
    [InlineData("quanly", "reports.view", true)]
    [InlineData("quanly", "tables.update", true)]
    [InlineData("quanly", "order-settings.update", true)]
    [InlineData("admin", "orders.cancel", true)]
    public async Task RolePermissions(string username, string permission, bool expected)
    {
        var userId = (await _host.SignInAsync(username))!.Value;
        Assert.Equal(expected, await _host.CallAsync<IPermissionService, bool>(s => s.HasPermissionAsync(userId, permission)));
    }

    [Fact]
    public void SettingsValidator_ProjectKeys()
    {
        var validator = new ProjectSettingsValidator();
        var result = validator.Validate(new UpdateSettingsRequest
        {
            Items =
            [
                new UpdateSettingItem { Key = "Ordering.OpenTime", Value = "25:00" },
                new UpdateSettingItem { Key = "Ordering.CloseTime", Value = "02:00" },
                new UpdateSettingItem { Key = "Ordering.ConfirmMode", Value = "Auto" },
                new UpdateSettingItem { Key = "Ordering.PausedUntil", Value = "manual" },
                new UpdateSettingItem { Key = "Store.BankBin", Value = "97042" },
                new UpdateSettingItem { Key = "Store.Name", Value = " " },
                new UpdateSettingItem { Key = "Brand.AppName", Value = "" }
            ]
        });

        Assert.Equal(
            ["items[0].value: Giờ dạng HH:mm", "items[2].value: Chế độ là ThuCong hoặc TuXacNhan", "items[4].value: Mã ngân hàng gồm 6 chữ số", "items[5].value: Nhập tên quán"],
            result.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}"));
    }
}
