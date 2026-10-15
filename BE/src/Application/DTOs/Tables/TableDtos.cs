using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Tables;

namespace Application.DTOs.Tables;

// Bàn và mã QR (07 §2.5), cài đặt nhận đơn, thông tin quán (07 §2.6), lối vào trang khách của demo (07 §2.12).

public sealed class DiningTableDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public int Capacity { get; init; }

    /// <summary>Mã bàn trong QR (BR-01).</summary>
    public string Code { get; init; } = string.Empty;

    public DateTime? CodeChangedAt { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public TableStatus Status { get; init; }
    public Guid? CurrentSessionId { get; init; }
    public string? CurrentSessionCode { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class SaveTableRequest
{
    public string Name { get; set; } = string.Empty;
    public string Zone { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int? SortOrder { get; set; }
}

public sealed class SetTableActiveRequest
{
    public bool IsActive { get; set; }
}

public sealed class GuestTableLink
{
    public string Name { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public TableStatus Status { get; init; }
}

/// <summary><c>OrderingStatus</c> = <c>OrderSettingsDto</c> (07 §2.6).</summary>
public sealed class OrderingStatusDto
{
    /// <summary>Nhận đơn QR ngay lúc này (chưa xét bàn tắt).</summary>
    public bool Accepting { get; init; }

    /// <summary><c>QuanTamNgung</c> hoặc <c>NgoaiGioNhanDon</c>.</summary>
    public string? BlockReason { get; init; }

    /// <summary>Đúng câu lỗi 07 §2.13.</summary>
    public string? Message { get; init; }

    public string OpenTime { get; init; } = string.Empty;
    public string CloseTime { get; init; } = string.Empty;
    public DateTime? PausedUntil { get; init; }
    public bool PausedIndefinitely { get; init; }
    public ConfirmMode ConfirmMode { get; init; }
    public DateTime AsOf { get; init; }
}

public sealed class UpdateOrderSettingsRequest
{
    public string OpenTime { get; set; } = string.Empty;
    public string CloseTime { get; set; } = string.Empty;
    public ConfirmMode? ConfirmMode { get; set; }
}

public sealed class PauseOrderingRequest
{
    /// <summary>15, 30 hoặc null (tới khi mở lại).</summary>
    public int? Minutes { get; set; }
}

public sealed class StoreProfileDto
{
    public const string NameKey = "Store.Name";

    public string Name { get; init; } = string.Empty;
    public string? Tagline { get; init; }
    public string Address { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string TaxCode { get; init; } = string.Empty;
    public string ReceiptFooter { get; init; } = string.Empty;
    public string BankBin { get; init; } = string.Empty;
    public string BankAccount { get; init; } = string.Empty;
    public string BankAccountName { get; init; } = string.Empty;
    public string LogoUrl { get; init; } = string.Empty;
    public string PrimaryColor { get; init; } = string.Empty;
}
