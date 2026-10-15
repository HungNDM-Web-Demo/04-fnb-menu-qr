using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Common.Exceptions;
using Application.DTOs.Orders;
using Application.DTOs.Public;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Menu;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Menu;
using Domain.Enums.Pos.Orders;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Implementations.Services.Pos;

namespace Infrastructure.Implementations.Services.Orders;

// Phần gửi đơn dùng chung cho khách (07 §2.7) và gọi món hộ (§2.8): kiểm lựa chọn (BR-04), món hết (BR-05), giá đổi,
// chụp tên giá vào dòng, mở phiên (BR-02), trạng thái theo BR-08, hủy yêu cầu thanh toán đang chờ (BR-12).

public sealed partial class PosOperations
{
    private sealed record PreparedLine(CartLineInput Input, MenuItem Item, IReadOnlyList<OrderItemOption> Options);

    private sealed record Submission(Order Order, TableSession Session, ServiceRequest? CancelledPayment);

    /// <summary>
    /// Bước 6 (lựa chọn sai BR-04 → <c>errors["lines[i].choiceIds"]</c>), bước 7 (món, lựa chọn hết → <c>MonVuaHet</c>),
    /// bước 8 nếu <paramref name="checkPrice"/> (giá khách thấy khác giá hiện tại → 409 <c>GiaDaThayDoi</c>).
    /// </summary>
    private static List<PreparedLine> PrepareLines(IReadOnlyList<CartLineInput> lines, MenuSnapshot menu, DateTime now, bool checkPrice)
    {
        var failures = new List<ValidationFailure>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (checkPrice && line.ExpectedUnitPrice is null)
                failures.Add(new ValidationFailure($"lines[{i}].expectedUnitPrice", "Thiếu giá món"));
            if (!menu.Items.TryGetValue(line.MenuItemId, out var item))
                continue;

            var message = ChoiceError(menu.GroupsOf(item), line.ChoiceIds ?? []);
            if (message is not null)
                failures.Add(new ValidationFailure($"lines[{i}].choiceIds", message));
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);

        var soldOutErrors = new Dictionary<string, string[]>();
        var soldOutLines = new List<int>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            string? message = null;
            if (!menu.Items.TryGetValue(line.MenuItemId, out var item) || !menu.IsVisible(item))
                message = "Món không còn trong thực đơn";
            else if (menu.IsSoldOut(item, now))
                message = "Món vừa hết";
            else
            {
                var soldChoice = menu.GroupsOf(item).SelectMany(g => g.ActiveChoices)
                    .FirstOrDefault(c => (line.ChoiceIds ?? []).Contains(c.Id) && c.IsSoldOutAt(now));
                if (soldChoice is not null)
                    message = $"{soldChoice.Name} vừa hết";
            }

            if (message is not null)
            {
                soldOutErrors[$"lines[{i}]"] = [message];
                soldOutLines.Add(i);
            }
        }

        if (soldOutLines.Count > 0)
        {
            throw PosErrors.WithErrors(PosErrors.MonVuaHet, PosErrors.SoldOutMessage, soldOutErrors,
                new Dictionary<string, object?> { ["soldOutLines"] = soldOutLines });
        }

        var prepared = lines.Select(line =>
        {
            var item = menu.Items[line.MenuItemId];
            var chosen = line.ChoiceIds ?? [];
            var options = menu.GroupsOf(item)
                .SelectMany(g => g.ActiveChoices.Where(c => chosen.Contains(c.Id))
                    .Select(c => new OrderItemOption(g.Id, g.Name, c.Id, c.Name, c.Price)))
                .ToList();
            return new PreparedLine(line, item, options);
        }).ToList();

        if (checkPrice)
        {
            var changes = prepared.Select((p, index) => new PriceChange
                {
                    Index = index,
                    MenuItemId = p.Item.Id,
                    ItemName = p.Item.Name,
                    OldUnitPrice = p.Input.ExpectedUnitPrice ?? 0,
                    NewUnitPrice = OrderPricing.UnitPrice(p.Item.Price, p.Options.Sum(o => o.Price))
                })
                .Where(c => c.OldUnitPrice != c.NewUnitPrice)
                .ToList();
            if (changes.Count > 0)
                throw PosConflicts.PriceChanged(changes);
        }

        return prepared;
    }

    /// <summary>BR-04: mỗi lựa chọn thuộc một nhóm của món; chọn một bắt buộc đúng 1, không bắt buộc 0–1; chọn nhiều 0…max.</summary>
    private static string? ChoiceError(IReadOnlyList<OptionGroup> groups, IReadOnlyCollection<Guid> choiceIds)
    {
        var known = groups.SelectMany(g => g.ActiveChoices).Select(c => c.Id).ToHashSet();
        if (choiceIds.Any(id => !known.Contains(id)) || choiceIds.Distinct().Count() != choiceIds.Count)
            return "Lựa chọn không hợp lệ";

        foreach (var group in groups)
        {
            var count = group.ActiveChoices.Count(c => choiceIds.Contains(c.Id));
            if (group.SelectionType == SelectionType.ChonMot && group.IsRequired && count != 1)
                return count == 0 ? $"Bắt buộc chọn 1 {group.Name}" : $"Chọn tối đa 1 {group.Name}";
            if (count > group.MaxSelect)
                return $"Chọn tối đa {group.MaxSelect} {group.Name}";
        }

        return null;
    }

    /// <summary>
    /// 07 §3.7: SHA-256 (hex) của JSON <c>[guestName ?? "", note ?? "", lines đã sắp theo (menuItemId, choiceIds đã sắp, note, quantity)]</c>.
    /// </summary>
    private static string CartKey(string? guestName, string? note, IEnumerable<CartLineInput> lines)
    {
        var normalized = lines
            .Select(l => new
            {
                menuItemId = l.MenuItemId.ToString(),
                choiceIds = (l.ChoiceIds ?? []).Select(c => c.ToString()).OrderBy(c => c, StringComparer.Ordinal).ToArray(),
                note = l.Note?.Trim() ?? string.Empty,
                quantity = l.Quantity
            })
            .OrderBy(l => l.menuItemId, StringComparer.Ordinal)
            .ThenBy(l => string.Join(',', l.choiceIds), StringComparer.Ordinal)
            .ThenBy(l => l.note, StringComparer.Ordinal)
            .ThenBy(l => l.quantity)
            .ToArray();
        var json = JsonSerializer.Serialize(new object[] { guestName?.Trim() ?? string.Empty, note?.Trim() ?? string.Empty, normalized });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
    }

    /// <summary>
    /// Tạo đơn trong transaction: chưa có phiên thì mở phiên <c>DangPhucVu</c>, cấp mã <c>PB</c>, gắn bàn (BR-02); trạng thái theo BR-08
    /// (<paramref name="staff"/> khác null là đơn gọi hộ, luôn đã xác nhận); phiên chờ thanh toán thì hủy yêu cầu thanh toán, về
    /// đang phục vụ (BR-12, 07 §5 quyết định 11).
    /// </summary>
    private async Task<Submission> CreateOrderAsync(
        DiningTable table,
        IReadOnlyList<PreparedLine> lines,
        OrderSource source,
        string? guestName,
        string? note,
        string? deviceId,
        string? clientRequestId,
        string? cartKey,
        ConfirmMode confirmMode,
        (Guid Id, string FullName)? staff,
        CancellationToken ct)
    {
        var now = Now;
        Submission? result = null;
        await unitOfWork.ExecuteInTransactionAsync(async token =>
        {
            TableSession session;
            if (table.CurrentSessionId is { } sessionId)
            {
                session = await LoadSessionAsync(sessionId, token) ?? throw new NotFoundException("Không tìm thấy phiên bàn.");
            }
            else
            {
                session = TableSession.Open(await PosCodes.NextSessionCodeAsync(sessions, now, token), table.Id, table.Name, now);
                await sessions.AddAsync(session, token);
                table.AttachSession(session.Id);
            }

            var items = lines.Select((line, index) => OrderItem.Create(
                line.Item.Id, line.Item.Code, line.Item.Name, line.Item.Price, line.Options, line.Input.Quantity, line.Input.Note,
                (index + 1) * PosRules.SortOrderStep)).ToList();
            var order = Order.Create(await PosCodes.NextOrderCodeAsync(orders, now, token), session.Id, table.Id, table.Name, source,
                guestName, note, now, deviceId, clientRequestId, cartKey, items);

            if (staff is { } user)
                order.Confirm(now, user.Id, user.FullName);
            else if (confirmMode == ConfirmMode.TuXacNhan && session.Orders.Any(o => o.Status is OrderStatus.DaXacNhan or OrderStatus.DaPhucVu))
                order.AutoConfirm();

            await orders.AddAsync(order, token);
            session.Touch();

            ServiceRequest? cancelled = null;
            if (session.Status == SessionStatus.ChoThanhToan)
            {
                cancelled = await PendingPaymentAsync(session.Id, tracking: true, token);
                cancelled?.CancelAutomatically(now);
                session.ResumeServing();
            }

            await unitOfWork.SaveChangesAsync(token);
            result = new Submission(order, session, cancelled);
        }, ct);

        return result!;
    }

    private async Task PublishSubmissionAsync(Submission submission, bool staffOrder, CancellationToken ct)
    {
        await events.OrderSubmittedAsync(submission.Order, ct);
        if (staffOrder)
            await events.OrdersChangedAsync([submission.Order.Id], [submission.Order.TableId], ct);
        await events.TablesChangedAsync([submission.Order.TableId], ct);
        if (submission.CancelledPayment is { } cancelled)
            await events.RequestsChangedAsync([cancelled.Id], [cancelled.TableId], null, ct);
    }
}
