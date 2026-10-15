namespace Domain.Enums.Pos.Requests;

/// <summary>Trạng thái yêu cầu từ bàn (BR-12).</summary>
public enum ServiceRequestStatus
{
    DangCho = 0,
    DaXuLy = 1,

    /// <summary>Yêu cầu thanh toán tự hủy khi bàn gửi thêm đơn.</summary>
    DaHuy = 2
}
