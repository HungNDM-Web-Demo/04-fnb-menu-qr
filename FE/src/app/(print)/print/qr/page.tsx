import type { Metadata } from 'next'
import { QrPrintPage } from '@/features/tables/pages/QrPrintPage'

export const metadata: Metadata = { title: 'In mã QR' }

export default function Page() {
  return <QrPrintPage />
}
