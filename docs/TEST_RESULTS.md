# Kết quả kiểm thử thực tế

Ngày kiểm chứng: 2026-10-19 (Asia/Saigon). Windows, Node 22.23.3 qua fnm, Docker Desktop Linux containers, MySQL 8.4. Phạm vi: nhánh feature/club-management-completion và các file tài liệu/CI chuẩn bị cho commit cuối. Đây là kết quả local, không phải bằng chứng Ubuntu hoặc GitHub Actions đã PASS.

| Lệnh hoặc nhóm | Kết quả đã chạy | Giới hạn |
|---|---|---|
| Baseline lần tiếp quản cuối | 282/282 PASS, FAIL 0 | Không dùng kết quả lịch sử 109/190 thay baseline này |
| npm test | 283/283 PASS, FAIL 0, SKIP 0 | Unit/API mock, có guard chặn DB thật |
| Snapshot staging commit API | 277/277 PASS | Xuất index ra thư mục tạm, không có file untracked |
| Snapshot staging commit deploy | 282/282 PASS | Kiểm tra cả readiness 200/503 và dependency import |
| npm run test:syntax | 61 file JS PASS | node --check, không phải chứng minh nghiệp vụ |
| npm run test:db | 19/19 PASS, FAIL 0, SKIP 0 | 17 ca SQL/API/transaction và 2 ca Chromium thật |
| Migration/schema | PASS | Up 001–007, verify --all, up lần hai không áp dụng lại |
| CLUB_TEST_BACKEND_IMAGE + test:db | PASS | Readiness healthy, non-root/read-only, đủ 7 SQL và không chứa tests |
| npm run test:backup | 4 nhóm kiểm tra PASS | Dump/restore thật, schema/ledger/data khớp; từ chối confirm sai, checksum sai, target không rỗng |
| npm run test:config | 11/11 bước PASS | Compose, Prometheus/rules, Loki, Alloy, Promtail legacy, Nginx HTTP/TLS, Bash |
| npm run test:observability | PASS | Grafana health, 2 datasource UID, dashboard 12 panel |
| npm run test:logging | 3/3 truy vấn runtime PASS | Alloy đọc fixture log và gửi Loki thật; backend error, HTTP 404/500, Nginx error được che nội dung |
| npm audit --audit-level=high | 0 vulnerabilities | Chỉ dependency npm, không bao gồm OS/image CVE |
| node scripts/check-secrets.js --history-base=293cf25 | 0 findings trong phạm vi quét | Source/config/docs, index và snapshot Git; không đọc .env thật; binary được review riêng |
| git diff --check | PASS | Cảnh báo LF/CRLF không phải lỗi whitespace |
| Docker image build | PASS | Tag club-management:verification, không triển khai Ubuntu |

## Nguồn bằng chứng và lệnh tái lập

Dùng Node 22. Trên Windows có thể chạy `fnm exec --using 22 npm.cmd test` và `fnm exec --using 22 node scripts/test-mysql.js`. Các lệnh npm khác trong bảng trỏ tới script cùng tên trong package.json. Để kiểm tra image: `docker build -t club-management:verification .`, đặt CLUB_TEST_BACKEND_IMAGE=club-management:verification rồi chạy test:db. Không nạp `.env` production.

TAP/log được giữ cục bộ trong thư mục TEMP (club-final-baseline.tap, club-image-mysql.tap, club-observability-regression.tap, club-final-config.log, club-final-backup.log) và các lượt trước push. Screenshot Chromium và kết quả config nằm trong artifacts bị Git ignore. CI tái lập lệnh trên runner biệt lập, không dùng credential Ubuntu. Không cộng số assertions, bước shell và số test TAP thành một con số coverage.

## Những tình huống đã kiểm chứng

CRUD và quan hệ năm nhóm nghiệp vụ; validation, phân trang, UNIQUE/FK/CHECK thật; bound SQL và literal wildcard; dashboard và tổng DECIMAL; soft deletion giữ row; Viewer đọc và bị chặn ghi, Manager/Admin ghi với CSRF/Origin hợp lệ. Helper mock xác nhận đúng cả ba role qua /api/auth/me, kiểm tra CSRF/Origin thiếu/sai và không thực hiện query ghi khi bị chặn.

Scrypt login chạy trước khi lấy connection transaction. Nếu disable/change/reset password thắng trước, locked recheck từ chối trạng thái/hash cũ; nếu login lấy khóa trước, mutation sau thu hồi session. Rollback lỗi không che lỗi gốc; release được gọi. Lỗi last_login_at làm session insert rollback. Admin demotion đồng thời không để hệ thống hết active Admin.

Chromium thật kiểm tra login, tạo CLB, dashboard mobile không tràn, profile/logout, Viewer không thấy chức năng ghi và Admin tạo user. Ảnh chỉ chứa fixture test trên MySQL tạm, không phải production.

## Lỗi phát hiện và sửa trong quá trình hoàn thiện

Các lần phát triển trước đã sửa fixture lock sai shape, Number cho GET_LOCK, test pool guard, khởi tạo state frontend, LF Bash và bind IP Nginx status chỉ dành Ubuntu. Lượt cuối bổ sung readiness thành công để bắt thiếu import pool trong snapshot staging; dependency được đưa đúng commit trước khi commit. Các test metrics/security được tách khỏi business để tránh phụ thuộc commit tương lai. Restore rehearsal bổ sung label/empty-target guard. Tài liệu RBAC và số test cũ được cập nhật, tiếng Việt được ghi UTF-8.

## Chưa được xác minh

PENDING_UBUNTU_EVIDENCE: schema/ledger và dữ liệu Ubuntu, TLS trust/cookie, demo.local, firewall/cổng, exporter host/cAdvisor/MySQL/Nginx UP, ingestion log host thật, retention dài hạn, backup dữ liệu thật và image/OS CVE review. Nginx status validation trên Windows thay IP docker0 bằng loopback trong bản tạm. Không có kiểm thử tải lớn hoặc coverage percentage. Những giới hạn này không được đánh dấu PASS.

GitHub Actions có kết quả riêng từ PR sau push; không mặc định workflow PASS dựa vào bảng local.
