import { stableId } from '@/mock/mock-helpers'
import { getSettingsMap, settingsDb, syncSeedEntries } from '@/mock/system-data'
import type { ConfirmMode, OrderingStatus, PublicStoreInfo, StoreProfile } from '@/types/menu-qr'
import { orderingStatus, type OrderingSettings } from '../lib/ordering-rules'
import { publishPosEvent } from './pos-events'

/**
 * Cài đặt nhận đơn và thông tin quán ở chế độ mock: đọc/ghi `settingsDb` của nền (06 §3, 07 §2.6).
 * Dùng chung cho handler `order-settings`, `store-profile` (FE-Quản lý) và API công khai, demo (FE-Khách).
 */

export function readOrderingSettings(): OrderingSettings {
  syncSeedEntries()
  const s = getSettingsMap()
  return {
    openTime: s['Ordering.OpenTime'] || '09:00',
    closeTime: s['Ordering.CloseTime'] || '22:00',
    confirmMode: (s['Ordering.ConfirmMode'] === 'ThuCong' ? 'ThuCong' : 'TuXacNhan') as ConfirmMode,
    pausedUntil: s['Ordering.PausedUntil'] ?? '',
  }
}

/** Trạng thái nhận đơn lúc này (07 §3.4) */
export const currentOrderingStatus = (now: number = Date.now()): OrderingStatus => orderingStatus(readOrderingSettings(), now)

/** Ghi các khóa cài đặt (thêm khóa nếu chưa có) */
export function writeSettings(values: Record<string, string>, groupName = 'Nhận đơn QR') {
  syncSeedEntries()
  for (const [key, value] of Object.entries(values)) {
    const existing = settingsDb.find((s) => s.key === key)
    if (existing) settingsDb.update(existing.id, { value })
    else settingsDb.insert({ id: stableId('setting', key), key, value, groupName })
  }
}

/** Nhận đơn cả ngày, bỏ tạm ngưng (POST /api/demo/ordering-all-day, 07 §2.12); phát `ordering-changed` */
export function setOrderingAllDay(): OrderingStatus {
  writeSettings({ 'Ordering.OpenTime': '00:00', 'Ordering.CloseTime': '00:00', 'Ordering.PausedUntil': '' })
  publishPosEvent('ordering-changed', {})
  return currentOrderingStatus()
}

export function getStoreProfile(): StoreProfile {
  syncSeedEntries()
  const s = getSettingsMap()
  return {
    name: s['Store.Name'] || 'Quán Vườn Dừa',
    tagline: s['Store.Tagline'] || undefined,
    address: s['Store.Address'] ?? '',
    phone: s['Store.Phone'] ?? '',
    taxCode: s['Store.TaxCode'] ?? '',
    receiptFooter: s['Store.ReceiptFooter'] ?? '',
    bankBin: s['Store.BankBin'] ?? '',
    bankAccount: s['Store.BankAccount'] ?? '',
    bankAccountName: s['Store.BankAccountName'] ?? '',
    logoUrl: s['Brand.LogoUrl'] || '/logo/logo-mark.svg',
    primaryColor: s['Brand.PrimaryColor'] || '#15803D',
  }
}

export function getPublicStoreInfo(): PublicStoreInfo {
  const p = getStoreProfile()
  return {
    name: p.name,
    tagline: p.tagline,
    logoUrl: p.logoUrl,
    primaryColor: p.primaryColor,
    address: p.address,
    phone: p.phone,
    bankBin: p.bankBin,
    bankAccount: p.bankAccount,
    bankAccountName: p.bankAccountName,
  }
}
