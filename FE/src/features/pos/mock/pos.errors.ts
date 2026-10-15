import { ApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { PriceChange, StaffOrderDto } from '@/types/menu-qr'
import { messages } from '../lib/ordering-rules'

/**
 * Lỗi nghiệp vụ có `code` trong ProblemDetails (07 §2.13): FE rẽ nhánh theo `code`, hiển thị nguyên văn `detail`.
 * Lỗi theo trường: `errors` dạng { trường: [câu] }; chỉ một lỗi thì `detail` là chính câu đó.
 */

type Extra = Record<string, unknown>
type FieldErrors = Record<string, string>

const toErrors = (errors: FieldErrors) => Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]]))

/** 400 vi phạm nghiệp vụ có mã */
export function bizError(detail: string, code?: string, extra: Extra = {}, errors?: FieldErrors): ApiError {
  return ApiError.fromStatus(400, detail, { ...(code ? { code } : {}), ...extra, ...(errors ? { errors: toErrors(errors) } : {}) })
}

/** 409 có mã */
export function conflictError(detail: string, code?: string, extra: Extra = {}, errors?: FieldErrors): ApiError {
  return ApiError.fromStatus(409, detail, { ...(code ? { code } : {}), ...extra, ...(errors ? { errors: toErrors(errors) } : {}) })
}

/** 400 lỗi theo trường; một lỗi thì detail = câu đó */
export function fieldErrors(errors: FieldErrors): ApiError {
  const values = Object.values(errors)
  return ApiError.fromStatus(400, values.length === 1 ? values[0] : 'Dữ liệu chưa hợp lệ.', { errors: toErrors(errors) })
}

/** Số tiền trong câu lỗi: "68.000 ₫" (khoảng trắng thường như BE) */
export const money = (n: number) => formatVnd(n).replace(/ /g, ' ')

export const PosErrors = {
  invalidQr: () =>
    ApiError.fromStatus(404, 'Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên', { code: 'MaQrKhongHopLe' }),
  tableInactive: () => bizError(messages.tableInactive, 'BanTamNgung'),
  storePaused: (message: string) => bizError(message, 'QuanTamNgung'),
  outsideHours: (message: string) => bizError(message, 'NgoaiGioNhanDon'),
  soldOut: (soldOutLines: number[], errors: FieldErrors) =>
    bizError('Có món vừa hết, vui lòng xóa khỏi giỏ rồi gửi lại', 'MonVuaHet', { soldOutLines }, errors),
  priceChanged: (priceChanges: PriceChange[]) =>
    conflictError('Giá đã thay đổi, vui lòng kiểm tra giỏ món rồi gửi lại', 'GiaDaThayDoi', { priceChanges }),
  tooManyPending: () => bizError('Bàn đang có 3 đơn chờ quán xác nhận, vui lòng chờ', 'QuaSoDonCho'),
  noConfirmedItems: () => bizError('Chưa có món được quán xác nhận', 'ChuaCoMonXacNhan'),
  orderHandled: (order: StaffOrderDto) =>
    conflictError(
      order.autoConfirmed ? 'Đơn đã được tự xác nhận' : `Đơn đã được ${order.handledByName ?? 'nhân viên khác'} xử lý`,
      'DonDaXuLy',
      { order }
    ),
  orderMustKeepItem: () => bizError('Đơn phải còn ít nhất 1 món, bỏ hết thì dùng Từ chối', 'DonPhaiConMon'),
  orderNotConfirmed: () => bizError('Đơn chưa được xác nhận', 'DonChuaXacNhan'),
  orderNotServable: () => bizError('Đơn đã bị từ chối hoặc đã hủy', 'DonKhongPhucVuDuoc'),
  itemNotServed: () => bizError('Món chưa phục vụ, không hoàn tác được', 'MonChuaPhucVu'),
  undoExpired: () => bizError('Hết thời gian hoàn tác', 'HetThoiGianHoanTac'),
  itemNotCancellable: () => bizError('Món đã bị bỏ hoặc đã hủy', 'MonKhongHuyDuoc'),
  sessionClosed: () => bizError('Phiên bàn đã đóng', 'PhienDaDong'),
  staleVersion: (currentVersion: number) =>
    conflictError('Phiên bàn vừa thay đổi, đang tải lại', 'DuLieuCu', { currentVersion }),
  pendingOrders: (pendingCount: number) =>
    bizError(`Còn ${pendingCount} đơn chờ xác nhận`, 'ConDonChoXacNhan', { pendingCount }),
  unservedItems: (unservedCount: number) =>
    bizError(`Còn ${unservedCount} món chưa phục vụ`, 'ConMonChuaPhucVu', { unservedCount }),
  cashShort: (short: number) =>
    bizError(`Còn thiếu ${money(short)}`, 'TienKhachDuaThieu', {}, { cashReceived: `Còn thiếu ${money(short)}` }),
  tableBusy: () => bizError('Bàn đang có khách', 'BanDangCoKhach'),
  tableOff: () => bizError('Bàn đang tắt, bật bàn trước khi gọi món', 'BanDangTat'),
  invalidTransferTarget: () => bizError('Chỉ chuyển sang bàn đang trống và đang bật', 'BanDichKhongHopLe'),
  menuItemOrdered: () => bizError('Món đã từng được gọi, không xóa được. Hãy dùng Ẩn', 'MonDaDuocGoi'),
  categoryHasItems: (itemCount: number) =>
    bizError(`Danh mục đang có ${itemCount} món, chuyển món sang danh mục khác trước`, 'DanhMucConMon', { itemCount }),
  groupInUse: (itemCount: number) =>
    bizError(`Nhóm tùy chọn đang gắn với ${itemCount} món, gỡ khỏi món trước`, 'NhomDangDung', { itemCount }),
  requestCancelled: () => bizError('Yêu cầu đã hủy', 'YeuCauDaHuy'),
}
