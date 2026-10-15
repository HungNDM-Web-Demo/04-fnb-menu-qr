namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ của Menu QR Gọi món (02-SRS §7, 07-DANH-SACH-API §1). Tách khỏi <see cref="Permissions"/> (quyền nền)
/// để không sửa file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts;
/// test <c>ProjectPermissionTests</c> kiểm tra việc này.
/// </summary>
public static class ProjectPermissions
{
    public static class MenuItems
    {
        public const string View = "menu-items.view";
        public const string Create = "menu-items.create";
        public const string Update = "menu-items.update";
        public const string Delete = "menu-items.delete";

        /// <summary>Báo hết món, hết lựa chọn, bán lại (UC-10).</summary>
        public const string Availability = "menu-items.availability";
    }

    public static class Tables
    {
        public const string View = "tables.view";
        public const string Create = "tables.create";
        public const string Update = "tables.update";
        public const string Delete = "tables.delete";

        /// <summary>In, tải mã QR (FE kiểm tra, không có endpoint riêng).</summary>
        public const string PrintQr = "tables.print-qr";
    }

    public static class OrderSettings
    {
        public const string Update = "order-settings.update";
    }

    public static class Orders
    {
        public const string View = "orders.view";
        public const string Confirm = "orders.confirm";
        public const string Serve = "orders.serve";

        /// <summary>Gọi món hộ khách; cũng đọc được thực đơn gộp.</summary>
        public const string Create = "orders.create";

        /// <summary>Hủy món, hủy đơn đã xác nhận (BR-15, chỉ quản lý).</summary>
        public const string Cancel = "orders.cancel";
    }

    public static class ServiceRequests
    {
        public const string View = "service-requests.view";
        public const string Update = "service-requests.update";
    }

    public static class TableSessions
    {
        public const string View = "table-sessions.view";
        public const string Checkout = "table-sessions.checkout";
        public const string Transfer = "table-sessions.transfer";
    }

    public static class Reports
    {
        /// <summary>Tổng quan và báo cáo (07 §5 quyết định 1: không dùng <c>dashboard.view</c> của nền).</summary>
        public const string View = "reports.view";
    }
}
