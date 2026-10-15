using Application.DTOs.Tables;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Tables;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Tables;

namespace Application.Mappings.Tables;

/// <summary>Ánh xạ bàn, trạng thái nhận đơn sang DTO (07 §2.5, §2.6).</summary>
public static class TableMappings
{
    /// <summary>06 §4: <c>Tat</c> khi tắt; <c>DangPhucVu</c>/<c>ChoThanhToan</c> theo phiên đang mở; còn lại <c>Trong</c>.</summary>
    public static TableStatus StatusOf(this DiningTable table, SessionStatus? sessionStatus) =>
        !table.IsActive ? TableStatus.Tat
        : table.CurrentSessionId is null ? TableStatus.Trong
        : sessionStatus == SessionStatus.ChoThanhToan ? TableStatus.ChoThanhToan
        : TableStatus.DangPhucVu;

    public static DiningTableDto ToDto(this DiningTable table, SessionStatus? sessionStatus, string? sessionCode) => new()
    {
        Id = table.Id,
        Name = table.Name,
        Zone = table.Zone,
        Capacity = table.Capacity,
        Code = table.Code,
        CodeChangedAt = table.CodeChangedAt,
        IsActive = table.IsActive,
        SortOrder = table.SortOrder,
        Status = table.StatusOf(sessionStatus),
        CurrentSessionId = table.CurrentSessionId,
        CurrentSessionCode = table.CurrentSessionId is null ? null : sessionCode,
        CreatedAt = table.CreatedAt
    };

    public static OrderingStatusDto ToDto(this OrderingState state, DateTime nowUtc) => new()
    {
        Accepting = state.Accepting,
        BlockReason = state.BlockReason,
        Message = state.Message,
        OpenTime = state.OpenTime,
        CloseTime = state.CloseTime,
        PausedUntil = state.PausedUntil,
        PausedIndefinitely = state.PausedIndefinitely,
        ConfirmMode = state.ConfirmMode,
        AsOf = nowUtc
    };
}
