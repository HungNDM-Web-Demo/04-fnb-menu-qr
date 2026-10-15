import { permissions } from '@/config/permissions'
import { tableCode } from '@/features/pos/lib/ordering-rules'
import { liveTables, tablesDb } from '@/features/pos/mock/menu.store'
import { isOpenSession, toTableDto } from '@/features/pos/mock/pos.mappers'
import { PosErrors, conflictError, fieldErrors } from '@/features/pos/mock/pos.errors'
import { publishPosEvent } from '@/features/pos/mock/pos-events'
import { sessionsDb } from '@/features/pos/mock/session.store'
import { mockDelay } from '@/lib/data-source'
import { normalizeVi } from '@/lib/normalize'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { notFound } from '@/mock/mock-errors'
import { newId } from '@/mock/mock-helpers'
import type { DiningTableDto, DiningTableRecord, SaveTableRequest } from '@/types/menu-qr'

/**
 * Handler mock Bàn và mã QR (07 §2.5; UC-11): đọc, ghi `dining-tables` của `menu.store.ts`, phát `tables-changed`.
 * Mã bàn cấp bằng `tableCode` (BR-01) không trùng mọi mã đã cấp, kể cả bàn đã xóa (07 §5 quyết định 4).
 */

const nowIso = () => new Date().toISOString()

const openSessionOf = (t: DiningTableRecord) => {
  if (!t.currentSessionId) return undefined
  const s = sessionsDb.get(t.currentSessionId)
  return s && isOpenSession(s) ? s : undefined
}
const dto = (t: DiningTableRecord): DiningTableDto => toTableDto(t, openSessionOf(t))
const changed = (tableIds: string[]) => publishPosEvent('tables-changed', { tableIds })

function getLive(id: string): DiningTableRecord {
  const t = tablesDb.get(id)
  if (!t || t.isDeleted) throw notFound('Không tìm thấy bàn')
  return t
}

function validate(input: SaveTableRequest, excludeId?: string) {
  const errors: Record<string, string> = {}
  const name = (input.name ?? '').trim()
  if (!name) errors.name = 'Nhập tên bàn'
  if (!(input.zone ?? '').trim()) errors.zone = 'Nhập khu vực'
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 20) errors.capacity = 'Sức chứa từ 1 đến 20'
  if (Object.keys(errors).length) throw fieldErrors(errors)
  const key = normalizeVi(name)
  if (liveTables().some((t) => t.id !== excludeId && normalizeVi(t.name) === key)) {
    throw conflictError('Tên bàn đã tồn tại', undefined, {}, { name: 'Tên bàn đã tồn tại' })
  }
}

/** Mọi mã đã cấp, kể cả bàn đã xóa */
const takenCodes = () => tablesDb.all().map((t) => t.code)

export const tablesMock = {
  async list(): Promise<DiningTableDto[]> {
    await mockDelay()
    requirePermission(permissions.tables.view)
    return liveTables().map(dto)
  },

  async get(id: string): Promise<DiningTableDto> {
    await mockDelay()
    requirePermission(permissions.tables.view)
    return dto(getLive(id))
  },

  /** Thêm bàn, cấp mã 6 ký tự (TC-37); mặc định cuối khu */
  async create(input: SaveTableRequest): Promise<DiningTableDto> {
    await mockDelay()
    requirePermission(permissions.tables.create)
    validate(input)
    const all = liveTables()
    const zone = input.zone.trim()
    const sortOrder = input.sortOrder ?? all.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 10
    const record = tablesDb.insert({
      id: newId(),
      name: input.name.trim(),
      zone,
      capacity: input.capacity,
      code: tableCode(takenCodes()),
      isActive: true,
      sortOrder,
      createdAt: nowIso(),
      version: 1,
    })
    auditCreate('DiningTable', record)
    changed([record.id])
    return dto(record)
  },

  /** Sửa tên, khu, sức chứa; mã giữ nguyên (UC-11 1a) */
  async update(id: string, input: SaveTableRequest): Promise<DiningTableDto> {
    await mockDelay()
    requirePermission(permissions.tables.update)
    const before = getLive(id)
    validate(input, id)
    const after = tablesDb.update(id, (cur) => ({
      ...cur,
      name: input.name.trim(),
      zone: input.zone.trim(),
      capacity: input.capacity,
      sortOrder: input.sortOrder ?? cur.sortOrder,
      version: cur.version + 1,
      updatedAt: nowIso(),
    }))!
    auditUpdate('DiningTable', before, after)
    changed([id])
    return dto(after)
  },

  /** Bật/tắt bàn; tắt bàn có phiên mở → BanDangCoKhach (TC-39) */
  async setActive(id: string, isActive: boolean): Promise<void> {
    await mockDelay(100, 200)
    requirePermission(permissions.tables.update)
    const before = getLive(id)
    if (!isActive && openSessionOf(before)) throw PosErrors.tableBusy()
    const after = tablesDb.update(id, (cur) => ({ ...cur, isActive: !!isActive, version: cur.version + 1, updatedAt: nowIso() }))!
    auditUpdate('DiningTable', before, after)
    changed([id])
  },

  /** Đổi mã QR, mã cũ hết hiệu lực ngay (FR-32, TC-38) */
  async regenerateCode(id: string): Promise<DiningTableDto> {
    await mockDelay()
    requirePermission(permissions.tables.update)
    const before = getLive(id)
    if (openSessionOf(before)) throw PosErrors.tableBusy()
    const after = tablesDb.update(id, (cur) => ({
      ...cur,
      code: tableCode(takenCodes()),
      codeChangedAt: nowIso(),
      version: cur.version + 1,
      updatedAt: nowIso(),
    }))!
    auditUpdate('DiningTable', before, after)
    changed([id])
    return dto(after)
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.tables.delete)
    const before = getLive(id)
    if (openSessionOf(before)) throw PosErrors.tableBusy()
    tablesDb.update(id, (cur) => ({ ...cur, isDeleted: true, version: cur.version + 1, updatedAt: nowIso() }))
    auditDelete('DiningTable', before)
    changed([id])
  },
}
