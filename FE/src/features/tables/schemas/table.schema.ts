import { z } from 'zod'

/** Câu lỗi khớp 07 §2.5, §2.6 */
export const tableSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên bàn').max(30, 'Tên bàn tối đa 30 ký tự'),
  zone: z.string().trim().min(1, 'Nhập khu vực').max(50, 'Khu vực tối đa 50 ký tự'),
  capacity: z
    .number({ error: 'Sức chứa từ 1 đến 20' })
    .int('Sức chứa từ 1 đến 20')
    .min(1, 'Sức chứa từ 1 đến 20')
    .max(20, 'Sức chứa từ 1 đến 20'),
})
export type TableFormValues = z.infer<typeof tableSchema>

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const orderSettingsSchema = z.object({
  openTime: z.string().regex(TIME_PATTERN, 'Giờ dạng HH:mm'),
  closeTime: z.string().regex(TIME_PATTERN, 'Giờ dạng HH:mm'),
  confirmMode: z.enum(['ThuCong', 'TuXacNhan'], { error: 'Chọn chế độ xác nhận' }),
})
export type OrderSettingsFormValues = z.infer<typeof orderSettingsSchema>
