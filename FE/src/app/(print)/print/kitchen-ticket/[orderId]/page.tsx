import type { Metadata } from 'next'
import { KitchenTicketPrintPage } from '@/features/live/pages/PrintPages'

export const metadata: Metadata = { title: 'Phiếu bếp' }

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { orderId } = await params
  const { auto } = await searchParams
  return <KitchenTicketPrintPage orderId={orderId} auto={auto === '1'} />
}
