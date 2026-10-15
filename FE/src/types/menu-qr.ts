/**
 * Hợp đồng dữ liệu nghiệp vụ Menu QR Gọi món, chép đúng docs/07-DANH-SACH-API.md §2 (07 là nguồn;
 * đổi DTO thì sửa 07 trước rồi sửa file này). BE `Application/DTOs/*` khớp từng trường.
 * Dùng chung cho FE-Khách và FE-Quản lý (07 §4.9): không tách bản sao trong features/*.
 * Quy ước: `?` là có thể null hoặc vắng; ngày giờ chuỗi ISO UTC; tiền là số nguyên đồng.
 */

// ============================================================ Enum (06 §4, 07 §2)

export type MenuTag = 'BanChay' | 'MonMoi' | 'Cay' | 'Chay'
export type SelectionType = 'ChonMot' | 'ChonNhieu'
export type SoldOutMode = 'HetHomNay' | 'HetToiKhiMoLai'
export type MenuItemStatus = 'DangBan' | 'HetMon' | 'An'
export type TableStatus = 'Trong' | 'DangPhucVu' | 'ChoThanhToan' | 'Tat'
export type SessionStatus = 'DangPhucVu' | 'ChoThanhToan' | 'DaDong' | 'DaHuy'
export type OrderSource = 'KhachQr' | 'NhanVien'
export type OrderStatus = 'ChoXacNhan' | 'DaXacNhan' | 'DaPhucVu' | 'BiTuChoi' | 'DaHuy'
export type OrderItemStatus = 'ChoXacNhan' | 'DaXacNhan' | 'BiBo' | 'DaPhucVu' | 'DaHuy'
export type RemoveReason = 'HetMon' | 'Khac'
export type RejectReason = 'BanKhongCoKhach' | 'DonTrung' | 'HetMon' | 'Khac'
export type ServiceRequestType = 'GoiNhanVien' | 'ThanhToan'
export type CallReason = 'ThemDa' | 'LayChenBat' | 'DonBan' | 'TuVanMon' | 'Khac'
export type ServiceRequestStatus = 'DangCho' | 'DaXuLy' | 'DaHuy'
export type PaymentMethod = 'TienMat' | 'ChuyenKhoan'
export type ConfirmMode = 'ThuCong' | 'TuXacNhan'
/** Mức màu theo thời gian chờ (07 §3.5) */
export type WaitLevel = 'BinhThuong' | 'Vang' | 'Do'

// ============================================================ Thực đơn (07 §2.1–2.4)

export type CategoryDto = {
  id: string
  code: string
  name: string
  nameEn?: string
  color: string // #RRGGBB, nền ô ảnh mặc định
  sortOrder: number
  isHidden: boolean
  itemCount: number // món chưa xóa, kể cả ẩn
}
export type SaveCategoryRequest = { code: string; name: string; nameEn?: string; color: string; isHidden: boolean }
export type ReorderRequest = { ids: string[] }

export type OptionChoiceDto = {
  id: string
  name: string
  nameEn?: string
  price: number // giá cộng thêm, bội số 1.000, ≥ 0
  isDefault: boolean
  isSoldOut: boolean // đã tính hết hạn "Hết trong hôm nay"
  soldOutMode?: SoldOutMode
  soldOutUntil?: string
  sortOrder: number
}
export type OptionGroupDto = {
  id: string
  name: string
  nameEn?: string
  selectionType: SelectionType
  isRequired: boolean // luôn false với ChonNhieu
  maxSelect: number // ChonMot luôn 1; ChonNhieu 1–10, ≤ số lựa chọn
  sortOrder: number
  choices: OptionChoiceDto[]
  itemCount: number // số món chưa xóa đang gắn nhóm
}
export type SaveOptionGroupRequest = {
  name: string
  nameEn?: string
  selectionType: SelectionType
  isRequired: boolean
  maxSelect: number
  /** Có id: sửa; không id: thêm; lựa chọn cũ vắng mặt: xóa mềm */
  choices: { id?: string; name: string; nameEn?: string; price: number; isDefault: boolean }[]
}

export type MenuItemDto = {
  id: string
  code: string
  name: string
  nameEn?: string
  categoryId: string
  categoryName: string
  imageUrl?: string
  description?: string
  descriptionEn?: string
  unit: string
  price: number
  tags: MenuTag[]
  optionGroupIds: string[] // theo thứ tự hiển thị
  isHidden: boolean
  soldOutMode?: SoldOutMode
  soldOutUntil?: string
  isSoldOut: boolean // hết của chính món, hoặc nhóm bắt buộc hết mọi lựa chọn (BR-14)
  status: MenuItemStatus // An > HetMon > DangBan
  sortOrder: number
  everOrdered: boolean // đã có trong đơn → khóa Xóa, gợi ý Ẩn (BR-16)
  updatedAt: string
}
export type SaveMenuItemRequest = {
  code: string // ^M\d{3}$
  name: string
  nameEn?: string
  categoryId: string
  description?: string
  descriptionEn?: string
  unit: string
  price: number
  tags: MenuTag[]
  optionGroupIds: string[]
  sortOrder?: number
}
/** isSoldOut = true thì bắt buộc mode */
export type SetAvailabilityRequest = { isSoldOut: boolean; mode?: SoldOutMode }
export type SetHiddenRequest = { isHidden: boolean }

export type MenuBundle = {
  categories: CategoryDto[] // chưa ẩn, theo sortOrder
  items: MenuItemDto[] // chưa ẩn, thuộc danh mục chưa ẩn; món hết vẫn trả
  optionGroups: OptionGroupDto[] // nhóm đang được món trong items dùng
}

// ============================================================ Bàn, QR, cài đặt nhận đơn (07 §2.5–2.6)

export type DiningTableDto = {
  id: string
  name: string
  zone: string
  capacity: number
  code: string // mã bàn 6 ký tự trong QR (BR-01)
  codeChangedAt?: string
  isActive: boolean
  sortOrder: number
  status: TableStatus
  currentSessionId?: string
  currentSessionCode?: string
  createdAt: string
}
export type SaveTableRequest = { name: string; zone: string; capacity: number; sortOrder?: number }
export type SetTableActiveRequest = { isActive: boolean }

export type OrderingStatus = {
  accepting: boolean // nhận đơn QR ngay lúc này (chưa xét bàn tắt)
  blockReason?: 'QuanTamNgung' | 'NgoaiGioNhanDon'
  message?: string // câu hiện ở dải vàng, đúng câu lỗi 07 §2.13
  openTime: string // "09:00"
  closeTime: string // "22:00"; bằng openTime = nhận đơn cả ngày; nhỏ hơn = qua đêm
  pausedUntil?: string // ISO UTC khi tạm ngưng có thời hạn
  pausedIndefinitely: boolean
  confirmMode: ConfirmMode
  asOf: string
}
export type OrderSettingsDto = OrderingStatus
export type UpdateOrderSettingsRequest = { openTime: string; closeTime: string; confirmMode: ConfirmMode }
/** minutes null = tới khi mở lại */
export type PauseOrderingRequest = { minutes: 15 | 30 | null }

export type StoreProfile = {
  name: string
  tagline?: string
  address: string
  phone: string
  taxCode: string
  receiptFooter: string
  bankBin: string
  bankAccount: string
  bankAccountName: string
  logoUrl: string
  primaryColor: string
}

// ============================================================ Đơn, dòng đơn (07 §2.8)

export type OrderItemOptionDto = { groupId: string; groupName: string; choiceId: string; name: string; price: number }

/** Một dòng món trong giỏ hoặc trong yêu cầu gọi món */
export type CartLineInput = {
  menuItemId: string
  choiceIds: string[]
  quantity: number // 1–20
  note?: string // ≤ 100 ký tự
  /** Đơn giá khách đang thấy (giá món + lựa chọn); bắt buộc ở API công khai để phát hiện đổi giá (BR-05) */
  expectedUnitPrice?: number
}

export type OrderItemDto = {
  id: string
  menuItemId: string
  itemCode: string
  itemName: string // chụp lúc gửi
  itemPrice: number // giá món lúc gửi
  options: OrderItemOptionDto[]
  optionsPrice: number // Σ giá cộng thêm
  unitPrice: number // itemPrice + optionsPrice
  quantity: number
  lineTotal: number // unitPrice × quantity (BR-03)
  note?: string
  status: OrderItemStatus
  removeReason?: RemoveReason
  removeNote?: string
  cancelReason?: string
  cancelledAt?: string
  cancelledByName?: string
  servedAt?: string
  statusText?: string // "Không phục vụ được: Hết món", "Đã hủy: Khách đổi ý"
  sortOrder: number
}

export type StaffOrderDto = {
  id: string
  code: string // DH + yyMMdd + 4 số
  sessionId: string
  sessionCode: string
  tableId: string
  tableName: string
  source: OrderSource
  status: OrderStatus
  autoConfirmed: boolean
  guestName?: string
  note?: string
  submittedAt: string
  handledAt?: string // giờ xác nhận hoặc từ chối
  handledByName?: string
  rejectReason?: RejectReason
  rejectNote?: string
  rejectText?: string // "Bàn không có khách", "Khác: …"
  total: number // Σ lineTotal dòng không BiBo, không DaHuy
  itemCount: number // số dòng còn hiệu lực
  unservedCount: number // dòng DaXacNhan chưa phục vụ
  items: OrderItemDto[]
  waitMinutes: number // ChoXacNhan: từ giờ gửi; DaXacNhan: từ giờ xác nhận; khác: 0
  waitLevel: WaitLevel
  asOf: string
}

export type LiveOrdersDto = {
  asOf: string
  pending: StaffOrderDto[] // ChoXacNhan, giờ gửi tăng dần
  serving: StaffOrderDto[] // DaXacNhan, giờ xác nhận tăng dần
}

export type ConfirmOrderRequest = { removedItems: { itemId: string; reason: RemoveReason; note?: string }[] }
export type RejectOrderRequest = { reason: RejectReason; note?: string }
/** itemIds vắng = mọi dòng DaXacNhan của đơn ("Phục vụ cả đơn") */
export type ServeOrderRequest = { itemIds?: string[] }
export type UnserveOrderRequest = { itemIds: string[] }
export type CancelOrderItemRequest = { quantity: number; reason: string }
export type CancelOrderRequest = { reason: string }
export type CreateStaffOrderRequest = {
  clientRequestId: string
  tableId: string
  guestName?: string
  note?: string
  lines: CartLineInput[]
}

// ============================================================ Phiên bàn, thu tiền (07 §2.9)

export type PaymentRequestBrief = {
  id: string
  method: PaymentMethod
  needVatInvoice: boolean
  createdAt: string
  status: ServiceRequestStatus
}

export type TableBoardItem = {
  tableId: string
  tableName: string
  zone: string
  capacity: number
  code: string
  isActive: boolean
  status: TableStatus
  session?: {
    id: string
    code: string
    status: SessionStatus
    openedAt: string
    orderCount: number // đơn không bị từ chối
    subtotal: number // tạm tính BR-11
    pendingOrderCount: number
    unservedCount: number
    paymentRequest?: PaymentRequestBrief // đang chờ
  }
  pendingRequestCount: number
}

export type SessionPaymentDto = {
  method: PaymentMethod
  total: number
  cashReceived?: number
  changeAmount?: number
  needVatInvoice: boolean
  closedAt: string
  closedByName: string
}

export type TableSessionDto = {
  id: string
  code: string // PB + yyMMdd + 4 số, số hóa đơn
  tableId: string
  tableName: string
  zone: string
  status: SessionStatus
  version: number // 07 §3.6
  openedAt: string
  closedAt?: string
  subtotal: number // BR-11
  pendingTotal: number // Σ total đơn ChoXacNhan (không tính vào tạm tính)
  orders: StaffOrderDto[] // theo giờ gửi tăng dần
  counts: { pendingOrders: number; unservedItems: number }
  paymentRequest?: PaymentRequestBrief
  payment?: SessionPaymentDto // khi DaDong
  requests: ServiceRequestDto[] // của phiên, mới nhất trước
  transferredFromTableName?: string
  asOf: string
}

export type TableSessionListItem = {
  id: string
  code: string
  tableName: string
  status: SessionStatus
  openedAt: string
  closedAt?: string
  total: number
  orderCount: number
  method?: PaymentMethod
  closedByName?: string
}

export type CheckoutRequest = {
  clientRequestId: string
  version: number
  method: PaymentMethod
  cashReceived?: number // bắt buộc với TienMat, ≥ tạm tính
  needVatInvoice?: boolean // mặc định lấy từ yêu cầu thanh toán
  acknowledgeUnserved?: boolean // nhân viên đã xác nhận cảnh báo "Còn {n} món chưa phục vụ"
}
export type CheckoutResultDto = { session: TableSessionDto; changeAmount: number; duplicate: boolean }
export type TransferSessionRequest = { targetTableId: string; version: number }

// ============================================================ Yêu cầu từ bàn (07 §2.10)

export type ServiceRequestDto = {
  id: string
  tableId: string
  tableName: string
  sessionId?: string
  sessionCode?: string
  type: ServiceRequestType
  reason?: CallReason
  note?: string
  paymentMethod?: PaymentMethod
  needVatInvoice: boolean
  reasonText: string // "Thêm đá", "Khác: …", "Thanh toán · Chuyển khoản · Cần HĐ GTGT"
  status: ServiceRequestStatus
  createdAt: string
  handledAt?: string
  handledByName?: string
  autoHandled: boolean
  waitMinutes: number
  isOverdue: boolean // DangCho và chờ ≥ 3 phút (BR-12)
}

// ============================================================ API công khai cho khách (07 §2.7)

export type PublicStoreInfo = {
  name: string
  tagline?: string
  logoUrl: string
  primaryColor: string
  address: string
  phone: string
  bankBin: string
  bankAccount: string
  bankAccountName: string
}

export type PublicTableInfo = {
  table: { name: string; zone: string; code: string; isActive: boolean }
  store: PublicStoreInfo
  ordering: OrderingStatus
  menuStamp: string
  asOf: string
}

export type PublicOptionGroup = {
  id: string
  name: string
  nameEn?: string
  selectionType: SelectionType
  isRequired: boolean
  maxSelect: number
  choices: { id: string; name: string; nameEn?: string; price: number; isDefault: boolean; isSoldOut: boolean }[]
}
export type PublicMenuItem = {
  id: string
  code: string
  categoryId: string
  name: string
  nameEn?: string
  description?: string
  descriptionEn?: string
  imageUrl?: string
  unit: string
  price: number
  tags: MenuTag[]
  optionGroupIds: string[]
  isSoldOut: boolean
}
export type PublicMenu = {
  stamp: string
  categories: { id: string; name: string; nameEn?: string; sortOrder: number }[]
  items: PublicMenuItem[]
  optionGroups: PublicOptionGroup[]
}

export type PublicOrderItemView = {
  itemName: string
  options: { groupName: string; name: string; price: number }[]
  quantity: number
  unitPrice: number
  lineTotal: number
  note?: string
  status: OrderItemStatus
  statusText?: string
}
export type PublicOrderView = {
  code: string
  source: OrderSource
  status: OrderStatus
  autoConfirmed: boolean
  guestName?: string
  note?: string
  submittedAt: string
  handledAt?: string
  rejectText?: string
  total: number
  isMine: boolean // gửi từ chính điện thoại này (X-Device-Id)
  items: PublicOrderItemView[]
}
export type PublicSessionView = {
  code: string
  status: SessionStatus
  openedAt: string
  closedAt?: string
  subtotal: number
  pendingTotal: number
  orders: PublicOrderView[] // mới nhất trước
  paymentRequest?: PaymentRequestBrief
  transferredToTableName?: string // BR-18
}
export type PublicServiceRequestView = {
  id: string
  type: ServiceRequestType
  reasonText: string
  status: ServiceRequestStatus
  createdAt: string
  handledAt?: string
}
export type PublicLiveState = {
  asOf: string
  table: { name: string; isActive: boolean }
  ordering: OrderingStatus
  menuStamp: string
  session: PublicSessionView | null // phiên đang mở của bàn
  endedSession?: PublicSessionView // phiên knownSession đã đóng/hủy/chuyển trong 4 giờ qua
  myRequests: PublicServiceRequestView[] // của điện thoại này trong 4 giờ qua, mới nhất trước
}

export type PublicSubmitOrderRequest = {
  clientRequestId: string
  deviceId: string
  guestName?: string // ≤ 30
  note?: string // ≤ 200
  lines: CartLineInput[]
}
export type PublicSubmitOrderResult = { order: PublicOrderView; sessionCode: string; duplicate: boolean }

export type PublicServiceRequestInput = {
  clientRequestId: string
  deviceId: string
  type: ServiceRequestType
  reason?: CallReason // bắt buộc với GoiNhanVien
  note?: string // bắt buộc khi Khac, ≤ 200
  paymentMethod?: PaymentMethod // bắt buộc với ThanhToan
  needVatInvoice?: boolean
}
export type PublicServiceRequestResult = { request: PublicServiceRequestView; duplicate: boolean }

/** Phần mở rộng của lỗi 409 GiaDaThayDoi */
export type PriceChange = { index: number; menuItemId: string; itemName: string; oldUnitPrice: number; newUnitPrice: number }

// ============================================================ Báo cáo (07 §2.11)

export type DashboardReport = {
  date: string
  asOf: string
  openSessions: number
  activeTables: number
  pendingOrders: number
  pendingRequests: number
  overdueRequests: number
  revenue: number
  closedSessions: number
  avgSessionValue: number
  avgConfirmMinutes?: number
  byHour: { hour: number; orders: number; revenue: number }[]
}
export type RevenueTotals = { revenue: number; sessionCount: number; orderCount: number; avgSessionValue: number }
export type RevenueReport = {
  from: string
  to: string
  totals: RevenueTotals
  previous: RevenueTotals & { from: string; to: string }
  revenueChangePercent?: number
  daily: (RevenueTotals & { date: string; previousRevenue: number })[]
}
export type ItemsReport = {
  totalRevenue: number
  items: {
    menuItemId: string
    code: string
    name: string
    categoryId: string
    categoryName: string
    quantity: number
    revenue: number
    share: number
  }[]
  problems: {
    menuItemId: string
    code: string
    name: string
    removedQty: number
    cancelledQty: number
    value: number
    reasons: { kind: 'BiBo' | 'DaHuy'; reasonText: string; quantity: number }[]
  }[]
  reasonSummary: { kind: 'BiBo' | 'DaHuy'; reasonText: string; lineCount: number; quantity: number; value: number }[]
}
export type OperationsReport = {
  orderCount: number
  customerOrders: number
  staffOrders: number
  selfOrderRate: number
  autoConfirmedOrders: number
  autoConfirmRate: number
  rejectedOrders: number
  rejectRate: number
  avgConfirmMinutes?: number
  avgRequestMinutes?: number
  requestCount: number
  rejectReasons: { reason: RejectReason; reasonText: string; count: number }[]
  byHour: { hour: number; orders: number }[]
  heatmap: { weekday: number; hour: number; orders: number }[] // weekday 1 = Thứ Hai … 7 = Chủ nhật
}

// ============================================================ Demo, thời gian thực (07 §2.12, §2.14)

export type GuestTableLink = { name: string; zone: string; code: string; status: TableStatus }

export type PosEventMap = {
  'order-submitted': { orderId: string; tableId: string; tableName: string; status: OrderStatus; autoConfirmed: boolean; source: OrderSource }
  'orders-changed': { orderIds: string[]; tableIds: string[] }
  'requests-changed': { requestIds: string[]; tableIds: string[]; newRequestIds: string[] }
  'tables-changed': { tableIds: string[] }
  'menu-changed': { menuItemIds: string[]; optionGroupIds: string[] }
  'ordering-changed': Record<string, never>
}
export type PosEventName = keyof PosEventMap

// ============================================================ Bản ghi mock-db (07 §4.8, không phải DTO)

export type CategoryRecord = Omit<CategoryDto, 'itemCount'> & { isDeleted?: boolean; createdAt: string; updatedAt?: string }
export type OptionChoiceRecord = {
  id: string
  name: string
  nameEn?: string
  price: number
  isDefault: boolean
  soldOutMode?: SoldOutMode
  soldOutUntil?: string
  sortOrder: number
  isDeleted?: boolean
}
export type OptionGroupRecord = Omit<OptionGroupDto, 'choices' | 'itemCount'> & {
  choices: OptionChoiceRecord[]
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}
export type MenuItemRecord = Omit<MenuItemDto, 'categoryName' | 'isSoldOut' | 'status' | 'everOrdered'> & {
  isDeleted?: boolean
  createdAt: string
}
export type DiningTableRecord = Omit<DiningTableDto, 'status' | 'currentSessionCode'> & {
  version: number
  isDeleted?: boolean
  updatedAt?: string
}
export type OrderItemRecord = Omit<OrderItemDto, 'statusText'> & { cancelledById?: string; removedAt?: string }
export type OrderRecord = {
  id: string
  code: string
  sessionId: string
  tableId: string
  tableName: string
  source: OrderSource
  status: OrderStatus
  autoConfirmed: boolean
  guestName?: string
  note?: string
  submittedAt: string
  handledAt?: string
  handledById?: string
  handledByName?: string
  rejectReason?: RejectReason
  rejectNote?: string
  deviceId?: string
  clientRequestId?: string
  cartKey?: string
  createdById?: string
  items: OrderItemRecord[]
  version: number
}
export type TableSessionRecord = {
  id: string
  code: string
  tableId: string
  tableName: string
  status: SessionStatus
  openedAt: string
  closedAt?: string
  total?: number // chốt khi DaDong
  paymentMethod?: PaymentMethod
  cashReceived?: number
  changeAmount?: number
  needVatInvoice: boolean
  closedById?: string
  closedByName?: string
  checkoutRequestId?: string
  transferredFromTableName?: string
  version: number
}
export type ServiceRequestRecord = {
  id: string
  tableId: string
  tableName: string
  sessionId?: string
  type: ServiceRequestType
  reason?: CallReason
  note?: string
  paymentMethod?: PaymentMethod
  needVatInvoice: boolean
  status: ServiceRequestStatus
  createdAt: string
  handledAt?: string
  handledById?: string
  handledByName?: string
  autoHandled: boolean
  deviceId?: string
  clientRequestId?: string
}
