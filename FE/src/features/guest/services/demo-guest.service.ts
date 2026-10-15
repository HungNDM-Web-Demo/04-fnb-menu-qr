import { apiRoutes } from '@/config/api-routes'
import { appConfig } from '@/config/app.config'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { GuestTableLink, OrderSettingsDto } from '@/types/menu-qr'
import { demoGuestMock } from '../mock/demo-guest.mock'

/** API demo cho lối vào trang khách (07 §2.12, §4.2) */
export const demoGuestService = {
  guestTables: (): Promise<GuestTableLink[]> =>
    isMockMode() ? demoGuestMock.guestTables() : apiCall.get<GuestTableLink[]>(apiRoutes.demo.guestTables),

  orderingAllDay: (): Promise<OrderSettingsDto> =>
    isMockMode() ? demoGuestMock.orderingAllDay() : apiCall.post<OrderSettingsDto>(apiRoutes.demo.orderingAllDay),

  /** Trang khách: chỉ có ở mock + bật thanh demo (07 §4.2 bước 5) */
  canEnableAllDayFromGuest: (): boolean => isMockMode() && appConfig.demoToolbar,
  orderingAllDayFromGuest: (): Promise<OrderSettingsDto> => demoGuestMock.orderingAllDayFromGuest(),
}
