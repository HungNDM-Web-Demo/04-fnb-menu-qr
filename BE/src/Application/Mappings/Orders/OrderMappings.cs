using Application.DTOs.Orders;
using Application.DTOs.Public;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Requests;
using Domain.Enums.Pos.Orders;

namespace Application.Mappings.Orders;

/// <summary>Ánh xạ đơn, dòng đơn, yêu cầu sang DTO nhân viên và DTO trang khách (07 §2.7, §2.8, §2.10).</summary>
public static class OrderMappings
{
    public static OrderItemDto ToDto(this OrderItem item) => new()
    {
        Id = item.Id,
        MenuItemId = item.MenuItemId,
        ItemCode = item.ItemCode,
        ItemName = item.ItemName,
        ItemPrice = item.ItemPrice,
        Options = item.GetOptions().Select(o => new OrderItemOptionDto
        {
            GroupId = o.GroupId,
            GroupName = o.GroupName,
            ChoiceId = o.ChoiceId,
            Name = o.Name,
            Price = o.Price
        }).ToList(),
        OptionsPrice = item.OptionsPrice,
        UnitPrice = item.UnitPrice,
        Quantity = item.Quantity,
        LineTotal = item.LineTotal,
        Note = item.Note,
        Status = item.Status,
        RemoveReason = item.RemoveReason,
        RemoveNote = item.RemoveNote,
        CancelReason = item.CancelReason,
        CancelledAt = item.CancelledAt,
        CancelledByName = item.CancelledByName,
        ServedAt = item.ServedAt,
        StatusText = PosLabels.ItemStatusText(item.Status, item.RemoveReason, item.RemoveNote, item.CancelReason),
        SortOrder = item.SortOrder
    };

    /// <summary>07 §3.5: chờ xác nhận tính từ giờ gửi (vàng 5, đỏ 10 phút); chờ phục vụ tính từ giờ xác nhận (vàng 15, đỏ 25 phút).</summary>
    public static (int Minutes, WaitLevel Level) Wait(this Order order, DateTime nowUtc)
    {
        static int Minutes(DateTime from, DateTime now) => Math.Max(0, (int)Math.Floor((now - from).TotalMinutes));

        switch (order.Status)
        {
            case OrderStatus.ChoXacNhan:
            {
                var minutes = Minutes(order.SubmittedAt, nowUtc);
                return (minutes, minutes >= PosRules.PendingLateMinutes ? WaitLevel.Do
                    : minutes >= PosRules.PendingWarnMinutes ? WaitLevel.Vang : WaitLevel.BinhThuong);
            }
            case OrderStatus.DaXacNhan:
            {
                var minutes = Minutes(order.HandledAt ?? order.SubmittedAt, nowUtc);
                return (minutes, minutes >= PosRules.ServingLateMinutes ? WaitLevel.Do
                    : minutes >= PosRules.ServingWarnMinutes ? WaitLevel.Vang : WaitLevel.BinhThuong);
            }
            default:
                return (0, WaitLevel.BinhThuong);
        }
    }

    public static StaffOrderDto ToStaffDto(this Order order, string sessionCode, DateTime nowUtc)
    {
        var (minutes, level) = order.Wait(nowUtc);
        return new StaffOrderDto
        {
            Id = order.Id,
            Code = order.Code,
            SessionId = order.SessionId,
            SessionCode = sessionCode,
            TableId = order.TableId,
            TableName = order.TableName,
            Source = order.Source,
            Status = order.Status,
            AutoConfirmed = order.AutoConfirmed,
            GuestName = order.GuestName,
            Note = order.Note,
            SubmittedAt = order.SubmittedAt,
            HandledAt = order.HandledAt,
            HandledByName = order.HandledByName,
            RejectReason = order.RejectReason,
            RejectNote = order.RejectNote,
            RejectText = PosLabels.RejectText(order.RejectReason, order.RejectNote),
            Total = order.Total,
            ItemCount = order.Items.Count(i => i.IsEffective),
            UnservedCount = order.Items.Count(i => i.Status == OrderItemStatus.DaXacNhan),
            Items = order.SortedItems.Select(i => i.ToDto()).ToList(),
            WaitMinutes = minutes,
            WaitLevel = level,
            AsOf = nowUtc
        };
    }

    public static PublicOrderView ToPublicView(this Order order, string? deviceId) => new()
    {
        Code = order.Code,
        Source = order.Source,
        Status = order.Status,
        AutoConfirmed = order.AutoConfirmed,
        GuestName = order.GuestName,
        Note = order.Note,
        SubmittedAt = order.SubmittedAt,
        HandledAt = order.HandledAt,
        RejectText = PosLabels.RejectText(order.RejectReason, order.RejectNote),
        Total = order.Total,
        IsMine = !string.IsNullOrWhiteSpace(deviceId) && string.Equals(order.DeviceId, deviceId.Trim(), StringComparison.Ordinal),
        Items = order.SortedItems.Select(i => new PublicOrderItemView
        {
            ItemName = i.ItemName,
            Options = i.GetOptions().Select(o => new PublicOrderItemOption { GroupName = o.GroupName, Name = o.Name, Price = o.Price }).ToList(),
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            LineTotal = i.LineTotal,
            Note = i.Note,
            Status = i.Status,
            StatusText = PosLabels.ItemStatusText(i.Status, i.RemoveReason, i.RemoveNote, i.CancelReason)
        }).ToList()
    };

    public static PaymentRequestBrief ToBrief(this ServiceRequest request) => new()
    {
        Id = request.Id,
        Method = request.PaymentMethod ?? PaymentMethod.TienMat,
        NeedVatInvoice = request.NeedVatInvoice,
        CreatedAt = request.CreatedAt,
        Status = request.Status
    };

    public static ServiceRequestDto ToDto(this ServiceRequest request, string? sessionCode, DateTime nowUtc)
    {
        var minutes = request.IsPending ? Math.Max(0, (int)Math.Floor((nowUtc - request.CreatedAt).TotalMinutes)) : 0;
        return new ServiceRequestDto
        {
            Id = request.Id,
            TableId = request.TableId,
            TableName = request.TableName,
            SessionId = request.SessionId,
            SessionCode = sessionCode,
            Type = request.Type,
            Reason = request.Reason,
            Note = request.Note,
            PaymentMethod = request.PaymentMethod,
            NeedVatInvoice = request.NeedVatInvoice,
            ReasonText = PosLabels.RequestText(request.Type, request.Reason, request.Note, request.PaymentMethod, request.NeedVatInvoice),
            Status = request.Status,
            CreatedAt = request.CreatedAt,
            HandledAt = request.HandledAt,
            HandledByName = request.HandledByName,
            AutoHandled = request.AutoHandled,
            WaitMinutes = minutes,
            IsOverdue = request.IsPending && minutes >= PosRules.RequestOverdueMinutes
        };
    }

    public static PublicServiceRequestView ToPublicView(this ServiceRequest request) => new()
    {
        Id = request.Id,
        Type = request.Type,
        ReasonText = PosLabels.RequestText(request.Type, request.Reason, request.Note, request.PaymentMethod, request.NeedVatInvoice),
        Status = request.Status,
        CreatedAt = request.CreatedAt,
        HandledAt = request.HandledAt
    };
}
