import { BarChart3, BellRing, LayoutDashboard, QrCode, UtensilsCrossed } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/**
 * Nhóm menu nghiệp vụ (docs/07-DANH-SACH-API.md §4.1). Thứ tự quyết định trang chủ theo quyền:
 * Quản lý, Quản trị vào Tổng quan; Nhân viên (không có reports.view) rơi xuống Nhận đơn.
 * Tổng quan gắn `reports.view` (không dùng `dashboard.view` vì vai trò nền STAFF có sẵn quyền đó).
 */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.reports.view,
      description: 'Bàn đang có khách, đơn chờ, doanh thu hôm nay',
    },
    {
      title: 'Nhận đơn',
      href: routePath.ordersLive,
      icon: BellRing,
      permission: permissions.orders.view,
      description: 'Đơn mới, yêu cầu từ bàn, tình trạng bàn theo thời gian thực',
    },
    {
      title: 'Thực đơn',
      href: routePath.menuItems,
      icon: UtensilsCrossed,
      permission: permissions.menuItems.view,
      description: 'Món, danh mục, nhóm tùy chọn, báo hết món',
    },
    {
      title: 'Bàn và QR',
      href: routePath.tables,
      icon: QrCode,
      permission: permissions.tables.view,
      description: 'Bàn, mã QR, in QR, cài đặt nhận đơn',
    },
    {
      title: 'Báo cáo',
      href: routePath.reports,
      icon: BarChart3,
      permission: permissions.reports.view,
      description: 'Doanh thu, món, vận hành',
    },
  ],
}
