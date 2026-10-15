# Danh sách API — Menu QR Gọi món

> Base URL dev: `https://localhost:7104` · Swagger: `https://localhost:7104/swagger` · SignalR: `https://localhost:7104/hubs/pos`
> Demo công khai (chế độ `mock`, không có BE): `https://pum-menu-qr.vercel.app`.
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này là **hợp đồng giữa BE và FE**: BE (`Application/DTOs`) và FE (`FE/src/types/menu-qr.ts`, chép đúng các khối `ts` dưới đây) phải khớp từng trường. Ở chế độ `mock`, handler trả đúng các kiểu này, áp đúng quy tắc ở §3 và câu lỗi ở §2.13. Bảng, enum, dữ liệu mẫu: `06-THIET-KE-CSDL.md`.

---

## 1. Mã quyền nghiệp vụ

Đúng `02-SRS.md` §7; các mã ghép `create / update / delete` tách thành từng mã. `ADMIN` luôn đủ quyền. Khai báo trong `FE/src/mock/seed/project.json` (đã có), `Application/Constants/Permissions.cs`, FE `config/permissions.ts` (đã có).

| Nhóm | Mã quyền | Tên hiển thị | ADMIN | MANAGER | STAFF |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Thực đơn | `menu-items.view` | Xem thực đơn | ✓ | ✓ | ✓ |
| Thực đơn | `menu-items.create` | Thêm danh mục, món, nhóm tùy chọn | ✓ | ✓ | |
| Thực đơn | `menu-items.update` | Sửa, ẩn, sắp xếp thực đơn | ✓ | ✓ | |
| Thực đơn | `menu-items.delete` | Xóa món chưa gọi, danh mục trống, nhóm tùy chọn chưa dùng | ✓ | ✓ | |
| Thực đơn | `menu-items.availability` | Báo hết món, hết lựa chọn, bán lại | ✓ | ✓ | ✓ |
| Bàn và QR | `tables.view` | Xem trang Bàn và QR | ✓ | ✓ | |
| Bàn và QR | `tables.create` | Thêm bàn | ✓ | ✓ | |
| Bàn và QR | `tables.update` | Sửa, bật tắt bàn, đổi mã QR | ✓ | ✓ | |
| Bàn và QR | `tables.delete` | Xóa bàn | ✓ | ✓ | |
| Bàn và QR | `tables.print-qr` | In, tải mã QR | ✓ | ✓ | |
| Bàn và QR | `order-settings.update` | Giờ nhận đơn, chế độ xác nhận, tạm ngưng nhận đơn | ✓ | ✓ | |
| Nhận đơn | `orders.view` | Xem màn hình nhận đơn | ✓ | ✓ | ✓ |
| Nhận đơn | `orders.confirm` | Xác nhận, bỏ món, từ chối đơn | ✓ | ✓ | ✓ |
| Nhận đơn | `orders.serve` | Đánh dấu đã phục vụ | ✓ | ✓ | ✓ |
| Nhận đơn | `orders.create` | Gọi món hộ khách | ✓ | ✓ | ✓ |
| Nhận đơn | `orders.cancel` | Hủy món, hủy đơn đã xác nhận | ✓ | ✓ | |
| Yêu cầu từ bàn | `service-requests.view` | Xem yêu cầu từ bàn | ✓ | ✓ | ✓ |
| Yêu cầu từ bàn | `service-requests.update` | Xử lý yêu cầu từ bàn | ✓ | ✓ | ✓ |
| Phiên bàn | `table-sessions.view` | Xem tab Bàn, chi tiết phiên bàn | ✓ | ✓ | ✓ |
| Phiên bàn | `table-sessions.checkout` | Thu tiền, in hóa đơn, đóng phiên | ✓ | ✓ | ✓ |
| Phiên bàn | `table-sessions.transfer` | Chuyển bàn | ✓ | ✓ | ✓ |
| Báo cáo | `reports.view` | Xem tổng quan, báo cáo | ✓ | ✓ | |

Quyền nền `dashboard.view` có sẵn ở cả `MANAGER` và `STAFF` trong `system.json` (dự án không gỡ được). Vì vậy trang Tổng quan `/dashboard` và `GET /api/reports/dashboard` gắn `reports.view`, không dùng `dashboard.view` (§5 quyết định 1). Trang khách `/t/*` và API `/api/public/*` không cần quyền (§2.7).

---

## 2. API nghiệp vụ

Bảng tra enum dùng chung (chuỗi PascalCase, khớp `06` §4):

```ts
type MenuTag = 'BanChay' | 'MonMoi' | 'Cay' | 'Chay'
type SelectionType = 'ChonMot' | 'ChonNhieu'
type SoldOutMode = 'HetHomNay' | 'HetToiKhiMoLai'
type MenuItemStatus = 'DangBan' | 'HetMon' | 'An'
type TableStatus = 'Trong' | 'DangPhucVu' | 'ChoThanhToan' | 'Tat'
type SessionStatus = 'DangPhucVu' | 'ChoThanhToan' | 'DaDong' | 'DaHuy'
type OrderSource = 'KhachQr' | 'NhanVien'
type OrderStatus = 'ChoXacNhan' | 'DaXacNhan' | 'DaPhucVu' | 'BiTuChoi' | 'DaHuy'
type OrderItemStatus = 'ChoXacNhan' | 'DaXacNhan' | 'BiBo' | 'DaPhucVu' | 'DaHuy'
type RemoveReason = 'HetMon' | 'Khac'
type RejectReason = 'BanKhongCoKhach' | 'DonTrung' | 'HetMon' | 'Khac'
type ServiceRequestType = 'GoiNhanVien' | 'ThanhToan'
type CallReason = 'ThemDa' | 'LayChenBat' | 'DonBan' | 'TuVanMon' | 'Khac'
type ServiceRequestStatus = 'DangCho' | 'DaXuLy' | 'DaHuy'
type PaymentMethod = 'TienMat' | 'ChuyenKhoan'
type ConfirmMode = 'ThuCong' | 'TuXacNhan'
type WaitLevel = 'BinhThuong' | 'Vang' | 'Do'
```

Chữ hiển thị đặt sẵn ở `FE/src/config/menu-qr-labels.ts`. Trang khách hiện `ChoXacNhan` là "Chờ quán xác nhận" (TC-06); nhân viên thấy `OrderItemStatus.DaXacNhan` là "Chờ phục vụ". BE trả thêm các trường chữ đã ghép (`reasonText`, `statusText`, `rejectText`) theo đúng quy tắc: dòng bị bỏ "Không phục vụ được: {Hết món | ghi chú}" (lý do `Khac` dùng ghi chú); dòng hủy "Đã hủy: {lý do}"; từ chối "{tên lý do}" hoặc "Khác: {ghi chú}"; yêu cầu gọi nhân viên "{tên lý do}" hoặc "Khác: {ghi chú}", thanh toán "Thanh toán · {Tiền mặt | Chuyển khoản}" thêm " · Cần HĐ GTGT".

Tham số ngày `from`, `to` dạng `yyyy-MM-dd`, hiểu theo giờ Việt Nam (00:00 `from` đến 23:59:59 `to`). Khoảng dài hơn 366 ngày → 400 `errors.from` "Khoảng ngày tối đa 366 ngày"; `to` nhỏ hơn `from` → 400 `errors.to` "Ngày kết thúc phải sau ngày bắt đầu".

Thao tác đổi đơn, phiên trả **200 kèm DTO mới** (không 204) để FE thay cache ngay. Mọi DTO có `asOf` là giờ máy chủ để FE tính đồng hồ chờ (§3.5).

### 2.1. Thực đơn gộp — `/api/menu`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/menu` | `orders.create` hoặc `menu-items.view` | Danh mục, món, nhóm tùy chọn chưa ẩn trong một lần gọi → `MenuBundle`; dùng cho Gọi món hộ (SCR-07). Món hết vẫn trả để hiện mờ |

```ts
type MenuBundle = {
  categories: CategoryDto[]        // chưa ẩn, theo sortOrder
  items: MenuItemDto[]             // chưa ẩn, thuộc danh mục chưa ẩn, theo (thứ tự danh mục, sortOrder)
  optionGroups: OptionGroupDto[]   // nhóm được các món trong items dùng
}
```

### 2.2. Danh mục — `/api/categories`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/categories` | `menu-items.view` | Tất cả (kể cả ẩn), theo `sortOrder` → `CategoryDto[]` |
| POST | `/api/categories` | `menu-items.create` | → `CategoryDto` (201), thêm cuối danh sách |
| PUT | `/api/categories/{id}` | `menu-items.update` | Tên, màu, ẩn/hiện → `CategoryDto` |
| PUT | `/api/categories/order` | `menu-items.update` | `ReorderRequest` đủ mọi danh mục theo thứ tự mới, đánh lại 10, 20, 30… → 204; thiếu, thừa id → 400 `errors.ids` "Danh sách sắp xếp không đầy đủ" |
| DELETE | `/api/categories/{id}` | `menu-items.delete` | Không còn món → 204; còn món → 400 `DanhMucConMon` kèm `itemCount` |

```ts
type CategoryDto = {
  id: string; code: string; name: string; nameEn?: string
  color: string                    // #RRGGBB
  sortOrder: number; isHidden: boolean
  itemCount: number                // món chưa xóa, kể cả ẩn
}
type SaveCategoryRequest = { code: string; name: string; nameEn?: string; color: string; isHidden: boolean }
type ReorderRequest = { ids: string[] }
```

Lỗi: `code` sai dạng → `errors.code` "Mã danh mục gồm 2–10 chữ in hoa hoặc số"; trùng → 409 `errors.code` "Mã danh mục đã tồn tại"; `name` trống → `errors.name` "Nhập tên danh mục"; `color` sai → `errors.color` "Màu dạng #RRGGBB".

### 2.3. Món — `/api/menu-items`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/menu-items?page&pageSize&search&categoryId&status` | `menu-items.view` | `search` theo mã, tên (không dấu); mặc định sắp theo (thứ tự danh mục, `sortOrder`) → `PaginatedResult<MenuItemDto>` |
| GET | `/api/menu-items/{id}` | `menu-items.view` | → `MenuItemDto` |
| POST | `/api/menu-items` | `menu-items.create` | → `MenuItemDto` (201) |
| PUT | `/api/menu-items/{id}` | `menu-items.update` | → `MenuItemDto`; đơn đã gửi giữ giá cũ (UC-09 3a); phát `menu-changed` |
| PATCH | `/api/menu-items/{id}/availability` | `menu-items.availability` | `SetAvailabilityRequest` → 204; phát `menu-changed` (UC-10) |
| PATCH | `/api/menu-items/{id}/hidden` | `menu-items.update` | `SetHiddenRequest` → 204; phát `menu-changed` |
| POST | `/api/menu-items/{id}/image` | `menu-items.update` | Multipart field `file`, JPG/PNG/WebP tối đa 2 MB → 200 `{ imageUrl }` |
| PUT | `/api/menu-items/order` | `menu-items.update` | `{ categoryId, ids }` đủ món của danh mục → 204 |
| DELETE | `/api/menu-items/{id}` | `menu-items.delete` | Chưa từng gọi → 204; đã gọi → 400 `MonDaDuocGoi` (BR-16, TC-33) |

```ts
type MenuItemDto = {
  id: string; code: string; name: string; nameEn?: string
  categoryId: string; categoryName: string
  imageUrl?: string; description?: string; descriptionEn?: string
  unit: string                     // "phần", "đĩa", "lon"…
  price: number
  tags: MenuTag[]
  optionGroupIds: string[]         // theo thứ tự hiển thị
  isHidden: boolean
  soldOutMode?: SoldOutMode; soldOutUntil?: string
  isSoldOut: boolean               // hết hiệu lực của món, hoặc nhóm bắt buộc hết mọi lựa chọn (§3.8)
  status: MenuItemStatus           // An > HetMon > DangBan
  sortOrder: number
  everOrdered: boolean             // đã có trong Pos_OrderItems → FE khóa Xóa, gợi ý Ẩn
  updatedAt: string
}
type SaveMenuItemRequest = {
  code: string                     // ^M\d{3}$
  name: string; nameEn?: string
  categoryId: string
  description?: string; descriptionEn?: string   // ≤ 500
  unit: string
  price: number
  tags: MenuTag[]
  optionGroupIds: string[]
  sortOrder?: number               // bỏ trống khi tạo → cuối danh mục
}
type SetAvailabilityRequest = { isSoldOut: boolean; mode?: SoldOutMode }   // isSoldOut = true thì bắt buộc mode
type SetHiddenRequest = { isHidden: boolean }
```

Lỗi (400 trừ khi ghi khác; thứ tự: định dạng → tham chiếu → trùng mã): `code` sai dạng → `errors.code` "Mã món dạng M001"; trùng → 409 `errors.code` "Mã món đã tồn tại" (UC-09 E1); `name` trống → `errors.name` "Nhập tên món"; `price` ≤ 0 → `errors.price` "Giá món phải lớn hơn 0"; không bội số 1.000 → `errors.price` "Giá phải là bội số 1.000 ₫" (UC-09 E2); `unit` trống → `errors.unit` "Nhập đơn vị tính"; `categoryId` không có → `errors.categoryId` "Danh mục không tồn tại"; `optionGroupIds` có id lạ → `errors.optionGroupIds` "Nhóm tùy chọn không tồn tại"; thiếu `mode` khi báo hết → `errors.mode` "Chọn Hết trong hôm nay hoặc Hết tới khi mở lại". Báo hết: `HetHomNay` ghi `soldOutUntil` = 00:00 ngày mai giờ Việt Nam; bán lại xóa cả hai cột.

### 2.4. Nhóm tùy chọn — `/api/option-groups`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/option-groups` | `menu-items.view` | Tất cả nhóm chưa xóa kèm lựa chọn chưa xóa, theo `sortOrder` → `OptionGroupDto[]` |
| POST | `/api/option-groups` | `menu-items.create` | `SaveOptionGroupRequest` → `OptionGroupDto` (201) |
| PUT | `/api/option-groups/{id}` | `menu-items.update` | Thay cả bộ lựa chọn: có `id` thì sửa, không có thì thêm, vắng mặt thì xóa mềm → `OptionGroupDto`; phát `menu-changed` |
| PATCH | `/api/option-groups/{id}/choices/{choiceId}/availability` | `menu-items.availability` | `SetAvailabilityRequest` → 204; áp cho mọi món dùng nhóm (FR-30, TC-35) |
| DELETE | `/api/option-groups/{id}` | `menu-items.delete` | Không món nào dùng → 204; còn món → 400 `NhomDangDung` kèm `itemCount` |

```ts
type OptionChoiceDto = {
  id: string; name: string; nameEn?: string
  price: number                    // giá cộng thêm, bội số 1.000, ≥ 0
  isDefault: boolean
  isSoldOut: boolean; soldOutMode?: SoldOutMode; soldOutUntil?: string
  sortOrder: number
}
type OptionGroupDto = {
  id: string; name: string; nameEn?: string
  selectionType: SelectionType
  isRequired: boolean              // luôn false với ChonNhieu
  maxSelect: number                // ChonMot luôn 1
  sortOrder: number
  choices: OptionChoiceDto[]
  itemCount: number                // món chưa xóa đang gắn nhóm
}
type SaveOptionGroupRequest = {
  name: string; nameEn?: string
  selectionType: SelectionType
  isRequired: boolean
  maxSelect: number
  choices: { id?: string; name: string; nameEn?: string; price: number; isDefault: boolean }[]
}
```

BE chuẩn hóa: `ChonMot` lưu `maxSelect = 1`; `ChonNhieu` lưu `isRequired = false`. Lỗi: `name` trống → `errors.name` "Nhập tên nhóm"; không có lựa chọn → `errors.choices` "Thêm ít nhất 1 lựa chọn"; `errors["choices[i].name"]` "Nhập tên lựa chọn"; giá âm hoặc lẻ → `errors["choices[i].price"]` "Giá phải là bội số 1.000 ₫" (TC-33); `ChonNhieu` có `maxSelect` ngoài 1–10 → `errors.maxSelect` "Số chọn tối đa từ 1 đến 10", lớn hơn số lựa chọn → "Số chọn tối đa không lớn hơn số lựa chọn" (UC-09 E3); nhiều mặc định → `errors.choices` "Chỉ chọn một lựa chọn mặc định"; mặc định trong `ChonNhieu` → `errors.choices` "Nhóm chọn nhiều không có lựa chọn mặc định".

### 2.5. Bàn và mã QR — `/api/tables`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/tables` | `tables.view` | Bàn chưa xóa, theo khu (thứ tự `sortOrder` nhỏ nhất của khu) rồi `sortOrder` → `DiningTableDto[]` |
| GET | `/api/tables/{id}` | `tables.view` | → `DiningTableDto` |
| POST | `/api/tables` | `tables.create` | Cấp mã 6 ký tự theo BR-01 → `DiningTableDto` (201) (TC-37) |
| PUT | `/api/tables/{id}` | `tables.update` | Tên, khu, sức chứa; mã giữ nguyên (UC-11 1a) → `DiningTableDto` |
| PATCH | `/api/tables/{id}/active` | `tables.update` | `SetTableActiveRequest` → 204; bàn có phiên mở → 400 `BanDangCoKhach` (TC-39) |
| POST | `/api/tables/{id}/regenerate-code` | `tables.update` | Đổi mã QR, mã cũ hết hiệu lực ngay (FR-32, TC-38) → `DiningTableDto`; bàn có phiên mở → 400 `BanDangCoKhach` |
| DELETE | `/api/tables/{id}` | `tables.delete` | Xóa mềm → 204; bàn có phiên mở → 400 `BanDangCoKhach` |

```ts
type DiningTableDto = {
  id: string; name: string; zone: string; capacity: number
  code: string                     // mã bàn trong QR
  codeChangedAt?: string
  isActive: boolean; sortOrder: number
  status: TableStatus              // suy ra (06 §4)
  currentSessionId?: string; currentSessionCode?: string
  createdAt: string
}
type SaveTableRequest = { name: string; zone: string; capacity: number; sortOrder?: number }
type SetTableActiveRequest = { isActive: boolean }
```

Lỗi: `name` trống → `errors.name` "Nhập tên bàn"; trùng → 409 `errors.name` "Tên bàn đã tồn tại"; `zone` trống → `errors.zone` "Nhập khu vực"; `capacity` ngoài 1–20 → `errors.capacity` "Sức chứa từ 1 đến 20" (UC-11 E1). Mọi thay đổi phát `tables-changed`. Đường dẫn QR do FE ghép (§3.9), API không trả URL.

### 2.6. Cài đặt nhận đơn và thông tin quán

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/order-settings` | Đã đăng nhập | → `OrderSettingsDto` (thanh trạng thái màn nhận đơn, tab Cài đặt nhận đơn) |
| PUT | `/api/order-settings` | `order-settings.update` | `UpdateOrderSettingsRequest` → `OrderSettingsDto` (UC-13) |
| POST | `/api/order-settings/pause` | `order-settings.update` | `PauseOrderingRequest` → `OrderSettingsDto` |
| POST | `/api/order-settings/resume` | `order-settings.update` | Mở nhận đơn lại ngay → `OrderSettingsDto` |
| GET | `/api/store-profile` | Đã đăng nhập | Khóa `Store.*`, `Brand.LogoUrl`, `Brand.PrimaryColor` → `StoreProfile` (bản in, QR chuyển khoản, khung xem trước) |

```ts
type OrderingStatus = {
  accepting: boolean               // nhận đơn QR ngay lúc này (chưa xét bàn tắt)
  blockReason?: 'QuanTamNgung' | 'NgoaiGioNhanDon'
  message?: string                 // đúng câu lỗi §2.13, hiện ở dải vàng trang khách
  openTime: string; closeTime: string               // "09:00", "22:00"
  pausedUntil?: string             // ISO UTC khi tạm ngưng có thời hạn
  pausedIndefinitely: boolean
  confirmMode: ConfirmMode
  asOf: string
}
type OrderSettingsDto = OrderingStatus
type UpdateOrderSettingsRequest = { openTime: string; closeTime: string; confirmMode: ConfirmMode }
type PauseOrderingRequest = { minutes: 15 | 30 | null }   // null = tới khi mở lại
type StoreProfile = {
  name: string; tagline?: string; address: string; phone: string; taxCode: string; receiptFooter: string
  bankBin: string; bankAccount: string; bankAccountName: string
  logoUrl: string; primaryColor: string
}
```

Lưu vào `System_Settings` (`06` §3): `pause` 15/30 phút ghi `Ordering.PausedUntil` = giờ hiện tại + số phút (ISO UTC), `null` ghi `manual`; `resume` ghi rỗng. Lỗi: `errors.openTime` / `errors.closeTime` "Giờ dạng HH:mm"; `errors.confirmMode` "Chọn chế độ xác nhận"; `errors.minutes` "Chọn 15 phút, 30 phút hoặc tới khi mở lại". Mọi thay đổi phát `ordering-changed`. Sửa các khóa này qua `PUT /api/settings` (Cài đặt chung) cũng được, BE kiểm cùng quy tắc (`FE/src/config/setting-labels.ts`).

### 2.7. Trang khách (API công khai) — `/api/public/tables/{code}`

Khách không đăng nhập. **Mã bàn trong đường dẫn là thông tin xác thực duy nhất** (BR-01): BE so không phân biệt hoa thường (FE luôn gửi chữ hoa), chỉ chấp nhận bàn chưa xóa; mã sai, mã cũ đã đổi → 404 `MaQrKhongHopLe`. Mọi phản hồi chỉ chứa dữ liệu của bàn đó và phiên của bàn đó (NFR-04). FE gọi bằng một axios riêng **không** gắn `Authorization`, không tự làm mới token.

- **Mã thiết bị ẩn danh**: FE sinh `crypto.randomUUID()` một lần, lưu trình duyệt (§4.3), gửi ở header `X-Device-Id` mọi request công khai và trong body khi ghi. BE chỉ dùng để chống gửi trùng, đánh dấu `isMine`, lọc `myRequests`; thiếu header thì `isMine = false`, `myRequests = []`.
- **Giới hạn tần suất** (NFR-04, `IPublicRateLimiter` đếm trong `IMemoryCache` theo `TimeProvider` qua bộ lọc `[PublicRateLimit]`, cửa sổ cố định 1 phút theo phút đồng hồ, khóa = IP + mã bàn): `public-write` 30 yêu cầu/phút cho hai `POST`; `public-read` 120 yêu cầu/phút cho các `GET`. Vượt → 429 `QuaNhieuYeuCau` kèm header `Retry-After` (giây). Khóa có mã bàn vì khách cùng wifi quán chung một IP (§5 quyết định 6). Chế độ `mock` không giả lập 429.
- **Cập nhật trạng thái cho khách**: hỏi lại `GET …/live` mỗi 5 giây, gọi ngay khi tab hiện lại (`visibilitychange`) và sau mỗi thao tác ghi; tải lại `GET …/menu` khi `menuStamp` đổi (§5 quyết định 7). Không dùng SignalR cho khách.

| Method | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/public/tables/{code}` | Bàn, quán, trạng thái nhận đơn → `PublicTableInfo` (FR-02) |
| GET | `/api/public/tables/{code}/menu` | Thực đơn cho khách → `PublicMenu`; header `ETag` = `"{stamp}"` (có ngoặc kép theo HTTP), gửi `If-None-Match` trùng → 304 |
| GET | `/api/public/tables/{code}/live?knownSession={mã PB}` | Trạng thái để hỏi lại mỗi 5 giây → `PublicLiveState` (FR-10, FR-14, FR-24) |
| POST | `/api/public/tables/{code}/orders` | Gửi đơn `PublicSubmitOrderRequest` → 201 `PublicSubmitOrderResult`; trùng → 200 cùng kết quả, `duplicate = true` (FR-08) |
| POST | `/api/public/tables/{code}/service-requests` | Gọi nhân viên, yêu cầu thanh toán `PublicServiceRequestInput` → 201 `PublicServiceRequestResult`; trùng → 200, `duplicate = true` (FR-11, FR-12) |

```ts
type PublicStoreInfo = {
  name: string; tagline?: string; logoUrl: string; primaryColor: string
  address: string; phone: string
  bankBin: string; bankAccount: string; bankAccountName: string   // QR chuyển khoản (FR-13)
}
type PublicTableInfo = {
  table: { name: string; zone: string; code: string; isActive: boolean }
  store: PublicStoreInfo
  ordering: OrderingStatus
  menuStamp: string
  asOf: string
}

type PublicOptionGroup = {
  id: string; name: string; nameEn?: string
  selectionType: SelectionType; isRequired: boolean; maxSelect: number
  choices: { id: string; name: string; nameEn?: string; price: number; isDefault: boolean; isSoldOut: boolean }[]
}
type PublicMenuItem = {
  id: string; code: string; categoryId: string
  name: string; nameEn?: string; description?: string; descriptionEn?: string
  imageUrl?: string; unit: string; price: number; tags: MenuTag[]
  optionGroupIds: string[]
  isSoldOut: boolean
}
type PublicMenu = {
  stamp: string                    // đổi khi thực đơn đổi hoặc qua 00:00 (§3.8)
  categories: { id: string; name: string; nameEn?: string; sortOrder: number }[]   // chưa ẩn, có món
  items: PublicMenuItem[]          // chưa ẩn, theo (thứ tự danh mục, sortOrder)
  optionGroups: PublicOptionGroup[]
}

type PublicOrderItemView = {
  itemName: string
  options: { groupName: string; name: string; price: number }[]
  quantity: number; unitPrice: number; lineTotal: number
  note?: string
  status: OrderItemStatus
  statusText?: string              // "Không phục vụ được: Hết món", "Đã hủy: Khách đổi ý"
}
type PublicOrderView = {
  code: string; source: OrderSource; status: OrderStatus; autoConfirmed: boolean
  guestName?: string; note?: string
  submittedAt: string; handledAt?: string
  rejectText?: string
  total: number
  isMine: boolean
  items: PublicOrderItemView[]
}
type PaymentRequestBrief = { id: string; method: PaymentMethod; needVatInvoice: boolean; createdAt: string; status: ServiceRequestStatus }
type PublicSessionView = {
  code: string; status: SessionStatus
  openedAt: string; closedAt?: string
  subtotal: number                 // BR-11
  pendingTotal: number             // đơn chờ xác nhận, chưa tính (UC-03 E2)
  orders: PublicOrderView[]        // mới nhất trước
  paymentRequest?: PaymentRequestBrief
  transferredToTableName?: string  // BR-18
}
type PublicServiceRequestView = { id: string; type: ServiceRequestType; reasonText: string; status: ServiceRequestStatus; createdAt: string; handledAt?: string }
type PublicLiveState = {
  asOf: string
  table: { name: string; isActive: boolean }
  ordering: OrderingStatus
  menuStamp: string
  session: PublicSessionView | null      // phiên đang mở của bàn
  endedSession?: PublicSessionView       // phiên knownSession nếu đã đóng, tự hủy hoặc chuyển bàn trong 4 giờ qua
  myRequests: PublicServiceRequestView[] // của X-Device-Id trong 4 giờ qua, mới nhất trước
}

type CartLineInput = {
  menuItemId: string
  choiceIds: string[]
  quantity: number                 // 1–20
  note?: string                    // ≤ 100
  expectedUnitPrice?: number       // bắt buộc ở API công khai: giá món + lựa chọn khách đang thấy
}
type PublicSubmitOrderRequest = { clientRequestId: string; deviceId: string; guestName?: string; note?: string; lines: CartLineInput[] }
type PublicSubmitOrderResult = { order: PublicOrderView; sessionCode: string; duplicate: boolean }
type PublicServiceRequestInput = {
  clientRequestId: string; deviceId: string
  type: ServiceRequestType
  reason?: CallReason              // bắt buộc với GoiNhanVien
  note?: string                    // bắt buộc khi Khac, ≤ 200
  paymentMethod?: PaymentMethod    // bắt buộc với ThanhToan
  needVatInvoice?: boolean
}
type PublicServiceRequestResult = { request: PublicServiceRequestView; duplicate: boolean }
type PriceChange = { index: number; menuItemId: string; itemName: string; oldUnitPrice: number; newUnitPrice: number }
```

**Gửi đơn**, thứ tự kiểm tra (400 trừ khi ghi khác; câu đúng §2.13):

| # | Tình huống | Kết quả | Tham chiếu |
| :---: | :--- | :--- | :--- |
| 1 | Mã bàn không hợp lệ | 404 `MaQrKhongHopLe` | BR-01, TC-02 |
| 2 | `clientRequestId` đã có trong bàn này | **200** đơn cũ, `duplicate = true` | TC-10 |
| 3 | Bàn tắt | `BanTamNgung` | BR-17, TC-08 |
| 4 | Quán tạm ngưng | `QuanTamNgung` | BR-07, TC-07 |
| 5 | Ngoài giờ nhận đơn | `NgoaiGioNhanDon` | BR-07 |
| 6 | Dữ liệu sai: giỏ trống, quá 30 dòng, số lượng, ghi chú, lựa chọn sai BR-04 | `errors` theo trường | BR-03, BR-04, BR-06 |
| 7 | Dòng có món ẩn, đã xóa, đang hết hoặc lựa chọn đang hết | `MonVuaHet` kèm `soldOutLines: number[]` và `errors["lines[i]"]` | BR-05, TC-09 |
| 8 | `expectedUnitPrice` khác giá hiện tại | **409** `GiaDaThayDoi` kèm `priceChanges: PriceChange[]`; không tạo đơn | BR-05, TC-32 |
| 9 | Cùng `deviceId` gửi cùng giỏ (`CartKey`) trong 10 giây | **200** đơn cũ, `duplicate = true` | BR-06 |
| 10 | Phiên đang mở đã có 3 đơn `ChoXacNhan` | `QuaSoDonCho` | BR-06, TC-11 |

Tạo đơn (một transaction): chưa có phiên → mở phiên `DangPhucVu`, cấp mã `PB`, gán `CurrentSessionId` (tranh chấp `Version` của bàn → đọc lại, vào phiên vừa mở, BR-02). Trạng thái theo BR-08 (§3.4). Dòng chụp tên, giá. Phiên `ChoThanhToan` → yêu cầu thanh toán đang chờ thành `DaHuy`, phiên về `DangPhucVu` (BR-12, UC-04 E3). `Session.Version + 1`. Phát `order-submitted`, `tables-changed`, `requests-changed` (nếu hủy yêu cầu thanh toán).

**Gửi yêu cầu**, thứ tự kiểm tra: (1) mã bàn → 404; (2) `clientRequestId` trùng → 200 cũ; (3) bàn tắt → `BanTamNgung`; (4) dữ liệu: thiếu `reason` → `errors.reason` "Chọn lý do"; `Khac` thiếu `note` → `errors.note` "Nhập nội dung cần hỗ trợ"; thiếu `paymentMethod` → `errors.paymentMethod` "Chọn phương thức thanh toán". Sau đó:

- `GoiNhanVien`: ngoài giờ nhận đơn **và** bàn không có phiên mở → `NgoaiGioNhanDon` (quán tạm ngưng vẫn gọi được). Cùng bàn, cùng `reason`, yêu cầu `DangCho` tạo trong 60 giây → 200 yêu cầu cũ, `duplicate = true` (BR-12, TC-15). Có phiên mở thì gắn `SessionId`.
- `ThanhToan`: bàn không có phiên mở hoặc tạm tính bằng 0 → `ChuaCoMonXacNhan` (TC-17). Phiên đã có yêu cầu thanh toán `DangCho` → cập nhật phương thức, cờ HĐ GTGT của yêu cầu đó, 200 `duplicate = true`. Còn lại tạo mới, phiên → `ChoThanhToan`, `Session.Version + 1`.
- Phát `requests-changed` (kèm `newRequestIds` khi tạo mới) và `tables-changed`.

**`live`**: `session` là phiên đang mở của bàn (null nếu không có). `knownSession` là mã phiên điện thoại đã biết (lưu sau lần gửi đơn hoặc lần đọc trước); nếu phiên đó thuộc bàn này (hoặc đã chuyển từ bàn này) và đã `DaDong`, `DaHuy` hoặc chuyển sang bàn khác trong 4 giờ qua → trả ở `endedSession` để FE hiện lời cảm ơn (FR-24), lý do từ chối (TC-21) hoặc thông báo chuyển bàn (BR-18).

### 2.8. Đơn (nhân viên) — `/api/orders`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/orders/live` | `orders.view` | Cột "Chờ xác nhận", "Chờ phục vụ" → `LiveOrdersDto` (FR-15, FR-19) |
| GET | `/api/orders/{id}` | `orders.view` | → `StaffOrderDto` (thẻ đơn, phiếu bếp) |
| POST | `/api/orders` | `orders.create` | Gọi món hộ `CreateStaffOrderRequest` → 201 `StaffOrderDto`; trùng `clientRequestId` → 200 đơn cũ (FR-20, TC-26) |
| POST | `/api/orders/{id}/confirm` | `orders.confirm` | Xác nhận, kèm dòng bỏ `ConfirmOrderRequest` → `StaffOrderDto` (FR-16, TC-19) |
| POST | `/api/orders/{id}/reject` | `orders.confirm` | Từ chối `RejectOrderRequest` → `StaffOrderDto` (FR-17, TC-21) |
| POST | `/api/orders/{id}/serve` | `orders.serve` | Phục vụ dòng hoặc cả đơn `ServeOrderRequest` → `StaffOrderDto` (FR-19, TC-24) |
| POST | `/api/orders/{id}/unserve` | `orders.serve` | Hoàn tác `UnserveOrderRequest` trong 60 giây từ `servedAt` → `StaffOrderDto` (UC-06 2a) |
| POST | `/api/orders/{id}/items/{itemId}/cancel` | `orders.cancel` | Hủy món `CancelOrderItemRequest` → `StaffOrderDto` (FR-21, TC-30) |
| POST | `/api/orders/{id}/cancel` | `orders.cancel` | Hủy cả đơn `CancelOrderRequest` (mọi dòng còn hiệu lực) → `StaffOrderDto` |

```ts
type OrderItemOptionDto = { groupId: string; groupName: string; choiceId: string; name: string; price: number }
type OrderItemDto = {
  id: string; menuItemId: string; itemCode: string; itemName: string
  itemPrice: number                // giá món lúc gửi
  options: OrderItemOptionDto[]
  optionsPrice: number
  unitPrice: number                // itemPrice + optionsPrice
  quantity: number
  lineTotal: number                // §3.1
  note?: string
  status: OrderItemStatus
  removeReason?: RemoveReason; removeNote?: string
  cancelReason?: string; cancelledAt?: string; cancelledByName?: string
  servedAt?: string
  statusText?: string
  sortOrder: number
}
type StaffOrderDto = {
  id: string; code: string
  sessionId: string; sessionCode: string
  tableId: string; tableName: string
  source: OrderSource; status: OrderStatus; autoConfirmed: boolean
  guestName?: string; note?: string
  submittedAt: string
  handledAt?: string; handledByName?: string
  rejectReason?: RejectReason; rejectNote?: string; rejectText?: string
  total: number                    // §3.2
  itemCount: number                // dòng còn hiệu lực
  unservedCount: number            // dòng DaXacNhan
  items: OrderItemDto[]            // theo sortOrder, gồm dòng bị bỏ, đã hủy
  waitMinutes: number; waitLevel: WaitLevel   // §3.5
  asOf: string
}
type LiveOrdersDto = {
  asOf: string
  pending: StaffOrderDto[]         // ChoXacNhan, submittedAt tăng dần (thẻ đỏ tự lên đầu, BR-09, TC-23)
  serving: StaffOrderDto[]         // DaXacNhan, handledAt tăng dần (chờ lâu nhất trên cùng, UC-06)
}
type ConfirmOrderRequest = { removedItems: { itemId: string; reason: RemoveReason; note?: string }[] }
type RejectOrderRequest = { reason: RejectReason; note?: string }
type ServeOrderRequest = { itemIds?: string[] }      // vắng = mọi dòng DaXacNhan ("Phục vụ cả đơn")
type UnserveOrderRequest = { itemIds: string[] }
type CancelOrderItemRequest = { quantity: number; reason: string }
type CancelOrderRequest = { reason: string }
type CreateStaffOrderRequest = { clientRequestId: string; tableId: string; guestName?: string; note?: string; lines: CartLineInput[] }
```

- **Xác nhận**: đơn khác `ChoXacNhan` → 409 `DonDaXuLy` "Đơn đã được {handledByName} xử lý" (UC-05 E3; tự xác nhận thì "Đơn đã được tự xác nhận") kèm `order: StaffOrderDto` mới nhất. `itemId` không thuộc đơn → `errors["removedItems[i].itemId"]` "Dòng không thuộc đơn"; `Khac` thiếu ghi chú → `errors["removedItems[i].note"]` "Nhập lý do bỏ món"; bỏ hết dòng → `DonPhaiConMon` (BR-10, TC-20). Kết quả: dòng bỏ `BiBo`, dòng còn lại `DaXacNhan`; đơn `DaXacNhan`, `handledAt`, người xác nhận; dòng bỏ lý do `HetMon` làm món đó "Hết trong hôm nay" nếu đang còn (BR-10, TC-19) và phát `menu-changed`. `Session.Version + 1`. FE mở bản in phiếu bếp (§2.15).
- **Từ chối**: như trên về 409; `Khac` thiếu ghi chú → `errors.note` "Nhập lý do từ chối". Mọi đơn của phiên `BiTuChoi` → phiên `DaHuy`, `closedAt`, bàn về `Trong` (BR-02, TC-21); yêu cầu gọi nhân viên của bàn giữ nguyên để nhân viên xử lý.
- **Phục vụ**: đơn `ChoXacNhan` → `DonChuaXacNhan` (TC-25); đơn `BiTuChoi`, `DaHuy` → `DonKhongPhucVuDuoc`; phiên đã đóng → `PhienDaDong`. Dòng không ở `DaXacNhan` bị bỏ qua (gọi lặp vô hại). Mọi dòng còn hiệu lực đã phục vụ → đơn `DaPhucVu` (TC-24). Không tăng `Session.Version`.
- **Hoàn tác phục vụ**: dòng không ở `DaPhucVu` → `MonChuaPhucVu`; quá 60 giây → `HetThoiGianHoanTac`. Đơn `DaPhucVu` về `DaXacNhan`.
- **Hủy món** (BR-15): phiên không mở → `PhienDaDong`; đơn khác `DaXacNhan`, `DaPhucVu` → `DonChuaXacNhan`; dòng không ở `DaXacNhan`, `DaPhucVu` → `MonKhongHuyDuoc`; `reason` trống → `errors.reason` "Nhập lý do hủy"; `quantity` ngoài 1…số lượng dòng → `errors.quantity` "Số lượng hủy từ 1 đến {n}". Hủy một phần tách dòng (`06` §4). Đơn không còn dòng hiệu lực → `DaHuy`; còn lại mà mọi dòng đã phục vụ → `DaPhucVu`. `Session.Version + 1`. Hủy cả đơn: kiểm như trên, hủy mọi dòng còn hiệu lực.
- **Gọi món hộ**: bàn không có → 404 "Không tìm thấy bàn"; bàn tắt → `BanDangTat`; dữ liệu và món hết kiểm như §2.7 bước 6–7 (không xét giờ nhận đơn, tạm ngưng, giới hạn 3 đơn chờ, không cần `expectedUnitPrice`). Đơn `NhanVien`, `DaXacNhan`, `handledBy` = người gọi; mở phiên nếu chưa có; hủy yêu cầu thanh toán đang chờ như khách gửi (§5 quyết định 11).
- Mọi thao tác phát `orders-changed` và `tables-changed`.

### 2.9. Phiên bàn và thu tiền — `/api/table-sessions`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/table-sessions/board` | `table-sessions.view` | Tab Bàn: mọi bàn chưa xóa kèm phiên đang mở → `TableBoardItem[]` (FR-22) |
| GET | `/api/table-sessions?page&pageSize&search&from&to&status` | `table-sessions.view` | Tra cứu phiên; `search` theo mã PB, tên bàn; lọc theo `openedAt`; không gửi `from`, `to` → hôm nay; mặc định `sortBy=openedAt&sortDir=desc` → `PaginatedResult<TableSessionListItem>` (in lại hóa đơn trong ngày, UC-08 4a) |
| GET | `/api/table-sessions/{id}` | `table-sessions.view` | Ngăn kéo chi tiết phiên → `TableSessionDto` (SCR-06) |
| POST | `/api/table-sessions/{id}/checkout` | `table-sessions.checkout` | Thu tiền, đóng phiên `CheckoutRequest` → `CheckoutResultDto` (FR-23, FR-24) |
| POST | `/api/table-sessions/{id}/transfer` | `table-sessions.transfer` | Chuyển bàn (P3) `TransferSessionRequest` → `TableSessionDto` (FR-25) |

```ts
type TableBoardItem = {
  tableId: string; tableName: string; zone: string; capacity: number; code: string
  isActive: boolean
  status: TableStatus
  session?: {
    id: string; code: string; status: SessionStatus; openedAt: string
    orderCount: number             // đơn không bị từ chối
    subtotal: number               // BR-11
    pendingOrderCount: number
    unservedCount: number
    paymentRequest?: PaymentRequestBrief   // đang chờ → thẻ vàng "Chờ thanh toán · Chuyển khoản"
  }
  pendingRequestCount: number
}
type SessionPaymentDto = {
  method: PaymentMethod; total: number
  cashReceived?: number; changeAmount?: number
  needVatInvoice: boolean
  closedAt: string; closedByName: string
}
type TableSessionDto = {
  id: string; code: string
  tableId: string; tableName: string; zone: string
  status: SessionStatus
  version: number                  // §3.6
  openedAt: string; closedAt?: string
  subtotal: number; pendingTotal: number
  orders: StaffOrderDto[]          // giờ gửi tăng dần
  counts: { pendingOrders: number; unservedItems: number }
  paymentRequest?: PaymentRequestBrief
  payment?: SessionPaymentDto      // khi DaDong
  requests: ServiceRequestDto[]    // của phiên, mới nhất trước
  transferredFromTableName?: string
  asOf: string
}
type TableSessionListItem = {
  id: string; code: string; tableName: string; status: SessionStatus
  openedAt: string; closedAt?: string
  total: number; orderCount: number
  method?: PaymentMethod; closedByName?: string
}
type CheckoutRequest = {
  clientRequestId: string          // §3.7
  version: number
  method: PaymentMethod
  cashReceived?: number            // bắt buộc với TienMat
  needVatInvoice?: boolean         // vắng = theo yêu cầu thanh toán
  acknowledgeUnserved?: boolean    // đã xác nhận cảnh báo món chưa phục vụ
}
type CheckoutResultDto = { session: TableSessionDto; changeAmount: number; duplicate: boolean }
type TransferSessionRequest = { targetTableId: string; version: number }
```

Thứ tự kiểm tra thu tiền (400 trừ khi ghi khác):

| # | Tình huống | Kết quả | Tham chiếu |
| :---: | :--- | :--- | :--- |
| 1 | Cùng `clientRequestId` đã thu | **200** kết quả cũ, `duplicate = true`; không xét `version` | UC-08 E4 |
| 2 | Phiên không mở | `PhienDaDong` | |
| 3 | `version` lệch | **409** `DuLieuCu` kèm `currentVersion` | §3.6 |
| 4 | Còn đơn `ChoXacNhan` | `ConDonChoXacNhan` kèm `pendingCount` | BR-13, TC-28 |
| 5 | Còn dòng `DaXacNhan` mà không `acknowledgeUnserved` | `ConMonChuaPhucVu` kèm `unservedCount` | BR-13, UC-08 E2 |
| 6 | `TienMat` thiếu `cashReceived` | `errors.cashReceived` "Nhập tiền khách đưa" | |
| 7 | `cashReceived` < tạm tính | `TienKhachDuaThieu`, `errors.cashReceived` "Còn thiếu {số tiền}" | BR-13, TC-29 |

Kết quả (một transaction): phiên `DaDong`, `total` = tạm tính, phương thức, `cashReceived`, `changeAmount`, `needVatInvoice`, người thu, `closedAt`; bàn `CurrentSessionId` null; mọi yêu cầu `DangCho` của bàn → `DaXuLy`, `autoHandled = true` (BR-13, TC-27). Phát `tables-changed`, `requests-changed`, `orders-changed`. FE mở bản in hóa đơn. Trang khách nhận `endedSession` qua `live` (FR-24).

Chuyển bàn (BR-18): bàn đích không `Trong` hoặc đang tắt → `BanDichKhongHopLe`; `version` lệch → 409 `DuLieuCu`. Phiên giữ mã; đổi `tableId`, `tableName`, ghi `transferredFromTableName`; hai bàn đổi `CurrentSessionId`; yêu cầu đang chờ của phiên chuyển theo.

### 2.10. Yêu cầu từ bàn — `/api/service-requests`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/service-requests/pending` | `service-requests.view` | Yêu cầu `DangCho`, `createdAt` tăng dần → `ServiceRequestDto[]` (FR-14) |
| POST | `/api/service-requests/{id}/handle` | `service-requests.update` | "Đã xử lý" → `ServiceRequestDto`; đã xử lý → 200 như cũ; đã hủy → 400 `YeuCauDaHuy` |

```ts
type ServiceRequestDto = {
  id: string; tableId: string; tableName: string
  sessionId?: string; sessionCode?: string
  type: ServiceRequestType
  reason?: CallReason; note?: string
  paymentMethod?: PaymentMethod; needVatInvoice: boolean
  reasonText: string               // "Thêm đá"; "Thanh toán · Chuyển khoản · Cần HĐ GTGT" (TC-16)
  status: ServiceRequestStatus
  createdAt: string; handledAt?: string; handledByName?: string
  autoHandled: boolean
  waitMinutes: number
  isOverdue: boolean               // DangCho và chờ ≥ 3 phút (BR-12, TC-23 demo bước 8)
}
```

Xử lý yêu cầu thanh toán không đổi trạng thái phiên (phiên vẫn "Chờ thanh toán" tới khi thu tiền). Phát `requests-changed`.

### 2.11. Báo cáo — `/api/reports`

Quyền `reports.view`. Doanh thu chỉ tính phiên `DaDong` theo `closedAt` (BR-19). Không gửi `from`, `to` → 30 ngày tới hôm nay. Số tiền làm tròn tới đồng, phút và phần trăm 1 chữ số.

| Method | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/reports/dashboard` | Tổng quan hôm nay (FR-01, TC-42) → `DashboardReport` |
| GET | `/api/reports/revenue?from&to` | Doanh thu theo ngày, so kỳ liền trước cùng độ dài (FR-35) → `RevenueReport` |
| GET | `/api/reports/items?from&to&categoryId` | Món gọi nhiều, món bị bỏ, bị hủy và lý do (FR-36) → `ItemsReport` |
| GET | `/api/reports/operations?from&to` | Vận hành (FR-37) → `OperationsReport` |

```ts
type DashboardReport = {
  date: string; asOf: string
  openSessions: number             // phiên DangPhucVu + ChoThanhToan
  activeTables: number             // bàn đang bật
  pendingOrders: number
  pendingRequests: number; overdueRequests: number
  revenue: number                  // Σ total phiên DaDong có closedAt hôm nay
  closedSessions: number
  avgSessionValue: number          // revenue ÷ closedSessions, 0 khi chưa có
  avgConfirmMinutes?: number       // BR-19, đơn khách gửi hôm nay đã được xử lý
  byHour: { hour: number; orders: number; revenue: number }[]   // 0–23 hôm nay
}
type RevenueTotals = { revenue: number; sessionCount: number; orderCount: number; avgSessionValue: number }
type RevenueReport = {
  from: string; to: string
  totals: RevenueTotals
  previous: RevenueTotals & { from: string; to: string }
  revenueChangePercent?: number    // null khi kỳ trước = 0
  daily: (RevenueTotals & { date: string; previousRevenue: number })[]   // đủ mọi ngày
}
type ItemsReport = {
  totalRevenue: number
  items: { menuItemId: string; code: string; name: string; categoryId: string; categoryName: string
           quantity: number; revenue: number; share: number }[]       // theo quantity giảm dần
  problems: { menuItemId: string; code: string; name: string; removedQty: number; cancelledQty: number; value: number
              reasons: { kind: 'BiBo' | 'DaHuy'; reasonText: string; quantity: number }[] }[]   // theo removedQty + cancelledQty giảm dần
  reasonSummary: { kind: 'BiBo' | 'DaHuy'; reasonText: string; lineCount: number; quantity: number; value: number }[]
}
type OperationsReport = {
  orderCount: number; customerOrders: number; staffOrders: number
  selfOrderRate: number            // customerOrders ÷ orderCount × 100
  autoConfirmedOrders: number; autoConfirmRate: number   // ÷ customerOrders
  rejectedOrders: number; rejectRate: number             // ÷ customerOrders (BR-19)
  avgConfirmMinutes?: number; avgRequestMinutes?: number
  requestCount: number
  rejectReasons: { reason: RejectReason; reasonText: string; count: number }[]
  byHour: { hour: number; orders: number }[]
  heatmap: { weekday: number; hour: number; orders: number }[]   // weekday 1 = Thứ Hai … 7 = Chủ nhật
}
```

Định nghĩa: `orderCount` (doanh thu) = đơn không bị từ chối của phiên đã đóng trong ngày; `ItemsReport.items` = dòng `DaXacNhan`, `DaPhucVu` của phiên `DaDong` lọc theo `closedAt`, `revenue = Σ lineTotal`; `problems`, `reasonSummary` = dòng `BiBo` (theo `handledAt` của đơn) và `DaHuy` (theo `cancelledAt`), `reasonText` của `BiBo` là "Hết món" hoặc "Khác"; `OperationsReport` lọc đơn theo `submittedAt`, yêu cầu theo `createdAt`; `avgConfirmMinutes` = trung bình `handledAt − submittedAt` của đơn khách không tự xác nhận đã xử lý; `avgRequestMinutes` = trung bình `handledAt − createdAt` của yêu cầu `DaXuLy` không `autoHandled` (BR-19).

### 2.12. Demo — bổ sung cho `/api/demo`

Chỉ bật khi `DEMO_MODE=true` (tắt → 404), phục vụ trình diễn ở §4.2.

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/demo/guest-tables` | Công khai | Bàn chưa xóa kèm mã, trạng thái để trang đăng nhập có lối vào "Xem như khách" → `GuestTableLink[]` |
| POST | `/api/demo/ordering-all-day` | Đã đăng nhập | Ghi `Ordering.OpenTime = Ordering.CloseTime = "00:00"` (nhận cả ngày) và bỏ tạm ngưng → `OrderSettingsDto` |

```ts
type GuestTableLink = { name: string; zone: string; code: string; status: TableStatus }
```

### 2.13. Bảng mã lỗi nghiệp vụ

Lỗi 400/404/409/429 nghiệp vụ có trường mở rộng `code` trong ProblemDetails để FE rẽ nhánh mà không so chuỗi; `detail` đúng câu dưới đây (FE hiển thị nguyên văn). Lỗi validate theo trường dùng `errors` như `QUY-UOC-API.md` §1.3; khi chỉ có một lỗi thì `detail` là chính câu đó.

| `code` | HTTP | `detail` | Nơi phát sinh |
| :--- | :---: | :--- | :--- |
| `MaQrKhongHopLe` | 404 | Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên | Mọi API công khai (BR-01, TC-02, TC-38) |
| `BanTamNgung` | 400 | Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên | Gửi đơn, gửi yêu cầu (BR-17, TC-08) |
| `QuanTamNgung` | 400 | Quán tạm ngưng nhận đơn qua QR tới {HH:mm}, vui lòng gọi nhân viên · tạm ngưng tới khi mở lại: Quán tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên | Gửi đơn (BR-07, TC-07); giờ Việt Nam |
| `NgoaiGioNhanDon` | 400 | Quán nhận đơn qua QR từ {HH:mm} đến {HH:mm}, vui lòng gọi nhân viên | Gửi đơn; gọi nhân viên khi bàn chưa có phiên (BR-07) |
| `MonVuaHet` | 400 | Có món vừa hết, vui lòng xóa khỏi giỏ rồi gửi lại | Gửi đơn, gọi món hộ; `errors["lines[i]"]` "Món vừa hết" / "Món không còn trong thực đơn" / "{tên lựa chọn} vừa hết"; kèm `soldOutLines` (BR-05, TC-09) |
| `GiaDaThayDoi` | 409 | Giá đã thay đổi, vui lòng kiểm tra giỏ món rồi gửi lại | Gửi đơn; kèm `priceChanges` (BR-05, TC-32) |
| `QuaSoDonCho` | 400 | Bàn đang có 3 đơn chờ quán xác nhận, vui lòng chờ | Gửi đơn (BR-06, TC-11) |
| `ChuaCoMonXacNhan` | 400 | Chưa có món được quán xác nhận | Yêu cầu thanh toán (BR-12, TC-17) |
| `DonDaXuLy` | 409 | Đơn đã được {tên} xử lý | Xác nhận, từ chối (UC-05 E3); kèm `order` |
| `DonPhaiConMon` | 400 | Đơn phải còn ít nhất 1 món, bỏ hết thì dùng Từ chối | Xác nhận (BR-10, TC-20) |
| `DonChuaXacNhan` | 400 | Đơn chưa được xác nhận | Phục vụ, hủy món (TC-25) |
| `DonKhongPhucVuDuoc` | 400 | Đơn đã bị từ chối hoặc đã hủy | Phục vụ |
| `MonChuaPhucVu` | 400 | Món chưa phục vụ, không hoàn tác được | Hoàn tác |
| `HetThoiGianHoanTac` | 400 | Hết thời gian hoàn tác | Hoàn tác |
| `MonKhongHuyDuoc` | 400 | Món đã bị bỏ hoặc đã hủy | Hủy món |
| `PhienDaDong` | 400 | Phiên bàn đã đóng | Phục vụ, hủy món, thu tiền (BR-15) |
| `DuLieuCu` | 409 | Phiên bàn vừa thay đổi, đang tải lại | Thu tiền, chuyển bàn; kèm `currentVersion` |
| `ConDonChoXacNhan` | 400 | Còn {n} đơn chờ xác nhận | Thu tiền (BR-13, TC-28); kèm `pendingCount` |
| `ConMonChuaPhucVu` | 400 | Còn {n} món chưa phục vụ | Thu tiền (UC-08 E2); kèm `unservedCount` |
| `TienKhachDuaThieu` | 400 | Còn thiếu {số tiền} | Thu tiền (TC-29: "Còn thiếu 68.000 ₫") |
| `BanDangCoKhach` | 400 | Bàn đang có khách | Tắt, xóa, đổi mã QR bàn có phiên mở (UC-11 E2, TC-39) |
| `BanDangTat` | 400 | Bàn đang tắt, bật bàn trước khi gọi món | Gọi món hộ |
| `BanDichKhongHopLe` | 400 | Chỉ chuyển sang bàn đang trống và đang bật | Chuyển bàn (BR-18) |
| `MonDaDuocGoi` | 400 | Món đã từng được gọi, không xóa được. Hãy dùng Ẩn | Xóa món (BR-16, TC-33) |
| `DanhMucConMon` | 400 | Danh mục đang có {n} món, chuyển món sang danh mục khác trước | Xóa danh mục; kèm `itemCount` |
| `NhomDangDung` | 400 | Nhóm tùy chọn đang gắn với {n} món, gỡ khỏi món trước | Xóa nhóm; kèm `itemCount` |
| `YeuCauDaHuy` | 400 | Yêu cầu đã hủy | Xử lý yêu cầu |
| `QuaNhieuYeuCau` | 429 | Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút | API công khai (NFR-04) |

Câu bắt buộc khác dùng `errors` theo trường: "Giỏ món đang trống" (`errors.lines`), "Mỗi đơn tối đa 30 món" (`errors.lines`), "Số lượng từ 1 đến 20" (`errors["lines[i].quantity"]`), "Bắt buộc chọn 1 {tên nhóm}" và "Chọn tối đa {n} {tên nhóm}" và "Lựa chọn không hợp lệ" (`errors["lines[i].choiceIds"]`, BR-04), "Ghi chú món tối đa 100 ký tự" (`errors["lines[i].note"]`), "Tên gọi tối đa 30 ký tự" (`errors.guestName`), "Ghi chú tối đa 200 ký tự" (`errors.note`); từ chối đơn thiếu lý do: "Chọn lý do từ chối" (`errors.reason`). Số tiền trong câu định dạng `68.000 ₫`, giờ `HH:mm` giờ Việt Nam.

### 2.14. Thời gian thực

**Nhân viên — SignalR `/hubs/pos`** (`[Authorize]`, token qua query `access_token`). Mọi người dùng đã đăng nhập vào một nhóm chung. Sự kiện (server → client), payload camelCase:

| Sự kiện | Payload | FE làm gì |
| :--- | :--- | :--- |
| `order-submitted` | `{ orderId, tableId, tableName, status, autoConfirmed, source }` | Làm mới `orders/live`, `board`; phát âm báo; đơn `ChoXacNhan` tăng số đếm tiêu đề tab (§4.4); đơn `autoConfirmed` mở bản in phiếu bếp nếu bật "Tự in phiếu bếp" (FR-18, TC-22) |
| `orders-changed` | `{ orderIds, tableIds }` | Làm mới `orders/live`, phiên đang mở trong ngăn kéo |
| `requests-changed` | `{ requestIds, tableIds, newRequestIds }` | Làm mới `service-requests/pending`; `newRequestIds` khác rỗng → âm báo (UC-04 bước 4) |
| `tables-changed` | `{ tableIds }` | Làm mới `board`, `tables`, Tổng quan |
| `menu-changed` | `{ menuItemIds, optionGroupIds }` | Làm mới `menu`, `menu-items`, `option-groups` |
| `ordering-changed` | `{}` | Làm mới `order-settings` |

Kiểu payload: `PosEventMap` trong `FE/src/types/menu-qr.ts`. BE gọi `IPosEventPublisher` sau khi lưu (chép mẫu demo Quản lý Nhà hàng). Mất kết nối → thanh đỏ "Mất kết nối, đang thử lại", nối lại thì làm mới toàn bộ; ngoài ra màn nhận đơn tự làm mới mỗi 30 giây.

**Khách — hỏi lại máy chủ** `GET /api/public/tables/{code}/live` mỗi 5 giây (NFR-03 cho phép), không mở kết nối SignalR (§5 quyết định 7).

**Chế độ `mock`**: handler gọi `publishPosEvent(tên, payload)` sau khi ghi; sự kiện đi qua `BroadcastChannel` khóa `fnb-menu-qr:pos-events` tới các tab khác, cùng hình dạng như trên. `mockDb.subscribe` (`remote = true`) đã tự làm mới query khi tab khác ghi. Trang khách ở mock vẫn hỏi lại mỗi 5 giây (đọc mock-db, để "Hết trong hôm nay" qua 00:00 và đồng hồ chờ cập nhật) và nghe `mockDb.subscribe` để cập nhật tức thì.

### 2.15. Bản in

Không có endpoint riêng. Route group `app/(print)` có `AuthGuard`, không sidebar, CSS `@page { size: 80mm auto }` (A4 với bản in QR), chữ ≥ 12 px, tự `window.print()` khi mở từ luồng thao tác:

- `/print/kitchen-ticket/[orderId]` (`orders.view`): `GET /api/orders/{id}` + `GET /api/store-profile`. Tên quán, "PHIẾU BẾP", bàn (chữ lớn), mã đơn, giờ gửi, tên gọi, "Tự xác nhận" hoặc "Nhân viên gọi hộ", từng dòng **còn hiệu lực** (không có dòng bị bỏ, TC-19): số lượng × tên, lựa chọn, ghi chú dòng; ghi chú đơn. Không in giá (FR-18).
- `/print/receipt/[sessionId]` (`table-sessions.view`): `GET /api/table-sessions/{id}` + `store-profile`. Tên, địa chỉ, SĐT, MST quán; "HÓA ĐƠN" số = mã phiên (BR-20), bàn, giờ vào, giờ in, thu ngân; dòng còn hiệu lực gộp theo (tên, lựa chọn, đơn giá) với số lượng × đơn giá = thành tiền; tổng, phương thức, tiền khách đưa, tiền thối; "Khách cần HĐ GTGT" nếu có; `receiptFooter`; "Giá đã gồm thuế GTGT".
- `/print/qr?ids={id,…}&layout=A6|Tem8|A4x4` (`tables.print-qr`): `GET /api/tables` + `store-profile`. Mỗi mã có logo, tên quán, tên bàn, câu "Quét để xem menu và gọi món", cạnh QR ≥ 3 cm (NFR-05, TC-40); bàn tắt có cảnh báo "Bàn đang tắt, khách quét sẽ không gửi đơn được" (TC-41). A6: 1 mã/trang; Tem8: tem 8×8 cm xếp trên A4; A4x4: 4 mã/trang A4.

FE mở bản in phiếu bếp, hóa đơn bằng `iframe` ẩn tới route trên (không mở tab mới, tránh trình duyệt chặn cửa sổ bật lên khi in tự động); bản in QR mở tab mới.

---

## 3. Công thức và quy tắc (nguồn sự thật chung của BE, FE và mock)

FE tính tại máy để giỏ, thẻ đơn, ngăn kéo phản hồi ngay bằng `features/pos/lib/pricing.ts`; handler mock dùng lại chính hàm đó; BE tính trong `OrderPricing` (Domain) ở mỗi thay đổi. Mọi số tiền là số nguyên đồng, không có làm tròn.

### 3.1. Thành tiền dòng (BR-03)

`optionsPrice = Σ price của lựa chọn`; `unitPrice = itemPrice + optionsPrice`; `lineTotal = unitPrice × quantity`, `quantity` nguyên 1–20. Dòng đơn chụp `itemPrice`, tên và giá lựa chọn lúc gửi (BR-16).

### 3.2. Tổng đơn, tạm tính phiên (BR-11)

- `order.total = Σ lineTotal` của dòng không `BiBo`, không `DaHuy`. Đơn chờ: tổng mọi dòng (thẻ chờ xác nhận hiện 230.000, TC-18); đơn bị từ chối giữ tổng lúc gửi để báo cáo, không tính tiền.
- `session.subtotal = Σ lineTotal` của dòng `DaXacNhan`, `DaPhucVu` thuộc đơn `DaXacNhan`, `DaPhucVu`. Đơn `ChoXacNhan`, `BiTuChoi`, `DaHuy` không tính.
- `session.pendingTotal = Σ total` đơn `ChoXacNhan` (trang khách ghi "Món chờ quán xác nhận chưa tính vào tạm tính", UC-03 E2).
- Phiên đã đóng: `total` chốt bằng `subtotal` lúc đóng; doanh thu = Σ `total` (BR-19).

### 3.3. Thu tiền (BR-13)

- Tiền mặt: `cashReceived ≥ subtotal`; `changeAmount = cashReceived − subtotal`. Nút nhanh: Đủ tiền, 100.000, 200.000, 500.000; nút nhỏ hơn tạm tính bị vô hiệu. Nhập thiếu: FE khóa "Hoàn tất" và hiện "Còn thiếu {subtotal − cashReceived}" (TC-29).
- Chuyển khoản: số tiền bằng `subtotal`, nhân viên bấm "Đã nhận tiền" rồi "Hoàn tất"; `cashReceived`, `changeAmount` null.
- Tạm tính bằng 0 (mọi món đã hủy) vẫn đóng được với tiền mặt 0 ₫.

### 3.4. Giờ nhận đơn, tạm ngưng, chế độ xác nhận (BR-07, BR-08)

```
m = phút hiện tại trong ngày theo giờ Việt Nam; o = openTime; c = closeTime (phút)
o == c  → nhận cả ngày
o <  c  → nhận khi o ≤ m < c
o >  c  → nhận qua đêm: m ≥ o hoặc m < c
pausedIndefinitely = (PausedUntil == "manual")
paused = pausedIndefinitely hoặc (PausedUntil là thời điểm và now < PausedUntil)   // quá giờ tự nhận lại, đọc lười
accepting = !paused và trong giờ;  blockReason ưu tiên QuanTamNgung rồi NgoaiGioNhanDon
```

Trạng thái đơn khách mới (BR-08): `ConfirmMode = TuXacNhan` **và** phiên đang mở đã có ít nhất một đơn `DaXacNhan` hoặc `DaPhucVu` → `DaXacNhan`, `autoConfirmed = true`, `handledAt = submittedAt`; còn lại `ChoXacNhan`. Đơn nhân viên gọi hộ luôn `DaXacNhan` (TC-22, TC-26).

### 3.5. Thời gian chờ và màu

- `now` ở FE = `Date.now() + (asOf − giờ máy lúc nhận)`; tính lại mỗi 15 giây. `waitMinutes` = phần nguyên phút.
- Đơn `ChoXacNhan`: chờ = `now − submittedAt`; `Vang` từ 5 phút, `Do` từ 10 phút (BR-09, TC-23). Đơn `DaXacNhan`: chờ = `now − handledAt`; `Vang` từ 15 phút, `Do` từ 25 phút (§5 quyết định 13). Khác: `BinhThuong`, chờ 0.
- Yêu cầu `DangCho`: `isOverdue` từ 3 phút (BR-12), dòng đỏ.
- Màu từ token `theme.css` (thêm token `--wait-warn`, `--wait-late`, `--table-*`), không mã màu cứng.

### 3.6. Phiên bản phiên bàn

`TableSessionDto.version` tăng 1 khi tạm tính hoặc trạng thái phiên có thể đổi: đơn mới vào phiên, xác nhận, từ chối, hủy món hoặc đơn, yêu cầu thanh toán tạo, cập nhật hoặc tự hủy, thu tiền, chuyển bàn. **Không** tăng khi phục vụ, hoàn tác phục vụ, gọi nhân viên, xử lý yêu cầu. Thao tác gửi kèm `version`: `checkout`, `transfer`; lệch → 409 `DuLieuCu` kèm `currentVersion`, FE báo, làm mới ngăn kéo, nhân viên kiểm lại số tiền rồi bấm lại (khách vừa gọi thêm khi đang thu tiền). `Pos_Orders.Version`, `Pos_DiningTables.Version` là concurrency token nội bộ: không gửi qua API, BE bắt lỗi tranh chấp rồi đọc lại (xác nhận trùng → `DonDaXuLy`; hai điện thoại cùng mở phiên → vào chung phiên).

### 3.7. Chống bấm lặp, gửi lại (BR-06, UC-08 E4)

| Thao tác | Khóa | Gửi lại cùng khóa |
| :--- | :--- | :--- |
| Khách gửi đơn | `Pos_Orders.ClientRequestId` (theo bàn) | 200 `PublicSubmitOrderResult` cũ, `duplicate = true` (TC-10) |
| Khách gửi lại cùng giỏ trong 10 giây (khác `clientRequestId`) | `(TableId, DeviceId, CartKey, SubmittedAt ≥ now − 10 giây)` | 200 đơn cũ, `duplicate = true` |
| Gọi món hộ | `Pos_Orders.ClientRequestId` | 200 `StaffOrderDto` cũ |
| Gửi yêu cầu từ bàn | `Pos_ServiceRequests.ClientRequestId` | 200 kết quả cũ |
| Thu tiền | `Pos_TableSessions.CheckoutRequestId` | 200 `CheckoutResultDto` cũ, không xét `version` |

FE sinh `clientRequestId` bằng `crypto.randomUUID()` khi bắt đầu thao tác (mở trang giỏ, mở hộp gọi nhân viên, mở hộp thu tiền), giữ nguyên khi bấm lại hoặc thử lại sau lỗi mạng, đổi mới sau khi thành công hoặc khi giỏ đổi. Nút khóa trong lúc chờ phản hồi. `CartKey` = SHA-256 (hex) của chuỗi JSON `[guestName ?? "", note ?? "", lines đã sắp theo (menuItemId, choiceIds đã sắp, note, quantity)]`; mock được lưu thẳng chuỗi chuẩn hóa thay cho băm. Hai request cùng khóa tới đồng thời: request sau gặp unique index, BE đọc lại và trả kết quả của request trước.

### 3.8. Hết món, kiểm tra lựa chọn, dấu thực đơn (BR-04, BR-14)

- Món hoặc lựa chọn **hết hiệu lực** khi `soldOutMode` khác null và (`soldOutUntil` null hoặc `now < soldOutUntil`). `HetHomNay` ghi `soldOutUntil` = 00:00 hôm sau giờ Việt Nam.
- Món `isSoldOut` = hết hiệu lực của món **hoặc** có nhóm `ChonMot` bắt buộc mà mọi lựa chọn chưa xóa đều hết.
- Kiểm dòng (giỏ, gửi đơn, gọi hộ): mỗi `choiceId` thuộc một nhóm của món, không trùng; nhóm `ChonMot` bắt buộc đúng 1, không bắt buộc 0–1; nhóm `ChonNhieu` 0…`maxSelect`; không chọn lựa chọn đang hết. Thứ tự lựa chọn trong `Options` theo thứ tự nhóm của món, rồi `sortOrder` lựa chọn.
- `menuStamp` / `PublicMenu.stamp` = chuỗi băm ngắn của (max `UpdatedAt` các bảng thực đơn, số món chưa xóa, ngày hiện tại giờ Việt Nam); ở mock = (phiên bản ghi gần nhất của các collection thực đơn, ngày hiện tại). Đổi stamp khi thực đơn đổi hoặc qua 00:00 (món "Hết trong hôm nay" bán lại).

### 3.9. Mã bàn, đường dẫn QR, QR chuyển khoản

- Mã bàn: 6 ký tự lấy ngẫu nhiên từ `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (BR-01: A–Z bỏ O, I, L và 2–9, nên không có 0, 1; TC-37), không trùng mọi mã đã cấp. Mock dùng `crypto.getRandomValues`.
- Đường dẫn QR = `{publicBaseUrl}/t/{mã bàn}`; `publicBaseUrl` = `NEXT_PUBLIC_PUBLIC_URL` nếu có (vd `https://pum-menu-qr.vercel.app`), không thì `window.location.origin`. QR vẽ ở FE bằng gói `qrcode`, mức sửa lỗi M, viền trắng 4 ô (NFR-05). Ảnh tải về `qr-ban-05.png` (tên bàn không dấu, kebab-case).
- QR chuyển khoản giả lập (FR-13, FR-23): chuỗi `VIETQR|{bankBin}|{bankAccount}|{subtotal}|{mã phiên}` (như demo Quản lý Nhà hàng), nội dung chuyển khoản là mã phiên `PB…`; hiện kèm tên ngân hàng theo BIN, số tài khoản, tên chủ tài khoản, số tiền, nội dung, câu "Nhân viên sẽ xác nhận khi nhận được tiền".

### 3.10. Số tính sẵn cho test

| Ca | Phép tính | Kết quả |
| :--- | :--- | ---: |
| TC-04 bước 1 | (65.000 + 10.000 + 15.000) × 1 | **90.000** |
| TC-04 bước 2 | (20.000 + 5.000) × 2 | **50.000** |
| Đơn chuẩn Bàn 05 (TC-06, TC-18) | 2 × 45.000 + 90.000 + 50.000 | **230.000** |
| Sau bỏ Trà tắc (TC-19) | 230.000 − 50.000 | **180.000** |
| Đơn 4 Bia (TC-22) | 4 × 22.000 | **88.000** |
| Phiên chuẩn (TC-12, TC-16, TC-42, demo bước 10) | 180.000 + 88.000 | **268.000** |
| Tiền thối (TC-27) | 300.000 − 268.000 | **32.000** |
| Còn thiếu (TC-29) | 268.000 − 200.000 | **68.000** |
| Hủy 1 Bia (TC-30) | dòng 3 × 22.000 = 66.000; 268.000 − 22.000 | **246.000** |
| Gọi món hộ (TC-26) | 2 × 75.000 | **150.000** |
| Gửi lại sau đổi giá (TC-32) | 1 × 79.000 | **79.000** |
| Trà tắc size M (TC-35) | 20.000 + 0 | **20.000** |
| Bàn 08 lúc nạp | 45.000 + 85.000 + 2 × 39.000 | 208.000 (chờ, tạm tính 0) |
| Bàn 10 lúc nạp | (329.000 + 100.000 + 25.000) + 89.000 + 10 × 25.000 + 4 × 25.000 + 49.000 | 942.000 (2 lon hủy 50.000 không tính) |

---

## 4. Quy ước riêng cho FE

### 4.1. Trang sau đăng nhập, menu, trang công khai

- **Menu sidebar** (`config/routes/main.routes.ts`, đã khai báo): Tổng quan `/dashboard` (`reports.view`), Nhận đơn `/orders/live` (`orders.view`), Thực đơn `/menu-items` (`menu-items.view`), Bàn và QR `/tables` (`tables.view`), Báo cáo `/reports` (`reports.view`), rồi nhóm Cài đặt của nền.
- **Trang sau đăng nhập** (SRS §2.2, TC-43): `homeAfterLogin = /dashboard`; `resolveHomePath` của nền tự rơi xuống mục menu đầu tiên có quyền, nên Quản lý, Quản trị vào Tổng quan, Nhân viên vào Nhận đơn. Nhân viên gõ `/reports`, `/tables`, `/dashboard` → `/forbidden`.
- **Trang khách** nằm ở `app/(public)/t/[tableCode]/` (`page.tsx`, `cart/page.tsx`, `orders/page.tsx`, `layout.tsx` riêng): **không** `AuthGuard`, không sidebar, không `DemoToolbar`, `metadata.robots = noindex`; render phía trình duyệt (`'use client'`), máy chủ chỉ trả khung và tiêu đề chung (§5 quyết định 8). `app/page.tsx` giữ `RootRedirect` của nền.
- **Bản in** ở `app/(print)/print/...` (§2.15), khai báo quyền trong `config/routes/hidden.routes.ts` (đã có).

### 4.2. Trình diễn trên một trình duyệt (chế độ `mock` trên Vercel)

Người xem demo `https://pum-menu-qr.vercel.app` thường chỉ có một trình duyệt, không có BE. Dữ liệu mock nằm trong localStorage nên **mọi tab cùng trình duyệt thấy cùng dữ liệu** và nhận sự kiện qua `BroadcastChannel`; cửa sổ ẩn danh hoặc trình duyệt khác là một bộ dữ liệu riêng, không thấy đơn của nhau. Vì vậy luồng "khách gọi món → nhân viên nhận đơn" chạy bằng **nhiều tab**:

1. **Lối vào trang khách** (đủ 5 chỗ, cùng một component `OpenGuestPageButton` của FE-Khách nhận `tableCode` hoặc cho chọn bàn):
   - Trang đăng nhập: thẻ "Xem như khách tại bàn" dưới các nút Đăng nhập nhanh: chọn bàn (mặc định Bàn 05, liệt kê từ `GET /api/demo/guest-tables`, ghi trạng thái), nút "Mở menu bàn này" mở **tab mới** `/t/{mã}`; dòng gợi ý "Đăng nhập Nhân viên ở tab này để nhận đơn". Chỉ hiện khi bật chế độ demo (`appConfig.demoToolbar`).
   - Màn nhận đơn: nút "Mở trang khách" trên thanh công cụ (chọn bàn rồi mở tab mới) và mục "Mở trang khách" trong ngăn kéo chi tiết bàn.
   - Bàn và QR: nút "Mở trang khách" từng bàn (FR-31, TC-37).
   - `DemoToolbar` mục "Trang khách" (§4.2 bước 4).
2. **Khung điện thoại**: `/t/...` mở trên màn hình rộng ≥ 768 px thì hiện giao diện khách trong khung điện thoại 390 × 844 ở giữa, bên cạnh là bảng nhỏ "Đây là màn hình điện thoại của khách" với các nút: "Mở Màn hình nhận đơn" (tab mới `/orders/live`; chưa đăng nhập thì qua trang đăng nhập), "Thêm điện thoại cùng bàn" (tab mới `?phone=2`, 3…), "Đổi bàn" (chọn bàn khác). Màn hình hẹp (điện thoại thật, chế độ thiết bị 390 × 844) hiện toàn màn, không có bảng này.
3. **Nhiều điện thoại trong một trình duyệt**: tham số `?phone=N` (N ≥ 2) cho tab một danh tính điện thoại riêng: mã thiết bị và giỏ lưu ở khóa có hậu tố `:p{N}` (§4.3). Không có tham số = điện thoại 1. Liên kết nội bộ của trang khách giữ nguyên `?phone`. Nhờ vậy TC-12, TC-22 ("điện thoại B") chạy được ở mock bằng tab `?phone=2`.
4. **`DemoToolbar` mục "Trang khách"** (thêm vào `components/demo/DemoToolbar.tsx`, hiện ở trang đã đăng nhập, cả hai chế độ):
   - Chọn bàn + "Mở menu khách" (tab mới).
   - "Giả lập khách gọi món": chọn ngẫu nhiên một bàn đang bật, trừ Bàn 05, Bàn 12 (bàn dành cho kịch bản test) và bàn đang có đơn chờ; 1–4 món còn bán, lựa chọn mặc định hoặc lựa chọn còn đầu tiên cho nhóm bắt buộc, số lượng 1–2 (bia 4–6), tên gọi ngẫu nhiên; gửi qua **chính service công khai** (`deviceId` = `demo-sim`) nên đi đúng mọi kiểm tra và hiện ở màn nhận đơn kèm âm báo.
   - "Giả lập gọi nhân viên": bàn có phiên mở ngẫu nhiên, lý do ngẫu nhiên trừ "Khác".
   - Công tắc "Khách tự gọi món mỗi 1–2 phút" (lưu sessionStorage của tab, mặc định tắt; chỉ chạy khi tab đang mở).
   - Dòng trạng thái nhận đơn; khi đang ngoài giờ hoặc tạm ngưng có nút "Nhận đơn cả ngày" (`POST /api/demo/ordering-all-day`) để người xem buổi tối vẫn thử được.
5. **Trang khách ngoài giờ ở mock**: dải vàng có thêm nút "Bật nhận đơn cả ngày (chỉ bản demo)" gọi thẳng handler mock (không cần đăng nhập, chỉ ở `isMockMode()` và `appConfig.demoToolbar`). Chế độ `api` chỉ hiện câu "Người xem demo: đăng nhập rồi bấm Demo → Nhận đơn cả ngày".
6. **Âm báo, tiêu đề tab**: màn nhận đơn có nút "Bật âm báo" (trình duyệt chặn tự phát âm trước khi người dùng bấm), lưu `localStorage` khóa `fnb-menu-qr:live-sound`. Số trên tiêu đề tab là số đơn chờ **mới chưa xem** (§4.4).

Kịch bản gợi ý cho người xem một mình: tab 1 đăng nhập Nhân viên ở `/orders/live` → bấm "Mở trang khách" Bàn 05 → tab 2 gọi món, gửi đơn → quay lại tab 1 thấy "(1) Nhận đơn", thẻ mới, âm báo → xác nhận → tab 2 thấy "Đã xác nhận".

### 4.3. Trang khách (SCR-01…SCR-04)

- Tối ưu điện thoại dọc 360–430 px (NFR-01): đầu trang logo, `store.name`, "Bàn 05"; thanh danh mục cuộn ngang dính đầu trang, chạm thì cuộn tới (IntersectionObserver tô danh mục đang xem); thanh dưới cố định trong tầm ngón cái: "Gọi nhân viên", "Món đã gọi", "Giỏ món (n) · tổng". Vùng chạm ≥ 44 px. Ảnh `loading="lazy"`, `useAssetUrl`.
- Tìm món: kính lúp, lọc theo tên không dấu khi gõ (UC-01 3a). Ngôn ngữ (P3): nút "EN" lưu `fnb-menu-qr:guest-lang`, dùng `nameEn` khi có.
- Chi tiết món: tấm trượt (`vaul` Drawer): ảnh lớn, mô tả, nhóm theo thứ tự, nhóm `ChonMot` dạng radio, `ChonNhieu` dạng checkbox; chọn sẵn mặc định; nhóm bắt buộc chưa chọn báo đỏ "Bắt buộc chọn 1" và khóa "Thêm vào giỏ"; chọn quá tối đa không cho, báo "Chọn tối đa {n}"; lựa chọn hết mờ; ô ghi chú dòng; số lượng 1–20; thành tiền tạm tính (§3.1). Món không có nhóm: nút "+" trên thẻ thêm thẳng 1.
- **Giỏ món** lưu `localStorage` khóa `fnb-menu-qr:cart:{mã bàn}` (điện thoại N ≥ 2: `…:p{N}`), `{ updatedAt, lines: CartLine[] }`, bỏ khi quá 4 giờ (BR-05). Dòng trùng (cùng món, cùng tập lựa chọn, cùng ghi chú) cộng số lượng. Tên gọi nhớ ở `fnb-menu-qr:guest-name`. Mã thiết bị `fnb-menu-qr:device` (hoặc `:p{N}`).
- **Gửi đơn**: gửi `expectedUnitPrice` từng dòng. Thành công → xóa giỏ, lưu `knownSession = sessionCode` ở `fnb-menu-qr:session:{mã bàn}`, sang "Món đã gọi". `MonVuaHet` → dòng trong `soldOutLines` báo đỏ "Món vừa hết", giỏ giữ nguyên. `GiaDaThayDoi` → cập nhật giá trong giỏ theo `priceChanges`, thông báo "Giá đã thay đổi", chờ khách bấm gửi lại (`clientRequestId` mới). `QuanTamNgung`, `NgoaiGioNhanDon`, `BanTamNgung`, `QuaSoDonCho` → hộp thông báo đúng `detail`, giỏ giữ nguyên.
- **Món đã gọi**: từ `live.session` (hoặc `endedSession`); đơn mới nhất trên; nhãn "Của bạn" khi `isMine`; dòng bị bỏ, đã hủy gạch ngang kèm `statusText`; tạm tính, ghi chú khi `pendingTotal > 0`; nút "Yêu cầu thanh toán" khóa khi `subtotal = 0` kèm "Chưa có món được quán xác nhận" (TC-17). Không có phiên: "Bàn chưa gọi món nào" + "Xem menu".
- **Yêu cầu thanh toán**: chọn Tiền mặt/Chuyển khoản, ô "Cần xuất hóa đơn GTGT"; chuyển khoản hiện QR (§3.9) với số tiền tạm tính. **Gọi nhân viên**: lý do nhanh, "Khác" kèm ô ghi chú; sau gửi hiện "Đã báo nhân viên, vui lòng chờ"; khi `myRequests` có trạng thái `DaXuLy` hiện "Nhân viên đã xử lý" (TC-14).
- **Kết thúc phiên**: `endedSession.status = DaDong` → màn "Cảm ơn quý khách, hẹn gặp lại", xóa giỏ, xóa `knownSession` khi khách bấm "Gọi món lần mới" (TC-27); `DaHuy` → giữ hiện đơn bị từ chối kèm lý do (TC-21); có `transferredToTableName` → "Bàn của quý khách đã chuyển sang {bàn mới}, vui lòng quét QR bàn mới" (BR-18).
- Dải vàng trên cùng khi không gửi được đơn: `ordering.message` hoặc (bàn tắt) "Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên" (UC-01 E3). Mã sai: trang lỗi đúng câu `MaQrKhongHopLe`, không hiện menu (TC-02).
- Màu chủ đạo trang khách theo `store.primaryColor` (cùng cơ chế `brand-color.ts` của nền).

### 4.4. Màn hình nhận đơn `/orders/live` (SCR-05…SCR-08)

- Tối ưu tablet ngang 1280 × 800 (NFR-06), sidebar thu gọn mặc định ở route này; không tự đăng xuất (dựa vào làm mới token của `lib/axios.ts`). Thanh trên: trạng thái nhận đơn, "Bật âm báo", "Tự in phiếu bếp" (công tắc, `localStorage` `fnb-menu-qr:auto-print`, mặc định bật), "Mở trang khách", "Gọi món hộ".
- Tab **Đơn**: cột "Chờ xác nhận" (`pending`) và "Chờ phục vụ" (`serving`). Thẻ: bàn, mã đơn, giờ gửi, đồng hồ chờ, tên gọi, nhãn "Tự xác nhận" / "Nhân viên gọi hộ", dòng món, lựa chọn, ghi chú, tổng; viền theo `waitLevel`. Chạm dòng → "Bỏ món" (lý do Hết món / Khác + ghi chú); bỏ hết thì khóa "Xác nhận", gợi ý "Từ chối" (TC-20). Thẻ chờ không có nút phục vụ (TC-25). "Đã phục vụ" từng dòng, "Phục vụ cả đơn"; thông báo nổi có "Hoàn tác" 10 giây.
- **Số đếm tiêu đề tab**: "({n}) Nhận đơn", `n` = số đơn `ChoXacNhan` đến qua sự kiện **sau khi** trang mở mà nhân viên chưa chạm vào thẻ hoặc chưa xử lý (thẻ có viền "Mới"); đơn có sẵn lúc tải trang không tính (TC-18 ra "(1)" dù dữ liệu mẫu đã có 2 đơn chờ). `n = 0` → "Nhận đơn".
- Tab **Yêu cầu**: `service-requests/pending`, dòng "Bàn 05 · Thêm đá · 0 phút", đỏ khi `isOverdue`, nút "Đã xử lý". Huy hiệu số trên tab.
- Tab **Bàn**: lưới theo khu, thẻ màu theo `TableStatus` (Trống, Đang phục vụ, Chờ thanh toán vàng kèm "Chuyển khoản · Cần HĐ GTGT", Tắt xám), giờ mở, số đơn, tạm tính, huy hiệu đơn chờ, yêu cầu. Chạm → ngăn kéo `TableSessionDto`: mã phiên, đơn, món, dòng bỏ/hủy, tạm tính; nút "Gọi món hộ", "Thu tiền" (khóa với lý do "Còn {n} đơn chờ xác nhận"), "Hủy món" (chỉ `orders.cancel`, TC-30), "Chuyển bàn" (P3), "In lại hóa đơn" (phiên đã đóng), "Mở trang khách". Bàn trống: "Gọi món hộ", "Mở trang khách".
- **Thu tiền**: hộp chọn phương thức; tiền mặt có ô số tiền + nút nhanh + "Tiền thối" (§3.3); chuyển khoản hiện QR, nút "Đã nhận tiền"; cảnh báo "Còn {n} món chưa phục vụ" có nút "Vẫn đóng phiên" (gửi `acknowledgeUnserved`). Thành công → in hóa đơn qua iframe, ngăn kéo đóng.
- **Gọi món hộ**: hộp thoại thực đơn dạng lưới từ `GET /api/menu`, dùng lại tấm chọn tùy chọn của trang khách; gửi `POST /api/orders`; in phiếu bếp.
- In phiếu bếp sau khi xác nhận, gọi hộ, và khi nhận `order-submitted` với `autoConfirmed` (nếu bật "Tự in phiếu bếp"); thẻ đơn có nút "In lại phiếu".

### 4.5. Thực đơn `/menu-items` (SCR-09)

- Tab Món, Danh mục, Nhóm tùy chọn. Người chỉ có `menu-items.view` + `availability` (Nhân viên) thấy danh sách món, công tắc "Còn món" ở món và lựa chọn, **không** có nút Thêm, Sửa, Xóa, kéo thả (TC-36). Tắt "Còn món" hỏi "Hết trong hôm nay" / "Hết tới khi mở lại".
- Form món: mã, tên, danh mục, ảnh (`POST image`), mô tả, giá, đơn vị, nhãn, gắn nhóm tùy chọn có kéo thả thứ tự; khung xem trước điện thoại bên phải dùng component thực đơn của trang khách (`GuestMenuPreview` của FE-Khách, nhận `PublicMenu` dựng từ form, FR-29).
- Món `everOrdered` khóa nút Xóa, gợi ý "Ẩn" (TC-33). Công tắc lựa chọn hết ghi chú "Áp dụng cho mọi món dùng nhóm {tên}".

### 4.6. Bàn và QR `/tables` (SCR-10, SCR-11)

- Tab Bàn: bảng theo khu, cột tên bàn, sức chứa, mã bàn, ảnh QR thu nhỏ, trạng thái, thao tác (Sửa, Bật/Tắt, Đổi mã QR có hộp xác nhận "Tấm QR cũ sẽ hết hiệu lực ngay, cần in lại", Mở trang khách, Tải PNG). Ô tick nhiều bàn + "In QR" (khóa khi chưa chọn, TC-41) mở tab `/print/qr?ids=…&layout=…` sau khi chọn mẫu.
- Tab Cài đặt nhận đơn (`order-settings.update`): giờ bắt đầu, kết thúc (gợi ý "Bằng nhau là nhận cả ngày"), chế độ xác nhận, "Tạm ngưng nhận đơn" 15 phút / 30 phút / Tới khi mở lại, "Mở nhận đơn lại".

### 4.7. Tổng quan, báo cáo

- Tổng quan `/dashboard`: thẻ số FR-01, biểu đồ đơn và doanh thu theo giờ hôm nay, lối tắt. Trang dùng `features/reports` (thay nội dung `app/(protected)/dashboard/page.tsx` của nền).
- Báo cáo `/reports`: tab Doanh thu (mặc định 30 ngày, đường kỳ trước làm nền), Món, Vận hành (bảng nhiệt thứ × giờ 9–23). Chọn nhanh Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn; chặn khoảng > 366 ngày trước khi gọi.
- Định dạng: tiền `formatVnd` (`268.000 ₫`), phút một chữ số thập phân dấu phẩy, tỉ lệ `%`.

### 4.8. Mock

- **Collection** (`mockDb.collection`, tên kebab-case, scope `business`): `categories`, `option-groups` (lựa chọn lồng trong bản ghi), `menu-items`, `dining-tables`, `table-sessions`, `orders` (dòng lồng trong bản ghi), `service-requests`. Kiểu bản ghi `*Record` trong `FE/src/types/menu-qr.ts`. Cài đặt nhận đơn, thông tin quán đọc/ghi `settingsDb` của nền (`@/mock/system-data`), id tài khoản bằng `userIdOf(username)`.
- **Seed**: `mockDb.registerSeed('demo-data', demoData)`, suy ra trường đúng `06` §5 (gồm `dayOffsetOfSlot`, giờ tương đối theo phút, `stableId` ở `06` §5.2), tính tiền bằng `pricing.ts`.
- **Bộ nhớ**: lịch sử 1.320 phiên trước hôm nay là dữ liệu chỉ đọc (không thao tác nào sửa phiên đã đóng ngày trước): giữ ở kho trong bộ nhớ dựng lại từ seed mỗi lần tải trang, **không** ghi localStorage; mock-db chỉ chứa phiên, đơn, yêu cầu **hôm nay** (phiên `d` vắng và `liveSessions`) và mọi thứ tạo trong phiên demo. Handler danh sách, báo cáo đọc hợp hai nguồn. Đặt lại dữ liệu xóa mock-db và dựng lại kho bộ nhớ.
- Mã `DH`, `PB` sinh trong handler theo ngày, nối tiếp số lớn nhất đã có ở hai nguồn. Lỗi trả đúng ProblemDetails, có `code` và trường mở rộng như §2.13 (dùng `domain(detail, { code, … })`, `conflict`, `notFound` của `mock-errors.ts`).
- **API công khai ở mock**: handler không gọi `requirePermission`, không đọc phiên đăng nhập (tab khách không đăng nhập vẫn chạy); `X-Device-Id` truyền bằng tham số hàm.
- Thời gian thực: `publishPosEvent` qua `BroadcastChannel` `fnb-menu-qr:pos-events` (§2.14).

### 4.9. Chia việc FE (hai agent làm song song)

Đã viết sẵn, **dùng chung, không agent nào tự đổi cấu trúc** (cần đổi hợp đồng thì sửa 07 trước, báo bên kia): `src/types/menu-qr.ts` (mọi DTO, enum, `*Record`, `PosEventMap`), `src/config/menu-qr-labels.ts`, `src/config/permissions.ts`, `src/config/route-path.ts`, `src/config/routes/main.routes.ts`, `src/config/routes/hidden.routes.ts`, `src/config/api-routes.ts`, `src/config/setting-labels.ts`, `src/mock/seed/*.json`, `scripts/generate-orders.mjs`. Được **thêm** hằng mới vào các file config này (nối cuối nhóm của mình), không sửa dòng của bên kia.

| | **FE-Khách** | **FE-Quản lý** |
| :--- | :--- | :--- |
| Màn hình | `/t/[tableCode]`, `/cart`, `/orders` (SCR-01…04); `/orders/live` (SCR-05…08); bản in phiếu bếp, hóa đơn; lối vào trang khách ở trang đăng nhập; mục "Trang khách" của `DemoToolbar` | `/menu-items` (SCR-09), `/tables` + bản in QR (SCR-10, 11), `/dashboard` (SCR-12), `/reports` (SCR-13), nhãn và kiểm tra Cài đặt chung (đã có sẵn) |
| Thư mục feature sở hữu | `features/pos/` (lõi dùng chung, xem dưới), `features/guest/`, `features/live/` | `features/menu-items/`, `features/tables/`, `features/reports/` |
| Route `app/` | `app/(public)/t/**`, `app/(protected)/orders/live/**`, `app/(print)/layout.tsx`, `app/(print)/print/kitchen-ticket/**`, `app/(print)/print/receipt/**` | `app/(protected)/menu-items/**`, `app/(protected)/tables/**`, `app/(protected)/reports/**`, `app/(protected)/dashboard/page.tsx` (thay nội dung), `app/(print)/print/qr/**` |
| Collection mock-db sở hữu (khai báo, nạp seed) | **Tất cả** trong `features/pos/mock/`: `menu.store.ts` (`categories`, `option-groups`, `menu-items`, `dining-tables`) và `session.store.ts` (`table-sessions`, `orders`, `service-requests`, kho lịch sử trong bộ nhớ) | Không khai báo collection; handler của mình (`features/*/mock/*.mock.ts`) đọc, ghi qua API của store |
| Handler mock | `features/guest/mock/` (API công khai, demo giả lập), `features/live/mock/` (đơn, phiên, yêu cầu, gọi hộ) | `features/menu-items/mock/` (danh mục, món, nhóm, `/api/menu`), `features/tables/mock/` (bàn, mã QR, `order-settings`, `store-profile`, `demo/guest-tables`, `demo/ordering-all-day`), `features/reports/mock/` |
| File nền được sửa | `components/demo/DemoToolbar.tsx` (thêm một `Section`), `features/auth/pages/LoginPage.tsx` (chèn một thẻ), `app/(protected)/layout.tsx` (gắn `RealtimeBridge`), `src/lib/realtime.ts` (tạo mới), `package.json` (thêm `qrcode`, `@types/qrcode`, `@microsoft/signalr`), `app/theme.css` (token trạng thái) | Không sửa file nền ngoài trang dashboard; cần gói mới thì nhờ FE-Khách thêm |

**Lõi `features/pos/` (FE-Khách viết, FE-Quản lý chỉ import).** Mốc 1, làm **trước tiên** để FE-Quản lý dùng được ngay:

| File | Xuất ra |
| :--- | :--- |
| `lib/vn-time.ts` | `vnNow()`, `vnDateKey(iso)`, `vnMinutesOfDay(iso)`, `startOfNextVnDay(iso)`, `dayOffsetOfSlot(d, isoToday)` (chép demo 03) |
| `lib/pricing.ts` | `unitPrice(itemPrice, options)`, `lineTotal(line)`, `orderTotal(items)`, `sessionSubtotal(orders)`, `pendingTotal(orders)` (§3.1–3.2) |
| `lib/menu-rules.ts` | `isSoldOutNow(mode, until, now)`, `itemIsSoldOut(item, groups, now)`, `validateChoices(item, groups, choiceIds)` → lỗi BR-04, `menuStamp(...)` (§3.8) |
| `lib/ordering-rules.ts` | `orderingStatus(settings, now)` → `OrderingStatus` (§3.4), `tableCode()` sinh mã BR-01, `qrUrl(code)` (§3.9) |
| `lib/vietqr.ts` | `vietQrPayload(store, amount, sessionCode)` |
| `components/MenuImage.tsx`, `components/QrImage.tsx` | Ảnh món (ô màu danh mục khi thiếu ảnh); vẽ QR từ chuỗi (gói `qrcode`) |
| `mock/menu.store.ts` | Collection thực đơn + bàn; `menuIds.category(code)`…, `getMenuSnapshot()`, `findTableByCode(code)` |
| `mock/pos-events.ts` | `publishPosEvent<K extends PosEventName>(name, payload: PosEventMap[K])` |

Mốc 2: `mock/session.store.ts` (`allSessions()`, `allOrders()`, `allRequests()` hợp kho lịch sử + mock-db, `nextOrderCode(day)`, `nextSessionCode(day)`), `components/GuestMenuPreview.tsx` (FE-Quản lý dùng ở khung xem trước; trước khi có thì hiện khung trống). FE-Quản lý viết báo cáo trên `allSessions/allOrders/allRequests` (kiểu `*Record`); trước mốc 2 có thể chạy với mảng rỗng.

Service: mỗi feature có `services/*.service.ts` riêng, chỉ gọi đường dẫn trong `apiRoutes`; trang khách dùng `features/guest/services/public-api.ts` (axios không token). Query key: `['menu']`, `['menu-items', query]`, `['option-groups']`, `['categories']`, `['tables']`, `['order-settings']`, `['store-profile']`, `['orders-live']`, `['order', id]`, `['table-board']`, `['table-session', id]`, `['service-requests-pending']`, `['reports', loại, query]`, `['public', code, 'info' | 'menu' | 'live']`; `RealtimeBridge` (FE-Khách) làm mới theo bảng §2.14 bằng các key này, nên FE-Quản lý dùng đúng key.

### 4.10. Thứ tự làm BE (một agent)

Namespace theo `BE-CAU-TRUC-THU-MUC.md`; Area `Pos`, module `Menu`, `Tables`, `Orders`, `Sessions`, `Requests`, `Reports`, `Public`. Chép nguyên từ demo Quản lý Nhà hàng: `Application/Common/Time/VietnamTime.cs`, `VietnamDates.cs`, `Infrastructure/Persistence/Seeders/SeedSlots.cs`, `Application/Interfaces/Services/Realtime/IPosEventPublisher.cs`, `Infrastructure/Implementations/Services/Realtime/NullPosEventPublisher.cs`, `API/Hubs/PosHub.cs`, `API/Configuration/RealtimeSetup.cs`, `Application/Common/Exceptions/PosConflicts.cs` (đổi tên sự kiện, mã lỗi theo file này).

1. **Domain**: `Domain/Enums/Pos/{Menu,Tables,Orders,Requests}/*.cs` (mọi enum `06` §4); `Domain/Entities/Pos/Menu/{Category,MenuItem,OptionGroup,OptionChoice,MenuItemOptionGroup}.cs`, `Pos/Tables/DiningTable.cs`, `Pos/Orders/{TableSession,Order,OrderItem}.cs`, `Pos/Requests/ServiceRequest.cs`; `Domain/Entities/Pos/PosRules.cs` (hằng số `06` §3), `PosErrors.cs` (mã lỗi §2.13), `OrderPricing.cs` (§3.1–3.2), `OrderingClock.cs` (§3.4, §3.8).
2. **Persistence**: `Infrastructure/Persistence/Configurations/Pos/{MenuConfigurations,TableConfigurations,OrderConfigurations,RequestConfigurations}.cs` (index, unique, concurrency `06` §4); `AppDbContext` tự nạp cấu hình (không thêm `DbSet`); migration `Add_Pos` (Postgres).
3. **Seed**: `PosSeedRecords.cs` (kiểu đọc JSON `06` §5.4), `DemoDataSeeder.cs` suy ra đúng `06` §5; đối chiếu số `06` §5.6 bằng `GET /api/reports/revenue` 89 ngày. `project.json` đã có quyền, tài khoản, cài đặt (SystemSeeder nền tự đồng bộ).
4. **Thực đơn**: DTO, validator, mapping, `ICategoryService`, `IMenuItemService`, `IOptionGroupService`, `IMenuQueryService` (`/api/menu`); controller `Controllers/Menu/{Categories,MenuItems,OptionGroups,Menu}Controller.cs`. `Permissions.cs` thêm nhóm như §1.
5. **Bàn, cài đặt**: `ITableService` (mã BR-01 bằng `RandomNumberGenerator`), `IOrderSettingsService` (đọc, ghi `System_Settings`, kiểm cùng quy tắc khi `PUT /api/settings`), `IStoreProfileService`; controller `Tables`, `OrderSettings`, `StoreProfile`; bổ sung `DemoController` §2.12.
6. **API công khai**: `IPublicTableService` + `Controllers/Public/PublicTablesController.cs` (`[AllowAnonymous]`, route `api/public/tables/{code}`), bộ lọc `[PublicRateLimit("public-read" | "public-write")]` + `IPublicRateLimiter` (§2.7) trả ProblemDetails 429; 404 có `code` qua bộ lọc `[PosNotFoundCode]` (không sửa `ExceptionMiddleware` nền).
7. **Đơn, phiên, yêu cầu**: `IOrderService` (gọi hộ, xác nhận, từ chối, phục vụ, hủy), `ITableSessionService` (board, chi tiết, thu tiền, chuyển bàn), `IServiceRequestService`; dùng chung một `OrderSubmission` (kiểm dòng, chụp giá, mở phiên, BR-08) cho cả khách và gọi hộ; mọi ghi trong transaction, phát sự kiện sau khi commit.
8. **Báo cáo**: `IReportService` + repository riêng `IPosReportRepository` (truy vấn gộp), controller `Reports`.
9. **Thời gian thực**: `SignalRPosEventPublisher` gửi sự kiện §2.14; hub map `/hubs/pos`.
10. Kiểm: `dotnet publish` không lỗi (máy dev không có Docker/Postgres; dùng Postgres portable nếu cần chạy), chạy tay các TC trọng tâm (TC-06, 10, 11, 19, 21, 22, 27, 28, 30, 32, 38) qua Swagger.

---

## 5. Quyết định thiết kế (BE và FE làm theo)

Những điểm SRS, use case chưa nói rõ đã được chốt như sau; FE mock làm giống BE để hai chế độ ra cùng kết quả.

| # | Chỗ | Quyết định | Lý do |
| :---: | :--- | :--- | :--- |
| 1 | Tổng quan và vai trò `STAFF` | `/dashboard` và `GET /api/reports/dashboard` gắn `reports.view`; `dashboard.view` của nền không dùng | `system.json` cấp sẵn `dashboard.view` cho `STAFF`, dự án không gỡ được; SRS: Tổng quan chỉ cho Quản lý (TC-43) |
| 2 | Tài khoản | Dùng đúng `admin`, `quanly`, `nhanvien` của nền (đổi mô tả); thêm `nhanvien2`, `nhanvien3` không có thẻ Đăng nhập nhanh để dữ liệu mẫu có nhiều người xác nhận | SRS §2.2 |
| 3 | Xác thực khách | Chỉ bằng mã bàn trong URL; đổi mã QR là thu hồi; không có token khác | BR-01; khách không tài khoản, QR in sẵn không đổi được nội dung |
| 4 | Mã bàn | Unique trên mọi dòng kể cả bàn đã xóa; sinh bằng bộ sinh ngẫu nhiên mật mã | Mã cũ không bao giờ sống lại; không đoán được từ tên bàn (BR-01) |
| 5 | Bàn tắt | Chặn cả gửi đơn lẫn gửi yêu cầu; nhân viên cũng không gọi món hộ cho bàn tắt | BR-17 "tạm ngưng nhận đơn qua QR"; bàn tắt là không dùng |
| 6 | Giới hạn tần suất | Khóa theo IP + mã bàn: ghi 30/phút, đọc 120/phút | NFR-04; khách cùng wifi quán chung một IP công cộng, khóa chỉ theo IP sẽ chặn nhầm cả quán |
| 7 | Khách nhận cập nhật | Hỏi lại `live` mỗi 5 giây (và khi tab hiện lại), không SignalR | NFR-03 cho phép; điện thoại khách hay khóa màn, đổi mạng, Safari ngắt WebSocket ở nền; khách ẩn danh vào hub cần cơ chế xác thực riêng; 20 bàn × vài máy là tải nhỏ |
| 8 | Trang khách render | Phía trình duyệt; máy chủ không kiểm mã bàn | Ở mock mã bàn đổi trong localStorage, máy chủ Next không biết; trang QR không cần SEO (`noindex`) |
| 9 | Giờ nhận đơn | Bằng nhau = cả ngày; giờ kết thúc nhỏ hơn = qua đêm | Quán nhậu mở qua 0 giờ; demo công khai cần thử được mọi giờ (nút "Nhận đơn cả ngày") |
| 10 | Gọi nhân viên khi quán tạm ngưng, ngoài giờ | Tạm ngưng vẫn gọi được; ngoài giờ chỉ gọi được khi bàn đang có phiên; yêu cầu thanh toán chỉ cần phiên có tạm tính > 0 | Tạm ngưng là bếp quá tải, không phải đóng cửa; khách ngồi quá 22:00 vẫn cần tính tiền; chặn ảnh QR bị chụp gọi bậy ban đêm |
| 11 | Đơn nhân viên gọi hộ khi bàn đang chờ thanh toán | Cũng hủy yêu cầu thanh toán, phiên về "Đang phục vụ" như khách gửi | Tạm tính đổi nên QR chuyển khoản cũ sai số tiền (BR-12 suy rộng) |
| 12 | Gọi nhân viên lặp | Chống lặp theo cùng bàn **và cùng lý do** trong 60 giây; lý do khác tạo yêu cầu mới | TC-15; hai người cùng bàn gọi "Thêm đá" và "Dọn bàn" là hai việc |
| 13 | Màu thẻ "Chờ phục vụ" | Vàng từ 15 phút, đỏ từ 25 phút kể từ lúc xác nhận | SRS chỉ quy định đơn chờ xác nhận; cần dấu hiệu món ra chậm |
| 14 | Số trên tiêu đề tab | Số đơn chờ mới đến sau khi mở trang, chưa chạm, chưa xử lý | TC-18 ra "(1) Nhận đơn" trong khi dữ liệu mẫu luôn có 2 đơn chờ (NFR-07) |
| 15 | In phiếu bếp | `iframe` ẩn; đơn tự xác nhận chỉ tự in ở thiết bị bật "Tự in phiếu bếp" | FR-18; nhiều tablet cùng mở thì không in trùng; trình duyệt chặn cửa sổ bật lên tự động |
| 16 | Lựa chọn hết | Áp cho mọi món dùng nhóm | FR-28 nhóm dùng chung; UC-10 1a |
| 17 | Bỏ món lý do "Hết món" khi món đã "Hết tới khi mở lại" | Giữ nguyên chế độ cũ | BR-10 chỉ để món không bán tiếp; không rút ngắn thời gian hết |
| 18 | Từ chối lý do "Hết món" | Không tự đổi món sang hết | BR-10 chỉ nói bỏ món; từ chối cả đơn không chỉ rõ món nào hết |
| 19 | Nhóm "chọn nhiều" | Không bắt buộc, không có mặc định | BR-04 "chọn từ 0"; đơn giản form |
| 20 | Dòng của đơn bị từ chối | Giữ `ChoXacNhan`; đơn giữ tổng lúc gửi | Trạng thái đơn đã đủ nghĩa; báo cáo giá trị đơn bị từ chối |
| 21 | Phiên tự hủy | Yêu cầu gọi nhân viên của bàn giữ nguyên | Nhân viên tự xử lý, không mất dấu |
| 22 | Đóng phiên tạm tính 0 | Cho phép với tiền mặt 0 ₫ | Mọi món bị hủy vẫn cần trả bàn |
| 23 | Thu tiền khi khách vừa gọi thêm | `version` của phiên; lệch → 409, nhân viên xem lại số tiền | UC-08: số tiền thu phải bằng tạm tính mới nhất |
| 24 | Tên quán trên trang khách | `Store.Name` (Cài đặt chung, nhóm Quán); logo, màu theo `Brand.*` | Giống demo POS Quán Cafe: `Brand.AppName` là tên sản phẩm quản lý |
| 25 | Khu vực bàn | Chữ tự do trong `Pos_DiningTables.Zone`, không có bảng khu vực | SRS §5.1 khu vực là thuộc tính của bàn |
| 26 | Lịch sử ở chế độ mock | Chỉ đọc, giữ trong bộ nhớ, không ghi localStorage | Giới hạn ~5 MB của localStorage |
| 27 | Dữ liệu mẫu hôm nay | Giờ tương đối theo phút so với lúc nạp; ngày lịch sử ánh xạ theo thứ thật (`06` §5.3) | Lúc demo luôn có đơn chờ 11 phút, yêu cầu chờ 4 phút; "cuối tuần đông hơn" đúng thứ thật |
| 28 | Điện thoại thứ hai ở mock | Tab cùng trình duyệt với `?phone=2`, không dùng cửa sổ ẩn danh | Ẩn danh là localStorage khác, không thấy dữ liệu demo |
| 29 | Giả lập khách gọi món | Đi qua service công khai thật, tránh Bàn 05, 12 | Đơn giả cũng qua mọi kiểm tra; không làm hỏng bàn của kịch bản test |
| 30 | Hủy món | Quản lý nhập lý do tự do (có gợi ý), không có enum | BR-15 "bắt buộc lý do"; TC-30 dùng "Khách đổi ý" |
| 31 | Nhật ký thao tác | Phiên, đơn, dòng, yêu cầu không ghi `System_AuditLogs` | Ghi rất nhiều; bản ghi đã chụp người, giờ thao tác |
| 32 | Hoàn tác "Đã phục vụ" | BE cho 60 giây kể từ `servedAt`, FE hiện nút 10 giây | Bù độ trễ mạng, như demo Quản lý Nhà hàng |
| 33 | Lọc, tìm món | `GET /api/menu-items`: `status` lọc theo trạng thái suy ra (`An` > `HetMon` > `DangBan`); `search` theo mã, tên, tên tiếng Anh; vắng `sortBy` → (thứ tự danh mục, `sortOrder`) | Khớp FE mock |
| 34 | Bàn, món khi sửa | Tên bàn trùng so không phân biệt hoa thường (Postgres: cả dấu); thêm bàn `sortOrder = max + 10`; sửa món đổi danh mục mà không gửi `sortOrder` thì xuống cuối danh mục mới | Khớp FE mock |
| 35 | Báo cáo | `daily[i].previousRevenue` = ngày cùng vị trí kỳ trước; `items` lọc `categoryId` và lấy `categoryName` theo danh mục **hiện tại** của món; dòng hủy không lý do → "Khác"; `OperationsReport.orderCount` gồm đơn bị từ chối, `requestCount` mọi loại, mọi trạng thái; `heatmap` đủ 7 × 24 ô; `byHour` của Tổng quan đếm mọi đơn gửi hôm nay, doanh thu theo giờ đóng phiên; `avgConfirmMinutes` tính đơn khách không tự xác nhận đã có `handledAt` (gồm bị từ chối: 1.216 đơn ở `06` §5.6) | Khớp FE mock, số `06` §5.6 |
| 36 | Hoàn tác phục vụ khi phiên đã đóng | `PhienDaDong` (như phục vụ, hủy món) | Phiên đã đóng không đổi món |
| 37 | Thu tiền | Đóng phiên chuyển "Đã xử lý" mọi yêu cầu đang chờ của bàn (kể cả gọi nhân viên chưa gắn phiên); `needVatInvoice` vắng lấy theo yêu cầu thanh toán đang chờ | BR-13 |
| 38 | In phiếu bếp | In sau khi nhân viên xác nhận đơn và sau khi gọi món hộ (luôn in); công tắc "Tự in phiếu bếp" chỉ áp cho đơn tự xác nhận (`order-submitted` có `autoConfirmed`) | FR-18; quyết định 15 |
| 39 | Lý do từ chối | `RejectOrderRequest.reason` bắt buộc: vắng → 400 `errors.reason` "Chọn lý do từ chối" (BE không coi vắng là giá trị đầu của enum) | Mock và BE cùng kết quả |
| 40 | Mã thiết bị ở chế độ `api` | FE gửi header `X-Device-Id` mọi request công khai và `deviceId` trong body khi ghi; BE lấy body, body trống thì lấy header. Mock nhận `deviceId` qua tham số hàm | §2.7; đánh dấu `isMine`, lọc `myRequests` |
| 41 | Số tiền, trường vắng trong JSON của BE | Số tiền là số thập phân (Postgres trả `268000.00`), FE dùng như `number`, không so chuỗi. Trường tùy chọn BE trả `null` (không bỏ trường): FE kiểm bằng `!= null` hoặc `??`, không dùng `=== undefined` | System.Text.Json mặc định; `PublicLiveState.session` cần có mặt kể cả khi null |
| 42 | ETag `/menu` | FE không tự gửi `If-None-Match`; trình duyệt tự kiểm lại bằng cache HTTP, 304 tới JS như 200 có thân. Gửi `If-None-Match: "{stamp}"` (có ngoặc kép) trùng → 304 | §2.7 |
