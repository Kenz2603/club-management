# Kiểm toán baseline trước khi mở rộng

Bản ghi lịch sử ngày 2026-10-18, không mô tả HEAD hiện tại. Baseline: main, HEAD 293cf25c4dc741fdb2d42624fa5f9de53fae17e2.

Working tree ban đầu chỉ có `backend/tests/api/phase2-integration.test.js` untracked. Giữ đủ 26 test và assertion; fixture transaction được cập nhật cho truy vấn khóa mới, không ghi đè hoặc loại các ca kiểm thử có sẵn. Không thay đổi Git, migration 001–007 hoặc dữ liệu Ubuntu.

## Hiện trạng đã đọc từ source

Express phục vụ HTML/CSS/JS và ba router clubs/auth/users. Có session lưu hash token trong MySQL, scrypt, CSRF HMAC, kiểm tra Origin/Referer, rate limiter và RBAC admin cho user management. GET /api/clubs công khai trả nguyên danh sách không phân trang; giữ hợp đồng này. Có ba trang index/login/users. Có bảy migration InnoDB, FK, unique và CHECK. Node mục tiêu 22; Express 5.3.0 và mysql2 3.24.6 trong lockfile.

## GAP và kế hoạch

| Nhóm | Baseline | Bổ sung |
|---|---|---|
| Nghiệp vụ | CLB chỉ list; các bảng khác chưa có API/UI | CRUD, archive/cancel, lọc, phân trang, dashboard dữ liệu thật |
| Auth | Có chức năng nền | Cookie lỗi, validation, transaction mật khẩu, concurrency, logout UI |
| Database | 001–007 và runner | Schema verification, Docker assets, kiểm thử DB cách ly, backup/restore |
| Docker/Nginx | HTTP, backend non-root | Readiness, resources, TLS tùy chọn, migration job |
| Monitoring | Chưa có | Prometheus/exporters/Grafana provisioning/dashboard |
| Logging | stdout/stderr rời rạc | JSON an toàn, Loki/collector, retention/LogQL |
| Tests | 109 khai báo, 26 untracked | Baseline thực, negative/security/DB/browser checks |
| Tài liệu | Windows setup | README/API/schema/runbook/security/báo cáo |

## Lỗi và rủi ro baseline

- Cookie decoding có thể throw ngoài try và Promise authenticate chưa được return.
- Password update và session revocation không atomic; target user đọc trước transaction.
- Update email rỗng/type sai và duplicate race chưa được xử lý đầy đủ.
- Dockerfile không copy database; .dockerignore loại database.
- Dev init tạo bảng nhưng không ghi ledger; runner verify chỉ kiểm tra tên cột.
- Test migration có field lock_acquired khác lockAcquired, tạo false positive.
- Test setup giữ biến môi trường DB từ host; cần khóa kết nối mock và tách MySQL integration.
- HTTP nội bộ không mã hóa; COOKIE_SECURE=false chỉ phù hợp môi trường lab được giới hạn.
- Thiếu metrics, centralized logs, backup và README.

## Bảo toàn tương thích

Giữ URL và schema response cũ. Không sửa SQL 001–007. Không tự nâng quyền manager. Không thêm public registration. Không hardcode hoặc đọc secret thật. Các thao tác delete nghiệp vụ ưu tiên archive/inactive/cancelled; không xóa lịch sử đóng góp. Không xóa container/volume cũ.

## Chỉ có thể nghiệm thu trên Ubuntu

PENDING_UBUNTU_EVIDENCE: schema/ledger production, Docker resources, server blocks demo.local/club.local, firewall, DNS, HTTPS, exporter host/cgroup, quyền đọc log, dashboards/alerts, backup và restore trên bản sao. File cấu hình không chứng minh dịch vụ đã chạy.

Kết quả baseline và các lượt kiểm tra được ghi riêng trong TEST_RESULTS.md khi hoàn tất; 109 khai báo không mặc định là 109 PASS.

## Cập nhật bàn giao 2026-10-19

Nhánh hiện tại feature/club-management-completion; commit auth 117deee đã có trước lần tiếp quản cuối. Sáu nhóm chức năng đã được phân loại; kết quả kiểm chứng hiện tại và trạng thái cuối nằm trong TEST_RESULTS.md, FINAL_REPORT.md và báo cáo Git trực tiếp. Ma trận RBAC đã được người dùng phê duyệt. Không coi kết quả lịch sử 109/190 test là kết quả hiện tại.
