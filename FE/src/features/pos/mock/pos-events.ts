/**
 * Phát sự kiện thời gian thực từ handler mock (07 §2.14): gọi sau khi ghi mock-db, cùng tên và payload như SignalR.
 * Ví dụ: publishPosEvent('menu-changed', { menuItemIds: [id], optionGroupIds: [] })
 */
export { publishPosEvent } from '@/lib/realtime'
