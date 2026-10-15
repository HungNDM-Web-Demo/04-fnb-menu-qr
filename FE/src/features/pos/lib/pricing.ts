import type { OrderItemStatus, OrderStatus } from '@/types/menu-qr'

/**
 * Công thức tiền (07 §3.1–3.2, BR-03, BR-11). FE (giỏ, thẻ đơn, ngăn kéo) và handler mock dùng chung;
 * BE tính ở `OrderPricing`. Mọi số tiền là số nguyên đồng, không làm tròn.
 */

type PricedOption = { price: number }
type PricedLine = { unitPrice: number; quantity: number }
type StatusLine = PricedLine & { status: OrderItemStatus }
type StatusOrder = { status: OrderStatus; items: StatusLine[] }

/** Dòng còn hiệu lực: không bị bỏ, không bị hủy */
export const isEffectiveLine = (status: OrderItemStatus): boolean => status !== 'BiBo' && status !== 'DaHuy'

/** Σ giá lựa chọn */
export const optionsPrice = (options: PricedOption[]): number => options.reduce((sum, o) => sum + o.price, 0)

/** unitPrice = itemPrice + Σ giá lựa chọn (§3.1) */
export const unitPrice = (itemPrice: number, options: PricedOption[]): number => itemPrice + optionsPrice(options)

/** lineTotal = unitPrice × quantity (§3.1) */
export const lineTotal = (line: PricedLine): number => line.unitPrice * line.quantity

/** Tổng đơn = Σ lineTotal dòng không BiBo, không DaHuy (§3.2) */
export const orderTotal = (items: StatusLine[]): number =>
  items.filter((i) => isEffectiveLine(i.status)).reduce((sum, i) => sum + lineTotal(i), 0)

/** Tạm tính phiên = Σ lineTotal dòng DaXacNhan, DaPhucVu của đơn DaXacNhan, DaPhucVu (BR-11) */
export const sessionSubtotal = (orders: StatusOrder[]): number =>
  orders
    .filter((o) => o.status === 'DaXacNhan' || o.status === 'DaPhucVu')
    .flatMap((o) => o.items)
    .filter((i) => i.status === 'DaXacNhan' || i.status === 'DaPhucVu')
    .reduce((sum, i) => sum + lineTotal(i), 0)

/** Σ tổng đơn ChoXacNhan (chưa tính vào tạm tính, UC-03 E2) */
export const pendingTotal = (orders: StatusOrder[]): number =>
  orders.filter((o) => o.status === 'ChoXacNhan').reduce((sum, o) => sum + orderTotal(o.items), 0)
