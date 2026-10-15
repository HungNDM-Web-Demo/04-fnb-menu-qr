import { z } from 'zod'

/**
 * Schema form trang Thực đơn. Câu lỗi giống hệt 07 §2.2–§2.4 (BE và mock dùng cùng chữ)
 * để lỗi kiểm ở FE và lỗi API hiện cùng một câu.
 */

export const MENU_ITEM_CODE_PATTERN = /^M\d{3}$/
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
export const CATEGORY_CODE_PATTERN = /^[A-Z0-9]{2,10}$/
export const PRICE_STEP_MESSAGE = 'Giá phải là bội số 1.000 ₫'

const MENU_TAG_VALUES = ['BanChay', 'MonMoi', 'Cay', 'Chay'] as const

export const menuItemSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(MENU_ITEM_CODE_PATTERN, 'Mã món dạng M001'),
    name: z.string().trim().min(1, 'Nhập tên món').max(150, 'Tên món tối đa 150 ký tự'),
    nameEn: z.string().trim().max(150, 'Tên tiếng Anh tối đa 150 ký tự'),
    categoryId: z.string().min(1, 'Danh mục không tồn tại'),
    description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự'),
    descriptionEn: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự'),
    unit: z.string().trim().min(1, 'Nhập đơn vị tính').max(20, 'Đơn vị tối đa 20 ký tự'),
    price: z.number().nullable(),
    tags: z.array(z.enum(MENU_TAG_VALUES)),
    optionGroupIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.price === null || !(v.price > 0)) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Giá món phải lớn hơn 0' })
    } else if (v.price % 1000 !== 0) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: PRICE_STEP_MESSAGE })
    }
  })
export type MenuItemFormValues = z.infer<typeof menuItemSchema>

export const categorySchema = z.object({
  code: z.string().trim().toUpperCase().regex(CATEGORY_CODE_PATTERN, 'Mã danh mục gồm 2–10 chữ in hoa hoặc số'),
  name: z.string().trim().min(1, 'Nhập tên danh mục').max(100, 'Tên danh mục tối đa 100 ký tự'),
  nameEn: z.string().trim().max(100, 'Tên tiếng Anh tối đa 100 ký tự'),
  color: z.string().trim().regex(HEX_COLOR_PATTERN, 'Màu dạng #RRGGBB'),
  isHidden: z.boolean(),
})
export type CategoryFormValues = z.infer<typeof categorySchema>

const choiceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Nhập tên lựa chọn').max(50, 'Tên lựa chọn tối đa 50 ký tự'),
  nameEn: z.string().trim().max(50, 'Tên tiếng Anh tối đa 50 ký tự'),
  price: z.number().nullable(),
  isDefault: z.boolean(),
})

export const optionGroupSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên nhóm').max(50, 'Tên nhóm tối đa 50 ký tự'),
    nameEn: z.string().trim().max(50, 'Tên tiếng Anh tối đa 50 ký tự'),
    selectionType: z.enum(['ChonMot', 'ChonNhieu']),
    isRequired: z.boolean(),
    maxSelect: z.number().nullable(),
    choices: z.array(choiceSchema),
  })
  .superRefine((v, ctx) => {
    if (v.choices.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Thêm ít nhất 1 lựa chọn' })
    }
    v.choices.forEach((c, i) => {
      const p = c.price ?? 0
      if (p < 0 || p % 1000 !== 0) {
        ctx.addIssue({ code: 'custom', path: ['choices', i, 'price'], message: PRICE_STEP_MESSAGE })
      }
    })
    const defaults = v.choices.filter((c) => c.isDefault).length
    if (v.selectionType === 'ChonNhieu') {
      const m = v.maxSelect
      if (m === null || !Number.isInteger(m) || m < 1 || m > 10) {
        ctx.addIssue({ code: 'custom', path: ['maxSelect'], message: 'Số chọn tối đa từ 1 đến 10' })
      } else if (v.choices.length > 0 && m > v.choices.length) {
        ctx.addIssue({ code: 'custom', path: ['maxSelect'], message: 'Số chọn tối đa không lớn hơn số lựa chọn' })
      }
      if (defaults > 0) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Nhóm chọn nhiều không có lựa chọn mặc định' })
      }
    } else if (defaults > 1) {
      ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Chỉ chọn một lựa chọn mặc định' })
    }
  })
export type OptionGroupFormValues = z.infer<typeof optionGroupSchema>
