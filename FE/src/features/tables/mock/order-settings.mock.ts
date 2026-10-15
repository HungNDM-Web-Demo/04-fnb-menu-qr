import { permissions } from '@/config/permissions'
import { fieldErrors } from '@/features/pos/mock/pos.errors'
import { publishPosEvent } from '@/features/pos/mock/pos-events'
import { currentOrderingStatus, getStoreProfile, writeSettings } from '@/features/pos/mock/settings.store'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, requireSession } from '@/mock/mock-auth'
import type { OrderSettingsDto, PauseOrderingRequest, StoreProfile, UpdateOrderSettingsRequest } from '@/types/menu-qr'

/**
 * Handler mock cài đặt nhận đơn, thông tin quán (07 §2.6; UC-13, BR-07, BR-08): đọc, ghi `System_Settings`
 * qua `settings.store.ts`, phát `ordering-changed`.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const orderSettingsMock = {
  async get(): Promise<OrderSettingsDto> {
    await mockDelay(80, 150)
    requireSession()
    return currentOrderingStatus()
  },

  async update(input: UpdateOrderSettingsRequest): Promise<OrderSettingsDto> {
    await mockDelay()
    requirePermission(permissions.orderSettings.update)
    const errors: Record<string, string> = {}
    if (!TIME.test(input.openTime ?? '')) errors.openTime = 'Giờ dạng HH:mm'
    if (!TIME.test(input.closeTime ?? '')) errors.closeTime = 'Giờ dạng HH:mm'
    if (input.confirmMode !== 'ThuCong' && input.confirmMode !== 'TuXacNhan') errors.confirmMode = 'Chọn chế độ xác nhận'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    writeSettings({
      'Ordering.OpenTime': input.openTime,
      'Ordering.CloseTime': input.closeTime,
      'Ordering.ConfirmMode': input.confirmMode,
    })
    publishPosEvent('ordering-changed', {})
    return currentOrderingStatus()
  },

  /** Tạm ngưng 15/30 phút ghi thời điểm ISO UTC; null ghi "manual" (tới khi mở lại) */
  async pause(input: PauseOrderingRequest): Promise<OrderSettingsDto> {
    await mockDelay()
    requirePermission(permissions.orderSettings.update)
    const minutes = input?.minutes
    if (minutes !== null && minutes !== 15 && minutes !== 30) {
      throw fieldErrors({ minutes: 'Chọn 15 phút, 30 phút hoặc tới khi mở lại' })
    }
    writeSettings({
      'Ordering.PausedUntil': minutes === null ? 'manual' : new Date(Date.now() + minutes * 60_000).toISOString(),
    })
    publishPosEvent('ordering-changed', {})
    return currentOrderingStatus()
  },

  async resume(): Promise<OrderSettingsDto> {
    await mockDelay()
    requirePermission(permissions.orderSettings.update)
    writeSettings({ 'Ordering.PausedUntil': '' })
    publishPosEvent('ordering-changed', {})
    return currentOrderingStatus()
  },

  async storeProfile(): Promise<StoreProfile> {
    await mockDelay(50, 120)
    requireSession()
    return getStoreProfile()
  },
}
