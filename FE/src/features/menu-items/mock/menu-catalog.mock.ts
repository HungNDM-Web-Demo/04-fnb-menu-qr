import { permissions } from '@/config/permissions'
import { startOfNextVnDay } from '@/features/pos/lib/vn-time'
import { categoriesDb, getMenuSnapshot, menuItemsDb, optionGroupsDb } from '@/features/pos/mock/menu.store'
import { toCategoryDto, toMenuItemDto, toOptionGroupDto } from '@/features/pos/mock/pos.mappers'
import { PosErrors, conflictError, fieldErrors } from '@/features/pos/mock/pos.errors'
import { publishPosEvent } from '@/features/pos/mock/pos-events'
import { everOrderedMenuItemIds } from '@/features/pos/mock/session.store'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockBlobs } from '@/mock/mock-blobs'
import { mockDb } from '@/mock/mock-db'
import { notFound } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  CategoryDto,
  MenuBundle,
  MenuItemDto,
  MenuItemRecord,
  OptionChoiceRecord,
  OptionGroupDto,
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveOptionGroupRequest,
  SetAvailabilityRequest,
  SoldOutMode,
} from '@/types/menu-qr'
import type { MenuItemQuery } from '../types/menu-items.types'

/**
 * Handler mock thực đơn (07 §2.1–2.4): đọc, ghi collection `categories`, `option-groups`, `menu-items`
 * của `features/pos/mock/menu.store.ts` (FE-Khách khai báo), áp quy tắc và câu lỗi đúng 07, phát `menu-changed`.
 */

const nowIso = () => new Date().toISOString()
const HEX = /^#[0-9A-Fa-f]{6}$/
const CATEGORY_CODE = /^[A-Z0-9]{2,10}$/
const MENU_ITEM_CODE = /^M\d{3}$/
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SOLD_OUT_MODES: SoldOutMode[] = ['HetHomNay', 'HetToiKhiMoLai']
const trimOrUndefined = (v?: string) => v?.trim() || undefined

const changed = (menuItemIds: string[] = [], optionGroupIds: string[] = []) =>
  publishPosEvent('menu-changed', { menuItemIds, optionGroupIds })

function dtoContext() {
  const snap = getMenuSnapshot()
  return { snap, ctx: { categories: snap.categories, optionGroups: snap.optionGroups, everOrdered: everOrderedMenuItemIds() } }
}

function menuItemDto(id: string): MenuItemDto {
  const { snap, ctx } = dtoContext()
  const item = snap.menuItems.find((m) => m.id === id)
  if (!item) throw notFound('Không tìm thấy món')
  return toMenuItemDto(item, ctx)
}

/** Đánh lại thứ tự 10, 20, 30… theo danh sách id gửi lên (đủ, không thừa, không trùng) */
function reorder(allIds: string[], ids: string[], apply: (id: string, sortOrder: number) => void) {
  const set = new Set(ids ?? [])
  if (!ids || ids.length !== allIds.length || set.size !== ids.length || !allIds.every((id) => set.has(id))) {
    throw fieldErrors({ ids: 'Danh sách sắp xếp không đầy đủ' })
  }
  mockDb.batch(() => ids.forEach((id, i) => apply(id, (i + 1) * 10)))
}

/** Kiểm món theo thứ tự 07 §2.3: định dạng → tham chiếu → trùng mã */
function validateMenuItem(input: SaveMenuItemRequest, excludeId?: string) {
  const errors: Record<string, string> = {}
  const code = (input.code ?? '').trim().toUpperCase()
  if (!MENU_ITEM_CODE.test(code)) errors.code = 'Mã món dạng M001'
  if (!input.name?.trim()) errors.name = 'Nhập tên món'
  if (!(input.price > 0)) errors.price = 'Giá món phải lớn hơn 0'
  else if (input.price % 1000 !== 0) errors.price = 'Giá phải là bội số 1.000 ₫'
  if (!input.unit?.trim()) errors.unit = 'Nhập đơn vị tính'
  if ((input.description ?? '').length > 500) errors.description = 'Mô tả tối đa 500 ký tự'
  if ((input.descriptionEn ?? '').length > 500) errors.descriptionEn = 'Mô tả tối đa 500 ký tự'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  const snap = getMenuSnapshot()
  if (!snap.categories.some((c) => c.id === input.categoryId)) {
    throw fieldErrors({ categoryId: 'Danh mục không tồn tại' })
  }
  if ((input.optionGroupIds ?? []).some((id) => !snap.optionGroups.some((g) => g.id === id))) {
    throw fieldErrors({ optionGroupIds: 'Nhóm tùy chọn không tồn tại' })
  }
  if (snap.menuItems.some((m) => m.code === code && m.id !== excludeId)) {
    throw conflictError('Mã món đã tồn tại', undefined, {}, { code: 'Mã món đã tồn tại' })
  }
  return code
}

function validateCategory(input: SaveCategoryRequest, excludeId?: string) {
  const errors: Record<string, string> = {}
  const code = (input.code ?? '').trim().toUpperCase()
  if (!CATEGORY_CODE.test(code)) errors.code = 'Mã danh mục gồm 2–10 chữ in hoa hoặc số'
  if (!input.name?.trim()) errors.name = 'Nhập tên danh mục'
  if (!HEX.test(input.color ?? '')) errors.color = 'Màu dạng #RRGGBB'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  if (getMenuSnapshot().categories.some((c) => c.code === code && c.id !== excludeId)) {
    throw conflictError('Mã danh mục đã tồn tại', undefined, {}, { code: 'Mã danh mục đã tồn tại' })
  }
  return code
}

/** Kiểm nhóm tùy chọn (07 §2.4), trả bản đã chuẩn hóa: ChonMot maxSelect = 1; ChonNhieu isRequired = false */
function validateOptionGroup(input: SaveOptionGroupRequest) {
  const errors: Record<string, string> = {}
  const single = input.selectionType !== 'ChonNhieu'
  const choices = input.choices ?? []
  if (!input.name?.trim()) errors.name = 'Nhập tên nhóm'
  if (choices.length === 0) errors.choices = 'Thêm ít nhất 1 lựa chọn'
  choices.forEach((c, i) => {
    if (!c.name?.trim()) errors[`choices[${i}].name`] = 'Nhập tên lựa chọn'
    if (!(c.price >= 0) || c.price % 1000 !== 0) errors[`choices[${i}].price`] = 'Giá phải là bội số 1.000 ₫'
  })
  const defaults = choices.filter((c) => c.isDefault).length
  if (!single) {
    const m = input.maxSelect
    if (!Number.isInteger(m) || m < 1 || m > 10) errors.maxSelect = 'Số chọn tối đa từ 1 đến 10'
    else if (choices.length > 0 && m > choices.length) errors.maxSelect = 'Số chọn tối đa không lớn hơn số lựa chọn'
    if (defaults > 0 && !errors.choices) errors.choices = 'Nhóm chọn nhiều không có lựa chọn mặc định'
  } else if (defaults > 1 && !errors.choices) {
    errors.choices = 'Chỉ chọn một lựa chọn mặc định'
  }
  if (Object.keys(errors).length) throw fieldErrors(errors)
  return {
    name: input.name.trim(),
    nameEn: trimOrUndefined(input.nameEn),
    selectionType: single ? ('ChonMot' as const) : ('ChonNhieu' as const),
    isRequired: single ? !!input.isRequired : false,
    maxSelect: single ? 1 : input.maxSelect,
  }
}

/** Ghép bộ lựa chọn: có id thì sửa (giữ trạng thái hết), không id thì thêm, vắng mặt thì xóa mềm */
function mergeChoices(existing: OptionChoiceRecord[], input: SaveOptionGroupRequest['choices']): OptionChoiceRecord[] {
  const keep = new Set(input.filter((c) => c.id).map((c) => c.id!))
  const next: OptionChoiceRecord[] = input.map((c, i) => {
    const old = c.id ? existing.find((e) => e.id === c.id && !e.isDeleted) : undefined
    return {
      ...(old ?? {}),
      id: old?.id ?? newId(),
      name: c.name.trim(),
      nameEn: trimOrUndefined(c.nameEn),
      price: c.price,
      isDefault: !!c.isDefault,
      sortOrder: (i + 1) * 10,
      isDeleted: false,
    }
  })
  const removed = existing.filter((e) => !e.isDeleted && !keep.has(e.id)).map((e) => ({ ...e, isDeleted: true }))
  const deletedBefore = existing.filter((e) => e.isDeleted)
  return [...next, ...removed, ...deletedBefore]
}

function soldOutFields(input: SetAvailabilityRequest): { soldOutMode?: SoldOutMode; soldOutUntil?: string } {
  if (!input.isSoldOut) return { soldOutMode: undefined, soldOutUntil: undefined }
  if (!input.mode || !SOLD_OUT_MODES.includes(input.mode)) {
    throw fieldErrors({ mode: 'Chọn Hết trong hôm nay hoặc Hết tới khi mở lại' })
  }
  return { soldOutMode: input.mode, soldOutUntil: input.mode === 'HetHomNay' ? startOfNextVnDay(Date.now()) : undefined }
}

export const menuCatalogMock = {
  /** GET /api/menu (§2.1) */
  async bundle(): Promise<MenuBundle> {
    await mockDelay(100, 200)
    requirePermission(permissions.orders.create, permissions.menuItems.view)
    const { snap, ctx } = dtoContext()
    const cats = snap.categories.filter((c) => !c.isHidden)
    const catIds = new Set(cats.map((c) => c.id))
    const items = snap.menuItems.filter((m) => !m.isHidden && catIds.has(m.categoryId))
    const used = new Set(items.flatMap((m) => m.optionGroupIds))
    return {
      categories: cats.map((c) => toCategoryDto(c, snap.menuItems)),
      items: items.map((m) => toMenuItemDto(m, ctx)),
      optionGroups: snap.optionGroups.filter((g) => used.has(g.id)).map((g) => toOptionGroupDto(g, snap.menuItems)),
    }
  },

  // ───── Danh mục (§2.2) ─────
  async categories(): Promise<CategoryDto[]> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const snap = getMenuSnapshot()
    return snap.categories.map((c) => toCategoryDto(c, snap.menuItems))
  },

  async createCategory(input: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const code = validateCategory(input)
    const snap = getMenuSnapshot()
    const max = snap.categories.reduce((m, c) => Math.max(m, c.sortOrder), 0)
    const record = categoriesDb.insert({
      id: newId(),
      code,
      name: input.name.trim(),
      nameEn: trimOrUndefined(input.nameEn),
      color: input.color.toUpperCase(),
      sortOrder: max + 10,
      isHidden: !!input.isHidden,
      createdAt: nowIso(),
    })
    auditCreate('Category', record)
    changed()
    return toCategoryDto(record, snap.menuItems)
  },

  async updateCategory(id: string, input: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = categoriesDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy danh mục')
    const code = validateCategory(input, id)
    const after = categoriesDb.update(id, {
      code,
      name: input.name.trim(),
      nameEn: trimOrUndefined(input.nameEn),
      color: input.color.toUpperCase(),
      isHidden: !!input.isHidden,
      updatedAt: nowIso(),
    })!
    auditUpdate('Category', before, after)
    changed()
    return toCategoryDto(after, getMenuSnapshot().menuItems)
  },

  async reorderCategories(ids: string[]): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    reorder(
      getMenuSnapshot().categories.map((c) => c.id),
      ids,
      (id, sortOrder) => categoriesDb.update(id, { sortOrder, updatedAt: nowIso() })
    )
    changed()
  },

  async deleteCategory(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const before = categoriesDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy danh mục')
    const count = getMenuSnapshot().menuItems.filter((m) => m.categoryId === id).length
    if (count > 0) throw PosErrors.categoryHasItems(count)
    categoriesDb.update(id, { isDeleted: true, updatedAt: nowIso() })
    auditDelete('Category', before)
    changed()
  },

  // ───── Món (§2.3) ─────
  async menuItems(query: MenuItemQuery): Promise<PaginatedResult<MenuItemDto>> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const { snap, ctx } = dtoContext()
    const catOrder = new Map(snap.categories.map((c, i) => [c.id, i]))
    let dtos = snap.menuItems.map((m, index) => ({ ...toMenuItemDto(m, ctx), _menuOrder: index, _catOrder: catOrder.get(m.categoryId) }))
    if (query.categoryId) dtos = dtos.filter((m) => m.categoryId === query.categoryId)
    if (query.status) dtos = dtos.filter((m) => m.status === query.status)
    const sortBy = query.sortBy && query.sortBy !== 'sortOrder' ? query.sortBy : '_menuOrder'
    const result = listQuery(dtos, { ...query, sortBy, sortDir: query.sortDir ?? 'asc' }, { searchFields: ['code', 'name', 'nameEn'] })
    return {
      ...result,
      items: result.items.map(({ _menuOrder, _catOrder, ...dto }) => {
        void _menuOrder
        void _catOrder
        return dto
      }),
    }
  },

  async menuItem(id: string): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    return menuItemDto(id)
  },

  async createMenuItem(input: SaveMenuItemRequest): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const code = validateMenuItem(input)
    const sameCategory = getMenuSnapshot().menuItems.filter((m) => m.categoryId === input.categoryId)
    const record: MenuItemRecord = menuItemsDb.insert({
      id: newId(),
      code,
      name: input.name.trim(),
      nameEn: trimOrUndefined(input.nameEn),
      categoryId: input.categoryId,
      description: trimOrUndefined(input.description),
      descriptionEn: trimOrUndefined(input.descriptionEn),
      unit: input.unit.trim(),
      price: input.price,
      tags: [...new Set(input.tags ?? [])],
      optionGroupIds: [...new Set(input.optionGroupIds ?? [])],
      isHidden: false,
      sortOrder: input.sortOrder ?? sameCategory.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 10,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('MenuItem', record)
    changed([record.id])
    return menuItemDto(record.id)
  },

  /** Sửa món; đơn đã gửi giữ giá đã chụp (UC-09 3a) */
  async updateMenuItem(id: string, input: SaveMenuItemRequest): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = menuItemsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy món')
    const code = validateMenuItem(input, id)
    const moved = before.categoryId !== input.categoryId
    const sameCategory = getMenuSnapshot().menuItems.filter((m) => m.categoryId === input.categoryId && m.id !== id)
    const after = menuItemsDb.update(id, {
      code,
      name: input.name.trim(),
      nameEn: trimOrUndefined(input.nameEn),
      categoryId: input.categoryId,
      description: trimOrUndefined(input.description),
      descriptionEn: trimOrUndefined(input.descriptionEn),
      unit: input.unit.trim(),
      price: input.price,
      tags: [...new Set(input.tags ?? [])],
      optionGroupIds: [...new Set(input.optionGroupIds ?? [])],
      sortOrder:
        input.sortOrder ?? (moved ? sameCategory.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 10 : before.sortOrder),
      updatedAt: nowIso(),
    })!
    auditUpdate('MenuItem', before, after)
    changed([id])
    return menuItemDto(id)
  },

  /** PATCH availability (UC-10): HetHomNay ghi soldOutUntil = 00:00 ngày mai giờ VN; bán lại xóa cả hai cột */
  async setAvailability(id: string, input: SetAvailabilityRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.menuItems.availability)
    const before = menuItemsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy món')
    const after = menuItemsDb.update(id, { ...soldOutFields(input), updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
    changed([id])
  },

  async setHidden(id: string, isHidden: boolean): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.menuItems.update)
    const before = menuItemsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy món')
    const after = menuItemsDb.update(id, { isHidden: !!isHidden, updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
    changed([id])
  },

  async uploadImage(id: string, file: File): Promise<{ imageUrl: string }> {
    await mockDelay(300, 600)
    requirePermission(permissions.menuItems.update)
    const before = menuItemsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy món')
    if (!IMAGE_TYPES.includes(file.type)) throw fieldErrors({ file: 'Chỉ nhận ảnh JPG, PNG hoặc WebP' })
    if (file.size > 2 * 1024 * 1024) throw fieldErrors({ file: 'Ảnh tối đa 2 MB' })
    const stored = await mockBlobs.put(file, file.name)
    const after = menuItemsDb.update(id, { imageUrl: stored.url, updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
    changed([id])
    return { imageUrl: stored.url }
  },

  /** PUT /api/menu-items/order: đủ món chưa xóa của danh mục */
  async reorderMenuItems(categoryId: string, ids: string[]): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const all = getMenuSnapshot().menuItems.filter((m) => m.categoryId === categoryId)
    reorder(
      all.map((m) => m.id),
      ids,
      (id, sortOrder) => menuItemsDb.update(id, { sortOrder, updatedAt: nowIso() })
    )
    changed(ids)
  },

  async deleteMenuItem(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const before = menuItemsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy món')
    if (everOrderedMenuItemIds().has(id)) throw PosErrors.menuItemOrdered()
    menuItemsDb.update(id, { isDeleted: true, updatedAt: nowIso() })
    auditDelete('MenuItem', before)
    changed([id])
  },

  // ───── Nhóm tùy chọn (§2.4) ─────
  async optionGroups(): Promise<OptionGroupDto[]> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const snap = getMenuSnapshot()
    return snap.optionGroups.map((g) => toOptionGroupDto(g, snap.menuItems))
  },

  async createOptionGroup(input: SaveOptionGroupRequest): Promise<OptionGroupDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const base = validateOptionGroup(input)
    const snap = getMenuSnapshot()
    const max = snap.optionGroups.reduce((m, g) => Math.max(m, g.sortOrder), 0)
    const record = optionGroupsDb.insert({
      id: newId(),
      ...base,
      sortOrder: max + 10,
      choices: mergeChoices([], input.choices.map((c) => ({ ...c, id: undefined }))),
      createdAt: nowIso(),
    })
    auditCreate('OptionGroup', record)
    changed([], [record.id])
    return toOptionGroupDto(record, snap.menuItems)
  },

  async updateOptionGroup(id: string, input: SaveOptionGroupRequest): Promise<OptionGroupDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = optionGroupsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy nhóm tùy chọn')
    const base = validateOptionGroup(input)
    const after = optionGroupsDb.update(id, {
      ...base,
      choices: mergeChoices(before.choices, input.choices),
      updatedAt: nowIso(),
    })!
    auditUpdate('OptionGroup', before, after)
    const snap = getMenuSnapshot()
    changed(
      snap.menuItems.filter((m) => m.optionGroupIds.includes(id)).map((m) => m.id),
      [id]
    )
    return toOptionGroupDto(after, snap.menuItems)
  },

  /** Hết một lựa chọn: áp cho mọi món dùng nhóm (FR-30, TC-35, 07 §5 quyết định 16) */
  async setChoiceAvailability(groupId: string, choiceId: string, input: SetAvailabilityRequest): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.menuItems.availability)
    const before = optionGroupsDb.get(groupId)
    const choice = before?.choices.find((c) => c.id === choiceId && !c.isDeleted)
    if (!before || before.isDeleted || !choice) throw notFound('Không tìm thấy lựa chọn')
    const fields = soldOutFields(input)
    const after = optionGroupsDb.update(groupId, {
      choices: before.choices.map((c) => (c.id === choiceId ? { ...c, ...fields } : c)),
      updatedAt: nowIso(),
    })!
    auditUpdate('OptionGroup', before, after)
    changed(
      getMenuSnapshot()
        .menuItems.filter((m) => m.optionGroupIds.includes(groupId))
        .map((m) => m.id),
      [groupId]
    )
  },

  async deleteOptionGroup(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const before = optionGroupsDb.get(id)
    if (!before || before.isDeleted) throw notFound('Không tìm thấy nhóm tùy chọn')
    const count = getMenuSnapshot().menuItems.filter((m) => m.optionGroupIds.includes(id)).length
    if (count > 0) throw PosErrors.groupInUse(count)
    optionGroupsDb.update(id, { isDeleted: true, updatedAt: nowIso() })
    auditDelete('OptionGroup', before)
    changed([], [id])
  },
}
