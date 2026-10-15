import type { OrderItemOptionDto, SelectionType, SoldOutMode } from '@/types/menu-qr'
import { vnDateKey } from './vn-time'

/**
 * Hết món, kiểm tra lựa chọn, dấu thực đơn (07 §3.8, BR-04, BR-14). Dùng chung cho handler mock, giỏ, tấm chi tiết món.
 */

type SoldOutFields = { soldOutMode?: SoldOutMode | null; soldOutUntil?: string | null }
type ChoiceLike = SoldOutFields & {
  id: string
  name: string
  price: number
  isDeleted?: boolean
  sortOrder: number
}
export type GroupLike = {
  id: string
  name: string
  selectionType: SelectionType
  isRequired: boolean
  maxSelect: number
  isDeleted?: boolean
  choices: ChoiceLike[]
}
type ItemLike = SoldOutFields & { optionGroupIds: string[] }

/** Hết hiệu lực: có chế độ hết và (không hạn hoặc chưa tới hạn) */
export function isSoldOutNow(
  mode: SoldOutMode | null | undefined,
  until: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!mode) return false
  return !until || now < new Date(until).getTime()
}

const liveChoices = (group: GroupLike) =>
  group.choices.filter((c) => !c.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)

/** Món hết = hết hiệu lực của món, hoặc nhóm ChonMot bắt buộc mà mọi lựa chọn chưa xóa đều hết (§3.8) */
export function itemIsSoldOut(item: ItemLike, groups: GroupLike[], now: number = Date.now()): boolean {
  if (isSoldOutNow(item.soldOutMode, item.soldOutUntil, now)) return true
  return item.optionGroupIds.some((id) => {
    const group = groups.find((g) => g.id === id && !g.isDeleted)
    if (!group || group.selectionType !== 'ChonMot' || !group.isRequired) return false
    const choices = liveChoices(group)
    return choices.length > 0 && choices.every((c) => isSoldOutNow(c.soldOutMode, c.soldOutUntil, now))
  })
}

export type ChoiceValidation = {
  /** Lỗi BR-04 (gắn vào `errors["lines[i].choiceIds"]`) */
  error?: string
  /** Lựa chọn đã sắp theo thứ tự nhóm của món rồi `sortOrder` lựa chọn (chụp vào dòng đơn) */
  options: OrderItemOptionDto[]
  /** Tên lựa chọn đang hết (bước 7 MonVuaHet: "{tên} vừa hết") */
  soldOutChoiceName?: string
}

/**
 * Kiểm tập lựa chọn của một dòng (BR-04): mỗi choiceId thuộc một nhóm của món, không trùng; ChonMot bắt buộc
 * đúng 1, không bắt buộc 0–1; ChonNhieu 0…maxSelect. Không xét hết món (trả `soldOutChoiceName` để bước sau báo).
 */
export function validateChoices(
  item: ItemLike,
  groups: GroupLike[],
  choiceIds: string[],
  now: number = Date.now()
): ChoiceValidation {
  const itemGroups = item.optionGroupIds
    .map((id) => groups.find((g) => g.id === id && !g.isDeleted))
    .filter((g): g is GroupLike => Boolean(g))
  const ids = choiceIds ?? []
  if (new Set(ids).size !== ids.length) return { error: 'Lựa chọn không hợp lệ', options: [] }

  const picked = new Set(ids)
  let matched = 0
  const options: OrderItemOptionDto[] = []
  let soldOutChoiceName: string | undefined
  for (const group of itemGroups) {
    const chosen = liveChoices(group).filter((c) => picked.has(c.id))
    matched += chosen.length
    if (group.selectionType === 'ChonMot') {
      if (group.isRequired && chosen.length === 0) return { error: `Bắt buộc chọn 1 ${group.name}`, options: [] }
      if (chosen.length > 1) return { error: `Chọn tối đa 1 ${group.name}`, options: [] }
    } else if (chosen.length > group.maxSelect) {
      return { error: `Chọn tối đa ${group.maxSelect} ${group.name}`, options: [] }
    }
    for (const c of chosen) {
      if (!soldOutChoiceName && isSoldOutNow(c.soldOutMode, c.soldOutUntil, now)) soldOutChoiceName = c.name
      options.push({ groupId: group.id, groupName: group.name, choiceId: c.id, name: c.name, price: c.price })
    }
  }
  if (matched !== ids.length) return { error: 'Lựa chọn không hợp lệ', options: [] }
  return { options, soldOutChoiceName }
}

/** Lựa chọn mặc định của món: mặc định của nhóm ChonMot, nếu hết thì lựa chọn còn đầu tiên khi nhóm bắt buộc */
export function defaultChoiceIds(item: ItemLike, groups: GroupLike[], now: number = Date.now()): string[] {
  const result: string[] = []
  for (const id of item.optionGroupIds) {
    const group = groups.find((g) => g.id === id && !g.isDeleted)
    if (!group || group.selectionType !== 'ChonMot') continue
    const choices = liveChoices(group).filter((c) => !isSoldOutNow(c.soldOutMode, c.soldOutUntil, now))
    const preferred = choices.find((c) => (c as { isDefault?: boolean }).isDefault)
    const pick = preferred ?? (group.isRequired ? choices[0] : undefined)
    if (pick) result.push(pick.id)
  }
  return result
}

/** Băm ngắn FNV-1a (không dùng cho bảo mật) */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Dấu thực đơn (§3.8): đổi khi thực đơn đổi hoặc qua 00:00 giờ Việt Nam.
 * Mock truyền các collection thực đơn; BE dùng (max UpdatedAt, số món, ngày).
 */
export function menuStamp(parts: unknown[], now: number = Date.now()): string {
  return shortHash(`${JSON.stringify(parts)}|${vnDateKey(now)}`)
}
