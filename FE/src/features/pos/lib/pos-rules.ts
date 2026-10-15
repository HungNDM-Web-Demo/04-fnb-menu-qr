/** Hằng số nghiệp vụ (06 §3, BE `PosRules`): BE và FE cùng giá trị. */
export const PosRules = {
  /** Tối đa dòng mỗi đơn (BR-06) */
  maxLinesPerOrder: 30,
  /** Số lượng mỗi dòng 1–20 (BR-03) */
  maxQuantity: 20,
  maxLineNote: 100,
  maxOrderNote: 200,
  maxGuestName: 30,
  maxRequestNote: 200,
  /** Đơn chờ xác nhận tối đa mỗi bàn (BR-06) */
  maxPendingOrders: 3,
  /** Cùng điện thoại gửi lại cùng giỏ trong 10 giây → đơn cũ (BR-06) */
  sameCartSeconds: 10,
  /** Gọi nhân viên cùng lý do trong 60 giây → yêu cầu cũ (BR-12) */
  callRepeatSeconds: 60,
  /** Yêu cầu chờ từ 3 phút → đỏ (BR-12) */
  requestOverdueMinutes: 3,
  /** Đơn chờ xác nhận: vàng 5, đỏ 10 phút (BR-09) */
  pendingWarnMinutes: 5,
  pendingLateMinutes: 10,
  /** Đơn chờ phục vụ: vàng 15, đỏ 25 phút (07 §5 quyết định 13) */
  servingWarnMinutes: 15,
  servingLateMinutes: 25,
  /** Giỏ giữ 4 giờ (BR-05) */
  cartTtlHours: 4,
  /** Hoàn tác "Đã phục vụ": máy chủ 60 giây, nút hiện 10 giây */
  unserveSeconds: 60,
  unserveButtonSeconds: 10,
  /** Khách xem phiên vừa kết thúc, yêu cầu của mình trong 4 giờ */
  endedSessionHours: 4,
  /** Trang khách hỏi lại mỗi 5 giây (07 §5 quyết định 7) */
  guestPollMs: 5_000,
} as const

/** Bảng ký tự mã bàn (BR-01): A–Z bỏ O, I, L và 2–9 */
export const TABLE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const TABLE_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/
