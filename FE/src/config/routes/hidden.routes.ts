import { Printer, QrCode, ReceiptText, UserRound } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/** Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền. */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
  // Bản in (route group app/(print), có AuthGuard, không sidebar; docs/07 §2.15)
  { title: 'In mã QR', href: routePath.qrPrint, icon: QrCode, permission: permissions.tables.printQr },
  { title: 'Phiếu bếp', href: '/print/kitchen-ticket', icon: Printer, permission: permissions.orders.view },
  { title: 'Hóa đơn', href: '/print/receipt', icon: ReceiptText, permission: permissions.tableSessions.view },
]
