'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'

/**
 * Giờ máy chủ ở FE (07 §3.5): now = Date.now() + (asOf − giờ máy lúc nhận), tính lại theo chu kỳ.
 */
type ClockState = { offset: number; setAsOf: (asOf: string | undefined) => void }

export const useServerClock = create<ClockState>((set) => ({
  offset: 0,
  setAsOf: (asOf) => {
    if (!asOf) return
    const t = new Date(asOf).getTime()
    if (Number.isFinite(t)) set({ offset: t - Date.now() })
  },
}))

/** Giờ máy chủ (ms), tự cập nhật mỗi `intervalMs` (mặc định 15 giây) */
export function useServerNow(intervalMs = 15_000): number {
  const offset = useServerClock((s) => s.offset)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now + offset
}

/** Ghi nhận asOf mới mỗi khi dữ liệu đổi */
export function useSyncAsOf(asOf: string | undefined) {
  const setAsOf = useServerClock((s) => s.setAsOf)
  useEffect(() => setAsOf(asOf), [asOf, setAsOf])
}
