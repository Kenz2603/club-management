# Runbook Ubuntu

Trạng thái: PENDING_UBUNTU_EVIDENCE. Không có lệnh nào trong tài liệu được tự chạy trên Ubuntu. Mọi thao tác production cần backup, review target và quyền vận hành của người dùng. Giữ nguyên project name/volume/network đang dùng; không dùng `down -v`, prune hoặc reset.

## 1. Kiểm kê chỉ đọc

Ghi lại OS, Docker version, dung lượng/RAM, network, container names, image IDs, volumes, cổng 80/443/3000/8080/3307/3001/9090/8081, Nginx server blocks và demo.local. `scripts/ubuntu-precheck.sh` có mục thử kết nối MySQL; không chạy nguyên script khi chưa được phép đọc DB. Không dùng `docker inspect` không lọc vì có thể in env secret.

## 2. Cấu hình

`.env` ngoài Git, chmod 600, dùng giá trị hiện tại được quản trị viên cung cấp trực tiếp trên host. Đặt APP_ORIGIN chính xác URL browser (scheme/host/port), SESSION_TTL_HOURS=8. HTTP lab dùng COOKIE_SECURE=false. Backend Compose dùng DB_HOST=mysql:3306 nội bộ; không publish MySQL. Không đổi MYSQL_PASSWORD của volume cũ bằng cách chỉ sửa env: password database không tự thay đổi.

Chỉ chạy `docker compose config --quiet`; không đưa bản config expanded chứa secret vào báo cáo. Xác nhận Node timezone/DB UTC.

## 3. Schema và backup

Tạo backup, kiểm tra checksum và restore trên bản sao trước. Xem DATABASE.md. Nếu Ubuntu có đủ 001–007, chạy verify --all rồi adopt --through=007 --confirm sau review. Nếu ledger đã đúng, up chỉ áp dụng phần chưa có. Không bật compose.dev.yaml trên production.

```bash
docker compose -f compose.yaml -f compose.backend.yaml -f compose.migrate.yaml build backend migrate
docker compose -f compose.yaml -f compose.backend.yaml -f compose.migrate.yaml run --rm migrate node backend/scripts/migrate.js status
docker compose -f compose.yaml -f compose.backend.yaml -f compose.migrate.yaml run --rm migrate node backend/scripts/migrate.js verify --all
```

Các lệnh baseline/adopt/up phải do người vận hành chọn theo schema thật, không tự động copy toàn bộ runbook. Backend không auto-migrate.

## 4. Backend

Sau khi schema/ledger xác nhận, `docker compose -f compose.yaml -f compose.backend.yaml up -d backend`. Giữ nguyên project hiện tại để gắn đúng mysql_data. Kiểm tra container healthy và curl 127.0.0.1:3000/api/health, /api/ready. Tạo Admin chỉ nếu chưa có; không ghi đè Admin Ubuntu. Không đưa password qua CLI.

## 5. Nginx HTTP

Backup riêng cấu hình Club hiện tại. Cài `nginx/club-logging.conf` vào http-context include (ví dụ /etc/nginx/conf.d/00-club-logging.conf). Cài duy nhất `club-management.conf` vào sites-available/sites-enabled cho club.local; không thay nginx.conf tổng hoặc demo.local. `nginx -t` thành công trước reload. File log riêng Club. XFF được overwrite, không tin header client. Kiểm tra DNS/hosts từ máy truy cập.

`club-status.conf` là tùy chọn exporter: bind 172.17.0.1:8081 phải thay bằng địa chỉ docker0 thực tế nếu khác. Chỉ allow exporter subnet thực cần thiết. Không mở status ra Internet; kiểm tra firewall và bind trước enable. Kiểm tra Windows đã thay IP bind bằng loopback trong bản test, không chứng minh IP Ubuntu hợp lệ.

## 6. HTTPS self-signed tùy chọn

Chỉ thay server block club.local sau khi người dùng đồng ý chuyển URL. Tạo certificate/key trên Ubuntu, không copy vào repo:

```bash
sudo install -d -m 700 /etc/nginx/club-tls
sudo openssl req -x509 -nodes -newkey rsa:3072 -days 365 -keyout /etc/nginx/club-tls/club.local.key -out /etc/nginx/club-tls/club.local.crt -subj /CN=club.local -addext subjectAltName=DNS:club.local
sudo chmod 600 /etc/nginx/club-tls/club.local.key
```

Dùng `club-management.https.conf.example`, APP_ORIGIN=https://club.local, COOKIE_SECURE=true. Kiểm tra Nginx -t, rồi reload duy nhất Nginx và recreate backend có kiểm soát. Người dùng tự tin cậy certificate test; không tự bypass browser warning. Không bật HSTS trước khi bảo đảm TLS trust và rollback HTTP phù hợp. Re-login sau chuyển scheme.

## 7. Monitoring/logging và rollback

Xem OBSERVABILITY.md; triển khai sau backend ổn định, không mặc định bật host collectors trên máy thiếu RAM. Rollback ứng dụng bằng image tag/compose snapshot trước nâng cấp; không rollback dữ liệu bằng xóa volume. Nếu migration lỗi dừng, giữ snapshot và điều tra. PENDING_UBUNTU_EVIDENCE: startup/reboot, dữ liệu cũ, demo.local regression, firewall, TLS/cookie, exporter UP, log permissions và backup drill.

## Trình tự bàn giao cuối

Xem UBUNTU_HANDOVER.md để kiểm kê project/volume/port, giữ MySQL hiện tại, chạy migrate job với --no-deps và chỉ recreate backend sau backup/schema review. Không dùng lệnh up toàn bộ khi chưa kiểm tra các dịch vụ có sẵn.
