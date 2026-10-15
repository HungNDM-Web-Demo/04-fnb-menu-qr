/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings;
 * docs/06-THIET-KE-CSDL.md §3, docs/07-DANH-SACH-API.md §2.6). Trang Cài đặt chung hiển thị khóa ngoài
 * nhóm Thương hiệu/Doanh nghiệp theo nhóm; mock gọi `validateProjectSettings` khi lưu, BE kiểm cùng quy tắc.
 * Nhóm "Nhận đơn QR" thường sửa ở Bàn và QR → Cài đặt nhận đơn (`/api/order-settings`).
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': { label: 'Tên quán', hint: 'Hiện ở đầu trang khách, bản in QR, hóa đơn' },
  'Store.Tagline': { label: 'Khẩu hiệu', hint: 'Dòng nhỏ dưới tên quán trên trang khách, có thể bỏ trống' },
  'Store.Address': { label: 'Địa chỉ', hint: 'In trên hóa đơn' },
  'Store.Phone': { label: 'Số điện thoại quán', hint: 'In trên hóa đơn' },
  'Store.TaxCode': { label: 'Mã số thuế', hint: 'In trên hóa đơn' },
  'Store.ReceiptFooter': { label: 'Lời chào cuối hóa đơn' },
  'Store.BankBin': { label: 'Mã ngân hàng (BIN)', hint: '6 chữ số theo VietQR, vd 970422' },
  'Store.BankAccount': { label: 'Số tài khoản nhận chuyển khoản', hint: 'Dùng cho QR chuyển khoản giả lập' },
  'Store.BankAccountName': { label: 'Tên chủ tài khoản', hint: 'Chữ in hoa không dấu' },
  'Ordering.OpenTime': { label: 'Giờ bắt đầu nhận đơn QR', hint: 'Dạng HH:mm, vd 09:00' },
  'Ordering.CloseTime': {
    label: 'Giờ kết thúc nhận đơn QR',
    hint: 'Dạng HH:mm. Bằng giờ bắt đầu: nhận đơn cả ngày; nhỏ hơn: nhận qua đêm',
  },
  'Ordering.ConfirmMode': {
    label: 'Chế độ xác nhận đơn',
    hint: 'ThuCong: mọi đơn chờ nhân viên; TuXacNhan: tự xác nhận khi bàn đã có đơn được xác nhận',
  },
  'Ordering.PausedUntil': {
    label: 'Tạm ngưng nhận đơn tới',
    hint: 'Để trống: đang nhận đơn; "manual": tới khi mở lại; hoặc thời điểm ISO UTC',
  },
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void current
  const errors: Record<number, string> = {}
  items.forEach(({ key, value }, i) => {
    const v = (value ?? '').trim()
    switch (key) {
      case 'Store.Name':
        if (!v) errors[i] = 'Nhập tên quán'
        break
      case 'Store.BankBin':
        if (!/^\d{6}$/.test(v)) errors[i] = 'Mã ngân hàng gồm 6 chữ số'
        break
      case 'Store.BankAccount':
        if (!/^\d{6,19}$/.test(v)) errors[i] = 'Số tài khoản gồm 6 đến 19 chữ số'
        break
      case 'Ordering.OpenTime':
      case 'Ordering.CloseTime':
        if (!TIME_RE.test(v)) errors[i] = 'Giờ dạng HH:mm'
        break
      case 'Ordering.ConfirmMode':
        if (v !== 'ThuCong' && v !== 'TuXacNhan') errors[i] = 'Chế độ là ThuCong hoặc TuXacNhan'
        break
      case 'Ordering.PausedUntil':
        if (v && v !== 'manual' && Number.isNaN(Date.parse(v))) errors[i] = 'Để trống, "manual" hoặc thời điểm ISO'
        break
    }
  })
  return errors
}
