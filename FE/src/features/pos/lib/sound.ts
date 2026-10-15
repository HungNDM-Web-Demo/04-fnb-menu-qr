'use client'

/**
 * Âm báo tạo bằng Web Audio (không cần file âm thanh). Trình duyệt chặn tự phát âm thanh
 * tới khi người dùng chạm vào trang: màn bếp có nút "Bật âm thanh" lần đầu (07 §4).
 */

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  return context
}

/** Gọi trong sự kiện chạm/bấm để mở khóa âm thanh. Trả true nếu đã phát được. */
export async function unlockSound(): Promise<boolean> {
  const ctx = getContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx.state === 'running'
  } catch {
    return false
  }
}

export const isSoundUnlocked = () => context?.state === 'running'

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain = 0.18) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/** "ticket": phiếu mới ở bếp (3 nốt đi lên); "ready": món xong ở phục vụ (2 nốt); "alert": báo hết món */
export function playSound(kind: 'ticket' | 'ready' | 'alert' = 'ticket') {
  const ctx = getContext()
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  if (kind === 'ticket') {
    tone(ctx, 784, t, 0.18)
    tone(ctx, 988, t + 0.16, 0.18)
    tone(ctx, 1318, t + 0.32, 0.3)
  } else if (kind === 'ready') {
    tone(ctx, 880, t, 0.2)
    tone(ctx, 1175, t + 0.18, 0.32)
  } else {
    tone(ctx, 440, t, 0.25, 0.22)
    tone(ctx, 349, t + 0.25, 0.35, 0.22)
  }
}
