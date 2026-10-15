/**
 * Chuỗi QR chuyển khoản giả lập (07 §3.9, FR-13, FR-23), như demo Quản lý Nhà hàng:
 * `VIETQR|{bankBin}|{bankAccount}|{số tiền}|{mã phiên}`; nội dung chuyển khoản là mã phiên PB….
 */
export function vietQrPayload(store: { bankBin: string; bankAccount: string }, amount: number, sessionCode: string): string {
  return `VIETQR|${store.bankBin}|${store.bankAccount}|${Math.round(amount)}|${sessionCode}`
}

/** Tên ngân hàng theo BIN (VietQR) */
const BANKS: Record<string, string> = {
  '970422': 'MB Bank',
  '970436': 'Vietcombank',
  '970415': 'VietinBank',
  '970418': 'BIDV',
  '970405': 'Agribank',
  '970407': 'Techcombank',
  '970416': 'ACB',
  '970432': 'VPBank',
  '970423': 'TPBank',
  '970403': 'Sacombank',
}

export const bankNameOf = (bin: string): string => BANKS[bin] ?? `Ngân hàng ${bin}`
