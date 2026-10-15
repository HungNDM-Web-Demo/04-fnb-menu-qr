/** Endpoint BE (QUY-UOC-API §3). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
    guestTables: '/api/demo/guest-tables',
    orderingAllDay: '/api/demo/ordering-all-day',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ---------- Nghiệp vụ Menu QR (docs/07-DANH-SACH-API.md §2) ----------
  menu: '/api/menu',
  categories: {
    list: '/api/categories',
    detail: (id: string) => `/api/categories/${id}`,
    order: '/api/categories/order',
  },
  menuItems: {
    list: '/api/menu-items',
    detail: (id: string) => `/api/menu-items/${id}`,
    availability: (id: string) => `/api/menu-items/${id}/availability`,
    hidden: (id: string) => `/api/menu-items/${id}/hidden`,
    image: (id: string) => `/api/menu-items/${id}/image`,
    order: '/api/menu-items/order',
  },
  optionGroups: {
    list: '/api/option-groups',
    detail: (id: string) => `/api/option-groups/${id}`,
    choiceAvailability: (id: string, choiceId: string) => `/api/option-groups/${id}/choices/${choiceId}/availability`,
  },
  tables: {
    list: '/api/tables',
    detail: (id: string) => `/api/tables/${id}`,
    active: (id: string) => `/api/tables/${id}/active`,
    regenerateCode: (id: string) => `/api/tables/${id}/regenerate-code`,
  },
  orderSettings: {
    detail: '/api/order-settings',
    pause: '/api/order-settings/pause',
    resume: '/api/order-settings/resume',
  },
  storeProfile: '/api/store-profile',
  orders: {
    create: '/api/orders',
    live: '/api/orders/live',
    detail: (id: string) => `/api/orders/${id}`,
    confirm: (id: string) => `/api/orders/${id}/confirm`,
    reject: (id: string) => `/api/orders/${id}/reject`,
    serve: (id: string) => `/api/orders/${id}/serve`,
    unserve: (id: string) => `/api/orders/${id}/unserve`,
    cancel: (id: string) => `/api/orders/${id}/cancel`,
    cancelItem: (id: string, itemId: string) => `/api/orders/${id}/items/${itemId}/cancel`,
  },
  tableSessions: {
    list: '/api/table-sessions',
    board: '/api/table-sessions/board',
    detail: (id: string) => `/api/table-sessions/${id}`,
    checkout: (id: string) => `/api/table-sessions/${id}/checkout`,
    transfer: (id: string) => `/api/table-sessions/${id}/transfer`,
  },
  serviceRequests: {
    pending: '/api/service-requests/pending',
    handle: (id: string) => `/api/service-requests/${id}/handle`,
  },
  reports: {
    dashboard: '/api/reports/dashboard',
    revenue: '/api/reports/revenue',
    items: '/api/reports/items',
    operations: '/api/reports/operations',
  },
  /** API công khai cho trang khách, không gửi Authorization (07 §2.7) */
  publicTables: {
    info: (code: string) => `/api/public/tables/${code}`,
    menu: (code: string) => `/api/public/tables/${code}/menu`,
    live: (code: string) => `/api/public/tables/${code}/live`,
    orders: (code: string) => `/api/public/tables/${code}/orders`,
    serviceRequests: (code: string) => `/api/public/tables/${code}/service-requests`,
  },
  /** SignalR hub cho nhân viên (07 §2.14) */
  posHub: '/hubs/pos',
} as const
