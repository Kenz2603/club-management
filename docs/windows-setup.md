# Hướng dẫn Thiết lập Môi trường Phát triển Windows

Tài liệu hướng dẫn thiết lập và kiểm thử môi trường phát triển cục bộ trên hệ điều hành Windows cho dự án Club Management.

---

## 1. Yêu cầu Tiên quyết

- **Hệ điều hành:** Windows 10/11 (64-bit)
- **Git for Windows:** Đã cài đặt và kích hoạt trong PATH
- **Quản lý phiên bản Node.js:** Sử dụng `fnm` (Fast Node Manager)
- **Node.js:** Phiên bản 22 LTS (theo chuẩn `.nvmrc`)
- **Docker Desktop:** Phiên bản hỗ trợ Docker Compose v2

---

## 2. Cài đặt và Chuẩn hóa Node.js 22

Dự án sử dụng Node.js 22 theo yêu cầu hệ thống. Việc sử dụng `fnm` giúp cô lập phiên bản Node.js cho dự án mà không gây ảnh hưởng đến các dự án khác trên máy.

### 2.1 Cài đặt fnm

Mở PowerShell và chạy lệnh cài đặt qua `winget`:

```powershell
winget install Schniz.fnm
```

### 2.2 Cài đặt Node.js 22

Cài đặt phiên bản Node.js 22 bằng `fnm`:

```powershell
fnm install 22
```

### 2.3 Kích hoạt môi trường trong phiên làm việc

Chạy lệnh sau để nạp phiên bản Node.js 22 cho phiên PowerShell hiện tại:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm use 22
```

Kiểm tra lại phiên bản:

```powershell
node -v
# Kết quả mong đợi: v22.x.x
npm -v
# Kết quả mong đợi: 10.x.x
```

---

## 3. Cài đặt Thư viện Phụ thuộc

Di chuyển vào thư mục dự án và thực hiện cài đặt dependencies từ file lockfile:

```powershell
cd A:\Projects\club-management
npm ci
```

---

## 4. Chạy Kiểm thử Tự động (Unit & Contract Tests)

Dự án sử dụng bộ kiểm thử tích hợp của Node.js (`node:test`) cùng file cấu hình môi trường test `backend/tests/setup/unit-env.js`.

Chạy toàn bộ test suites:

```powershell
npm test
```

Kết quả mong đợi:
- Toàn bộ test cases trong `backend/tests/clubs.test.js` và `backend/tests/contract/legacy-api.test.js` đều PASS.
- Không yêu cầu kết nối cơ sở dữ liệu thật khi chạy unit test.

---

## 5. Khởi chạy Môi trường Phát triển với Docker Compose

### 5.1 Tạo file cấu hình môi trường

Tạo file `.env` từ file mẫu `.env.example`:

```powershell
Copy-Item .env.example .env
```

Cập nhật mật khẩu trong `.env` cho môi trường cục bộ:
```env
MYSQL_DATABASE=club_management
MYSQL_USER=club_user
MYSQL_PASSWORD=your_dev_password
MYSQL_ROOT_PASSWORD=your_dev_root_password
```

### 5.2 Khởi chạy MySQL Development

Chạy MySQL với cấu hình override trong `compose.dev.yaml` (ánh xạ cổng `127.0.0.1:3307` để tránh xung đột cổng 3306):

```powershell
docker compose -p club-management-dev -f compose.yaml -f compose.dev.yaml up -d mysql
```

Kiểm tra trạng thái container:

```powershell
docker compose -p club-management-dev ps
```

Container MySQL sẽ tự động khởi tạo 5 bảng nghiệp vụ từ thư mục `database/migrations` khi volume được tạo mới lần đầu.

### 5.3 Chạy Backend Cục bộ

Thiết lập các biến môi trường để backend kết nối tới MySQL development trên cổng 3307:

```powershell
$env:PORT = "3000"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3307"
$env:MYSQL_DATABASE = "club_management"
$env:MYSQL_USER = "club_user"
$env:MYSQL_PASSWORD = "your_dev_password"

node backend/src/server.js
```

### 5.4 Kiểm tra Giao diện Frontend

Mở trình duyệt web và truy cập:
- `http://localhost:3000` : Giao diện người dùng công khai của Club Management
- `http://localhost:3000/api/health` : Kiểm tra trạng thái máy chủ
- `http://localhost:3000/api/clubs` : Danh sách câu lạc bộ từ cơ sở dữ liệu

---

## 6. Dừng Môi trường Phát triển

Khi kết thúc phiên làm việc:

```powershell
docker compose -p club-management-dev -f compose.yaml -f compose.dev.yaml down
```
