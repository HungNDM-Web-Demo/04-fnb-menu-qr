using System.Text.Json;
using Domain.Enums.Pos.Menu;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Requests;

namespace Infrastructure.Persistence.Seeders;

// Hình dạng của FE/src/mock/seed/demo-data.json (06 §5.2), nguồn duy nhất cho FE mock và DemoDataSeeder.
// Phiên, đơn, yêu cầu ghi bằng khóa gọn (06 §5.4): giờ là chuỗi "HH:mm" (ngày theo ô ngày d) hoặc số phút so với lúc nạp
// (phiên hôm nay, liveSessions) nên các trường giờ đọc thành JsonElement rồi seeder tự đổi.

internal sealed class MenuQrSeedFile
{
    public List<CategorySeed>? Categories { get; init; }
    public List<OptionGroupSeed>? OptionGroups { get; init; }
    public List<MenuItemSeed>? MenuItems { get; init; }
    public List<TableSeed>? Tables { get; init; }
    public List<SessionSeed>? LiveSessions { get; init; }
    public List<SessionSeed>? Sessions { get; init; }
}

internal sealed class CategorySeed
{
    public string Code { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class OptionGroupSeed
{
    /// <summary>Chỉ để tham chiếu trong file, không lưu.</summary>
    public string Key { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public SelectionType Type { get; init; }
    public bool Required { get; init; }
    public int Max { get; init; } = 1;
    public int SortOrder { get; init; }
    public List<ChoiceSeed>? Choices { get; init; }
}

internal sealed class ChoiceSeed
{
    public string Key { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }
    public decimal Price { get; init; }
    public bool? Default { get; init; }
}

internal sealed class MenuItemSeed
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? NameEn { get; init; }

    /// <summary>Mã danh mục.</summary>
    public string Category { get; init; } = string.Empty;

    public string Unit { get; init; } = string.Empty;
    public decimal Price { get; init; }

    /// <summary>Tên file trong FE/public/seed/menu/.</summary>
    public string? Image { get; init; }

    public string? Description { get; init; }
    public List<MenuTag>? Tags { get; init; }

    /// <summary><c>key</c> nhóm tùy chọn theo thứ tự.</summary>
    public List<string>? Groups { get; init; }

    public SoldOutMode? SoldOut { get; init; }
    public bool? Hidden { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class TableSeed
{
    public int No { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Zone { get; init; } = string.Empty;
    public int Capacity { get; init; }
    public string Code { get; init; } = string.Empty;
    public bool? Active { get; init; }
}

/// <summary>Phiên bàn khóa gọn (06 §5.4).</summary>
internal sealed class SessionSeed
{
    /// <summary>Ô ngày; vắng = hôm nay (giờ là số phút so với lúc nạp).</summary>
    public int? D { get; init; }

    /// <summary>Số bàn (<c>tables[].no</c>).</summary>
    public int Tb { get; init; }

    public List<OrderSeed> Od { get; init; } = [];

    /// <summary>Giờ đóng phiên; vắng = phiên đang mở hoặc tự hủy.</summary>
    public JsonElement? C { get; init; }

    /// <summary><c>[phương thức, tiền khách đưa?]</c>.</summary>
    public List<JsonElement>? Pm { get; init; }

    public int? Vat { get; init; }

    /// <summary>Người thu tiền, đóng phiên.</summary>
    public string? By { get; init; }

    public List<RequestSeed>? Rq { get; init; }
}

/// <summary>Đơn khóa gọn (06 §5.4).</summary>
internal sealed class OrderSeed
{
    public JsonElement T { get; init; }

    /// <summary><c>"N"</c> = nhân viên gọi hộ.</summary>
    public string? S { get; init; }

    /// <summary>Tên gọi.</summary>
    public string? G { get; init; }

    /// <summary>Số phút sau giờ gửi thì <see cref="By"/> xác nhận; <c>"a"</c> = tự xác nhận.</summary>
    public JsonElement? Cf { get; init; }

    /// <summary><c>[lý do, số phút sau giờ gửi, ghi chú?]</c>.</summary>
    public List<JsonElement>? Rj { get; init; }

    public string? By { get; init; }

    /// <summary>Số phút sau giờ gửi thì mọi dòng còn hiệu lực đã phục vụ.</summary>
    public int? Sv { get; init; }

    /// <summary>Dòng <c>[mã món, số lượng, [key lựa chọn]?, { n?, sv?, rm?, cx? }?]</c>.</summary>
    public List<JsonElement> It { get; init; } = [];
}

/// <summary>Phần thêm của dòng.</summary>
internal sealed class LineExtraSeed
{
    public string? N { get; init; }
    public int? Sv { get; init; }

    /// <summary><c>[lý do RemoveReason, ghi chú?]</c>.</summary>
    public List<string>? Rm { get; init; }

    /// <summary><c>[số lượng hủy, lý do, số phút sau giờ gửi, người hủy]</c>.</summary>
    public List<JsonElement>? Cx { get; init; }
}

/// <summary>Yêu cầu từ bàn khóa gọn (06 §5.4).</summary>
internal sealed class RequestSeed
{
    /// <summary><c>"G"</c> gọi nhân viên, <c>"T"</c> yêu cầu thanh toán.</summary>
    public string Ty { get; init; } = string.Empty;

    public JsonElement T { get; init; }
    public CallReason? R { get; init; }
    public string? N { get; init; }
    public PaymentMethod? Pm { get; init; }
    public int? Vat { get; init; }

    /// <summary>Xử lý sau <c>h</c> phút bởi <see cref="By"/> (vắng <c>by</c> = người đóng phiên).</summary>
    public int? H { get; init; }

    public string? By { get; init; }

    /// <summary><c>1</c> = yêu cầu thanh toán tự hủy vì bàn gọi thêm.</summary>
    public int? Cx { get; init; }
}
