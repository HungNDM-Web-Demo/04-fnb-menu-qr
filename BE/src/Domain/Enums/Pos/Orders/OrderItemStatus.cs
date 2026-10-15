namespace Domain.Enums.Pos.Orders;

/// <summary>Trạng thái dòng đơn. Dòng của đơn bị từ chối giữ <c>ChoXacNhan</c>.</summary>
public enum OrderItemStatus
{
    ChoXacNhan = 0,

    /// <summary>Nhân viên thấy "Chờ phục vụ".</summary>
    DaXacNhan = 1,
    BiBo = 2,
    DaPhucVu = 3,
    DaHuy = 4
}
