import { mockDelay } from '@/lib/data-source'
import { requireSession } from '@/mock/mock-auth'
import { liveTables } from '@/features/pos/mock/menu.store'
import { tableStatusOf } from '@/features/pos/mock/pos.mappers'
import { sessionsDb } from '@/features/pos/mock/session.store'
import { setOrderingAllDay } from '@/features/pos/mock/settings.store'
import type { GuestTableLink, OrderSettingsDto } from '@/types/menu-qr'

/** Demo (07 §2.12): lối vào "Xem như khách", "Nhận đơn cả ngày" */
export const demoGuestMock = {
  async guestTables(): Promise<GuestTableLink[]> {
    await mockDelay(80, 180)
    const sessions = sessionsDb.all()
    return liveTables().map((t) => ({
      name: t.name,
      zone: t.zone,
      code: t.code,
      status: tableStatusOf(t, sessions.find((s) => s.id === t.currentSessionId)),
    }))
  },

  /** POST /api/demo/ordering-all-day (đã đăng nhập) */
  async orderingAllDay(): Promise<OrderSettingsDto> {
    await mockDelay(150, 300)
    requireSession()
    return setOrderingAllDay()
  },

  /** Nút "Bật nhận đơn cả ngày (chỉ bản demo)" trên trang khách ở mock (07 §4.2 bước 5): không cần đăng nhập */
  async orderingAllDayFromGuest(): Promise<OrderSettingsDto> {
    await mockDelay(150, 300)
    return setOrderingAllDay()
  },
}
