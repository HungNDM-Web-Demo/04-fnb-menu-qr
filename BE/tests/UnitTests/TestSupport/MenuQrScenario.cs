using Application.DTOs.Orders;
using Application.DTOs.Public;
using Application.DTOs.Sessions;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Public;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.TestSupport;

/// <summary>
/// Thao tác dùng lại trong test: tra Id theo mã, gửi đơn từ trang khách, dựng "Đơn chuẩn Bàn 05" và "Phiên chuẩn Bàn 05"
/// (05 §1: TC-06, TC-19, TC-22).
/// </summary>
public sealed class MenuQrScenario(PosTestHost host)
{
    public const string Ban05 = "K7M2QX";
    public const string Ban08 = "P9C4WV";
    public const string Ban12 = "R4TZ8N";
    public const string Ban14 = "M3XH7B";
    public const string Ban20 = "H3WP6D";
    public const string PhoneA = "phone-a";
    public const string PhoneB = "phone-b";

    public PosTestHost Host => host;

    public Task<Guid> TableIdAsync(string code) =>
        host.QueryAsync<DiningTable, Guid>(q => q.Where(t => t.Code == code).Select(t => t.Id).SingleAsync());

    public Task<MenuItem> ItemAsync(string code) =>
        host.QueryAsync<MenuItem, MenuItem>(q => q.Include(i => i.OptionGroups).SingleAsync(i => i.Code == code));

    public Task<Guid> ChoiceIdAsync(string groupName, string choiceName) =>
        host.QueryAsync<OptionGroup, Guid>(q => q.Where(g => g.Name == groupName).SelectMany(g => g.Choices)
            .Where(c => c.Name == choiceName).Select(c => c.Id).SingleAsync());

    /// <summary>Dòng giỏ kèm giá khách đang thấy (giá món + lựa chọn hiện tại).</summary>
    public async Task<CartLineInput> LineAsync(string itemCode, int quantity, params (string Group, string Choice)[] choices)
    {
        var item = await ItemAsync(itemCode);
        var ids = new List<Guid>();
        decimal extra = 0;
        foreach (var (group, choice) in choices)
        {
            var id = await ChoiceIdAsync(group, choice);
            ids.Add(id);
            extra += await host.QueryAsync<OptionChoice, decimal>(q => q.Where(c => c.Id == id).Select(c => c.Price).SingleAsync());
        }

        return new CartLineInput { MenuItemId = item.Id, ChoiceIds = ids, Quantity = quantity, ExpectedUnitPrice = item.Price + extra };
    }

    public Task<T> Public<T>(Func<IPublicTableService, Task<T>> call) => host.CallAsync(call);

    public Task<T> Orders<T>(Func<IOrderService, Task<T>> call) => host.CallAsync(call);

    public Task<T> Sessions<T>(Func<ITableSessionService, Task<T>> call) => host.CallAsync(call);

    public async Task<WriteOutcome<PublicSubmitOrderResult>> SubmitAsync(
        string tableCode, string device, IEnumerable<CartLineInput> lines, string? guestName = null, string? requestId = null)
    {
        await host.SignInAsync(null);
        var request = new PublicSubmitOrderRequest
        {
            ClientRequestId = requestId ?? Guid.NewGuid().ToString(),
            DeviceId = device,
            GuestName = guestName,
            Lines = lines.ToList()
        };
        return await Public(s => s.SubmitOrderAsync(tableCode, request));
    }

    /// <summary>Đơn chuẩn Bàn 05 (TC-06): 2 Gỏi cuốn, Cơm chiên + Trứng + Lạp xưởng, 2 Trà tắc size L, "Anh Tuấn" = 230.000 ₫.</summary>
    public async Task<PublicSubmitOrderResult> StandardOrderAsync(string tableCode = Ban05)
    {
        var lines = new[]
        {
            await LineAsync("M001", 2),
            await LineAsync("M011", 1, ("Thêm", "Trứng ốp la"), ("Thêm", "Lạp xưởng")),
            await LineAsync("M036", 2, ("Size", "L"))
        };
        return (await SubmitAsync(tableCode, PhoneA, lines, "Anh Tuấn")).Value;
    }

    public async Task<Guid> OrderIdAsync(string orderCode) =>
        await host.QueryAsync<Order, Guid>(q => q.Where(o => o.Code == orderCode).Select(o => o.Id).SingleAsync());

    /// <summary>
    /// Phiên chuẩn Bàn 05: Đơn chuẩn được xác nhận bỏ Trà tắc lý do Hết món (TC-19, còn 180.000 ₫), điện thoại B gửi 4 Bia Sài Gòn
    /// Special tự xác nhận (TC-22, 88.000 ₫); tạm tính 268.000 ₫.
    /// </summary>
    public async Task<(Guid StandardOrderId, Guid BeerOrderId, Guid SessionId)> StandardSessionAsync()
    {
        var standard = await StandardOrderAsync();
        var orderId = await OrderIdAsync(standard.Order.Code);
        var order = await Orders(s => s.GetByIdAsync(orderId));
        var traTac = order.Items.Single(i => i.ItemCode == "M036");

        await host.SignInAsync("nhanvien");
        await Orders(s => s.ConfirmAsync(orderId, new ConfirmOrderRequest
        {
            RemovedItems = [new RemovedItemInput { ItemId = traTac.Id, Reason = RemoveReason.HetMon }]
        }));

        var beer = await SubmitAsync(Ban05, PhoneB, [await LineAsync("M043", 4)]);
        var beerId = await OrderIdAsync(beer.Value.Order.Code);
        await host.SignInAsync("nhanvien");
        return (orderId, beerId, order.SessionId);
    }

    public async Task<TableSessionDto> SessionAsync(Guid sessionId)
    {
        await host.SignInAsync("nhanvien");
        return await Sessions(s => s.GetByIdAsync(sessionId));
    }
}
