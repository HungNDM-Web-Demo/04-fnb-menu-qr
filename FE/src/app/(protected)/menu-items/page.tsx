import type { Metadata } from 'next'
import { MenuItemsPage } from '@/features/menu-items/pages/MenuItemsPage'

export const metadata: Metadata = { title: 'Thực đơn' }

export default function Page() {
  return <MenuItemsPage />
}
