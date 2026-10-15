import { qrFileName, qrUrl } from '@/features/pos/lib/ordering-rules'

/** Mẫu in QR (07 §2.15, FR-33) */
export type QrLayout = 'A6' | 'Tem8' | 'A4x4'
export const QR_LAYOUTS: { value: QrLayout; label: string; hint: string; perPage: number }[] = [
  { value: 'A6', label: 'Thẻ dựng A6', hint: '1 mã mỗi trang A6, dựng trên bàn', perPage: 1 },
  { value: 'Tem8', label: 'Tem dán 8×8 cm', hint: '6 tem trên một tờ A4, cắt rời dán bàn', perPage: 6 },
  { value: 'A4x4', label: 'Tờ A4 4 mã', hint: '4 mã trên một tờ A4', perPage: 4 },
]
export const isQrLayout = (v: string | null): v is QrLayout => QR_LAYOUTS.some((l) => l.value === v)

/** Đường dẫn khách quét: `{publicBaseUrl}/t/{mã}` */
export const tableQrUrl = (code: string) => qrUrl(code)

/** Tải ảnh PNG mã QR của một bàn (UC-12 1a): mức sửa lỗi M, viền trắng 4 ô (NFR-05) */
export async function downloadQrPng(tableName: string, code: string) {
  const { default: QRCode } = await import('qrcode')
  const dataUrl = await QRCode.toDataURL(tableQrUrl(code), { width: 1024, margin: 4, errorCorrectionLevel: 'M' })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = qrFileName(tableName)
  document.body.appendChild(a)
  a.click()
  a.remove()
}
