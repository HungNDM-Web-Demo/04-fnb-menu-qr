import type {
  CallReason,
  ConfirmMode,
  MenuTag,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  RejectReason,
  RemoveReason,
  ServiceRequestStatus,
  SessionStatus,
  SoldOutMode,
  TableStatus,
} from '@/types/menu-qr'

/**
 * Chữ hiển thị của enum nghiệp vụ (docs/07-DANH-SACH-API.md §2), dùng chung FE-Khách và FE-Quản lý.
 * Trang khách dùng nhãn `guest*` khi câu cho khách khác câu cho nhân viên.
 */
export const menuTagLabels: Record<MenuTag, string> = { BanChay: 'Bán chạy', MonMoi: 'Món mới', Cay: 'Cay', Chay: 'Chay' }
export const soldOutModeLabels: Record<SoldOutMode, string> = { HetHomNay: 'Hết trong hôm nay', HetToiKhiMoLai: 'Hết tới khi mở lại' }
export const tableStatusLabels: Record<TableStatus, string> = { Trong: 'Trống', DangPhucVu: 'Đang phục vụ', ChoThanhToan: 'Chờ thanh toán', Tat: 'Tắt' }
export const sessionStatusLabels: Record<SessionStatus, string> = { DangPhucVu: 'Đang phục vụ', ChoThanhToan: 'Chờ thanh toán', DaDong: 'Đã đóng', DaHuy: 'Đã hủy' }
export const orderSourceLabels: Record<OrderSource, string> = { KhachQr: 'Khách tự gọi', NhanVien: 'Nhân viên' }
export const orderStatusLabels: Record<OrderStatus, string> = {
  ChoXacNhan: 'Chờ xác nhận',
  DaXacNhan: 'Đã xác nhận',
  DaPhucVu: 'Đã phục vụ',
  BiTuChoi: 'Bị từ chối',
  DaHuy: 'Đã hủy',
}
/** Trang khách: "Chờ quán xác nhận" (UC-02 bước 7, TC-06) */
export const guestOrderStatusLabels: Record<OrderStatus, string> = { ...orderStatusLabels, ChoXacNhan: 'Chờ quán xác nhận' }
export const orderItemStatusLabels: Record<OrderItemStatus, string> = {
  ChoXacNhan: 'Chờ xác nhận',
  DaXacNhan: 'Chờ phục vụ',
  BiBo: 'Bị bỏ',
  DaPhucVu: 'Đã phục vụ',
  DaHuy: 'Đã hủy',
}
export const removeReasonLabels: Record<RemoveReason, string> = { HetMon: 'Hết món', Khac: 'Khác' }
export const rejectReasonLabels: Record<RejectReason, string> = { BanKhongCoKhach: 'Bàn không có khách', DonTrung: 'Đơn trùng', HetMon: 'Hết món', Khac: 'Khác' }
export const callReasonLabels: Record<CallReason, string> = { ThemDa: 'Thêm đá', LayChenBat: 'Lấy chén bát', DonBan: 'Dọn bàn', TuVanMon: 'Tư vấn món', Khac: 'Khác' }
export const requestStatusLabels: Record<ServiceRequestStatus, string> = { DangCho: 'Đang chờ', DaXuLy: 'Đã xử lý', DaHuy: 'Đã hủy' }
export const paymentMethodLabels: Record<PaymentMethod, string> = { TienMat: 'Tiền mặt', ChuyenKhoan: 'Chuyển khoản' }
export const confirmModeLabels: Record<ConfirmMode, string> = { ThuCong: 'Thủ công', TuXacNhan: 'Tự xác nhận khi bàn đã có đơn được xác nhận' }
/** Lý do hủy món gợi ý cho quản lý (vẫn nhập tự do) */
export const cancelReasonSuggestions = ['Khách đổi ý', 'Lên món chậm, khách không dùng nữa', 'Gọi nhầm món', 'Món không đúng yêu cầu']
