# Kết luận và hướng phát triển

Mã nguồn được mở rộng trong kiến trúc Node.js/Express/MySQL và frontend HTML/CSS/JavaScript sẵn có. Các API cũ được duy trì; danh sách CLB phân trang dùng endpoint quản trị riêng để không thay response legacy. Nghiệp vụ mới dùng metadata allowlist, validation, transaction, FK và phân quyền backend. Giao diện lấy dữ liệu thật và không chèn dữ liệu API bằng innerHTML.

Hoàn thiện vận hành bao gồm backend image non-root có migration assets, readiness, graceful shutdown, giới hạn tài nguyên và log rotation. Nginx có file log riêng, chặn public metrics và mẫu HTTPS tách riêng. Prometheus/Grafana và Loki/Alloy có cấu hình provisioning cùng dashboard/query; Promtail được giữ trong profile legacy do đã EOL. Không giả định có cảnh báo qua email/Slack khi chưa cấu hình receiver.

Kết quả kiểm thử chính thức nằm trong chương kết quả thực nghiệm. Mock suite kiểm tra logic và contract nhưng không thể thay thế MySQL transaction hoặc trải nghiệm trình duyệt. Vì vậy test database cách ly và browser được chạy riêng; lỗi phát hiện trong các lượt đầu được sửa và chạy lại. Kết quả PASS có phạm vi theo commit/workspace và môi trường, không phải cam kết hệ thống không còn lỗi.

Trước nghiệm thu cuối, cần xác minh Ubuntu VMware: schema và migration ledger có dữ liệu cũ, Nginx club.local không ảnh hưởng demo.local, firewall, timezone, HTTPS/cookie, exporter UP, quyền collector đọc đúng file, retention và restore drill. Không xóa volume để giải quyết lỗi quyền hoặc migration. Người vận hành cần có bản backup được thử phục hồi và kế hoạch quay lại image trước đó.

Các hướng phát triển có thể gồm assignment user–CLB, đăng ký/điểm danh hoạt động, xuất báo cáo, MFA, audit trail lưu bền, shared rate limiter và notification receiver. Mỗi mở rộng cần tiêu chí nghiệp vụ, đánh giá bảo mật, migration bổ sung tương thích và kiểm thử riêng. Không tự bổ sung những chức năng này vào production chỉ để tăng số lượng tính năng.

PENDING_UBUNTU_EVIDENCE: ảnh target UP, dashboard host thực, Grafana Explore, HTTPS/cookie và kết quả backup/restore. Chỉ kết luận sẵn sàng vận hành sau khi các điều kiện này được nghiệm thu bởi người quản trị môi trường cuối.

Workflow GitHub CI kiểm tra mock/security/syntax, database/browser, backup/restore, Docker/config, Grafana provisioning và Alloy/Loki trên runner biệt lập. Kết quả GitHub cần xem từ PR; không suy ra từ local PASS. Thay đổi được chia thành các commit chức năng trên feature branch; kết quả push và PR được xác minh riêng ở bước bàn giao cuối. Không đưa .env, artifacts, secrets hoặc backup vào Git.
