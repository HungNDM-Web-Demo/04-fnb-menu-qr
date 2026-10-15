import type { Metadata } from 'next'
import { GuestShell } from '@/features/guest/components/GuestShell'

/** Trang khách công khai (07 §4.1): không AuthGuard, không sidebar, không DemoToolbar, không lập chỉ mục. */
export const metadata: Metadata = {
  title: 'Menu gọi món',
  robots: { index: false, follow: false },
}

export default async function GuestLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tableCode: string }>
}) {
  const { tableCode } = await params
  return <GuestShell tableCode={tableCode}>{children}</GuestShell>
}
