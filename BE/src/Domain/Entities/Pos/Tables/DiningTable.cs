using Domain.Base;
using Domain.Common;

namespace Domain.Entities.Pos.Tables;

/// <summary>
/// Bàn và mã bàn trong QR (bảng <c>Pos_DiningTables</c>, FR-31, FR-32, BR-01, BR-17). Trạng thái không lưu, suy ra từ
/// <see cref="IsActive"/> và phiên <see cref="CurrentSessionId"/>. <see cref="Version"/> là concurrency token: hai điện thoại
/// cùng gửi đơn đầu thì request sau thua, đọc lại và vào phiên vừa mở (BR-02).
/// </summary>
public class DiningTable : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int NameMaxLength = 50;
    public const int ZoneMaxLength = 50;

    private DiningTable()
    {
    }

    public string Name { get; private set; } = string.Empty;
    public string Zone { get; private set; } = string.Empty;
    public int Capacity { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public DateTime? CodeChangedAt { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int SortOrder { get; private set; }
    public Guid? CurrentSessionId { get; private set; }
    public int Version { get; private set; } = 1;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static DiningTable Create(string name, string zone, int capacity, string code, int sortOrder)
    {
        if (!PosRules.IsValidTableCode(code))
            throw new DomainException("Mã bàn không đúng quy tắc BR-01.");

        var table = new DiningTable { Code = code, SortOrder = sortOrder };
        table.Update(name, zone, capacity, sortOrder);
        return table;
    }

    public void Update(string name, string zone, int capacity, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Nhập tên bàn");
        if (string.IsNullOrWhiteSpace(zone))
            throw new DomainException("Nhập khu vực");
        if (capacity is < PosRules.CapacityMin or > PosRules.CapacityMax)
            throw new DomainException("Sức chứa từ 1 đến 20");

        Name = name.Trim();
        Zone = zone.Trim();
        Capacity = capacity;
        SortOrder = sortOrder;
    }

    public bool HasOpenSession => CurrentSessionId is not null;

    /// <summary>Bật, tắt bàn; bàn đang có khách không tắt được (BR-17, TC-39).</summary>
    public void SetActive(bool isActive)
    {
        if (!isActive && HasOpenSession)
            throw PosErrors.TableOccupied();
        IsActive = isActive;
        Version++;
    }

    /// <summary>Đổi mã QR (FR-32): mã cũ hết hiệu lực ngay; bàn đang có khách không đổi được.</summary>
    public void ChangeCode(string code, DateTime atUtc)
    {
        if (HasOpenSession)
            throw PosErrors.TableOccupied();
        if (!PosRules.IsValidTableCode(code))
            throw new DomainException("Mã bàn không đúng quy tắc BR-01.");
        Code = code;
        CodeChangedAt = atUtc;
        Version++;
    }

    public void EnsureDeletable()
    {
        if (HasOpenSession)
            throw PosErrors.TableOccupied();
    }

    public void AttachSession(Guid sessionId)
    {
        CurrentSessionId = sessionId;
        Version++;
    }

    public void DetachSession()
    {
        CurrentSessionId = null;
        Version++;
    }
}
