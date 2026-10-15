/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs`
 * và danh sách seed `src/mock/seed/system.json` (+ project.json).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },
  // Quyền nghiệp vụ (docs/07-DANH-SACH-API.md §1, project.json)
  menuItems: {
    view: 'menu-items.view',
    create: 'menu-items.create',
    update: 'menu-items.update',
    delete: 'menu-items.delete',
    availability: 'menu-items.availability',
  },
  tables: {
    view: 'tables.view',
    create: 'tables.create',
    update: 'tables.update',
    delete: 'tables.delete',
    printQr: 'tables.print-qr',
  },
  orderSettings: {
    update: 'order-settings.update',
  },
  orders: {
    view: 'orders.view',
    confirm: 'orders.confirm',
    serve: 'orders.serve',
    create: 'orders.create',
    cancel: 'orders.cancel',
  },
  serviceRequests: {
    view: 'service-requests.view',
    update: 'service-requests.update',
  },
  tableSessions: {
    view: 'table-sessions.view',
    checkout: 'table-sessions.checkout',
    transfer: 'table-sessions.transfer',
  },
  reports: {
    view: 'reports.view',
  },
} as const

/** Mã vai trò hệ thống (BR-SYS-06). */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
