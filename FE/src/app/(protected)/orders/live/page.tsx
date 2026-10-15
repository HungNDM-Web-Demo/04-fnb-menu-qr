import type { Metadata } from 'next'
import { LiveOrdersPage } from '@/features/live/pages/LiveOrdersPage'

export const metadata: Metadata = { title: 'Nhận đơn' }

export default function Page() {
  return <LiveOrdersPage />
}
