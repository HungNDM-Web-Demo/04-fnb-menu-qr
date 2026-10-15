import { isApiError } from '@/lib/api-error'

/** Mã lỗi nghiệp vụ `code` trong ProblemDetails (07 §2.13) để giao diện rẽ nhánh, không so chuỗi */
export const errorCodeOf = (error: unknown): string | undefined =>
  isApiError(error) && typeof error.problem.code === 'string' ? error.problem.code : undefined

/** Trường mở rộng của lỗi (soldOutLines, priceChanges, order, currentVersion…) */
export function problemExtra<T>(error: unknown, key: string): T | undefined {
  return isApiError(error) ? (error.problem[key] as T | undefined) : undefined
}
