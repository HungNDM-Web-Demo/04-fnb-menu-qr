import type { StatusTone } from '@/components/shared/StatusBadge'
import type { MenuItemStatus, MenuTag, SelectionType } from '@/types/menu-qr'

/** Nhãn và màu trạng thái món ở trang Thực đơn (07 §2.3: An > HetMon > DangBan) */
export const menuItemStatusView: Record<MenuItemStatus, { label: string; tone: StatusTone }> = {
  DangBan: { label: 'Đang bán', tone: 'success' },
  HetMon: { label: 'Hết món', tone: 'warning' },
  An: { label: 'Đang ẩn', tone: 'neutral' },
}
export const MENU_ITEM_STATUSES: MenuItemStatus[] = ['DangBan', 'HetMon', 'An']

export const selectionTypeLabels: Record<SelectionType, string> = { ChonMot: 'Chọn một', ChonNhieu: 'Chọn nhiều' }
export const MENU_TAGS: MenuTag[] = ['BanChay', 'MonMoi', 'Cay', 'Chay']

/** Đơn vị gợi ý trong form món */
export const UNIT_SUGGESTIONS = ['phần', 'đĩa', 'tô', 'nồi', 'ly', 'lon', 'chai'] as const

/** Lý do khóa nút Xóa món đã gọi (BR-16, TC-33), trùng câu lỗi `MonDaDuocGoi` */
export const EVER_ORDERED_MESSAGE = 'Món đã từng được gọi, không xóa được. Hãy dùng Ẩn'

/** Mô tả quy tắc nhóm tùy chọn: "Chọn một · bắt buộc", "Chọn nhiều · tối đa 2" */
export function describeGroup(g: { selectionType: SelectionType; isRequired: boolean; maxSelect: number }) {
  return g.selectionType === 'ChonMot'
    ? `Chọn một · ${g.isRequired ? 'bắt buộc' : 'không bắt buộc'}`
    : `Chọn nhiều · tối đa ${g.maxSelect}`
}
