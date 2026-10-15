import { readJson, removeKey, storageKey, writeJson } from '@/lib/storage'
import { PosRules } from '@/features/pos/lib/pos-rules'

/**
 * Bộ nhớ trình duyệt của trang khách (07 §4.3): mã thiết bị, giỏ món, tên gọi, phiên đã biết, ngôn ngữ.
 * Điện thoại giả lập N ≥ 2 (`?phone=N`, 07 §4.2) dùng khóa có hậu tố `:p{N}`.
 */

export const phoneSuffix = (phone: number) => (phone >= 2 ? `:p${phone}` : '')

const newUuid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

export const newRequestId = newUuid

/** Mã thiết bị ẩn danh, sinh một lần (`fnb-menu-qr:device`) */
export function getDeviceId(phone: number): string {
  const key = storageKey(`device${phoneSuffix(phone)}`)
  const existing = readJson<string>('local', key)
  if (existing) return existing
  const id = newUuid()
  writeJson('local', key, id)
  return id
}

const GUEST_NAME_KEY = storageKey('guest-name')
export const readGuestName = () => readJson<string>('local', GUEST_NAME_KEY) ?? ''
export const writeGuestName = (name: string) => writeJson('local', GUEST_NAME_KEY, name)

const LANG_KEY = storageKey('guest-lang')
export type GuestLang = 'vi' | 'en'
export const readGuestLang = (): GuestLang => (readJson<string>('local', LANG_KEY) === 'en' ? 'en' : 'vi')
export const writeGuestLang = (lang: GuestLang) => writeJson('local', LANG_KEY, lang)

const sessionKey = (code: string, phone: number) => storageKey(`session:${code.toUpperCase()}${phoneSuffix(phone)}`)
export const readKnownSession = (code: string, phone: number) => readJson<string>('local', sessionKey(code, phone)) ?? undefined
export const writeKnownSession = (code: string, phone: number, sessionCode: string) =>
  writeJson('local', sessionKey(code, phone), sessionCode)
export const clearKnownSession = (code: string, phone: number) => removeKey('local', sessionKey(code, phone))

// ───────────────────────── Giỏ món ─────────────────────────

export type CartLine = {
  key: string
  menuItemId: string
  choiceIds: string[]
  quantity: number
  note?: string
  /** Bản chụp để hiển thị; `unitPrice` là giá khách đang thấy, gửi làm `expectedUnitPrice` (BR-05) */
  itemName: string
  imageUrl?: string
  itemPrice: number
  options: { groupName: string; name: string; price: number }[]
  unitPrice: number
}
export type CartState = { updatedAt: number; lines: CartLine[] }

export const EMPTY_CART: CartState = { updatedAt: 0, lines: [] }
export const cartKey = (code: string, phone: number) => storageKey(`cart:${code.toUpperCase()}${phoneSuffix(phone)}`)

const cache = new Map<string, CartState>()
const listeners = new Set<() => void>()

function readCart(key: string): CartState {
  const cached = cache.get(key)
  if (cached) return cached
  let state = readJson<CartState>('local', key) ?? EMPTY_CART
  // Giỏ giữ 4 giờ (BR-05)
  if (state.updatedAt && Date.now() - state.updatedAt > PosRules.cartTtlHours * 3600_000) {
    removeKey('local', key)
    state = EMPTY_CART
  }
  if (!Array.isArray(state.lines)) state = EMPTY_CART
  cache.set(key, state)
  return state
}

function writeCart(key: string, lines: CartLine[]) {
  const state: CartState = lines.length ? { updatedAt: Date.now(), lines } : { updatedAt: Date.now(), lines: [] }
  cache.set(key, state)
  if (lines.length) writeJson('local', key, state)
  else removeKey('local', key)
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && cache.has(event.key)) {
      cache.delete(event.key)
      listeners.forEach((l) => l())
    }
  })
}

export const cartStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: readCart,
  /** Dòng trùng (cùng món, cùng tập lựa chọn, cùng ghi chú) cộng số lượng (tối đa 20) */
  add(key: string, line: Omit<CartLine, 'key'>) {
    const lines = [...readCart(key).lines]
    const sig = (l: Pick<CartLine, 'menuItemId' | 'choiceIds' | 'note' | 'unitPrice'>) =>
      `${l.menuItemId}|${[...l.choiceIds].sort().join(',')}|${(l.note ?? '').trim()}|${l.unitPrice}`
    const idx = lines.findIndex((l) => sig(l) === sig(line))
    if (idx >= 0) lines[idx] = { ...lines[idx], quantity: Math.min(PosRules.maxQuantity, lines[idx].quantity + line.quantity) }
    else lines.push({ ...line, key: newUuid() })
    writeCart(key, lines)
  },
  setQuantity(key: string, lineKey: string, quantity: number) {
    const lines = readCart(key)
      .lines.map((l) => (l.key === lineKey ? { ...l, quantity: Math.min(PosRules.maxQuantity, quantity) } : l))
      .filter((l) => l.quantity > 0)
    writeCart(key, lines)
  },
  remove(key: string, lineKey: string) {
    writeCart(key, readCart(key).lines.filter((l) => l.key !== lineKey))
  },
  /** Cập nhật đơn giá theo `priceChanges` (409 GiaDaThayDoi) */
  reprice(key: string, changes: { index: number; newUnitPrice: number }[]) {
    const lines = readCart(key).lines.map((l, i) => {
      const c = changes.find((x) => x.index === i)
      return c ? { ...l, unitPrice: c.newUnitPrice, itemPrice: c.newUnitPrice - l.options.reduce((s, o) => s + o.price, 0) } : l
    })
    writeCart(key, lines)
  },
  clear(key: string) {
    writeCart(key, [])
  },
}
