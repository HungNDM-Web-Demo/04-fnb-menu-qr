'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { routePath } from '@/config/route-path'
import { canAccessPath } from '@/config/routes'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth, useSyncCurrentUser } from '@/features/auth/hooks/use-auth'

/**
 * Bản in (07 §2.15): cần đăng nhập và đúng quyền theo `hidden.routes.ts`, không sidebar, không header.
 * Đang kiểm thì không vẽ gì (bản in mở trong iframe ẩn).
 */
export function PrintAuthGate({ children }: { children: React.ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth()
  const { can } = usePermissions()
  const router = useRouter()
  const pathname = usePathname()
  useSyncCurrentUser()
  const allowed = canAccessPath(pathname, can)
  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) router.replace(`${routePath.login}?redirect=${encodeURIComponent(pathname)}`)
    else if (!allowed) router.replace(routePath.forbidden)
  }, [hydrated, isAuthenticated, allowed, pathname, router])
  if (!hydrated || !isAuthenticated || !allowed) return null
  return <>{children}</>
}
