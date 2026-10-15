namespace Domain.Enums.Pos.Tables;

/// <summary>Trạng thái bàn, không lưu, suy ra từ <c>IsActive</c> và phiên đang mở (06 §4).</summary>
public enum TableStatus
{
    Trong,
    DangPhucVu,
    ChoThanhToan,
    Tat
}
