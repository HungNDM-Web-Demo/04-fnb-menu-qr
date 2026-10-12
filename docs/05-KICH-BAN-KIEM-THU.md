# Kịch bản kiểm thử nghiệm thu — Menu QR Gọi món

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi lượt test; test case ghi "Sau TC-xx" thì chạy nối tiếp test case đó |
| Tài khoản | Nhân viên, Quản lý theo cột "Vai trò", dùng "Đăng nhập nhanh". Khách không đăng nhập, mở trang `/t/{mã bàn}` |
| Thiết bị | Khách: điện thoại thật hoặc chế độ thiết bị di động 390×844. "Điện thoại B" là một trình duyệt khác hoặc cửa sổ ẩn danh. Nhân viên: cửa sổ 1280×800 |
| Thời gian thực | Mở trang khách và Màn hình nhận đơn song song; chế độ `mock` dùng hai tab cùng trình duyệt |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

Dữ liệu mẫu dùng trong test:

- Cài đặt nhận đơn: giờ nhận đơn 09:00–22:00; chế độ "Tự xác nhận khi bàn đã có đơn được xác nhận".
- Bàn: Bàn 05 mã `K7M2QX` (Trống); Bàn 08 mã `P9C4WV` (đang mở phiên, có 1 đơn chờ xác nhận gửi 11 phút trước); Bàn 12 mã `R4TZ8N` (Trống); Bàn 14 mã `M3XH7B` (đang mở phiên, có yêu cầu "Gọi nhân viên – Thêm đá" gửi 4 phút trước); Bàn 20 mã `H3WP6D` (đang tắt).
- Món: "Gỏi cuốn tôm thịt" 45.000 ₫; "Bánh xèo miền Tây" 75.000 ₫; "Cơm chiên dương châu" 65.000 ₫ với nhóm "Thêm" (chọn nhiều, tối đa 2): Trứng ốp la +10.000 ₫, Lạp xưởng +15.000 ₫, Chả lụa +12.000 ₫; "Mì xào hải sản" 85.000 ₫ với nhóm "Mức cay" (chọn một, bắt buộc, không mặc định): Không cay, Cay vừa, Cay nhiều, đều +0 ₫; "Trà tắc" 20.000 ₫ với nhóm "Size" (chọn một, bắt buộc, mặc định M): M +0 ₫, L +5.000 ₫; "Bia Sài Gòn Special" 22.000 ₫/lon; "Khoai tây chiên" 45.000 ₫ đang "Hết món".
- **Đơn chuẩn Bàn 05** (điện thoại A, tên gọi "Anh Tuấn"): 2 Gỏi cuốn tôm thịt = 90.000 ₫; 1 Cơm chiên dương châu + Trứng ốp la + Lạp xưởng = (65.000 + 10.000 + 15.000) × 1 = 90.000 ₫; 2 Trà tắc size L = (20.000 + 5.000) × 2 = 50.000 ₫; tổng 230.000 ₫.
- **Phiên chuẩn Bàn 05:** Đơn chuẩn được xác nhận và bỏ dòng Trà tắc (còn 180.000 ₫), cộng đơn 4 Bia Sài Gòn Special từ điện thoại B = 88.000 ₫; tạm tính 268.000 ₫. Tạo bằng TC-06, TC-19, TC-22.

---

## 2. Test case

### 2.1. Khách xem menu và gửi đơn

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Quét QR mở đúng bàn | Khách | 1. Mở `/t/K7M2QX` trên điện thoại | Không yêu cầu đăng nhập; đầu trang có logo, tên quán, "Bàn 05"; thanh danh mục cuộn ngang, giữ trên cùng khi cuộn; món có ảnh, tên, giá, nhãn |
| TC-02 | UC-01 | Mã QR không hợp lệ | Khách | 1. Mở `/t/ABCDEF` | Trang báo "Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên"; không hiện menu |
| TC-03 | UC-01 | Món đang hết | Khách | 1. Tìm "khoai tây" | Khoai tây chiên mờ, nhãn "Hết món", không có nút thêm |
| TC-04 | UC-02 | Tính tiền món có tùy chọn | Khách | 1. Mở Cơm chiên dương châu, chọn Trứng ốp la, Lạp xưởng, số lượng 1 2. Mở Trà tắc, chọn L, số lượng 2 | Bước 1 thành tiền 90.000 ₫; bước 2 Size M được chọn sẵn khi mở, sau khi chọn L thành tiền 50.000 ₫ |
| TC-05 | UC-02 | Nhóm bắt buộc và số chọn tối đa | Khách | 1. Mở Mì xào hải sản, không chọn mức cay 2. Mở Cơm chiên, chọn Trứng ốp la, Lạp xưởng rồi chọn tiếp Chả lụa | Bước 1 nút "Thêm vào giỏ" khóa, nhóm "Mức cay" báo đỏ "Bắt buộc chọn 1"; bước 2 không chọn được Chả lụa, báo "Chọn tối đa 2" |
| TC-06 | UC-02 | Gửi đơn | Khách, Nhân viên | 1. Thêm đủ món của Đơn chuẩn 2. Mở Giỏ món, nhập tên gọi "Anh Tuấn" 3. Gửi đơn | Giỏ trống; trang Món đã gọi hiện đơn mã `DH{yyMMdd}{nnnn}` trạng thái "Chờ quán xác nhận", tổng 230.000 ₫; tab Bàn của nhân viên: Bàn 05 "Đang phục vụ" |
| TC-07 | UC-02 | Gửi khi quán tạm ngưng | Quản lý, Khách | 1. Quản lý bật "Tạm ngưng nhận đơn" 15 phút 2. Khách Bàn 05 gửi giỏ có 1 Gỏi cuốn | Trang khách có dải thông báo; gửi bị chặn, báo "Quán tạm ngưng nhận đơn qua QR tới {giờ}, vui lòng gọi nhân viên"; giỏ giữ nguyên; vẫn xem được menu |
| TC-08 | UC-02 | Bàn đang tắt | Khách | 1. Mở `/t/H3WP6D` 2. Thêm 1 Gỏi cuốn, bấm Gửi đơn | Menu hiển thị; gửi bị chặn, báo "Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên" |
| TC-09 | UC-02 | Món vừa hết khi đang trong giỏ | Khách, Nhân viên | 1. Khách Bàn 12 thêm 1 Bánh xèo, 1 Gỏi cuốn vào giỏ 2. Nhân viên báo hết Bánh xèo 3. Khách gửi đơn 4. Xóa dòng Bánh xèo, gửi lại | Bước 3 không gửi được, dòng Bánh xèo báo đỏ "Món vừa hết"; bước 4 gửi thành công đơn 45.000 ₫ |
| TC-10 | UC-02 | Bấm Gửi đơn hai lần | Khách | 1. Giỏ có 1 Gỏi cuốn 2. Bấm Gửi đơn hai lần thật nhanh | Chỉ một đơn được tạo |
| TC-11 | UC-02 | Quá 3 đơn chờ xác nhận | Khách | 1. Bàn 12 gửi 3 đơn, mỗi đơn 1 Gỏi cuốn, cách nhau hơn 10 giây, nhân viên chưa xác nhận 2. Gửi đơn thứ 4 | Đơn thứ 4 bị chặn, báo "Bàn đang có 3 đơn chờ quán xác nhận, vui lòng chờ" |

### 2.2. Khách theo dõi món và gửi yêu cầu

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-12 | UC-03 | Xem món đã gọi từ nhiều điện thoại | Khách | 1. Có Phiên chuẩn Bàn 05 2. Trên điện thoại A mở "Món đã gọi" | Thấy 2 đơn: đơn của "Anh Tuấn" (Trà tắc gạch ngang, "Không phục vụ được: Hết món") và đơn 4 Bia "Đã xác nhận"; tạm tính 268.000 ₫ |
| TC-13 | UC-03 | Đơn chờ xác nhận chưa tính tạm tính | Khách | 1. Sau TC-06 (đơn chưa xác nhận) mở "Món đã gọi" | Đơn "Chờ quán xác nhận"; tạm tính 0 ₫ kèm ghi chú "Món chờ quán xác nhận chưa tính vào tạm tính" |
| TC-14 | UC-04 | Gọi nhân viên | Khách, Nhân viên | 1. Khách Bàn 05 bấm Gọi nhân viên → Thêm đá 2. Nhân viên bấm Đã xử lý | Bước 1: điện thoại hiện "Đã báo nhân viên, vui lòng chờ"; trong 3 giây màn hình nhận đơn có âm báo, dòng "Bàn 05 · Thêm đá". Bước 2: điện thoại hiện "Nhân viên đã xử lý" |
| TC-15 | UC-04 | Gọi nhân viên lặp lại | Khách, Nhân viên | 1. Bấm Gọi nhân viên → Thêm đá 2. Trong 60 giây bấm lại | Chỉ có một yêu cầu trên màn hình nhận đơn; lần 2 điện thoại hiện "Đã báo nhân viên, vui lòng chờ" |
| TC-16 | UC-04 | Yêu cầu thanh toán chuyển khoản | Khách, Nhân viên | 1. Có Phiên chuẩn Bàn 05 2. Khách bấm Yêu cầu thanh toán → Chuyển khoản, tick "Cần xuất hóa đơn GTGT" | Điện thoại hiện QR số tiền 268.000 ₫, nội dung mã phiên `PB{yyMMdd}{nnnn}`; màn hình nhận đơn có yêu cầu "Bàn 05 · Thanh toán · Chuyển khoản · Cần HĐ GTGT"; tab Bàn: Bàn 05 màu vàng "Chờ thanh toán" |
| TC-17 | UC-04 | Yêu cầu thanh toán khi chưa có món được xác nhận | Khách | 1. Sau TC-06 (đơn chưa xác nhận) mở "Món đã gọi" | Nút "Yêu cầu thanh toán" khóa, ghi chú "Chưa có món được quán xác nhận" |

### 2.3. Nhận đơn và phục vụ

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-18 | UC-05 | Đơn mới hiện theo thời gian thực | Nhân viên, Khách | 1. Nhân viên mở `/orders/live` 2. Khách gửi Đơn chuẩn | Trong 3 giây thẻ đơn Bàn 05 xuất hiện ở cột "Chờ xác nhận", có âm báo; tiêu đề tab "(1) Nhận đơn"; thẻ có tên gọi "Anh Tuấn", 3 dòng kèm tùy chọn, tổng 230.000 ₫ |
| TC-19 | UC-05 | Xác nhận có bỏ món | Nhân viên, Khách | 1. Sau TC-18, chạm dòng Trà tắc → Bỏ món, lý do Hết món 2. Bấm Xác nhận | Đơn "Đã xác nhận", tổng 180.000 ₫, sang cột "Chờ phục vụ"; bản in phiếu bếp mở, không có Trà tắc; điện thoại khách hiện Trà tắc "Không phục vụ được: Hết món"; Trà tắc trên menu chuyển "Hết món" |
| TC-20 | UC-05 | Bỏ hết món | Nhân viên | 1. Đơn chờ xác nhận của Bàn 08, bỏ toàn bộ dòng | Nút "Xác nhận" khóa, gợi ý dùng "Từ chối" |
| TC-21 | UC-05 | Từ chối đơn duy nhất của phiên | Khách, Nhân viên | 1. Khách Bàn 12 gửi 1 Gỏi cuốn 2. Nhân viên Từ chối, lý do "Bàn không có khách" | Đơn "Bị từ chối"; phiên Bàn 12 tự hủy, Bàn 12 về "Trống"; điện thoại khách hiện lý do từ chối |
| TC-22 | UC-05 | Tự xác nhận đơn sau | Khách, Nhân viên | 1. Sau TC-19, điện thoại B mở `/t/K7M2QX`, gửi 4 Bia Sài Gòn Special | Đơn 88.000 ₫ vào thẳng cột "Chờ phục vụ" với nhãn "Tự xác nhận"; phiếu bếp mở bản in; tạm tính Bàn 05 là 268.000 ₫ |
| TC-23 | UC-05 | Đơn chờ quá lâu | Nhân viên | 1. Mở `/orders/live`, xem cột "Chờ xác nhận" | Thẻ đơn Bàn 08 (chờ 11 phút) màu đỏ, đứng đầu cột |
| TC-24 | UC-06 | Phục vụ cả đơn | Nhân viên, Khách | 1. Sau TC-22, ở thẻ đơn của "Anh Tuấn" bấm "Phục vụ cả đơn" | Đơn "Đã phục vụ", rời cột "Chờ phục vụ"; điện thoại khách hiện đơn "Đã phục vụ"; dòng Trà tắc bị bỏ không ảnh hưởng |
| TC-25 | UC-06 | Đơn chưa xác nhận không phục vụ được | Nhân viên | 1. Xem thẻ đơn chờ xác nhận của Bàn 08 | Không có nút "Đã phục vụ" ở dòng nào |
| TC-26 | UC-07 | Gọi món hộ khách | Nhân viên | 1. Tab Bàn → Bàn 12 (Trống) → Gọi món hộ 2. Chọn 2 Bánh xèo miền Tây → Gửi | Đơn nguồn "Nhân viên", trạng thái "Đã xác nhận", 150.000 ₫; Bàn 12 "Đang phục vụ", tạm tính 150.000 ₫; phiếu bếp mở bản in |

### 2.4. Thu tiền và hủy món

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-27 | UC-08 | Thu tiền mặt và đóng phiên | Nhân viên, Khách | 1. Phiên chuẩn Bàn 05 đã phục vụ hết, có yêu cầu thanh toán 2. Tab Bàn → Bàn 05 → Thu tiền → Tiền mặt, khách đưa 300.000 ₫ → Hoàn tất 3. Khách quét lại QR, gửi 1 Gỏi cuốn | Bước 2: tiền thối 32.000 ₫; bản in hóa đơn số `PB{yyMMdd}{nnnn}`, tổng 268.000 ₫; Bàn 05 "Trống"; yêu cầu thanh toán tự "Đã xử lý"; điện thoại khách hiện "Cảm ơn quý khách, hẹn gặp lại", giỏ trống. Bước 3: phiên mới với mã khác |
| TC-28 | UC-08 | Đóng phiên khi còn đơn chờ | Nhân viên | 1. Tab Bàn → Bàn 08 → Thu tiền | Nút "Thu tiền" khóa, báo "Còn 1 đơn chờ xác nhận" |
| TC-29 | UC-08 | Tiền khách đưa không đủ | Nhân viên | 1. Phiên chuẩn Bàn 05 → Thu tiền → Tiền mặt, nhập 200.000 ₫ | Nút "Hoàn tất" khóa, hiện "Còn thiếu 68.000 ₫" |
| TC-30 | UC-15 | Quản lý hủy món đã xác nhận | Quản lý, Nhân viên | 1. Quản lý mở phiên chuẩn Bàn 05, chạm dòng 4 Bia → Hủy món, số lượng 1, lý do "Khách đổi ý" 2. Nhân viên mở cùng phiên | Bước 1: dòng Bia còn 3 lon 66.000 ₫, 1 lon "Đã hủy"; tạm tính 246.000 ₫; điện thoại khách cập nhật. Bước 2: nhân viên không thấy nút "Hủy món" |

### 2.5. Thực đơn và báo hết món

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-31 | UC-09 | Thêm món có nhóm tùy chọn | Quản lý, Khách | 1. Tab Nhóm tùy chọn → thêm "Mức đá" (chọn một, không bắt buộc): Ít đá 0 ₫, Không đá 0 ₫ 2. Tab Món → thêm `M051` "Cà phê sữa đá" 29.000 ₫, gắn "Mức đá" → Lưu 3. Mở trang khách Bàn 05 | Khung xem trước hiển thị món mới; trang khách có Cà phê sữa đá 29.000 ₫, chi tiết có nhóm "Mức đá" không bắt buộc, thêm vào giỏ được khi chưa chọn mức đá |
| TC-32 | UC-09 | Đổi giá khi khách đang có món trong giỏ | Khách, Quản lý | 1. Khách Bàn 12 thêm 1 Bánh xèo (75.000 ₫) vào giỏ 2. Quản lý sửa giá Bánh xèo thành 79.000 ₫ 3. Khách gửi đơn 4. Khách bấm gửi lại | Bước 3 báo "Giá đã thay đổi", giỏ cập nhật 79.000 ₫, chưa tạo đơn; bước 4 tạo đơn 79.000 ₫; menu khách hiện 79.000 ₫ |
| TC-33 | UC-09 | Giá lẻ và xóa món đã gọi | Quản lý | 1. Sửa giá lựa chọn Lạp xưởng thành 15.500 ₫ → Lưu 2. Chọn Gỏi cuốn tôm thịt → Xóa | Bước 1 báo giá phải là bội số 1.000 ₫, không lưu; bước 2 từ chối, gợi ý dùng "Ẩn" |
| TC-34 | UC-10 | Báo hết món | Nhân viên, Khách | 1. Khách đang mở menu Bàn 05 2. Nhân viên mở Thực đơn → Bánh xèo → tắt "Còn món", chọn "Hết trong hôm nay" | Trong 5 giây trang khách hiện Bánh xèo mờ, nhãn "Hết món" |
| TC-35 | UC-10 | Hết một lựa chọn | Nhân viên, Khách | 1. Nhân viên mở Trà tắc (đang bán), tắt lựa chọn Size L 2. Khách mở Trà tắc | Size L mờ, không chọn được; Size M chọn sẵn; thêm vào giỏ được với giá 20.000 ₫ |
| TC-36 | UC-10 | Nhân viên không sửa được thực đơn | Nhân viên | 1. Đăng nhập nhanh Nhân viên, mở Thực đơn | Thấy công tắc "Còn món" ở món và lựa chọn; không có nút Thêm, Sửa, Xóa ở mọi tab |

### 2.6. Bàn và mã QR

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-37 | UC-11 | Thêm bàn và mở trang khách | Quản lý | 1. Bàn và QR → Thêm bàn: "Bàn 21", Ngoài sân, 4 chỗ → Lưu 2. Bấm "Mở trang khách" | Bàn 21 có mã 6 ký tự, không chứa 0, O, 1, I, L; có ảnh QR; trang khách mở ở tab mới, đầu trang "Bàn 21" |
| TC-38 | UC-11 | Đổi mã QR | Quản lý, Khách | 1. Chọn Bàn 05 (Trống) → Đổi mã QR → xác nhận 2. Mở lại `/t/K7M2QX` 3. Mở đường dẫn mới | Mã mới khác `K7M2QX`; bước 2 báo "Mã QR không hợp lệ hoặc đã hết hiệu lực"; bước 3 mở menu Bàn 05 |
| TC-39 | UC-11 | Tắt bàn đang có khách | Quản lý | 1. Chọn Bàn 08 → Tắt bàn | Từ chối, báo "Bàn đang có khách" |
| TC-40 | UC-12 | In QR mẫu A4 | Quản lý | 1. Tick Bàn 01 đến Bàn 08 → In QR 2. Chọn mẫu "Tờ A4 4 mã" | Bản xem trước 2 trang A4, mỗi trang 4 mã; mỗi mã có logo, tên quán, tên bàn, câu "Quét để xem menu và gọi món"; cạnh mã QR không nhỏ hơn 3 cm |
| TC-41 | UC-12 | In QR khi chưa chọn bàn hoặc có bàn tắt | Quản lý | 1. Bỏ tick mọi bàn 2. Tick Bàn 20 → In QR | Bước 1 nút "In QR" khóa; bước 2 bản xem trước của Bàn 20 có cảnh báo "Bàn đang tắt, khách quét sẽ không gửi đơn được" |

### 2.7. Tổng quan, báo cáo, phân quyền

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-42 | UC-14 | Số liệu cập nhật sau khi đóng phiên | Quản lý, Nhân viên | 1. Ghi lại doanh thu và số phiên đã đóng hôm nay ở Tổng quan 2. Nhân viên đóng Phiên chuẩn Bàn 05 (268.000 ₫) 3. Quay lại Tổng quan | Doanh thu tăng đúng 268.000 ₫, số phiên đã đóng tăng 1 |
| TC-43 | UC-14 | Nhân viên không xem được báo cáo, thiết lập bàn | Nhân viên | 1. Đăng nhập nhanh Nhân viên 2. Gõ URL `/reports` 3. Gõ URL `/tables` | Bước 1 vào thẳng Màn hình nhận đơn; bước 2 và 3 chuyển tới `/forbidden` |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| | | | | |
