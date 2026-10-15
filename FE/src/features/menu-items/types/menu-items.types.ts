import type { PaginationQuery } from '@/types/api'
import type { MenuItemStatus } from '@/types/menu-qr'

/** Tham số GET /api/menu-items (07 §2.3) */
export type MenuItemQuery = PaginationQuery & { categoryId?: string; status?: MenuItemStatus }
