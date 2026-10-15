import type { Metadata } from 'next'
import { ReceiptPrintPage } from '@/features/live/pages/PrintPages'

export const metadata: Metadata = { title: 'Hóa đơn' }

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ auto?: string }>
}) {
  const { sessionId } = await params
  const { auto } = await searchParams
  return <ReceiptPrintPage sessionId={sessionId} auto={auto === '1'} />
}
