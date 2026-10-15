'use client'

import { createContext, useContext } from 'react'
import type { PublicLiveState, PublicMenu, PublicTableInfo } from '@/types/menu-qr'
import type { GuestLang } from '../lib/guest-storage'

export type GuestContextValue = {
  /** Mã bàn chữ hoa */
  code: string
  /** Điện thoại giả lập (07 §4.2), 1 = mặc định */
  phone: number
  deviceId: string
  cartKey: string
  lang: GuestLang
  setLang: (lang: GuestLang) => void
  info: PublicTableInfo
  menu?: PublicMenu
  menuLoading: boolean
  live?: PublicLiveState
  setKnownSession: (code: string | undefined) => void
  /** Đường dẫn trong trang khách, giữ `?phone` */
  href: (path?: '' | '/cart' | '/orders') => string
  /** Khung điện thoại trên màn hình rộng: phần tử chứa tấm trượt */
  container: HTMLElement | null
  /** Phần tử cuộn (null = window) */
  scrollEl: HTMLElement | null
  openCallStaff: () => void
}

export const GuestContext = createContext<GuestContextValue | null>(null)

export function useGuest(): GuestContextValue {
  const value = useContext(GuestContext)
  if (!value) throw new Error('useGuest phải nằm trong GuestShell')
  return value
}

/** Chữ theo ngôn ngữ khách chọn (P3): dùng `nameEn` khi có */
export const pickName = (lang: GuestLang, vi: string, en?: string) => (lang === 'en' && en ? en : vi)
