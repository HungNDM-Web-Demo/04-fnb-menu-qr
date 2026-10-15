# Kịch bản demo — Menu QR Gọi món

> Dùng khi trình bày cho chủ quán ăn, quán nhậu, quán cafe muốn khách tự gọi món. Thời lượng 12–15 phút. Đi theo một bàn khách từ lúc ngồi xuống quét QR tới lúc thanh toán, xen giữa là góc nhìn của nhân viên và chủ quán.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 3 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có 90 ngày số liệu, vài bàn đang ngồi, 2 đơn chờ xác nhận, 1 yêu cầu chờ quá 3 phút
- [ ] Đổi tên quán (Cài đặt chung → nhóm Quán), logo, màu (nhóm Thương hiệu) theo thương hiệu khách nếu đã biết: trang menu của khách lấy đúng thông tin này
- [ ] Chuẩn bị điện thoại thật để quét QR Bàn 05 (`/t/K7M2QX`). Link demo phải mở được từ điện thoại (link online hoặc cùng mạng wifi với máy chạy demo). Không có điện thoại: bấm "Mở trang khách" để mở tab thứ hai cùng trình duyệt (bản demo dữ liệu mẫu không dùng được cửa sổ ẩn danh), màn hình rộng sẽ hiện khung điện thoại; người thứ hai cùng bàn là nút "Thêm điện thoại cùng bàn"
- [ ] Cửa sổ chính đăng nhập `nhanvien` ở Màn hình nhận đơn, bật loa để khách nghe âm báo đơn mới
- [ ] Ghi nhớ số liệu: Gỏi cuốn tôm thịt 45.000 ₫, Cơm chiên dương châu 65.000 ₫ (Trứng ốp la +10.000 ₫, Lạp xưởng +15.000 ₫), Trà tắc 20.000 ₫ (Size L +5.000 ₫), Bia Sài Gòn Special 22.000 ₫

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3104` hoặc link online |
| Trang khách Bàn 05 | `http://localhost:3104/t/K7M2QX` (hoặc bấm "Mở trang khách" ở Bàn và QR) |
| Swagger | `https://localhost:7104/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, thương hiệu trên trang khách |
| `quanly` | Quản lý | Tổng quan, in QR, thực đơn và giá, cài đặt nhận đơn, báo cáo |
| `nhanvien` | Nhân viên | Màn hình nhận đơn, xác nhận đơn, báo hết món, thu tiền |
| — | Khách | Trang menu trên điện thoại, không cần tài khoản |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh".

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung 7 giờ tối, quán kín bàn, 3 bạn nhân viên chạy không kịp ghi order. Em cho anh/chị xem một bàn khách tự gọi món từ lúc ngồi xuống tới lúc trả tiền."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Quản lý | Đăng nhập `quanly`, mở Tổng quan: 7 bàn đang ngồi, 2 đơn chờ xác nhận, doanh thu tối nay, thời gian xác nhận đơn trung bình | Chủ quán ở nhà vẫn biết quán đang đông cỡ nào, nhân viên xử lý đơn nhanh hay chậm |
| 2 | Quản lý | Mở Bàn và QR, chọn Bàn 05, In QR mẫu thẻ dựng A6; đưa điện thoại quét mã ngay trên màn hình | Mỗi bàn một mã riêng, tự in ở văn phòng, không cần mua thiết bị |
| 3 | Khách | Trên điện thoại: menu Bàn 05 có logo quán, ảnh món, nhãn "Bán chạy", thanh danh mục cuộn ngang; Khoai tây chiên mờ "Hết món" | Không cài app, không đăng nhập; menu luôn đúng món còn bán, đúng giá hiện tại |
| 4 | Khách | Chọn 2 Gỏi cuốn tôm thịt; Cơm chiên dương châu thêm Trứng ốp la và Lạp xưởng (90.000 ₫); 2 Trà tắc size L; thử Mì xào hải sản thấy bắt buộc chọn mức cay rồi bỏ; nhập tên gọi "Anh Tuấn", gửi đơn 230.000 ₫ | Khách tự chọn tùy chọn, quán không ghi nhầm "ít cay" thành "cay nhiều"; tiền tự cộng |
| 5 | Nhân viên | Đổi sang Nhân viên: đơn Bàn 05 vừa hiện kèm âm báo. Quầy báo hết tắc: bỏ dòng Trà tắc lý do "Hết món", bấm Xác nhận; phiếu bếp mở bản in | Đơn khách gửi phải qua tay nhân viên mới vào bếp, chống đặt bậy; món hết bỏ ngay trên đơn, không phải chạy ra bàn báo |
| 6 | Khách | Điện thoại hiện đơn "Đã xác nhận", Trà tắc gạch ngang "Không phục vụ được: Hết món"; Trà tắc trên menu đã mờ; tạm tính 180.000 ₫ | Khách biết ngay món nào không có để gọi món khác, không phải chờ rồi mới biết |
| 7 | Khách | Người thứ hai cùng bàn quét QR, gọi 4 Bia Sài Gòn Special; đơn tự xác nhận | Cả bàn cùng gọi được; bàn đã có khách thật thì đơn sau vào thẳng, nhân viên đỡ một thao tác |
| 8 | Khách | Bấm "Gọi nhân viên" → "Thêm đá". Nhân viên thấy yêu cầu Bàn 05, bấm Đã xử lý; yêu cầu Bàn 14 đỏ vì đã chờ hơn 3 phút | Khách không phải vẫy tay gọi; quản lý biết yêu cầu nào đang bị bỏ quên |
| 9 | Nhân viên | Mang món ra, bấm "Phục vụ cả đơn"; điện thoại khách hiện "Đã phục vụ" | Khách và quán cùng biết món nào còn chờ |
| 10 | Khách | Bấm "Yêu cầu thanh toán", chọn Chuyển khoản; điện thoại hiện mã QR 268.000 ₫ (180.000 + 88.000), nội dung là mã phiên bàn | Khách không phải chờ nhân viên mang bill; số tiền và nội dung có sẵn, không chuyển nhầm |
| 11 | Nhân viên | Tab Bàn: Bàn 05 vàng "Chờ thanh toán · Chuyển khoản"; mở phiên, kiểm tra 268.000 ₫, bấm "Đã nhận tiền", in hóa đơn; điện thoại khách hiện "Cảm ơn quý khách" | Thu tiền nhanh, bàn trống ngay cho lượt khách sau |
| 12 | Quản lý | Đổi sang Quản lý: sửa giá Bánh xèo miền Tây từ 75.000 ₫ lên 79.000 ₫, xem khung điện thoại thấy giá mới ngay; mở Báo cáo: món bị bỏ nhiều nhất, tỉ lệ khách tự gọi, đơn theo khung giờ | Đổi giá không phải in lại menu, không phải in lại QR; số liệu để sắp người đúng giờ cao điểm |

> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai sẽ nhập thực đơn, ảnh món, sơ đồ bàn của quán mình và in bộ QR theo mẫu thương hiệu của quán."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Khách chụp lại mã QR rồi ở nhà đặt bậy thì sao? | Đơn đầu tiên của mỗi bàn phải nhân viên xác nhận; mỗi bàn tối đa 3 đơn chờ; quản lý đổi mã QR một chạm là ảnh chụp cũ hết tác dụng. Bản triển khai có thể chỉ cho gửi đơn khi điện thoại dùng wifi của quán. |
| Khách lớn tuổi không biết quét QR? | Nhân viên gọi món hộ trên tablet, đơn vào cùng phiên bàn, tính tiền chung. |
| Khách có phải cài app không? | Không. Camera điện thoại quét là mở bằng trình duyệt, chạy trên cả iPhone và Android. |
| Khách thanh toán online luôn được không? | Demo hiện QR chuyển khoản có sẵn số tiền, nhân viên bấm xác nhận. Bản triển khai nối cổng thanh toán hoặc ngân hàng để tự xác nhận tiền về và tự đóng bàn. |
| Đơn có tự in ra bếp không? | Demo mở bản in phiếu bếp qua trình duyệt khi xác nhận. Bản triển khai in thẳng ra máy in nhiệt ở bếp, quầy bar, hoặc đẩy vào màn hình bếp (xem demo Quản lý Nhà hàng). |
| Đổi giá, đổi món có phải in lại QR không? | Không. QR chỉ chứa đường dẫn của bàn; menu luôn lấy từ hệ thống nên đổi giá là khách thấy ngay. |
| Quán tôi có khách nước ngoài? | Bản triển khai có menu song ngữ Việt/Anh, khách tự chuyển ngôn ngữ. |
| Có lấy được số điện thoại khách để chăm sóc không? | Demo không có tài khoản khách để khách gọi món nhanh nhất. Bản triển khai có thể thêm đăng ký thành viên, tích điểm. |
| Wifi quán yếu thì sao? | Trang menu nhẹ, ảnh được nén, tải dưới 3 giây trên 4G; khách dùng 4G của mình vẫn gọi được. |
| Nối với phần mềm bán hàng quán đang dùng được không? | Được nếu phần mềm đó có API; cần khảo sát. Hoặc dùng luôn màn hình nhận đơn và hóa đơn của demo này. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số bàn, số khu vực, giờ mở cửa, có máy in bếp chưa, muốn xác nhận đơn thủ công hay tự động
- [ ] Xin ảnh món và thực đơn hiện tại để dựng bản thử
- [ ] Gửi link demo, link trang khách Bàn 05 và tài khoản `nhanvien`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
