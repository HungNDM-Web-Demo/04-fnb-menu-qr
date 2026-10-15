import { mockDb } from '@/mock/mock-db'
import type { CategoryRecord, DiningTableRecord, MenuItemRecord, OptionGroupRecord } from '@/types/menu-qr'
import { menuStamp as computeStamp } from '../lib/menu-rules'
import { seedBundle } from './pos.seed'

/**
 * Collection thực đơn và bàn ở chế độ mock (07 §4.8, scope `business`). FE-Khách khai báo và nạp seed;
 * handler của FE-Quản lý đọc, ghi qua các collection này (insert/update/…) rồi gọi `publishPosEvent`.
 * Bản ghi theo kiểu `*Record` trong `@/types/menu-qr`; xóa là xóa mềm (`isDeleted`).
 */

export { menuIds, userNameOf } from './pos.seed'

export const categoriesDb = mockDb.collection<CategoryRecord>('categories', () => seedBundle().categories)
export const optionGroupsDb = mockDb.collection<OptionGroupRecord>('option-groups', () => seedBundle().optionGroups)
export const menuItemsDb = mockDb.collection<MenuItemRecord>('menu-items', () => seedBundle().menuItems)
export const tablesDb = mockDb.collection<DiningTableRecord>('dining-tables', () => seedBundle().tables)

export type MenuSnapshot = {
  /** Chưa xóa (kể cả ẩn), theo sortOrder */
  categories: CategoryRecord[]
  /** Chưa xóa, lựa chọn chưa xóa, theo sortOrder */
  optionGroups: OptionGroupRecord[]
  /** Chưa xóa (kể cả ẩn), theo (thứ tự danh mục, sortOrder) */
  menuItems: MenuItemRecord[]
}

/** Toàn bộ thực đơn chưa xóa trong một lần đọc */
export function getMenuSnapshot(): MenuSnapshot {
  const categories = categoriesDb.filter((c) => !c.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
  const catOrder = new Map(categories.map((c, i) => [c.id, i]))
  const optionGroups = optionGroupsDb
    .filter((g) => !g.isDeleted)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({ ...g, choices: g.choices.filter((c) => !c.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder) }))
  const menuItems = menuItemsDb
    .filter((m) => !m.isDeleted)
    .sort(
      (a, b) =>
        (catOrder.get(a.categoryId) ?? 999) - (catOrder.get(b.categoryId) ?? 999) ||
        a.sortOrder - b.sortOrder ||
        a.code.localeCompare(b.code)
    )
  return { categories, optionGroups, menuItems }
}

/** Dấu thực đơn ở mock (07 §3.8): đổi khi bản ghi thực đơn đổi hoặc qua 00:00 */
export function currentMenuStamp(now: number = Date.now()): string {
  return computeStamp([categoriesDb.all(), optionGroupsDb.all(), menuItemsDb.all()], now)
}

/** Bàn chưa xóa theo mã QR, không phân biệt hoa thường (BR-01) */
export function findTableByCode(code: string): DiningTableRecord | undefined {
  const upper = (code ?? '').trim().toUpperCase()
  if (!upper) return undefined
  return tablesDb.find((t) => !t.isDeleted && t.code.toUpperCase() === upper)
}

/** Bàn chưa xóa, theo khu (sortOrder nhỏ nhất của khu) rồi sortOrder */
export function liveTables(): DiningTableRecord[] {
  const tables = tablesDb.filter((t) => !t.isDeleted)
  const zoneOrder = new Map<string, number>()
  for (const t of tables) zoneOrder.set(t.zone, Math.min(zoneOrder.get(t.zone) ?? Infinity, t.sortOrder))
  return tables.sort(
    (a, b) => (zoneOrder.get(a.zone) ?? 0) - (zoneOrder.get(b.zone) ?? 0) || a.sortOrder - b.sortOrder
  )
}
