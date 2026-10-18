# Xử lý lỗi

| Triệu chứng | Kiểm tra và hướng xử lý |
|---|---|
| Missing MYSQL_* | Nạp env qua Compose hoặc node --env-file; không in .env |
| MySQL access denied sau đổi .env | Volume cũ giữ account password cũ; không reset volume, phối hợp quản trị viên |
| 403 Origin | APP_ORIGIN phải đúng scheme/host/port; proxy X-Forwarded-Proto đúng; kiểm tra Referer policy |
| 403 CSRF | Lấy /api/auth/me sau login; không dùng token session cũ; re-login sau đổi role |
| Cookie không được gửi | Secure=true yêu cầu HTTPS; HTTP lab dùng false có chủ đích |
| 401 | Session hết hạn/revoked, account disabled hoặc login lại sau reset |
| 409 duplicate | Username/email user unique; member email unique theo CLB |
| 409 parent inactive | Kích hoạt parent trước khi ghi, hoặc dùng Ngừng/Hủy để giữ lịch sử |
| 429 | Chờ cửa sổ limiter; không restart production để bypass |
| Readiness 503 | DB host/network/account/schema; liveness 200 không chứng minh DB hoạt động |
| Migration drift | Dừng; so schema/ledger/backup; không sửa SQL/checksum đã áp dụng |
| Nginx unknown log format club_json | Cài club-logging.conf trong http context trước server blocks |
| Nginx không bind 172.17.0.1 | Xác minh docker0 trên Ubuntu; sửa status bind phù hợp, không listen public |
| Nginx exporter up nhưng nginx_up=0 | Kiểm tra bind/allow status endpoint và host-gateway |
| MySQL exporter mysql_up=0 | Secret config/user grant/host; không dùng root để bỏ qua lỗi |
| Không thấy logs sau recreate backend | Cập nhật exact LogPath directory cho collector |
| Docker/test thiếu tài nguyên | Dừng test bằng orchestrator; chỉ cleanup container test có đúng nhãn, không prune |
| Browser test thiếu executable | npx playwright install chromium; không coi test là SKIP/PASS |

Không đưa expanded Compose, raw logs chứa secret hoặc docker inspect env vào issue/báo cáo. Dùng request ID, status và code đã chuẩn hóa.
