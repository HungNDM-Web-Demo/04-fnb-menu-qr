/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',
  ordersLive: '/orders/live',
  menuItems: '/menu-items',
  tables: '/tables',
  /** Bản in mã QR: ?ids=…&layout=A6|Tem8|A4x4 */
  qrPrint: '/print/qr',
  reports: '/reports',
  /** Bản in (không layout, 80 mm) */
  kitchenTicket: (orderId: string) => `/print/kitchen-ticket/${orderId}`,
  receipt: (sessionId: string) => `/print/receipt/${sessionId}`,
  /** Trang khách công khai (không AuthGuard); phone = số điện thoại giả lập khi demo một trình duyệt (07 §4.2) */
  guest: (tableCode: string, phone?: number) => `/t/${tableCode}${phone && phone > 1 ? `?phone=${phone}` : ''}`,
  guestCart: (tableCode: string) => `/t/${tableCode}/cart`,
  guestOrders: (tableCode: string) => `/t/${tableCode}/orders`,

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

export type RoutePath = Extract<(typeof routePath)[keyof typeof routePath], string>
