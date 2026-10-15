import type { CallReason, CartLineInput, GuestTableLink, PublicMenu } from '@/types/menu-qr'
import { demoGuestService } from '../services/demo-guest.service'
import { publicService } from '../services/public-api'
import { newRequestId } from './guest-storage'

/**
 * Giả lập khách cho người xem demo một mình (07 §4.2 bước 4, quyết định 29): đi qua CHÍNH service công khai
 * (`deviceId` = `demo-sim`) nên qua đủ mọi kiểm tra và hiện ở màn nhận đơn kèm âm báo.
 */

const SIM_DEVICE = 'demo-sim'
/** Bàn dành cho kịch bản test, không giả lập */
const RESERVED = new Set(['Bàn 05', 'Bàn 12'])
const NAMES = ['Anh Minh', 'Chị Hạnh', 'Bạn Long', 'Cô Ba', 'Anh Khoa', 'Chị Ngọc', 'Bạn Duy', 'Anh Sơn', 'Chị Thảo', 'Bạn Vy']
const REASONS: CallReason[] = ['ThemDa', 'LayChenBat', 'DonBan', 'TuVanMon']

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
const shuffle = <T,>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5)
const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

function buildLines(menu: PublicMenu): CartLineInput[] {
  const beerCats = new Set(menu.categories.filter((c) => /bia/i.test(c.name)).map((c) => c.id))
  const available = menu.items.filter((i) => !i.isSoldOut)
  const chosen = shuffle(available).slice(0, between(1, 4))
  const lines: CartLineInput[] = []
  for (const item of chosen) {
    const choiceIds: string[] = []
    let ok = true
    for (const gid of item.optionGroupIds) {
      const g = menu.optionGroups.find((x) => x.id === gid)
      if (!g || g.selectionType !== 'ChonMot') continue
      const open = g.choices.filter((c) => !c.isSoldOut)
      const c = open.find((x) => x.isDefault) ?? (g.isRequired ? open[0] : undefined)
      if (c) choiceIds.push(c.id)
      else if (g.isRequired) ok = false
    }
    if (!ok) continue
    const price = item.price + choiceIds.reduce((s, id) => s + (menu.optionGroups.flatMap((g) => g.choices).find((c) => c.id === id)?.price ?? 0), 0)
    lines.push({ menuItemId: item.id, choiceIds, quantity: beerCats.has(item.categoryId) ? between(4, 6) : between(1, 2), expectedUnitPrice: price })
  }
  return lines
}

/** Giả lập khách gọi món: bàn đang bật ngẫu nhiên (trừ Bàn 05, 12 và bàn đang có đơn chờ) */
export async function simulateGuestOrder(): Promise<{ table: string; total: number; code: string }> {
  const tables: GuestTableLink[] = await demoGuestService.guestTables()
  const candidates = shuffle(tables.filter((t) => t.status !== 'Tat' && !RESERVED.has(t.name)))
  for (const t of candidates) {
    const live = await publicService.live(t.code, undefined, SIM_DEVICE)
    if (!live.ordering.accepting) throw new Error(live.ordering.message ?? 'Quán đang không nhận đơn QR')
    if (live.session?.orders.some((o) => o.status === 'ChoXacNhan')) continue
    const menu = await publicService.menu(t.code, SIM_DEVICE)
    const lines = buildLines(menu)
    if (lines.length === 0) continue
    const result = await publicService.submitOrder(t.code, {
      clientRequestId: newRequestId(),
      deviceId: SIM_DEVICE,
      guestName: pick(NAMES),
      lines,
    })
    return { table: t.name, total: result.order.total, code: result.order.code }
  }
  throw new Error('Không còn bàn phù hợp để giả lập (mọi bàn đang có đơn chờ)')
}

/** Giả lập gọi nhân viên: bàn có phiên mở ngẫu nhiên, lý do ngẫu nhiên trừ "Khác" */
export async function simulateCallStaff(): Promise<{ table: string; reason: string }> {
  const tables = await demoGuestService.guestTables()
  const open = tables.filter((t) => t.status === 'DangPhucVu' || t.status === 'ChoThanhToan')
  if (open.length === 0) throw new Error('Chưa có bàn nào đang có khách')
  const t = pick(open)
  const reason = pick(REASONS)
  const result = await publicService.serviceRequest(t.code, {
    clientRequestId: newRequestId(),
    deviceId: SIM_DEVICE,
    type: 'GoiNhanVien',
    reason,
  })
  return { table: t.name, reason: result.request.reasonText }
}
