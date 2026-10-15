import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type {
  CancelOrderItemRequest,
  CancelOrderRequest,
  CheckoutRequest,
  CheckoutResultDto,
  ConfirmOrderRequest,
  CreateStaffOrderRequest,
  LiveOrdersDto,
  MenuBundle,
  OrderSettingsDto,
  RejectOrderRequest,
  ServeOrderRequest,
  ServiceRequestDto,
  SessionStatus,
  StaffOrderDto,
  StoreProfile,
  TableBoardItem,
  TableSessionDto,
  TableSessionListItem,
  TransferSessionRequest,
  UnserveOrderRequest,
} from '@/types/menu-qr'
import { liveMock } from '../mock/live.mock'

/** Màn hình nhận đơn (07 §2.8–2.10, §2.1, §2.6) */
export const liveService = {
  liveOrders: (): Promise<LiveOrdersDto> => (isMockMode() ? liveMock.liveOrders() : apiCall.get(apiRoutes.orders.live)),
  getOrder: (id: string): Promise<StaffOrderDto> => (isMockMode() ? liveMock.getOrder(id) : apiCall.get(apiRoutes.orders.detail(id))),
  createStaffOrder: (body: CreateStaffOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.createStaffOrder(body) : apiCall.post(apiRoutes.orders.create, body),
  confirm: (id: string, body: ConfirmOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.confirm(id, body) : apiCall.post(apiRoutes.orders.confirm(id), body),
  reject: (id: string, body: RejectOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.reject(id, body) : apiCall.post(apiRoutes.orders.reject(id), body),
  serve: (id: string, body: ServeOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.serve(id, body) : apiCall.post(apiRoutes.orders.serve(id), body),
  unserve: (id: string, body: UnserveOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.unserve(id, body) : apiCall.post(apiRoutes.orders.unserve(id), body),
  cancelItem: (id: string, itemId: string, body: CancelOrderItemRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.cancelItem(id, itemId, body) : apiCall.post(apiRoutes.orders.cancelItem(id, itemId), body),
  cancelOrder: (id: string, body: CancelOrderRequest): Promise<StaffOrderDto> =>
    isMockMode() ? liveMock.cancelOrder(id, body) : apiCall.post(apiRoutes.orders.cancel(id), body),

  board: (): Promise<TableBoardItem[]> => (isMockMode() ? liveMock.board() : apiCall.get(apiRoutes.tableSessions.board)),
  sessionDetail: (id: string): Promise<TableSessionDto> =>
    isMockMode() ? liveMock.sessionDetail(id) : apiCall.get(apiRoutes.tableSessions.detail(id)),
  sessionList: (
    query: PaginationQuery & { from?: string; to?: string; status?: SessionStatus }
  ): Promise<PaginatedResult<TableSessionListItem>> =>
    isMockMode() ? liveMock.sessionList(query) : apiCall.get(apiRoutes.tableSessions.list, { params: query }),
  checkout: (id: string, body: CheckoutRequest): Promise<CheckoutResultDto> =>
    isMockMode() ? liveMock.checkout(id, body) : apiCall.post(apiRoutes.tableSessions.checkout(id), body),
  transfer: (id: string, body: TransferSessionRequest): Promise<TableSessionDto> =>
    isMockMode() ? liveMock.transfer(id, body) : apiCall.post(apiRoutes.tableSessions.transfer(id), body),

  pendingRequests: (): Promise<ServiceRequestDto[]> =>
    isMockMode() ? liveMock.pendingRequests() : apiCall.get(apiRoutes.serviceRequests.pending),
  handleRequest: (id: string): Promise<ServiceRequestDto> =>
    isMockMode() ? liveMock.handleRequest(id) : apiCall.post(apiRoutes.serviceRequests.handle(id)),

  menuBundle: (): Promise<MenuBundle> => (isMockMode() ? liveMock.menuBundle() : apiCall.get(apiRoutes.menu)),
  orderSettings: (): Promise<OrderSettingsDto> =>
    isMockMode() ? liveMock.orderSettings() : apiCall.get(apiRoutes.orderSettings.detail),
  storeProfile: (): Promise<StoreProfile> => (isMockMode() ? liveMock.storeProfile() : apiCall.get(apiRoutes.storeProfile)),
}
