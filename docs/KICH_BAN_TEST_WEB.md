# Kịch bản test chức năng web quản lý tài sản

Tài liệu này dùng để test thủ công toàn bộ chức năng hiện có trên web. Mỗi test case ghi rõ dữ liệu nhập, vị trí bấm và kết quả mong đợi.

## 0. Chuẩn bị môi trường

### 0.1. Chạy local trên máy tính

Terminal backend:

```powershell
cd C:\Users\haida\Desktop\LVTN\backend
php artisan config:clear
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal frontend:

```powershell
cd C:\Users\haida\Desktop\LVTN\frontend
npm run dev
```

Mở web:

```text
http://localhost:5173/login
```

Nếu Vite báo port khác như `5174`, mở đúng URL terminal in ra.

### 0.2. Chạy test QR bằng điện thoại

Điện thoại và laptop phải cùng Wi-Fi.

Sửa `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://192.168.1.167:8000/api
VITE_PUBLIC_APP_URL=http://192.168.1.167:5173
```

Chạy backend:

```powershell
cd C:\Users\haida\Desktop\LVTN\backend
php artisan config:clear
php artisan serve --host=0.0.0.0 --port=8000
```

Chạy frontend:

```powershell
cd C:\Users\haida\Desktop\LVTN\frontend
npm run dev -- --host 0.0.0.0
```

Mở điện thoại:

```text
http://192.168.1.167:5173/login
```

Nếu điện thoại mở được trang login nhưng không login được, thử mở:

```text
http://192.168.1.167:8000/api/categories
```

Kết quả tốt: có JSON hoặc lỗi `Unauthenticated`. Nếu không kết nối được, Windows Firewall đang chặn `php.exe`.

## 1. Dữ liệu mẫu cho database mới

Nếu database mới hoàn toàn chưa có user admin, cần import dump SQL cũ hoặc tạo admin đầu tiên bằng phpMyAdmin/seeder. Sau đó dùng web để tạo các dữ liệu dưới đây.

### 1.1. Tài khoản test đề xuất

Mật khẩu dùng chung để dễ test: `123456`

| Vai trò | Email | Tên | Phòng ban | Ghi chú |
|---|---|---|---|---|
| Admin | `admin.asset@test.com` | Nguyễn Kế Toán | Kế toán | Kế toán tài sản |
| Manager chính | `manager.it@test.com` | Trần Trưởng Phòng IT | IT | Gán làm người duyệt chính của phòng IT |
| Manager phụ | `deputy.it@test.com` | Lê Phó Phòng IT | IT | Role manager nhưng không phải người duyệt chính |
| User IT | `user.it@test.com` | Phạm Nhân Viên IT | IT | Nhân viên tạo yêu cầu, nhận máy |
| User IT 2 | `user2.it@test.com` | Đỗ Nhân Viên IT | IT | Dùng test quét nhầm QR |
| User HR | `user.hr@test.com` | Võ Nhân Viên HR | Nhân sự | Dùng test phân vùng phòng ban |

### 1.2. Phòng ban mẫu

| Tên phòng ban | Mã | Người duyệt chính |
|---|---|---|
| IT | IT | Trần Trưởng Phòng IT |
| Nhân sự | HR | Chưa gán hoặc gán manager khác |
| Kế toán | ACC | Nguyễn Kế Toán hoặc để trống |

### 1.3. Danh mục thiết bị mẫu

| Tên danh mục | Mô tả |
|---|---|
| Laptop | Máy tính xách tay cấp cho nhân viên |
| Màn hình | Màn hình rời |
| Chuột | Thiết bị ngoại vi |
| Máy in | Thiết bị văn phòng |

### 1.4. Tài sản mẫu

Tạo bằng admin ở menu `Quản lý tài sản > Danh sách tài sản`.

| Tên tài sản | Danh mục | Giá mua | Ngày mua | Bảo hành | Dùng để test |
|---|---|---:|---|---|---|
| Laptop Dell Latitude 7420 | Laptop | 18000000 | 10/01/2025 | 10/01/2028 | Mượn bình thường |
| Laptop HP EliteBook 840 | Laptop | 16500000 | 12/01/2025 | 12/01/2028 | Cấp phát khẩn cấp |
| Màn hình Dell P2422H | Màn hình | 4200000 | 15/01/2025 | 15/01/2028 | Test sai danh mục |
| Chuột Logitech M331 | Chuột | 350000 | 20/01/2025 | 20/01/2027 | Test thanh lý |

Mã tài sản sẽ tự sinh dạng `TS-2025-00001`, `TS-2025-00002`, ...

## 2. Test đăng nhập, đăng xuất, phân quyền

### TC-AUTH-01: Đăng nhập sai mật khẩu

1. Mở `/login`.
2. Nhập email `admin.asset@test.com`.
3. Nhập mật khẩu `sai123`.
4. Bấm `Đăng nhập`.

Kết quả mong đợi:

- Hiện thông báo lỗi đăng nhập.
- Không vào dashboard.
- URL vẫn ở `/login`.

### TC-AUTH-02: Đăng nhập admin thành công

1. Mở `/login`.
2. Nhập `admin.asset@test.com` / `123456`.
3. Bấm `Đăng nhập`.

Kết quả mong đợi:

- Chuyển vào `/dashboard`.
- Layout hiển thị `Admin Portal`.
- Menu có `Quản lý tài sản`, `Quản lý mượn`, `Quản trị hệ thống`, `Xử lý & bảo trì`, `Thu hồi & thanh lý`, `Báo cáo kiểm kê`.
- Góc phải có chuông thông báo, avatar, nút đăng xuất.

### TC-AUTH-03: Đăng xuất

1. Đăng nhập admin.
2. Bấm nút `Đăng xuất` ở góc phải.

Kết quả mong đợi:

- Local token bị xóa.
- Chuyển về `/login`.
- Mở `/dashboard` lại sẽ bị đẩy về login.

### TC-AUTH-04: Chặn truy cập sai role

1. Đăng nhập bằng `user.it@test.com`.
2. Gõ trực tiếp URL `/admin/assets`.

Kết quả mong đợi:

- Web tự chuyển về `/dashboard`.
- User không thấy menu admin.

### TC-AUTH-05: Quét QR khi chưa đăng nhập

1. Logout.
2. Mở một link QR thật, ví dụ `/employee/handover?code=<uuid tài sản>`.
3. Web chuyển về `/login`.
4. Đăng nhập bằng user đang được cấp tài sản đó.

Kết quả mong đợi:

- Login xong quay lại đúng `/employee/handover?code=...`.
- Màn hình hiện `Thông tin thiết bị`, không đá về dashboard.

## 3. Test admin - tổng quan

### TC-ADM-DASH-01: Xem dashboard admin

1. Đăng nhập admin.
2. Bấm menu `Tổng quan`.

Kết quả mong đợi:

- Hiện các thẻ việc cần xử lý: yêu cầu chờ cấp phát, chờ user xác nhận QR, báo hỏng chờ tiếp nhận, báo mất chờ xử lý, yêu cầu trả chờ nhận.
- Có thống kê tài sản theo trạng thái.
- Có danh sách hoạt động gần đây.
- Có lối tắt nhanh sang các trang xử lý.

## 4. Test admin - danh mục thiết bị

### TC-CAT-01: Thêm danh mục thành công

1. Admin vào `Quản lý tài sản > Danh mục thiết bị`.
2. Bấm `Thêm danh mục`.
3. Nhập tên: `Laptop`.
4. Nhập mô tả: `Máy tính xách tay cấp cho nhân viên`.
5. Bấm `Lưu`.

Kết quả mong đợi:

- Hiện thông báo thêm thành công.
- Bảng có dòng `Laptop`.
- Cột số tài sản ban đầu là `0`.

### TC-CAT-02: Không cho xóa danh mục đang có tài sản

Điều kiện: danh mục `Laptop` đã có ít nhất 1 tài sản.

1. Vào `Danh mục thiết bị`.
2. Bấm xóa dòng `Laptop`.
3. Xác nhận.

Kết quả mong đợi:

- Hiện lỗi không thể xóa vì đang có tài sản thuộc danh mục.
- Dòng `Laptop` vẫn còn.

### TC-CAT-03: Sửa danh mục

1. Bấm sửa dòng `Laptop`.
2. Đổi mô tả thành `Thiết bị laptop cho nhân viên`.
3. Bấm `Lưu`.

Kết quả mong đợi:

- Hiện thông báo cập nhật thành công.
- Bảng hiển thị mô tả mới.

## 5. Test admin - danh sách tài sản

### TC-ASSET-01: Thêm tài sản mới

1. Vào `Quản lý tài sản > Danh sách tài sản`.
2. Bấm `Nhập Tài sản Mới`.
3. Nhập:
   - Tên tài sản: `Laptop Dell Latitude 7420`
   - Danh mục: `Laptop`
   - Giá mua: `18000000`
   - Ngày mua: `10/01/2025`
   - Hạn bảo hành: `10/01/2028`
   - Mô tả: `Laptop cấp cho nhân viên IT`
   - Ảnh: chọn một ảnh bất kỳ `.jpg/.png`
4. Bấm `Lưu`.

Kết quả mong đợi:

- Hiện thông báo thêm thành công.
- Bảng có tài sản mới.
- Mã tài sản tự sinh dạng `TS-2025-00001`.
- Vị trí là `Kho tổng`.
- Trạng thái là `Mới nhập kho`.
- Có ảnh thumbnail.

### TC-ASSET-02: Bắt lỗi thiếu trường

1. Bấm `Nhập Tài sản Mới`.
2. Để trống tên hoặc giá mua.
3. Bấm `Lưu`.

Kết quả mong đợi:

- Form báo lỗi tại trường bắt buộc.
- Không tạo tài sản mới.

### TC-ASSET-03: Tìm kiếm tài sản

1. Ở ô tìm kiếm, nhập `Latitude`.
2. Bấm biểu tượng tìm kiếm hoặc Enter.

Kết quả mong đợi:

- Bảng chỉ còn tài sản có tên hoặc mã chứa `Latitude`.

### TC-ASSET-04: Lọc theo danh mục/trạng thái/vị trí

1. Chọn danh mục `Laptop`.
2. Chọn trạng thái `Mới nhập kho`.
3. Chọn vị trí `Kho tổng`.

Kết quả mong đợi:

- Bảng chỉ hiển thị laptop còn trong kho tổng.

### TC-ASSET-05: Mở QR tài sản

1. Ở dòng `Laptop Dell Latitude 7420`, bấm icon QR.

Kết quả mong đợi:

- Modal hiện QR.
- Dưới QR có mã tài sản và link dạng `/employee/handover?code=<uuid>`.
- Nếu cấu hình local: link bắt đầu bằng `http://localhost:5173`.
- Nếu cấu hình mobile: link bắt đầu bằng IP LAN, ví dụ `http://192.168.1.167:5173`.

### TC-ASSET-06: Quét QR xem thông tin thiết bị

1. Copy link QR ở TC-ASSET-05.
2. Đăng nhập bằng user hoặc manager.
3. Mở link đó.

Kết quả mong đợi:

- Màn hình tiêu đề `Thông tin thiết bị`.
- Hiển thị ảnh, mã tài sản, tên, danh mục, vị trí/phòng ban, trạng thái.
- Nếu thiết bị chưa được cấp cho user hiện tại, chỉ thấy cảnh báo `Chỉ được xem thông tin`, không có nút xác nhận/báo hỏng/trả.

### TC-ASSET-07: Sửa tài sản còn trong kho

1. Vào `Danh sách tài sản`.
2. Chọn tài sản trạng thái `Mới nhập kho`.
3. Bấm icon sửa.
4. Đổi tên thành `Laptop Dell Latitude 7420 - Test`.
5. Bấm `Lưu`.

Kết quả mong đợi:

- Cập nhật thành công.
- Bảng hiển thị tên mới.

### TC-ASSET-08: Không cho sửa tài sản đã cấp phát

Điều kiện: tài sản đã ở trạng thái `Đang sử dụng` hoặc `Chờ bàn giao`.

1. Vào `Danh sách tài sản`.
2. Bấm icon sửa tài sản đó.

Kết quả mong đợi:

- Nút sửa bị disable hoặc backend trả lỗi.
- Không cho cập nhật tài sản đã cấp phát/bảo trì/báo mất/thanh lý.

### TC-ASSET-09: Xem lịch sử tài sản

1. Ở dòng tài sản, bấm icon lịch sử.

Kết quả mong đợi:

- Modal hiển thị timeline.
- Có các sự kiện như cấp phát, xác nhận bàn giao, báo hỏng, trả kho, thanh lý tùy tài sản.
- Mỗi sự kiện có thời gian, trạng thái cũ, trạng thái mới, người thao tác nếu có.

### TC-ASSET-10: Thanh lý tài sản trong kho

Điều kiện: tài sản `Chuột Logitech M331` đang ở kho tổng, trạng thái `Mới nhập kho`.

1. Bấm icon `Thanh lý`.
2. Nhập lý do: `Thiết bị lỗi thời, không còn nhu cầu sử dụng`.
3. Bấm xác nhận.

Kết quả mong đợi:

- Tài sản chuyển trạng thái `Đã thanh lý`.
- Trang `Thu hồi & thanh lý > Phiếu thanh lý` có dòng tài sản này.
- Lịch sử tài sản có sự kiện `Thanh lý`.

### TC-ASSET-11: Không cho thanh lý tài sản đang mượn

Điều kiện: tài sản đang `Đang sử dụng` hoặc `Đang bảo trì`.

1. Bấm icon thanh lý hoặc gọi thao tác thanh lý.

Kết quả mong đợi:

- Nút thanh lý bị disable hoặc backend trả lỗi.
- Tài sản không đổi trạng thái.

### TC-ASSET-12: Xuất Excel danh sách tài sản

1. Vào `Danh sách tài sản`.
2. Bấm `Xuất Excel`.

Kết quả mong đợi:

- Trình duyệt tải file `.csv`.
- File mở được bằng Excel.
- Có các cột mã tài sản, tên, danh mục, vị trí, trạng thái, giá mua, ngày mua, bảo hành, mô tả.

## 6. Test admin - quản lý phòng ban

### TC-DEPT-01: Thêm phòng ban

1. Vào `Quản trị hệ thống > Quản lý phòng ban`.
2. Bấm thêm mới.
3. Nhập:
   - Tên: `IT`
   - Mã: `IT`
   - Mô tả: `Phòng công nghệ thông tin`
4. Chưa chọn người duyệt.
5. Bấm lưu.

Kết quả mong đợi:

- Tạo phòng ban thành công.
- Bảng có dòng `IT`.

### TC-DEPT-02: Gán trưởng phòng duyệt chính

Điều kiện: đã có user `manager.it@test.com`.

1. Sửa phòng ban `IT`.
2. Chọn người duyệt chính là `Trần Trưởng Phòng IT`.
3. Nếu user chưa có role manager, popup xác nhận nâng quyền xuất hiện.
4. Bấm xác nhận.

Kết quả mong đợi:

- Phòng IT hiển thị người duyệt chính.
- User được gán role manager.
- Nếu thay từ manager A sang manager B, manager A vẫn giữ role manager, không bị hạ xuống user.

### TC-DEPT-03: Chặn xóa phòng ban đang có nhân viên/tài sản

Điều kiện: phòng `IT` có nhân viên hoặc tài sản.

1. Bấm xóa phòng `IT`.
2. Xác nhận.

Kết quả mong đợi:

- Hiện lỗi không thể xóa do còn dữ liệu liên quan.
- Phòng ban vẫn còn.

## 7. Test admin - quản lý nhân sự

### TC-USER-01: Thêm nhân sự user

1. Vào `Quản trị hệ thống > Quản lý nhân sự`.
2. Bấm thêm mới.
3. Nhập:
   - Tên: `Phạm Nhân Viên IT`
   - Email: `user.it@test.com`
   - Mật khẩu: `123456`
   - Phòng ban: `IT`
   - Chức vụ: `user`
   - SĐT: `0901234567`
   - Trạng thái: hoạt động
4. Bấm lưu.

Kết quả mong đợi:

- Thêm thành công.
- Bảng có user mới, phòng ban IT, chức vụ user.

### TC-USER-02: Bắt lỗi email trùng

1. Thêm user với email `user.it@test.com` lần nữa.
2. Bấm lưu.

Kết quả mong đợi:

- Hiện lỗi email đã tồn tại.
- Không tạo user mới.

### TC-USER-03: Bắt lỗi số điện thoại sai

1. Thêm/sửa user.
2. Nhập SĐT `12345`.
3. Bấm lưu.

Kết quả mong đợi:

- Hiện lỗi số điện thoại phải có 10 số và bắt đầu bằng `0`.

### TC-USER-04: Chặn đổi chức vụ người đang là trưởng phòng duyệt chính

Điều kiện: `manager.it@test.com` đang là người duyệt chính của phòng IT.

1. Vào `Quản lý nhân sự`.
2. Sửa user `Trần Trưởng Phòng IT`.
3. Đổi chức vụ từ manager sang user.
4. Bấm lưu.

Kết quả mong đợi:

- Hiện cảnh báo phải đổi người duyệt ở `Quản lý phòng ban` trước.
- Role không đổi.

### TC-USER-05: Chặn chuyển phòng người đang là trưởng phòng duyệt chính

1. Sửa user `Trần Trưởng Phòng IT`.
2. Đổi phòng ban từ IT sang Nhân sự.
3. Bấm lưu.

Kết quả mong đợi:

- Hiện lỗi yêu cầu bổ nhiệm người duyệt khác trước.
- Phòng ban không đổi.

### TC-USER-06: Chặn khóa tài khoản người đang là trưởng phòng duyệt chính

1. Sửa hoặc khóa user `Trần Trưởng Phòng IT`.
2. Chuyển trạng thái không hoạt động hoặc bấm khóa.

Kết quả mong đợi:

- Hiện lỗi phải đổi người duyệt chính ở phòng ban trước.
- Tài khoản vẫn hoạt động.

### TC-USER-07: Chặn khóa tài khoản user còn tài sản active

Điều kiện: `user.it@test.com` đang giữ 1 tài sản trạng thái active.

1. Vào `Quản lý nhân sự`.
2. Khóa user `Phạm Nhân Viên IT`.

Kết quả mong đợi:

- Hiện lỗi không thể khóa vì còn phiếu bàn giao chưa đóng.
- Tài khoản vẫn hoạt động.

### TC-USER-08: Chặn khóa tài khoản user còn phiếu bảo trì pending/repairing

Điều kiện: user có phiếu báo hỏng chưa hoàn tất.

1. Vào `Quản lý nhân sự`.
2. Khóa user đó.

Kết quả mong đợi:

- Hiện lỗi còn phiếu bảo trì chưa đóng.
- Tài khoản vẫn hoạt động.

## 8. Test user - dashboard, hồ sơ, thông báo

### TC-USER-DASH-01: Dashboard nhân viên

1. Đăng nhập `user.it@test.com`.
2. Vào `Tổng quan`.

Kết quả mong đợi:

- Hiện tổng yêu cầu, chờ xử lý, đang giữ, cần xác nhận/trả.
- Có danh sách tài sản đang giao nếu user có assignment.
- Có danh sách yêu cầu gần đây.

### TC-USER-PROFILE-01: Sửa thông tin cá nhân

1. Vào `Thông tin cá nhân`.
2. Đổi tên hoặc số điện thoại thành `0909999999`.
3. Bấm lưu.

Kết quả mong đợi:

- Cập nhật thành công.
- Header hoặc profile hiển thị thông tin mới.

### TC-USER-PROFILE-02: Đổi mật khẩu sai mật khẩu hiện tại

1. Vào `Thông tin cá nhân`.
2. Nhập mật khẩu hiện tại sai.
3. Nhập mật khẩu mới `654321`, xác nhận `654321`.
4. Bấm lưu.

Kết quả mong đợi:

- Hiện lỗi mật khẩu hiện tại không đúng.
- Mật khẩu không đổi.

### TC-NOTI-01: Chuông thông báo

1. Tạo một sự kiện sinh thông báo, ví dụ manager duyệt yêu cầu của user.
2. Đăng nhập user.
3. Bấm chuông thông báo.

Kết quả mong đợi:

- Badge chuông có số thông báo chưa đọc.
- Dropdown hiển thị nội dung thông báo.
- Bấm một thông báo thì trạng thái đọc được cập nhật.
- Bấm `Đánh dấu tất cả đã đọc` thì badge về 0.

## 9. Test luồng mượn bình thường user -> manager -> admin -> user xác nhận QR

### TC-BORROW-01: User tạo yêu cầu mượn

1. Đăng nhập `user.it@test.com`.
2. Vào `Yêu cầu mượn thiết bị`.
3. Bấm tạo yêu cầu.
4. Chọn danh mục `Laptop`.
5. Nhập lý do: `Cần laptop để làm việc dự án ERP trong 3 tháng`.
6. Bấm gửi.

Kết quả mong đợi:

- Tạo yêu cầu thành công.
- Yêu cầu có trạng thái `Chờ trưởng phòng duyệt`.
- Manager chính phòng IT nhận thông báo.

### TC-BORROW-02: Chặn tạo yêu cầu trùng danh mục đang mở

1. User tiếp tục tạo yêu cầu mượn `Laptop` lần nữa khi yêu cầu cũ chưa kết thúc.

Kết quả mong đợi:

- Hiện lỗi đang có yêu cầu cùng danh mục chưa kết thúc.
- Không tạo yêu cầu mới.

### TC-BORROW-03: Manager chính duyệt yêu cầu

1. Đăng nhập `manager.it@test.com`.
2. Vào `Duyệt yêu cầu`.
3. Tìm yêu cầu của `Phạm Nhân Viên IT`.
4. Bấm duyệt.
5. Nhập ghi chú: `Đồng ý cấp laptop cho dự án ERP`.
6. Xác nhận.

Kết quả mong đợi:

- Yêu cầu chuyển sang trạng thái `Chờ admin cấp phát`.
- Admin nhận thông báo.
- User thấy trạng thái yêu cầu đã được trưởng phòng duyệt.

### TC-BORROW-04: Manager từ chối yêu cầu

1. User tạo yêu cầu mượn danh mục khác, ví dụ `Màn hình`.
2. Manager vào `Duyệt yêu cầu`.
3. Bấm từ chối.
4. Nhập lý do: `Chưa cần cấp màn hình rời trong giai đoạn này`.
5. Xác nhận.

Kết quả mong đợi:

- Yêu cầu chuyển trạng thái `Đã từ chối`.
- User thấy lý do từ chối.
- User có thể tạo yêu cầu mới sau đó.

### TC-BORROW-05: Manager phụ không có quyền duyệt

1. Đăng nhập `deputy.it@test.com`.

Kết quả mong đợi:

- Menu không có hoặc không cho thao tác `Duyệt yêu cầu` nếu tài khoản không phải người duyệt chính.
- Vẫn xem được tổng quan, tài sản phòng ban, nhân viên phòng ban, lịch sử mượn cá nhân.

### TC-BORROW-06: Admin cấp phát đúng tài sản

Điều kiện: yêu cầu Laptop đã được manager duyệt.

1. Đăng nhập admin.
2. Vào `Quản lý mượn > Duyệt mượn & cấp phát`.
3. Chọn yêu cầu trạng thái `Chờ admin cấp phát`.
4. Bấm cấp phát.
5. Chọn tài sản `Laptop Dell Latitude 7420` trạng thái trong kho.
6. Ghi chú: `Cấp phát theo yêu cầu đã duyệt`.
7. Xác nhận.

Kết quả mong đợi:

- Yêu cầu chuyển sang `Đã cấp phát`.
- Assignment được tạo trạng thái `Chờ xác nhận`.
- Tài sản chuyển trạng thái `Chờ bàn giao`.
- User nhận thông báo cần quét QR xác nhận.

### TC-BORROW-07: Admin không thể cấp phát sai danh mục

1. Với yêu cầu danh mục `Laptop`, admin chọn tài sản `Màn hình Dell P2422H`.
2. Xác nhận.

Kết quả mong đợi:

- Hiện lỗi thiết bị không thuộc đúng danh mục yêu cầu.
- Không tạo phiếu bàn giao.
- Tài sản vẫn ở kho.

### TC-BORROW-08: Admin chuyển chờ nhập kho

1. Tạo yêu cầu danh mục không còn tài sản trong kho.
2. Manager duyệt.
3. Admin vào yêu cầu.
4. Bấm `Chờ nhập kho`.
5. Nhập ghi chú: `Kho tổng hiện hết laptop phù hợp`.
6. Xác nhận.

Kết quả mong đợi:

- Yêu cầu chuyển trạng thái `Chờ nhập kho`.
- User nhận thông báo.
- Dashboard admin giảm/đổi số yêu cầu chờ xử lý tương ứng.

### TC-BORROW-09: User xác nhận nhận tài sản bằng QR

Điều kiện: Admin đã cấp phát `Laptop Dell Latitude 7420` cho `user.it@test.com`.

1. Admin mở QR của tài sản hoặc dùng link QR đã in.
2. Đăng nhập `user.it@test.com`.
3. Mở `/employee/handover?code=<uuid laptop>`.
4. Kiểm tra màn hình `Thông tin thiết bị`.
5. Bấm `Xác nhận nhận tài sản`.

Kết quả mong đợi:

- Hiện thông báo đã xác nhận.
- Tài sản chuyển sang `Đang sử dụng`.
- Assignment chuyển sang `Đang mượn`.
- Tài sản được gắn phòng ban IT.
- Dashboard user tăng số `Đang giữ`.
- Lịch sử tài sản có sự kiện xác nhận bàn giao.

### TC-BORROW-10: User khác quét nhầm QR

Điều kiện: `Laptop Dell Latitude 7420` đang chờ xác nhận cho `user.it@test.com`.

1. Đăng nhập `user2.it@test.com`.
2. Mở QR của laptop đó.

Kết quả mong đợi:

- Màn hình chỉ hiển thị thông tin.
- Không có nút `Xác nhận nhận tài sản`.
- Có cảnh báo thiết bị không nằm trong phiếu bàn giao của tài khoản hiện tại.

## 10. Test manager tự tạo yêu cầu mượn

### TC-MANAGER-REQ-01: Manager tạo yêu cầu của chính mình

1. Đăng nhập `manager.it@test.com`.
2. Vào `Yêu cầu mượn của tôi`.
3. Tạo yêu cầu danh mục `Laptop`.
4. Nhập lý do: `Trưởng phòng cần laptop để đi công tác`.
5. Gửi yêu cầu.

Kết quả mong đợi:

- Yêu cầu không cần tự duyệt manager.
- Trạng thái chuyển thẳng sang `Chờ admin cấp phát`.
- Admin thấy nhãn/yêu cầu cấp quản lý.

## 11. Test cấp phát khẩn cấp

### TC-EMER-01: Admin cấp phát khẩn cấp

Điều kiện: `Laptop HP EliteBook 840` đang ở kho tổng, trạng thái mới nhập.

1. Admin vào `Quản lý mượn > Cấp phát khẩn cấp`.
2. Chọn nhân viên nhận: `Phạm Nhân Viên IT`.
3. Chọn tài sản: `Laptop HP EliteBook 840`.
4. Nhập lý do: `Máy cũ hỏng đột xuất, cần thiết bị làm việc ngay`.
5. Bấm cấp phát.

Kết quả mong đợi:

- Tạo phiếu bàn giao khẩn cấp trạng thái `Chờ xác nhận`.
- Tài sản chuyển `Chờ bàn giao`.
- Danh sách cấp phát khẩn cấp hiển thị dòng mới.
- User phải quét QR để xác nhận, admin không tự hoàn tất được.

### TC-EMER-02: User xác nhận cấp phát khẩn cấp

1. Đăng nhập `user.it@test.com`.
2. Mở QR của `Laptop HP EliteBook 840`.
3. Bấm `Xác nhận nhận tài sản`.

Kết quả mong đợi:

- Tài sản chuyển sang `Đang sử dụng`.
- Manager phòng IT nhận thông báo admin vừa cấp phát khẩn cấp.
- Lịch sử tài sản có sự kiện bàn giao.

### TC-EMER-03: Không cho cấp phát khẩn cấp tài sản không ở kho

1. Admin vào cấp phát khẩn cấp.
2. Chọn tài sản đang `Đang sử dụng`.
3. Xác nhận.

Kết quả mong đợi:

- Tài sản không xuất hiện trong danh sách chọn hoặc backend trả lỗi.
- Không tạo phiếu cấp phát.

## 12. Test QR thông tin thiết bị

### TC-QR-01: Quét QR thiết bị đang trong kho

1. Đăng nhập user hoặc manager.
2. Mở QR của tài sản trạng thái `Mới nhập kho`.

Kết quả mong đợi:

- Hiện form `Thông tin thiết bị`.
- Hiện ảnh, mã, tên, danh mục, vị trí kho tổng, trạng thái.
- Không có nút xác nhận/báo hỏng/trả.

### TC-QR-02: Quét QR thiết bị đang user giữ

1. Đăng nhập user đang giữ laptop.
2. Mở QR của laptop.

Kết quả mong đợi:

- Hiện form thông tin thiết bị.
- Có nút `Báo hỏng`.
- Có nút `Yêu cầu trả thiết bị`.
- Không có nút `Xác nhận nhận tài sản` vì đã xác nhận rồi.

### TC-QR-03: Quét QR thiết bị blacklist/báo mất

Điều kiện: tài sản đang `Đang điều tra mất` hoặc `Mất vĩnh viễn`.

1. Mở QR tài sản đó.

Kết quả mong đợi:

- Hiện cảnh báo thiết bị đang nằm trong luồng báo mất.
- Không có nút xác nhận/báo hỏng/trả.

## 13. Test báo hỏng và bảo trì

### TC-MAINT-01: User báo hỏng bằng QR

Điều kiện: `user.it@test.com` đang giữ `Laptop Dell Latitude 7420`.

1. Đăng nhập user.
2. Mở QR laptop.
3. Bấm `Báo hỏng`.
4. Nhập mô tả: `Màn hình bị nhấp nháy liên tục khi mở máy`.
5. Tải ảnh minh chứng.
6. Bấm `Gửi báo hỏng`.

Kết quả mong đợi:

- Hiện thông báo gửi phiếu báo hỏng.
- Tài sản chuyển trạng thái `Chờ bàn giao`/chờ xử lý bảo trì.
- Phiếu mượn của user vẫn còn active cho đến khi admin tiếp nhận.
- Admin nhận thông báo.
- Trang `Tiếp nhận sự cố` có phiếu mới.

### TC-MAINT-02: Bắt lỗi mô tả báo hỏng quá ngắn

1. Mở QR tài sản đang giữ.
2. Bấm `Báo hỏng`.
3. Nhập mô tả `hư`.
4. Gửi.

Kết quả mong đợi:

- Form báo lỗi mô tả tối thiểu 10 ký tự.
- Không tạo phiếu bảo trì.

### TC-MAINT-03: Admin tiếp nhận bảo trì

1. Đăng nhập admin.
2. Vào `Xử lý & bảo trì > Tiếp nhận sự cố`.
3. Tìm phiếu laptop.
4. Bấm `Tiếp nhận`.

Kết quả mong đợi:

- Phiếu chuyển sang trạng thái `Đang bảo trì`.
- Assignment của user đóng thành `Đã trả`.
- Tài sản chuyển sang `Đang bảo trì`.
- Tài sản bị gỡ khỏi phòng ban.
- User nhận thông báo đã cắt trách nhiệm.

### TC-MAINT-04: Admin hoàn tất bảo trì

1. Vào `Xử lý & bảo trì > Đang bảo trì`.
2. Tìm phiếu laptop.
3. Bấm hoàn tất.
4. Nhập chi phí: `500000`.
5. Xác nhận.

Kết quả mong đợi:

- Phiếu chuyển `Đã hoàn tất`.
- Tài sản về trạng thái `Mới nhập kho`.
- Vị trí về `Kho tổng`.
- Lịch sử tài sản có sự kiện hoàn tất bảo trì.

### TC-MAINT-05: Bắt lỗi không nhập chi phí sửa chữa

1. Vào phiếu đang bảo trì.
2. Bấm hoàn tất.
3. Để trống chi phí.
4. Xác nhận.

Kết quả mong đợi:

- Form báo lỗi phải nhập chi phí sửa chữa.
- Phiếu vẫn `Đang bảo trì`.

## 14. Test yêu cầu trả/thu hồi thiết bị

### TC-RETURN-01: User gửi yêu cầu trả từ QR

Điều kiện: user đang giữ tài sản active.

1. Đăng nhập user.
2. Mở QR tài sản.
3. Bấm `Yêu cầu trả thiết bị`.
4. Nhập ghi chú: `Hoàn thành công việc, trả lại máy đầy đủ sạc`.
5. Gửi.

Kết quả mong đợi:

- Hiện thông báo đã gửi yêu cầu trả.
- Trên QR hiện cảnh báo đã gửi yêu cầu trả.
- Admin nhận thông báo.
- Trang `Thu hồi & thanh lý > Phiếu thu hồi` có dòng mới.

### TC-RETURN-02: Admin xác nhận nhận lại thiết bị

1. Admin vào `Thu hồi & thanh lý > Phiếu thu hồi`.
2. Tìm yêu cầu trả.
3. Bấm xác nhận nhận lại.
4. Nhập ghi chú: `Nhận máy, đầy đủ phụ kiện, ngoại hình tốt`.
5. Xác nhận.

Kết quả mong đợi:

- Assignment chuyển `Đã trả`.
- Tài sản về trạng thái `Mới nhập kho`.
- Vị trí về `Kho tổng`.
- User lịch sử mượn hiển thị ngày trả.
- Lịch sử tài sản có sự kiện nhận lại kho.

## 15. Test báo mất/blacklist

### TC-LOST-01: User báo mất từ lịch sử mượn

Điều kiện: user đang giữ tài sản active.

1. Đăng nhập user.
2. Vào `Lịch sử mượn`.
3. Tìm tài sản đang mượn.
4. Bấm `Báo mất`.
5. Nhập mô tả: `Bị thất lạc khi di chuyển từ nhà đến công ty, chưa tìm lại được`.
6. Gửi.

Kết quả mong đợi:

- Tạo phiếu báo mất.
- Tài sản chuyển trạng thái `Đang điều tra mất`.
- Assignment vẫn còn hiệu lực cho đến khi admin xử lý.
- Admin nhận thông báo.

### TC-LOST-02: QR tài sản đang báo mất

1. Mở QR tài sản vừa báo mất.

Kết quả mong đợi:

- Màn hình hiển thị cảnh báo blacklist/báo mất.
- Không có nút báo hỏng, trả, xác nhận.

### TC-LOST-03: Admin xác nhận tìm lại thiết bị

1. Admin vào `Xử lý & bảo trì > Thiết bị blacklist`.
2. Chọn phiếu báo mất trạng thái pending.
3. Bấm xử lý.
4. Chọn `Đã tìm lại thiết bị`.
5. Nhập ghi chú: `Đã thu hồi thiết bị tại quầy lễ tân`.
6. Xác nhận.

Kết quả mong đợi:

- Lost report chuyển `Đã tìm lại`.
- Assignment được đóng.
- Tài sản về `Mới nhập kho`.
- Lịch sử tài sản có sự kiện tìm lại.

### TC-LOST-04: Admin xác nhận mất vĩnh viễn

1. User báo mất một tài sản khác.
2. Admin vào `Thiết bị blacklist`.
3. Bấm xử lý.
4. Chọn `Xác nhận mất vĩnh viễn`.
5. Nhập ghi chú: `HR đã làm việc trực tiếp, xử lý bồi thường ngoài hệ thống`.
6. Xác nhận.

Kết quả mong đợi:

- Lost report chuyển `Mất vĩnh viễn`.
- Tài sản chuyển `Mất vĩnh viễn`.
- Assignment được đóng.
- QR chỉ còn cảnh báo, không thao tác.

## 16. Test thanh lý

### TC-DISPOSE-01: Xem danh sách phiếu thanh lý

1. Admin vào `Thu hồi & thanh lý > Phiếu thanh lý`.

Kết quả mong đợi:

- Hiển thị các tài sản đã thanh lý.
- Có mã tài sản, tên, danh mục, ngày thanh lý/cập nhật, ghi chú lịch sử nếu có.

### TC-DISPOSE-02: Không cho đưa tài sản đã thanh lý quay lại sử dụng

1. Mở danh sách tài sản.
2. Tìm tài sản `Đã thanh lý`.
3. Thử sửa/cấp phát/thanh lý lại.

Kết quả mong đợi:

- Không có thao tác cấp phát hoặc sửa sử dụng lại.
- Tài sản không quay về trạng thái khác.

## 17. Test manager

### TC-MGR-DASH-01: Dashboard manager chính

1. Đăng nhập `manager.it@test.com`.
2. Vào `Tổng quan`.

Kết quả mong đợi:

- Hiển thị số nhân viên phòng ban.
- Hiển thị số yêu cầu chờ duyệt.
- Hiển thị số tài sản phòng ban.
- Hiển thị số tài sản đang mượn trong phòng.
- Có nút/lối tắt `Duyệt yêu cầu`.

### TC-MGR-DASH-02: Dashboard manager phụ

1. Đăng nhập `deputy.it@test.com`.
2. Vào `Tổng quan`.

Kết quả mong đợi:

- Hiển thị thông báo tài khoản quản lý phụ không phải người duyệt chính.
- Không có chức năng duyệt chính.
- Vẫn có lối tắt yêu cầu của tôi, QR, nhân viên phòng ban, lịch sử mượn.

### TC-MGR-EMP-01: Xem nhân viên phòng ban

1. Đăng nhập manager IT.
2. Vào `Nhân viên phòng ban`.

Kết quả mong đợi:

- Chỉ thấy nhân viên thuộc phòng IT.
- Không thấy nhân viên phòng Nhân sự hoặc Kế toán.
- Có thể tìm kiếm theo tên/email/số điện thoại.

### TC-MGR-ASSET-01: Xem tài sản phòng ban

1. Đăng nhập manager IT.
2. Vào `Tài sản phòng ban`.

Kết quả mong đợi:

- Chỉ thấy tài sản có `department_id` là IT.
- Không có nút thêm/sửa/xóa tài sản.
- Có thể xem QR và lịch sử nếu UI cho phép.

### TC-MGR-HISTORY-01: Xem lịch sử mượn cá nhân manager

1. Đăng nhập manager.
2. Vào `Lịch sử mượn của tôi`.

Kết quả mong đợi:

- Chỉ hiển thị tài sản manager đã/đang mượn.
- Không hiển thị lịch sử của nhân viên khác.

## 18. Test user - lịch sử mượn

### TC-HISTORY-01: Lọc lịch sử mượn

1. Đăng nhập user.
2. Vào `Lịch sử mượn`.
3. Tìm theo mã tài sản hoặc tên.
4. Lọc trạng thái `Đang mượn`, `Chờ xác nhận`, `Đã trả`.

Kết quả mong đợi:

- Bảng lọc đúng dữ liệu.
- Mỗi dòng có ảnh, mã tài sản, tên, danh mục, trạng thái, ngày cấp phát, ngày xác nhận, ngày trả, người cấp phát, ghi chú.

### TC-HISTORY-02: Thao tác theo trạng thái

1. Với dòng `Chờ xác nhận`, kiểm tra nút `Xác nhận`.
2. Với dòng `Đang mượn`, kiểm tra nút `Quét QR` và `Báo mất`.
3. Với dòng đã gửi yêu cầu trả, kiểm tra tag `Chờ admin nhận`.

Kết quả mong đợi:

- Nút hiển thị đúng theo trạng thái.
- Không có thao tác sai trạng thái.

## 19. Test báo cáo kiểm kê

### TC-REPORT-01: Xem báo cáo admin

1. Admin vào `Báo cáo kiểm kê`.

Kết quả mong đợi:

- Hiển thị tổng tài sản.
- Tài sản trong kho.
- Giá trị đang quản lý.
- Giá trị đã thanh lý.
- Biểu đồ/bảng theo trạng thái, danh mục, phòng ban.
- Có thống kê luồng mượn/trả, sự cố, báo mất.

### TC-REPORT-02: Xuất báo cáo

1. Admin vào `Báo cáo kiểm kê`.
2. Bấm `Xuất Excel`.

Kết quả mong đợi:

- Tải file `.csv`.
- File có các phần: tổng quan, tài sản theo trạng thái, tài sản theo danh mục, tài sản theo phòng ban, luồng mượn trả, sự cố và mất thiết bị.

## 20. Test thông báo liên vai trò

### TC-NOTI-ROLE-01: User gửi yêu cầu -> manager nhận

1. User tạo yêu cầu mượn.
2. Đăng nhập manager chính.
3. Bấm chuông.

Kết quả mong đợi:

- Manager có thông báo yêu cầu mượn mới.

### TC-NOTI-ROLE-02: Manager duyệt -> admin nhận

1. Manager duyệt yêu cầu.
2. Đăng nhập admin.
3. Bấm chuông.

Kết quả mong đợi:

- Admin có thông báo trưởng phòng đã duyệt yêu cầu.

### TC-NOTI-ROLE-03: Admin cấp phát -> user nhận

1. Admin cấp phát thiết bị.
2. Đăng nhập user.
3. Bấm chuông.

Kết quả mong đợi:

- User có thông báo admin đã tạo phiếu bàn giao, cần quét QR.

### TC-NOTI-ROLE-04: User báo hỏng/trả/mất -> admin nhận

1. User báo hỏng hoặc yêu cầu trả hoặc báo mất.
2. Đăng nhập admin.
3. Bấm chuông.

Kết quả mong đợi:

- Admin nhận đúng thông báo tương ứng.

## 21. Test các case lỗi bảo mật/quyền

### TC-SEC-01: User gọi trang admin bằng URL

1. Đăng nhập user.
2. Mở `/admin/users`.

Kết quả mong đợi:

- Redirect về `/dashboard`.
- Không thấy dữ liệu nhân sự.

### TC-SEC-02: Manager phụ gọi API duyệt

1. Đăng nhập manager phụ.
2. Nếu có URL trang duyệt, cố mở `/manager/assignment-approvals`.

Kết quả mong đợi:

- Không thể duyệt yêu cầu vì backend chỉ cho người duyệt chính.
- Nếu thao tác được hiển thị do cache UI thì API phải trả lỗi quyền.

### TC-SEC-03: Admin tạo yêu cầu mượn qua trang user

1. Đăng nhập admin.
2. Mở `/employee/assignment-requests`.
3. Tạo yêu cầu.

Kết quả mong đợi:

- Backend từ chối vì admin không cần tạo yêu cầu mượn.

## 22. Các điểm chưa thuộc phạm vi chức năng hiện tại

Các mục dưới đây có trong SRS nhưng hiện chưa hoàn thiện đầy đủ, không đưa vào tiêu chí pass bắt buộc cho bản hiện tại:

- In lại tem QR và vô hiệu hóa QR cũ.
- SLA 48 giờ cho admin/manager, quá hạn tự cảnh báo/hủy sau 7 ngày.
- Nhắc sau 24 giờ/hủy sau 3 ngày cho cấp phát khẩn cấp chưa xác nhận.
- Upload giấy tờ pháp lý/bồi thường trong báo mất, vì phần này đã thống nhất xử lý trực tiếp ngoài code.
- Trang QR thanh lý chỉ đọc màu xám đầy đủ lý lịch vòng đời.
- Nhật ký kiểm toán cho mọi hành động ngoài tài sản, ví dụ sửa/xóa nhân sự/phòng ban.

## 23. Checklist pass nhanh trước khi demo

- Admin login được, thấy đúng menu.
- Manager chính login được, thấy menu duyệt.
- Manager phụ login được, không có quyền duyệt chính.
- User login được, thấy menu user.
- Admin tạo được danh mục và tài sản.
- User tạo yêu cầu mượn.
- Manager duyệt.
- Admin cấp phát.
- User quét QR xác nhận.
- User quét QR báo hỏng.
- Admin tiếp nhận và hoàn tất bảo trì.
- User quét QR yêu cầu trả.
- Admin xác nhận nhận lại.
- User báo mất.
- Admin xử lý tìm lại/mất vĩnh viễn.
- Admin thanh lý tài sản trong kho.
- Xuất Excel tài sản và báo cáo.
- Chuông thông báo có số và đánh dấu đã đọc được.
