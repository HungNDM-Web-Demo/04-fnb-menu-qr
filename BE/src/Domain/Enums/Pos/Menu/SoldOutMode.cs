namespace Domain.Enums.Pos.Menu;

/// <summary>Chế độ hết món, hết lựa chọn (BR-14).</summary>
public enum SoldOutMode
{
    /// <summary>Hết trong hôm nay: tự bán lại lúc 00:00 giờ Việt Nam.</summary>
    HetHomNay = 0,

    /// <summary>Hết tới khi có người bật lại.</summary>
    HetToiKhiMoLai = 1
}
