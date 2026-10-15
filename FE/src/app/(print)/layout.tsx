import type { Metadata } from 'next'
import { PrintAuthGate } from '@/features/live/components/PrintAuthGate'

export const metadata: Metadata = { title: 'Bản in', robots: { index: false, follow: false } }

/** Bản in phiếu bếp, hóa đơn, mã QR (07 §2.15): cần đăng nhập, không sidebar; khổ giấy do từng trang đặt. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <PrintAuthGate>{children}</PrintAuthGate>
}
