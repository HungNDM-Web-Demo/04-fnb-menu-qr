using Application.Common.Exceptions;
using Application.DTOs.Menu;
using Application.DTOs.Orders;
using Application.DTOs.Public;
using Application.DTOs.Tables;
using Application.Interfaces.Services.Menu;
using Application.Interfaces.Services.Realtime;
using Application.Interfaces.Services.Tables;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Menu;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Domain.Enums.Pos.Tables;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;
using static UnitTests.TestSupport.MenuQrScenario;

namespace UnitTests.MenuQr;

/// <summary>Trang khách (07 §2.7): xem menu, gửi đơn, chống trùng, giờ nhận đơn, gọi nhân viên, yêu cầu thanh toán (TC-01…TC-17, TC-32).</summary>
public sealed class GuestFlowTests : IAsyncLifetime
{
    private PosTestHost _host = null!;
    private MenuQrScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await PosTestHost.StartAsync();
        _pos = new MenuQrScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private static string CodeOf(DomainException e) => (string)e.Extensions["code"]!;

    [Fact]
    public async Task Tc01_Tc02_Tc03_InfoMenuAndInvalidCode()
    {
        var info = await _pos.Public(s => s.GetInfoAsync("k7m2qx"));
        Assert.Equal(("Bàn 05", "Quán Vườn Dừa", true), (info.Table.Name, info.Store.Name, info.Ordering.Accepting));

        var menu = await _pos.Public(s => s.GetMenuAsync(Ban05));
        Assert.Equal(49, menu.Items.Count);   // M029 ẩn
        Assert.Equal(6, menu.Categories.Count);
        Assert.True(menu.Items.Single(i => i.Code == "M003").IsSoldOut);
        Assert.Equal(info.MenuStamp, menu.Stamp);
        var size = menu.OptionGroups.Single(g => g.Name == "Size");
        Assert.True(size.Choices.Single(c => c.Name == "M").IsDefault);

        var invalid = await Assert.ThrowsAsync<PosNotFoundException>(() => _pos.Public(s => s.GetInfoAsync("ABCDEF")));
        Assert.Equal((PosErrors.MaQrKhongHopLe, "Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên"), (invalid.Code, invalid.Message));
    }

    [Fact]
    public async Task Tc06_Tc13_Tc17_StandardOrder_PendingNotInSubtotal()
    {
        var result = await _pos.StandardOrderAsync();
        Assert.Matches(@"^DH261014\d{4}$", result.Order.Code);
        Assert.Matches(@"^PB261014\d{4}$", result.SessionCode);
        Assert.Equal((OrderStatus.ChoXacNhan, 230_000m, true, false), (result.Order.Status, result.Order.Total, result.Order.IsMine, result.Duplicate));
        Assert.Equal(["Gỏi cuốn tôm thịt", "Cơm chiên dương châu", "Trà tắc"], result.Order.Items.Select(i => i.ItemName));
        Assert.Equal(["Trứng ốp la", "Lạp xưởng"], result.Order.Items[1].Options.Select(o => o.Name));
        Assert.Contains(_host.Events.All, e => e.Name == PosEvents.OrderSubmitted);

        var live = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, result.SessionCode));
        Assert.Equal((0m, 230_000m, SessionStatus.DangPhucVu), (live.Session!.Subtotal, live.Session.PendingTotal, live.Session.Status));
        Assert.Null(live.EndedSession);
        var other = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneB, null));
        Assert.False(other.Session!.Orders[0].IsMine);

        await _host.SignInAsync("nhanvien");
        var board = await _pos.Sessions(s => s.GetBoardAsync());
        Assert.Equal(TableStatus.DangPhucVu, board.Single(b => b.TableName == "Bàn 05").Status);

        // TC-17: chưa có món được xác nhận thì không yêu cầu thanh toán được.
        var pay = await Assert.ThrowsAsync<DomainException>(() => _pos.Public(s => s.SendRequestAsync(Ban05, new PublicServiceRequestInput
        {
            ClientRequestId = "pay-1", DeviceId = PhoneA, Type = ServiceRequestType.ThanhToan, PaymentMethod = PaymentMethod.TienMat
        })));
        Assert.Equal((PosErrors.ChuaCoMonXacNhan, "Chưa có món được quán xác nhận"), (CodeOf(pay), pay.Message));
    }

    [Fact]
    public async Task Tc07_Paused_Tc08_InactiveTable_OutOfHours()
    {
        var line = await _pos.LineAsync("M001", 1);
        await _host.SignInAsync("quanly");
        var paused = await _host.CallAsync<IOrderSettingsService, OrderingStatusDto>(s => s.PauseAsync(new PauseOrderingRequest { Minutes = 15 }));
        Assert.Equal((false, "QuanTamNgung"), (paused.Accepting, paused.BlockReason));

        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban05, PhoneA, [line]));
        Assert.Equal((PosErrors.QuanTamNgung, "Quán tạm ngưng nhận đơn qua QR tới 12:15, vui lòng gọi nhân viên"), (CodeOf(error), error.Message));

        // Tạm ngưng vẫn gọi nhân viên được (07 §5 quyết định 10).
        var call = await _pos.Public(s => s.SendRequestAsync(Ban05, new PublicServiceRequestInput
        {
            ClientRequestId = "call-paused", DeviceId = PhoneA, Type = ServiceRequestType.GoiNhanVien, Reason = CallReason.TuVanMon
        }));
        Assert.True(call.Created);

        // Quá 15 phút tự nhận lại (đọc lười).
        _host.Time.Advance(TimeSpan.FromMinutes(16));
        Assert.True((await _pos.SubmitAsync(Ban05, PhoneA, [line])).Created);

        var off = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban20, PhoneA, [line]));
        Assert.Equal((PosErrors.BanTamNgung, "Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên"), (CodeOf(off), off.Message));
        var offInfo = await _pos.Public(s => s.GetInfoAsync(Ban20));
        Assert.False(offInfo.Table.IsActive);

        await _host.SignInAsync("quanly");
        await _host.CallAsync<IOrderSettingsService, OrderingStatusDto>(s => s.UpdateAsync(new UpdateOrderSettingsRequest
        {
            OpenTime = "16:00", CloseTime = "02:00", ConfirmMode = ConfirmMode.TuXacNhan
        }));
        var outOfHours = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban12, PhoneA, [line]));
        Assert.Equal("Quán nhận đơn qua QR từ 16:00 đến 02:00, vui lòng gọi nhân viên", outOfHours.Message);

        // Ngoài giờ: gọi nhân viên chỉ được khi bàn đang có phiên.
        var noSession = await Assert.ThrowsAsync<DomainException>(() => _pos.Public(s => s.SendRequestAsync(Ban12, new PublicServiceRequestInput
        {
            ClientRequestId = "call-night", DeviceId = PhoneA, Type = ServiceRequestType.GoiNhanVien, Reason = CallReason.ThemDa
        })));
        Assert.Equal(PosErrors.NgoaiGioNhanDon, CodeOf(noSession));
        Assert.True((await _pos.Public(s => s.SendRequestAsync(Ban05, new PublicServiceRequestInput
        {
            ClientRequestId = "call-night-05", DeviceId = PhoneA, Type = ServiceRequestType.GoiNhanVien, Reason = CallReason.ThemDa
        }))).Created);

        _host.Time.Advance(TimeSpan.FromHours(11));   // 23:16 giờ Việt Nam
        Assert.True((await _pos.SubmitAsync(Ban12, PhoneA, [line])).Created);

        // Demo: nhận đơn cả ngày.
        await _host.SignInAsync("nhanvien");
        var allDay = await _host.CallAsync<IOrderSettingsService, OrderingStatusDto>(s => s.AcceptAllDayAsync());
        Assert.Equal(("00:00", "00:00", true), (allDay.OpenTime, allDay.CloseTime, allDay.Accepting));
    }

    [Fact]
    public async Task Tc09_SoldOutWhileInCart_ThenResubmit()
    {
        var banhXeo = await _pos.LineAsync("M010", 1);
        var goiCuon = await _pos.LineAsync("M001", 1);
        await _host.SignInAsync("nhanvien");
        await _host.CallAsync<IMenuItemService>(s => s.SetAvailabilityAsync(banhXeo.MenuItemId,
            new SetAvailabilityRequest { IsSoldOut = true, Mode = SoldOutMode.HetHomNay }));

        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban12, PhoneA, [banhXeo, goiCuon]));
        Assert.Equal(PosErrors.MonVuaHet, CodeOf(error));
        Assert.Equal([0], (List<int>)error.Extensions["soldOutLines"]!);
        Assert.Equal("Món vừa hết", ((Dictionary<string, string[]>)error.Extensions["errors"]!)["lines[0]"][0]);

        var ok = await _pos.SubmitAsync(Ban12, PhoneA, [goiCuon]);
        Assert.Equal(45_000m, ok.Value.Order.Total);

        // "Hết trong hôm nay" tự bán lại lúc 00:00.
        _host.Time.Advance(TimeSpan.FromHours(12.1));
        var menu = await _pos.Public(s => s.GetMenuAsync(Ban12));
        Assert.False(menu.Items.Single(i => i.Code == "M010").IsSoldOut);
    }

    [Fact]
    public async Task Tc10_SameRequestOrSameCart_ReturnsExistingOrder()
    {
        var line = await _pos.LineAsync("M001", 1);
        var first = await _pos.SubmitAsync(Ban12, PhoneA, [line], requestId: "req-1");
        var again = await _pos.SubmitAsync(Ban12, PhoneA, [line], requestId: "req-1");
        Assert.Equal((true, false, true), (first.Created, again.Created, again.Value.Duplicate));
        Assert.Equal(first.Value.Order.Code, again.Value.Order.Code);

        // Cùng điện thoại, cùng giỏ, khác mã yêu cầu trong 10 giây → đơn cũ (BR-06).
        _host.Time.Advance(TimeSpan.FromSeconds(5));
        var sameCart = await _pos.SubmitAsync(Ban12, PhoneA, [line], requestId: "req-2");
        Assert.Equal((false, first.Value.Order.Code), (sameCart.Created, sameCart.Value.Order.Code));

        _host.Time.Advance(TimeSpan.FromSeconds(6));
        Assert.True((await _pos.SubmitAsync(Ban12, PhoneA, [line], requestId: "req-3")).Created);
        Assert.Equal(2, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.TableName == "Bàn 12" && o.SubmittedAt >= _host.Time.GetUtcNow().UtcDateTime.AddMinutes(-1))));
    }

    [Fact]
    public async Task Tc11_FourthPendingOrder_Blocked()
    {
        var line = await _pos.LineAsync("M001", 1);
        for (var i = 0; i < 3; i++)
        {
            Assert.True((await _pos.SubmitAsync(Ban12, PhoneA, [line])).Created);
            _host.Time.Advance(TimeSpan.FromSeconds(11));
        }

        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban12, PhoneA, [line]));
        Assert.Equal((PosErrors.QuaSoDonCho, "Bàn đang có 3 đơn chờ quán xác nhận, vui lòng chờ"), (CodeOf(error), error.Message));
    }

    [Fact]
    public async Task Br04_ChoiceRules_AndCartLimits()
    {
        var mi = await _pos.LineAsync("M013", 1);   // Mức cay bắt buộc, chưa chọn
        var com = await _pos.LineAsync("M011", 1, ("Thêm", "Trứng ốp la"), ("Thêm", "Lạp xưởng"), ("Thêm", "Chả lụa"));
        var bad = await Assert.ThrowsAsync<ValidationException>(() => _pos.SubmitAsync(Ban12, PhoneA, [mi, com]));
        Assert.Equal(["Bắt buộc chọn 1 Mức cay", "Chọn tối đa 2 Thêm"], bad.Errors.Select(e => e.ErrorMessage));
        Assert.Equal(["lines[0].choiceIds", "lines[1].choiceIds"], bad.Errors.Select(e => e.PropertyName));

        var empty = await Assert.ThrowsAsync<ValidationException>(() => _pos.SubmitAsync(Ban12, PhoneA, []));
        Assert.Equal("Giỏ món đang trống", Assert.Single(empty.Errors).ErrorMessage);

        var tooMany = await _pos.LineAsync("M001", 21);
        var quantity = await Assert.ThrowsAsync<ValidationException>(() => _pos.SubmitAsync(Ban12, PhoneA, [tooMany], new string('a', 31)));
        Assert.Equal(["Tên gọi tối đa 30 ký tự", "Số lượng từ 1 đến 20"], quantity.Errors.Select(e => e.ErrorMessage));

        // Trà tắc: Size M chọn sẵn → 20.000 ₫ (TC-35 phần giá).
        var tra = await _pos.LineAsync("M036", 1, ("Size", "M"));
        Assert.Equal(20_000m, (await _pos.SubmitAsync(Ban12, PhoneA, [tra])).Value.Order.Total);
    }

    [Fact]
    public async Task Tc32_PriceChanged_ThenResubmit()
    {
        var line = await _pos.LineAsync("M010", 1);
        await _host.SignInAsync("quanly");
        var item = await _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.GetByIdAsync(line.MenuItemId));
        await _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.UpdateAsync(item.Id, new SaveMenuItemRequest
        {
            Code = item.Code, Name = item.Name, NameEn = item.NameEn, CategoryId = item.CategoryId, Description = item.Description,
            Unit = item.Unit, Price = 79_000, Tags = item.Tags.ToList(), OptionGroupIds = item.OptionGroupIds.ToList()
        }));

        var conflict = await Assert.ThrowsAsync<ConflictException>(() => _pos.SubmitAsync(Ban12, PhoneA, [line]));
        Assert.Equal((PosErrors.GiaDaThayDoi, "Giá đã thay đổi, vui lòng kiểm tra giỏ món rồi gửi lại"), ((string)conflict.Extensions["code"]!, conflict.Message));
        var change = Assert.Single((List<PriceChange>)conflict.Extensions["priceChanges"]!);
        Assert.Equal((75_000m, 79_000m), (change.OldUnitPrice, change.NewUnitPrice));
        Assert.Equal(0, await _host.QueryAsync<Order, int>(q => q.CountAsync(o => o.TableName == "Bàn 12" && o.Status == OrderStatus.ChoXacNhan)));

        line.ExpectedUnitPrice = 79_000;
        Assert.Equal(79_000m, (await _pos.SubmitAsync(Ban12, PhoneA, [line])).Value.Order.Total);
        Assert.Equal(79_000m, (await _pos.Public(s => s.GetMenuAsync(Ban12))).Items.Single(i => i.Code == "M010").Price);
    }

    [Fact]
    public async Task Tc14_Tc15_CallStaff_RepeatWithin60s_ThenHandled()
    {
        PublicServiceRequestInput Call(string id, CallReason reason) =>
            new() { ClientRequestId = id, DeviceId = PhoneA, Type = ServiceRequestType.GoiNhanVien, Reason = reason };

        var first = await _pos.Public(s => s.SendRequestAsync(Ban05, Call("c1", CallReason.ThemDa)));
        Assert.Equal((true, "Thêm đá", ServiceRequestStatus.DangCho), (first.Created, first.Value.Request.ReasonText, first.Value.Request.Status));
        Assert.Contains(_host.Events.All, e => e.Name == PosEvents.RequestsChanged);

        _host.Time.Advance(TimeSpan.FromSeconds(30));
        var repeat = await _pos.Public(s => s.SendRequestAsync(Ban05, Call("c2", CallReason.ThemDa)));
        Assert.Equal((false, true, first.Value.Request.Id), (repeat.Created, repeat.Value.Duplicate, repeat.Value.Request.Id));
        var otherReason = await _pos.Public(s => s.SendRequestAsync(Ban05, Call("c3", CallReason.DonBan)));
        Assert.True(otherReason.Created);

        var khac = await Assert.ThrowsAsync<ValidationException>(() => _pos.Public(s => s.SendRequestAsync(Ban05, Call("c4", CallReason.Khac))));
        Assert.Equal("Nhập nội dung cần hỗ trợ", Assert.Single(khac.Errors).ErrorMessage);

        await _host.SignInAsync("nhanvien");
        var pending = await _host.CallAsync<Application.Interfaces.Services.Orders.IServiceRequestService, IReadOnlyList<ServiceRequestDto>>(s => s.GetPendingAsync());
        Assert.Equal(4, pending.Count);   // 2 mới + Bàn 10 thanh toán + Bàn 14 thêm đá
        Assert.True(pending.Single(r => r.TableName == "Bàn 14" && r.Reason == CallReason.ThemDa).IsOverdue);
        await _host.CallAsync<Application.Interfaces.Services.Orders.IServiceRequestService, ServiceRequestDto>(s => s.HandleAsync(first.Value.Request.Id));

        var live = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, null));
        Assert.Equal(ServiceRequestStatus.DaXuLy, live.MyRequests.Single(r => r.Id == first.Value.Request.Id).Status);
        Assert.Empty((await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneB, null))).MyRequests);
    }

    [Fact]
    public async Task Tc38_RegenerateCode_OldCodeInvalid_Tc37_NewTable()
    {
        await _host.SignInAsync("quanly");
        var tableId = await _pos.TableIdAsync(Ban05);
        var changed = await _host.CallAsync<ITableService, DiningTableDto>(s => s.RegenerateCodeAsync(tableId));
        Assert.NotEqual(Ban05, changed.Code);
        Assert.True(PosRules.IsValidTableCode(changed.Code));
        await Assert.ThrowsAsync<PosNotFoundException>(() => _pos.Public(s => s.GetInfoAsync(Ban05)));
        Assert.Equal("Bàn 05", (await _pos.Public(s => s.GetInfoAsync(changed.Code))).Table.Name);

        var created = await _host.CallAsync<ITableService, DiningTableDto>(s => s.CreateAsync(new SaveTableRequest { Name = "Bàn 21", Zone = "Ngoài sân", Capacity = 4 }));
        Assert.True(PosRules.IsValidTableCode(created.Code));
        Assert.Equal((210, TableStatus.Trong), (created.SortOrder, created.Status));
        var duplicate = await Assert.ThrowsAsync<ConflictException>(() => _host.CallAsync<ITableService, DiningTableDto>(s =>
            s.CreateAsync(new SaveTableRequest { Name = "bàn 21", Zone = "Ngoài sân", Capacity = 4 })));
        Assert.Equal(("Tên bàn đã tồn tại", "name"), (duplicate.Message, duplicate.Field));

        // TC-39: bàn đang có khách không tắt, không xóa, không đổi mã được.
        var ban08 = await _pos.TableIdAsync(Ban08);
        var busy = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<ITableService>(s => s.SetActiveAsync(ban08, new SetTableActiveRequest { IsActive = false })));
        Assert.Equal((PosErrors.BanDangCoKhach, "Bàn đang có khách"), (CodeOf(busy), busy.Message));
        await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<ITableService, DiningTableDto>(s => s.RegenerateCodeAsync(ban08)));
        await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<ITableService>(s => s.DeleteAsync(ban08)));
    }
}
