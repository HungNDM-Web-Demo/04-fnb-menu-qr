import { AppShell } from '@/components/shared/AppShell'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { LiveBell } from '@/features/live/components/LiveBell'
import { ConnectionBanner, RealtimeBridge } from '@/features/pos/components/RealtimeBridge'

/** Khu vực cần đăng nhập: sidebar + header + thanh công cụ demo (KIEN-TRUC-HE-THONG §6.4); thời gian thực 07 §2.14. */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RealtimeBridge />
      <AppShell headerActions={<LiveBell />} banner={<ConnectionBanner />}>
        {children}
      </AppShell>
    </AuthGuard>
  )
}
