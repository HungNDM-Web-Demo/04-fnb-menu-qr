namespace Domain.Enums.Pos.Orders;

/// <summary>Trạng thái phiên bàn (06 §4).</summary>
public enum SessionStatus
{
    DangPhucVu = 0,
    ChoThanhToan = 1,
    DaDong = 2,

    /// <summary>Mọi đơn của phiên bị từ chối (BR-02), không tính doanh thu.</summary>
    DaHuy = 3
}
