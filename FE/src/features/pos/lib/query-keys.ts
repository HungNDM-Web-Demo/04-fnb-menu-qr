/**
 * Query key dùng chung (07 §4.9): `RealtimeBridge` làm mới theo bảng §2.14 bằng các key này,
 * nên mọi feature dùng đúng tiền tố.
 */
export const posKeys = {
  menu: ['menu'] as const,
  menuItems: ['menu-items'] as const,
  optionGroups: ['option-groups'] as const,
  categories: ['categories'] as const,
  tables: ['tables'] as const,
  orderSettings: ['order-settings'] as const,
  storeProfile: ['store-profile'] as const,
  ordersLive: ['orders-live'] as const,
  order: (id: string) => ['order', id] as const,
  orderRoot: ['order'] as const,
  tableBoard: ['table-board'] as const,
  tableSession: (id: string) => ['table-session', id] as const,
  tableSessionRoot: ['table-session'] as const,
  tableSessions: ['table-sessions'] as const,
  serviceRequestsPending: ['service-requests-pending'] as const,
  reports: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  guestTables: ['demo', 'guest-tables'] as const,
  /** Trang khách: ['public', code, 'info' | 'menu' | 'live'] */
  publicInfo: (code: string) => ['public', code, 'info'] as const,
  publicMenu: (code: string) => ['public', code, 'menu'] as const,
  publicLive: (code: string) => ['public', code, 'live'] as const,
}
