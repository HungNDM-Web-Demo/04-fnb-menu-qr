import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  DiningTableDto,
  OrderSettingsDto,
  PauseOrderingRequest,
  SaveTableRequest,
  StoreProfile,
  UpdateOrderSettingsRequest,
} from '@/types/menu-qr'
import { orderSettingsMock } from '../mock/order-settings.mock'
import { tablesMock } from '../mock/tables.mock'

/** Bàn và mã QR (07 §2.5) */
export const tableService = {
  list: (): Promise<DiningTableDto[]> => (isMockMode() ? tablesMock.list() : apiCall.get(apiRoutes.tables.list)),
  get: (id: string): Promise<DiningTableDto> =>
    isMockMode() ? tablesMock.get(id) : apiCall.get(apiRoutes.tables.detail(id)),
  create: (input: SaveTableRequest): Promise<DiningTableDto> =>
    isMockMode() ? tablesMock.create(input) : apiCall.post(apiRoutes.tables.list, input),
  update: (id: string, input: SaveTableRequest): Promise<DiningTableDto> =>
    isMockMode() ? tablesMock.update(id, input) : apiCall.put(apiRoutes.tables.detail(id), input),
  setActive: (id: string, isActive: boolean): Promise<void> =>
    isMockMode() ? tablesMock.setActive(id, isActive) : apiCall.patch(apiRoutes.tables.active(id), { isActive }),
  regenerateCode: (id: string): Promise<DiningTableDto> =>
    isMockMode() ? tablesMock.regenerateCode(id) : apiCall.post(apiRoutes.tables.regenerateCode(id)),
  remove: (id: string): Promise<void> =>
    isMockMode() ? tablesMock.remove(id) : apiCall.delete(apiRoutes.tables.detail(id)),
}

/** Cài đặt nhận đơn, thông tin quán (07 §2.6) */
export const orderSettingsService = {
  get: (): Promise<OrderSettingsDto> =>
    isMockMode() ? orderSettingsMock.get() : apiCall.get(apiRoutes.orderSettings.detail),
  update: (input: UpdateOrderSettingsRequest): Promise<OrderSettingsDto> =>
    isMockMode() ? orderSettingsMock.update(input) : apiCall.put(apiRoutes.orderSettings.detail, input),
  pause: (input: PauseOrderingRequest): Promise<OrderSettingsDto> =>
    isMockMode() ? orderSettingsMock.pause(input) : apiCall.post(apiRoutes.orderSettings.pause, input),
  resume: (): Promise<OrderSettingsDto> =>
    isMockMode() ? orderSettingsMock.resume() : apiCall.post(apiRoutes.orderSettings.resume),
  storeProfile: (): Promise<StoreProfile> =>
    isMockMode() ? orderSettingsMock.storeProfile() : apiCall.get(apiRoutes.storeProfile),
}
