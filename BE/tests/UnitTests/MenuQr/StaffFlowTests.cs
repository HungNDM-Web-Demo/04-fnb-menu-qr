using Application.Common.Exceptions;
using Application.DTOs.Menu;
using Application.DTOs.Orders;
using Application.DTOs.Public;
using Application.DTOs.Reports;
using Application.DTOs.Sessions;
using Application.Interfaces.Services.Menu;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Reports;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Enums.Pos.Menu;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;
using Domain.Enums.Pos.Tables;
using FluentValidation;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using UnitTests.TestSupport;
using static UnitTests.TestSupport.MenuQrScenario;

namespace UnitTests.MenuQr;

/// <summary>
/// Nhân viên, quản lý: xác nhận, bỏ món, từ chối, tự xác nhận, phục vụ, gọi món hộ, hủy món, thu tiền, chuyển bàn, xung đột
/// version, chống thu trùng (TC-18…TC-30, TC-42), thực đơn (TC-31, TC-33, TC-35), đặt lại dữ liệu demo.
/// </summary>
public sealed class StaffFlowTests : IAsyncLifetime
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
    public async Task Tc18_Tc19_Tc22_Tc12_StandardSession_268000()
    {
        var (standardId, beerId, sessionId) = await _pos.StandardSessionAsync();

        var standard = await _pos.Orders(s => s.GetByIdAsync(standardId));
        Assert.Equal((OrderStatus.DaXacNhan, 180_000m, "Lê Hoàng Nam"), (standard.Status, standard.Total, standard.HandledByName));
        var tra = standard.Items.Single(i => i.ItemCode == "M036");
        Assert.Equal((OrderItemStatus.BiBo, "Không phục vụ được: Hết món"), (tra.Status, tra.StatusText));

        // BR-10: Trà tắc chuyển "Hết trong hôm nay".
        var traItem = await _pos.ItemAsync("M036");
        Assert.Equal(SoldOutMode.HetHomNay, traItem.SoldOutMode);
        Assert.Contains(_host.Events.All, e => e.Name == "menu-changed");

        var beer = await _pos.Orders(s => s.GetByIdAsync(beerId));
        Assert.Equal((OrderStatus.DaXacNhan, true, 88_000m), (beer.Status, beer.AutoConfirmed, beer.Total));

        var session = await _pos.SessionAsync(sessionId);
        Assert.Equal((268_000m, 0m, 2), (session.Subtotal, session.PendingTotal, session.Orders.Count));

        var live = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, null));
        Assert.Equal(268_000m, live.Session!.Subtotal);
        Assert.Equal([false, true], live.Session.Orders.Select(o => o.IsMine));
        Assert.Equal(OrderStatus.DaXacNhan, live.Session.Orders.Single(o => o.Code == beer.Code).Status);

        var orders = await _pos.Orders(s => s.GetLiveAsync());
        Assert.Contains(orders.Serving, o => o.Id == beerId && o.AutoConfirmed);
    }

    [Fact]
    public async Task Tc20_RemoveAll_Tc23_Overdue_Tc25_ServePending_ConfirmTwice409()
    {
        await _host.SignInAsync("nhanvien");
        var live = await _pos.Orders(s => s.GetLiveAsync());
        var ban08 = live.Pending[0];
        Assert.Equal(("Bàn 08", WaitLevel.Do), (ban08.TableName, ban08.WaitLevel));

        var all = new ConfirmOrderRequest { RemovedItems = ban08.Items.Select(i => new RemovedItemInput { ItemId = i.Id, Reason = RemoveReason.HetMon }).ToList() };
        var removeAll = await Assert.ThrowsAsync<DomainException>(() => _pos.Orders(s => s.ConfirmAsync(ban08.Id, all)));
        Assert.Equal((PosErrors.DonPhaiConMon, "Đơn phải còn ít nhất 1 món, bỏ hết thì dùng Từ chối"), (CodeOf(removeAll), removeAll.Message));

        var khac = await Assert.ThrowsAsync<ValidationException>(() => _pos.Orders(s => s.ConfirmAsync(ban08.Id, new ConfirmOrderRequest
        {
            RemovedItems = [new RemovedItemInput { ItemId = ban08.Items[0].Id, Reason = RemoveReason.Khac }]
        })));
        Assert.Equal(("removedItems[0].note", "Nhập lý do bỏ món"), (khac.Errors.Single().PropertyName, khac.Errors.Single().ErrorMessage));

        var serve = await Assert.ThrowsAsync<DomainException>(() => _pos.Orders(s => s.ServeAsync(ban08.Id, new ServeOrderRequest())));
        Assert.Equal((PosErrors.DonChuaXacNhan, "Đơn chưa được xác nhận"), (CodeOf(serve), serve.Message));

        await _pos.Orders(s => s.ConfirmAsync(ban08.Id, new ConfirmOrderRequest()));
        await _host.SignInAsync("nhanvien2");
        var again = await Assert.ThrowsAsync<ConflictException>(() => _pos.Orders(s => s.ConfirmAsync(ban08.Id, new ConfirmOrderRequest())));
        Assert.Equal((PosErrors.DonDaXuLy, "Đơn đã được Lê Hoàng Nam xử lý"), ((string)again.Extensions["code"]!, again.Message));
        Assert.IsType<StaffOrderDto>(again.Extensions["order"]);
    }

    [Fact]
    public async Task Tc21_RejectOnlyOrder_SessionCancelled_TableFree()
    {
        var sent = await _pos.SubmitAsync(Ban12, PhoneA, [await _pos.LineAsync("M001", 1)]);
        var orderId = await _pos.OrderIdAsync(sent.Value.Order.Code);
        await _host.SignInAsync("nhanvien");

        // Thiếu lý do: không được coi là lý do đầu tiên của enum (mock và BE cùng câu, 07 §2.13)
        var noReason = await Assert.ThrowsAsync<ValidationException>(() => _pos.Orders(s => s.RejectAsync(orderId, new RejectOrderRequest())));
        Assert.Equal(("reason", "Chọn lý do từ chối"), (noReason.Errors.Single().PropertyName, noReason.Errors.Single().ErrorMessage));

        var noNote = await Assert.ThrowsAsync<ValidationException>(() => _pos.Orders(s => s.RejectAsync(orderId, new RejectOrderRequest { Reason = RejectReason.Khac })));
        Assert.Equal("Nhập lý do từ chối", noNote.Errors.Single().ErrorMessage);

        var rejected = await _pos.Orders(s => s.RejectAsync(orderId, new RejectOrderRequest { Reason = RejectReason.BanKhongCoKhach }));
        Assert.Equal((OrderStatus.BiTuChoi, "Bàn không có khách"), (rejected.Status, rejected.RejectText));

        var board = await _pos.Sessions(s => s.GetBoardAsync());
        Assert.Equal(TableStatus.Trong, board.Single(b => b.TableName == "Bàn 12").Status);
        var session = await _pos.SessionAsync(rejected.SessionId);
        Assert.Equal(SessionStatus.DaHuy, session.Status);

        var live = await _pos.Public(s => s.GetLiveAsync(Ban12, PhoneA, sent.Value.SessionCode));
        Assert.Null(live.Session);
        Assert.Equal((SessionStatus.DaHuy, "Bàn không có khách"), (live.EndedSession!.Status, live.EndedSession.Orders[0].RejectText));
    }

    [Fact]
    public async Task Tc24_ServeAll_Unserve60s()
    {
        var (standardId, _, _) = await _pos.StandardSessionAsync();
        var served = await _pos.Orders(s => s.ServeAsync(standardId, new ServeOrderRequest()));
        Assert.Equal((OrderStatus.DaPhucVu, 0), (served.Status, served.UnservedCount));
        Assert.Equal(OrderItemStatus.BiBo, served.Items.Single(i => i.ItemCode == "M036").Status);

        var goi = served.Items.First(i => i.ItemCode == "M001");
        _host.Time.Advance(TimeSpan.FromSeconds(30));
        var undone = await _pos.Orders(s => s.UnserveAsync(standardId, new UnserveOrderRequest { ItemIds = [goi.Id] }));
        Assert.Equal(OrderStatus.DaXacNhan, undone.Status);

        await _pos.Orders(s => s.ServeAsync(standardId, new ServeOrderRequest { ItemIds = [goi.Id] }));
        _host.Time.Advance(TimeSpan.FromSeconds(61));
        var late = await Assert.ThrowsAsync<DomainException>(() => _pos.Orders(s => s.UnserveAsync(standardId, new UnserveOrderRequest { ItemIds = [goi.Id] })));
        Assert.Equal((PosErrors.HetThoiGianHoanTac, "Hết thời gian hoàn tác"), (CodeOf(late), late.Message));
    }

    [Fact]
    public async Task Tc26_StaffOrder_150000_Idempotent_InactiveTable()
    {
        await _host.SignInAsync("nhanvien");
        var tableId = await _pos.TableIdAsync(Ban12);
        var line = await _pos.LineAsync("M010", 2);
        line.ExpectedUnitPrice = null;
        var request = new CreateStaffOrderRequest { ClientRequestId = "staff-1", TableId = tableId, Lines = [line] };
        await _host.SignInAsync("nhanvien");
        var created = await _pos.Orders(s => s.CreateAsync(request));
        Assert.Equal((true, OrderSource.NhanVien, OrderStatus.DaXacNhan, 150_000m, "Lê Hoàng Nam"),
            (created.Created, created.Value.Source, created.Value.Status, created.Value.Total, created.Value.HandledByName));
        var again = await _pos.Orders(s => s.CreateAsync(request));
        Assert.Equal((false, created.Value.Id), (again.Created, again.Value.Id));

        var board = await _pos.Sessions(s => s.GetBoardAsync());
        var ban12 = board.Single(b => b.TableName == "Bàn 12");
        Assert.Equal((TableStatus.DangPhucVu, 150_000m), (ban12.Status, ban12.Session!.Subtotal));

        var off = await Assert.ThrowsAsync<DomainException>(() => _pos.Orders(s => s.CreateAsync(new CreateStaffOrderRequest
        {
            ClientRequestId = "staff-2", TableId = board.Single(b => b.TableName == "Bàn 20").TableId, Lines = [line]
        })));
        Assert.Equal((PosErrors.BanDangTat, "Bàn đang tắt, bật bàn trước khi gọi món"), (CodeOf(off), off.Message));
    }

    [Fact]
    public async Task Tc16_Tc27_Tc29_Tc42_PaymentRequest_CheckoutCash_NewSession()
    {
        var (standardId, beerId, sessionId) = await _pos.StandardSessionAsync();
        await _pos.Orders(s => s.ServeAsync(standardId, new ServeOrderRequest()));
        await _pos.Orders(s => s.ServeAsync(beerId, new ServeOrderRequest()));
        await _host.SignInAsync("quanly");
        var before = await _host.CallAsync<IReportService, DashboardReport>(s => s.GetDashboardAsync());

        var pay = await _pos.Public(s => s.SendRequestAsync(Ban05, new PublicServiceRequestInput
        {
            ClientRequestId = "pay-1", DeviceId = PhoneA, Type = ServiceRequestType.ThanhToan, PaymentMethod = PaymentMethod.ChuyenKhoan, NeedVatInvoice = true
        }));
        Assert.Equal("Thanh toán · Chuyển khoản · Cần HĐ GTGT", pay.Value.Request.ReasonText);
        await _host.SignInAsync("nhanvien");
        var board = await _pos.Sessions(s => s.GetBoardAsync());
        Assert.Equal(TableStatus.ChoThanhToan, board.Single(b => b.TableName == "Bàn 05").Status);

        var session = await _pos.SessionAsync(sessionId);
        var shortCash = await Assert.ThrowsAsync<DomainException>(() => _pos.Sessions(s => s.CheckoutAsync(sessionId, new CheckoutRequest
        {
            ClientRequestId = "co-1", Version = session.Version, Method = PaymentMethod.TienMat, CashReceived = 200_000
        })));
        Assert.Equal((PosErrors.TienKhachDuaThieu, "Còn thiếu 68.000 ₫"), (CodeOf(shortCash), shortCash.Message));

        var stale = await Assert.ThrowsAsync<ConflictException>(() => _pos.Sessions(s => s.CheckoutAsync(sessionId, new CheckoutRequest
        {
            ClientRequestId = "co-1", Version = session.Version - 1, Method = PaymentMethod.TienMat, CashReceived = 300_000
        })));
        Assert.Equal((PosErrors.DuLieuCu, session.Version), ((string)stale.Extensions["code"]!, (int)stale.Extensions["currentVersion"]!));

        var request = new CheckoutRequest { ClientRequestId = "co-1", Version = session.Version, Method = PaymentMethod.TienMat, CashReceived = 300_000 };
        var result = await _pos.Sessions(s => s.CheckoutAsync(sessionId, request));
        Assert.Equal((32_000m, SessionStatus.DaDong, 268_000m, true), (result.ChangeAmount, result.Session.Status, result.Session.Payment!.Total, result.Session.Payment.NeedVatInvoice));
        Assert.All(result.Session.Requests, r => Assert.Equal((ServiceRequestStatus.DaXuLy, true), (r.Status, r.AutoHandled)));

        var duplicate = await _pos.Sessions(s => s.CheckoutAsync(sessionId, request));
        Assert.Equal((true, 32_000m), (duplicate.Duplicate, duplicate.ChangeAmount));

        await _host.SignInAsync("quanly");
        var after = await _host.CallAsync<IReportService, DashboardReport>(s => s.GetDashboardAsync());
        Assert.Equal((before.Revenue + 268_000m, before.ClosedSessions + 1), (after.Revenue, after.ClosedSessions));

        var live = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, session.Code));
        Assert.Null(live.Session);
        Assert.Equal(SessionStatus.DaDong, live.EndedSession!.Status);

        var next = await _pos.SubmitAsync(Ban05, PhoneA, [await _pos.LineAsync("M001", 1)]);
        Assert.NotEqual(session.Code, next.Value.SessionCode);
    }

    [Fact]
    public async Task Tc28_Unserved_PaymentCancelledByNewOrder()
    {
        await _host.SignInAsync("nhanvien");
        var board = await _pos.Sessions(s => s.GetBoardAsync());
        var ban08 = await _pos.SessionAsync(board.Single(b => b.TableName == "Bàn 08").Session!.Id);
        var pending = await Assert.ThrowsAsync<DomainException>(() => _pos.Sessions(s => s.CheckoutAsync(ban08.Id, new CheckoutRequest
        {
            ClientRequestId = "x", Version = ban08.Version, Method = PaymentMethod.TienMat, CashReceived = 0
        })));
        Assert.Equal((PosErrors.ConDonChoXacNhan, "Còn 1 đơn chờ xác nhận", 1), (CodeOf(pending), pending.Message, (int)pending.Extensions["pendingCount"]!));

        // Bàn 10 chờ thanh toán: còn món chưa phục vụ thì cảnh báo; khách gọi thêm thì yêu cầu thanh toán tự hủy (BR-12).
        var ban10 = await _pos.SessionAsync(board.Single(b => b.TableName == "Bàn 10").Session!.Id);
        Assert.Equal(SessionStatus.ChoThanhToan, ban10.Status);
        var more = await _pos.SubmitAsync("Q8DM5Y", PhoneA, [await _pos.LineAsync("M043", 2)]);
        Assert.Equal(OrderStatus.DaXacNhan, more.Value.Order.Status);
        var after = await _pos.SessionAsync(ban10.Id);
        Assert.Equal((SessionStatus.DangPhucVu, null), (after.Status, after.PaymentRequest));
        Assert.True(after.Version > ban10.Version);
        Assert.Contains(after.Requests, r => r.Type == ServiceRequestType.ThanhToan && r.Status == ServiceRequestStatus.DaHuy);

        var unserved = await Assert.ThrowsAsync<DomainException>(() => _pos.Sessions(s => s.CheckoutAsync(after.Id, new CheckoutRequest
        {
            ClientRequestId = "y", Version = after.Version, Method = PaymentMethod.ChuyenKhoan
        })));
        Assert.Equal(PosErrors.ConMonChuaPhucVu, CodeOf(unserved));
        var closed = await _pos.Sessions(s => s.CheckoutAsync(after.Id, new CheckoutRequest
        {
            ClientRequestId = "y", Version = after.Version, Method = PaymentMethod.ChuyenKhoan, AcknowledgeUnserved = true
        }));
        Assert.Equal((986_000m, null), (closed.Session.Payment!.Total, closed.Session.Payment.CashReceived));
    }

    [Fact]
    public async Task Tc30_ManagerCancelsOneBeer_246000()
    {
        var (_, beerId, sessionId) = await _pos.StandardSessionAsync();
        var beer = await _pos.Orders(s => s.GetByIdAsync(beerId));
        await _host.SignInAsync("quanly");

        var noReason = await Assert.ThrowsAsync<ValidationException>(() => _pos.Orders(s => s.CancelItemAsync(beerId, beer.Items[0].Id, new CancelOrderItemRequest { Quantity = 1 })));
        Assert.Equal("Nhập lý do hủy", noReason.Errors.Single().ErrorMessage);
        var tooMany = await Assert.ThrowsAsync<ValidationException>(() => _pos.Orders(s => s.CancelItemAsync(beerId, beer.Items[0].Id, new CancelOrderItemRequest { Quantity = 5, Reason = "Khách đổi ý" })));
        Assert.Equal("Số lượng hủy từ 1 đến 4", tooMany.Errors.Single().ErrorMessage);

        var cancelled = await _pos.Orders(s => s.CancelItemAsync(beerId, beer.Items[0].Id, new CancelOrderItemRequest { Quantity = 1, Reason = "Khách đổi ý" }));
        Assert.Equal(2, cancelled.Items.Count);
        Assert.Equal((3, 66_000m, OrderItemStatus.DaXacNhan), (cancelled.Items[0].Quantity, cancelled.Items[0].LineTotal, cancelled.Items[0].Status));
        Assert.Equal((1, OrderItemStatus.DaHuy, "Đã hủy: Khách đổi ý", "Trần Thị Mai"),
            (cancelled.Items[1].Quantity, cancelled.Items[1].Status, cancelled.Items[1].StatusText, cancelled.Items[1].CancelledByName));
        Assert.Equal(246_000m, (await _pos.SessionAsync(sessionId)).Subtotal);
        Assert.Equal(246_000m, (await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, null))).Session!.Subtotal);
    }

    [Fact]
    public async Task Transfer_ToFreeTable_PhoneSeesMove()
    {
        var (_, _, sessionId) = await _pos.StandardSessionAsync();
        var session = await _pos.SessionAsync(sessionId);
        var ban12 = await _pos.TableIdAsync(Ban12);
        var ban08 = await _pos.TableIdAsync(Ban08);

        var busy = await Assert.ThrowsAsync<DomainException>(() => _pos.Sessions(s => s.TransferAsync(sessionId, new TransferSessionRequest { TargetTableId = ban08, Version = session.Version })));
        Assert.Equal((PosErrors.BanDichKhongHopLe, "Chỉ chuyển sang bàn đang trống và đang bật"), (CodeOf(busy), busy.Message));

        var moved = await _pos.Sessions(s => s.TransferAsync(sessionId, new TransferSessionRequest { TargetTableId = ban12, Version = session.Version }));
        Assert.Equal(("Bàn 12", "Bàn 05", session.Code), (moved.TableName, moved.TransferredFromTableName, moved.Code));

        var old = await _pos.Public(s => s.GetLiveAsync(Ban05, PhoneA, session.Code));
        Assert.Null(old.Session);
        Assert.Equal("Bàn 12", old.EndedSession!.TransferredToTableName);
        Assert.Equal(session.Code, (await _pos.Public(s => s.GetLiveAsync(Ban12, PhoneA, null))).Session!.Code);
    }

    [Fact]
    public async Task Tc31_Tc33_Tc35_MenuManagement()
    {
        await _host.SignInAsync("quanly");
        var group = await _host.CallAsync<IOptionGroupService, OptionGroupDto>(s => s.CreateAsync(new SaveOptionGroupRequest
        {
            Name = "Mức đá", SelectionType = SelectionType.ChonMot, IsRequired = false,
            Choices = [new SaveOptionChoiceInput { Name = "Ít đá" }, new SaveOptionChoiceInput { Name = "Không đá" }]
        }));
        var categoryId = (await _pos.ItemAsync("M030")).CategoryId;
        var item = await _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.CreateAsync(new SaveMenuItemRequest
        {
            Code = "M051", Name = "Cà phê sữa đá", CategoryId = categoryId, Unit = "ly", Price = 29_000, OptionGroupIds = [group.Id]
        }));
        Assert.Equal((MenuItemStatus.DangBan, false), (item.Status, item.EverOrdered));
        var duplicate = await Assert.ThrowsAsync<ConflictException>(() => _host.CallAsync<IMenuItemService, MenuItemDto>(s => s.CreateAsync(new SaveMenuItemRequest
        {
            Code = "M051", Name = "Trùng", CategoryId = categoryId, Unit = "ly", Price = 10_000
        })));
        Assert.Equal(("Mã món đã tồn tại", "code"), (duplicate.Message, duplicate.Field));

        var menu = await _pos.Public(s => s.GetMenuAsync(Ban05));
        Assert.Equal(29_000m, menu.Items.Single(i => i.Code == "M051").Price);
        var line = await _pos.LineAsync("M051", 1);
        Assert.True((await _pos.SubmitAsync(Ban05, PhoneA, [line])).Created);

        // TC-33: giá lẻ, xóa món đã gọi.
        var bad = new Application.Validators.Menu.SaveOptionGroupRequestValidator().Validate(new SaveOptionGroupRequest
        {
            Name = "Thêm", SelectionType = SelectionType.ChonNhieu, MaxSelect = 2,
            Choices = [new SaveOptionChoiceInput { Name = "Lạp xưởng", Price = 15_500 }]
        });
        Assert.Contains(bad.Errors, e => e.PropertyName == "Choices[0].Price" && e.ErrorMessage == "Giá phải là bội số 1.000 ₫");
        var goiCuon = await _pos.ItemAsync("M001");
        await _host.SignInAsync("quanly");
        var ordered = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IMenuItemService>(s => s.DeleteAsync(goiCuon.Id)));
        Assert.Equal((PosErrors.MonDaDuocGoi, "Món đã từng được gọi, không xóa được. Hãy dùng Ẩn"), (CodeOf(ordered), ordered.Message));

        // TC-35: hết Size L áp cho mọi món dùng nhóm; Size M vẫn chọn được, 20.000 ₫.
        await _host.SignInAsync("nhanvien");
        var size = (await _host.CallAsync<IOptionGroupService, IReadOnlyList<OptionGroupDto>>(s => s.GetListAsync())).Single(g => g.Name == "Size");
        await _host.CallAsync<IOptionGroupService>(s => s.SetChoiceAvailabilityAsync(size.Id, size.Choices.Single(c => c.Name == "L").Id,
            new SetAvailabilityRequest { IsSoldOut = true, Mode = SoldOutMode.HetToiKhiMoLai }));
        var sizeL = await _pos.LineAsync("M037", 1, ("Size", "L"));
        var soldL = await Assert.ThrowsAsync<DomainException>(() => _pos.SubmitAsync(Ban12, PhoneA, [sizeL]));
        Assert.Equal("L vừa hết", ((Dictionary<string, string[]>)soldL.Extensions["errors"]!)["lines[0]"][0]);
        Assert.Equal(20_000m, (await _pos.SubmitAsync(Ban12, PhoneA, [await _pos.LineAsync("M036", 1, ("Size", "M"))])).Value.Order.Total);
    }

    [Fact]
    public async Task DemoReset_RestoresSeedNumbers()
    {
        await _pos.StandardSessionAsync();
        await _host.RunAsync(async sp => await sp.GetRequiredService<DemoDataResetter>().ResetAsync());

        Assert.Equal(1335, await _host.QueryAsync<Domain.Entities.Pos.Orders.TableSession, int>(q => q.CountAsync()));
        Assert.Equal(2127, await _host.QueryAsync<Domain.Entities.Pos.Orders.Order, int>(q => q.CountAsync()));
        Assert.Equal(6618, await _host.QueryAsync<Domain.Entities.Pos.Orders.OrderItem, int>(q => q.CountAsync()));
        Assert.Equal(50, await _host.QueryAsync<MenuItem, int>(q => q.CountAsync()));
        Assert.Null((await _pos.ItemAsync("M036")).SoldOutMode);
    }
}
