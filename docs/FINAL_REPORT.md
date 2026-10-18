# Báo cáo bàn giao phát triển

Ngày 2026-10-19. Phạm vi Windows đã được hoàn thiện, kiểm thử và chia nhóm commit trên feature/club-management-completion. Không SSH, không triển khai và không thay đổi dữ liệu Ubuntu. Kết quả push/PR phải đối chiếu báo cáo Git trực tiếp sau bước cuối; file này không tự chứng minh push thành công.

## A. Tổng quan

Giữ Node.js/Express/MySQL 8.4 và frontend HTML/CSS/JavaScript. Nghiệp vụ dùng ma trận RBAC đã được người dùng duyệt. Không thay migration 001–007, không thêm đăng ký công khai, không thay response schema legacy hoặc xóa chức năng cũ.

## B. Chức năng

CRUD CLB/thành viên/hoạt động/họp/đóng góp; chi tiết, tìm kiếm/lọc/phân trang; dashboard dữ liệu thật và tổng đóng góp; soft deletion giữ lịch sử. Auth/session/CSRF/Origin/rate limits, user/password management và admin cuối có regression. Frontend tiếng Việt responsive, hồ sơ, tài khoản, trạng thái loading/empty/error/success và điều hướng theo role.

## C. Thay đổi và commit

Xem CHANGES.md và git log -7. Các nhóm: auth; API/RBAC; frontend; database/backup; Docker/Nginx/hardening; monitoring/logging; CI/tài liệu/PDF. Phần staging chọn lọc app.js ban đầu được bảo toàn làm cơ sở commit API; hunk hardening/observability vào nhóm riêng. Snapshot commit API được kiểm tra không phụ thuộc file untracked.

## D. Kiểm thử

TEST_RESULTS.md ghi lệnh và giới hạn. Baseline tiếp quản 282/282. Hiện tại mock 283/283, MySQL/Chromium 19/19, syntax 61 file, config 11 bước; backup/restore 4 nhóm kiểm tra, Loki/Alloy 3 truy vấn và Grafana provisioning đều PASS. Không có FAIL ở các lượt nghiệm thu local. Không coi kết quả lịch sử là hiện tại.

## E. Lỗi đã xử lý

Login đưa scrypt ra ngoài khóa và recheck dưới khóa; rollback bảo toàn lỗi gốc; last_login_at failure rollback session; mock role được xác nhận qua API; readiness có test thành công và thất bại. Image chứa SQL/schema manifest. Migration verifier kiểm tra cột, key, FK, CHECK. Restore từ chối target không có label hoặc không rỗng. Tài liệu số test/RBAC/encoding được cập nhật.

## F. Giới hạn

Chưa có bằng chứng vận hành Ubuntu, dữ liệu cũ, TLS trust, demo.local, firewall, exporters host, retention thực hoặc backup dữ liệu thật. Không đo tải/coverage percentage. npm audit không thay thế OS/image CVE scan. Các bước trên phải nghiệm thu trước rollout; không phải lỗi local đã bị bỏ qua.

## G. Bảo mật

Scrypt, session hash/cookie, CSRF+Origin, RBAC, bound SQL, input allowlist, textContent/CSP, limiter và container hardening có mã nguồn/test tương ứng. npm audit hiện không có vulnerability. Secret pattern scan kiểm tra working source, index và snapshot Git; .env thật/secrets/artifacts/backups không được commit. Scanner không bảo đảm loại trừ mọi loại secret. Xem SECURITY_CHECKLIST.md cho điều kiện vận hành.

## H. Docker/Nginx

Image build và chạy hardened trên DB tạm PASS, non-root/read-only, healthcheck/SQL assets. Compose config và Nginx HTTP/TLS syntax PASS. Cấu hình dùng host Nginx, giữ riêng server block Club; không thay demo.local. Không xóa volume hoặc giả định cổng trống. UBUNTU_HANDOVER.md mô tả kiểm kê, backup, schema và rollback.

## I. Prometheus/Grafana

Có scrape config backend/host/containers/MySQL/Nginx, 3 alert rules, provisioning và dashboard 12 panel. promtool và Grafana runtime PASS. Target host Ubuntu và notification receiver chưa được nghiệm thu; không tuyên bố đã gửi email/Slack.

## J. Loki/Alloy/Promtail

Loki retention 72 giờ, Alloy mặc định thu đúng file Club, Promtail chỉ profile legacy. Runtime Windows xác nhận log ứng dụng, HTTP 404/500 và Nginx error được che nội dung. Không mount Docker socket hoặc đọc log Ubuntu. Quyền file và LogPath sau recreate cần kiểm tra tại host.

## K. Tài liệu/PDF/CI

README, audit baseline, RBAC đã duyệt, API, architecture, database, deployment, UBUNTU_HANDOVER, backup/restore, observability, security, testing/results, troubleshooting, user guide, báo cáo Markdown và PDF tối thiểu 10 trang. Ảnh trong PDF là screenshot test thật; không có tên/mã sinh viên/giảng viên tự tạo. CI chạy toàn bộ nhóm kiểm tra trên runner độc lập, không deploy hoặc dùng secret production.

## L. Git

Baseline 293cf25; giữ lịch sử commit auth 117deee. Không reset, force push, xóa branch hoặc merge vào main. Remote không có develop tại lúc kiểm tra; main là default branch và target PR dự kiến. Các SHA, kết quả push, PR và trạng thái working tree được kiểm tra trực tiếp ở cuối nhiệm vụ; không suy ra từ tài liệu này.

## M. Bàn giao Ubuntu

Dùng SHA feature branch trong báo cáo Git cuối. Thực hiện UBUNTU_HANDOVER.md: kiểm kê đúng project/volume/port/image; backup và restore rehearsal; kiểm tra schema/ledger; build rồi chỉ recreate backend; cài riêng Nginx Club; smoke test và đối chiếu demo.local; bật monitoring/logging theo tài nguyên; thu minh chứng thật. Không dùng down -v/prune/reset volume.

## N. Phê duyệt và nghiệp vụ

RBAC đã được người dùng duyệt. Không còn câu hỏi nghiệp vụ chặn phát triển local. Người dùng tự quyết định và thực hiện Ubuntu, TLS, quyền collector host, secret/account exporter và chính sách retention/backup. Không yêu cầu gửi credential thật trong hội thoại.

## O. Kết luận

Mã nguồn và cấu hình sẵn sàng được người vận hành tiếp nhận để kiểm tra trên Ubuntu. Chưa tuyên bố production đã sẵn sàng hoặc được triển khai. PENDING_UBUNTU_EVIDENCE phải được hoàn tất trước nghiệm thu vận hành cuối cùng. Kết quả GitHub/push/PR được báo riêng sau khi có bằng chứng từ remote.
