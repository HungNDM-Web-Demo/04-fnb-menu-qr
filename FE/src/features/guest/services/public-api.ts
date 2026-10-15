import axios from 'axios'
import { apiRoutes } from '@/config/api-routes'
import { appConfig } from '@/config/app.config'
import { toApiError } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import { mockDb } from '@/mock/mock-db'
import type {
  PublicLiveState,
  PublicMenu,
  PublicServiceRequestInput,
  PublicServiceRequestResult,
  PublicSubmitOrderRequest,
  PublicSubmitOrderResult,
  PublicTableInfo,
} from '@/types/menu-qr'
import { publicMock } from '../mock/public.mock'

/**
 * API công khai cho trang khách (07 §2.7): axios riêng KHÔNG gắn Authorization, không tự làm mới token;
 * gửi `X-Device-Id` mọi request. Mã bàn luôn gửi chữ hoa.
 */
const publicHttp = axios.create({ baseURL: appConfig.apiUrl, timeout: 20_000, headers: { 'Content-Type': 'application/json' } })
publicHttp.interceptors.response.use(
  (r) => r,
  (error) => Promise.reject(toApiError(error))
)

/** Collection mock-db mà trang khách cần nghe */
const RELEVANT = [
  'orders',
  'table-sessions',
  'service-requests',
  'menu-items',
  'option-groups',
  'categories',
  'dining-tables',
  'system.settings',
]

const up = (code: string) => code.trim().toUpperCase()
const headers = (deviceId?: string) => (deviceId ? { 'X-Device-Id': deviceId } : undefined)

export const publicService = {
  info: async (code: string, deviceId?: string): Promise<PublicTableInfo> =>
    isMockMode()
      ? publicMock.info(up(code))
      : (await publicHttp.get<PublicTableInfo>(apiRoutes.publicTables.info(up(code)), { headers: headers(deviceId) })).data,

  menu: async (code: string, deviceId?: string): Promise<PublicMenu> =>
    isMockMode()
      ? publicMock.menu(up(code))
      : (await publicHttp.get<PublicMenu>(apiRoutes.publicTables.menu(up(code)), { headers: headers(deviceId) })).data,

  live: async (code: string, knownSession: string | undefined, deviceId?: string): Promise<PublicLiveState> =>
    isMockMode()
      ? publicMock.live(up(code), knownSession, deviceId)
      : (
          await publicHttp.get<PublicLiveState>(apiRoutes.publicTables.live(up(code)), {
            params: knownSession ? { knownSession } : undefined,
            headers: headers(deviceId),
          })
        ).data,

  submitOrder: async (code: string, request: PublicSubmitOrderRequest): Promise<PublicSubmitOrderResult> =>
    isMockMode()
      ? publicMock.submitOrder(up(code), request, request.deviceId)
      : (await publicHttp.post<PublicSubmitOrderResult>(apiRoutes.publicTables.orders(up(code)), request, { headers: headers(request.deviceId) }))
          .data,

  serviceRequest: async (code: string, input: PublicServiceRequestInput): Promise<PublicServiceRequestResult> =>
    isMockMode()
      ? publicMock.serviceRequest(up(code), input, input.deviceId)
      : (
          await publicHttp.post<PublicServiceRequestResult>(apiRoutes.publicTables.serviceRequests(up(code)), input, {
            headers: headers(input.deviceId),
          })
        ).data,

  /**
   * Chế độ mock: nghe mock-db (tab khác ghi) để cập nhật tức thì, ngoài việc hỏi lại mỗi 5 giây (07 §2.14).
   * Chế độ api: không có kênh đẩy cho khách (07 §5 quyết định 7).
   */
  subscribeChanges: (listener: () => void): (() => void) =>
    isMockMode()
      ? mockDb.subscribe((event) => {
          if (event.reset || event.collections.length === 0 || event.collections.some((c) => RELEVANT.includes(c))) listener()
        })
      : () => {},
}
