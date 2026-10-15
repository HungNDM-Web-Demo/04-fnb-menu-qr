import type { Metadata } from 'next'
import { TablesPage } from '@/features/tables/pages/TablesPage'

export const metadata: Metadata = { title: 'Bàn và QR' }

export default function Page() {
  return <TablesPage />
}
