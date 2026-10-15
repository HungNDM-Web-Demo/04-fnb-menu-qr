'use client'

import { create } from 'zustand'
import { readJson, storageKey, writeJson } from '@/lib/storage'

/**
 * Tùy chọn của thiết bị nhận đơn (07 §4.2 bước 6, §4.4): âm báo (`fnb-menu-qr:live-sound`, mặc định tắt vì trình
 * duyệt chặn tự phát), tự in phiếu bếp (`fnb-menu-qr:auto-print`, mặc định bật).
 */
const SOUND_KEY = storageKey('live-sound')
const AUTO_PRINT_KEY = storageKey('auto-print')
/** Đặt "1" để bản in không tự gọi window.print() (kiểm thử tự động) */
export const NO_AUTO_PRINT_KEY = storageKey('print.no-auto')

type LivePrefs = {
  sound: boolean
  autoPrint: boolean
  setSound: (on: boolean) => void
  setAutoPrint: (on: boolean) => void
}

export const useLivePrefs = create<LivePrefs>((set) => ({
  sound: typeof window !== 'undefined' && readJson<boolean>('local', SOUND_KEY) === true,
  autoPrint: typeof window === 'undefined' || readJson<boolean>('local', AUTO_PRINT_KEY) !== false,
  setSound: (sound) => {
    writeJson('local', SOUND_KEY, sound)
    set({ sound })
  },
  setAutoPrint: (autoPrint) => {
    writeJson('local', AUTO_PRINT_KEY, autoPrint)
    set({ autoPrint })
  },
}))

export const isAutoPrintBlocked = () => readJson<string | number>('local', NO_AUTO_PRINT_KEY)?.toString() === '1'

/**
 * Mở bản in phiếu bếp, hóa đơn bằng iframe ẩn (07 §2.15, quyết định 15): không mở tab mới, trang in tự gọi
 * window.print() trong iframe khi có `?auto=1`.
 */
export function printInFrame(url: string) {
  if (typeof document === 'undefined') return
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  frame.src = `${url}${url.includes('?') ? '&' : '?'}auto=1`
  document.body.appendChild(frame)
  window.setTimeout(() => frame.remove(), 120_000)
}
