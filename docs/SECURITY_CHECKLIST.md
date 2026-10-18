# Security checklist

## Đã triển khai trong mã nguồn

- [x] Scrypt salt ngẫu nhiên, timing-safe compare, giới hạn input password.
- [x] Session token ngẫu nhiên, DB chỉ lưu hash, expiry/revocation và account status.
- [x] Cookie HttpOnly/SameSite; Secure theo môi trường, không đọc bằng JS.
- [x] CSRF HMAC và Origin/Referer cho ghi; login origin validation.
- [x] RBAC backend; Manager/Viewer theo phê duyệt trong RBAC_PROPOSAL.md.
- [x] Validation allowlist fields, ID, enum, date/time, currency, email.
- [x] Query bound parameters; table/column identifiers từ metadata cứng.
- [x] Render textContent; CSP, nosniff, frame/referrer headers.
- [x] Login rate limit IP/account và giới hạn request đang xử lý.
- [x] Đổi/reset mật khẩu dùng transaction và user lock; thu hồi session.
- [x] Bảo vệ admin active cuối cùng và self-disable.
- [x] Cookie lỗi không gây unhandled rejection.
- [x] Backend non-root, read-only, cap_drop ALL, no-new-privileges, resources/log rotation.
- [x] Backend/phpMyAdmin chỉ publish loopback; MySQL production không publish cổng.
- [x] Logs không có body, cookie, password, Authorization hoặc query string.
- [x] Nginx ghi đè XFF bằng IP client quan sát được; chặn public metrics.
- [x] Secret files/env không đưa vào image/repository.

## Điều kiện triển khai cần kiểm tra

- [ ] PENDING_UBUNTU_EVIDENCE: HTTPS, APP_ORIGIN và Secure cookie thực tế. HTTP chỉ dành lab nội bộ giới hạn.
- [ ] Mật khẩu mạnh riêng từng dịch vụ, quyền file secret, rotate theo chính sách; không yêu cầu người dùng gửi secret cho Codex.
- [ ] Exporter user SELECT/PROCESS/REPLICATION CLIENT với giới hạn kết nối; không dùng root/app account.
- [ ] Xác minh network, firewall, exact trusted proxy chain và cổng không public.
- [ ] Xác minh image CVE/digest trước triển khai; npm audit không bao gồm OS/image vulnerabilities.
- [ ] Backup mã hóa, retention và restore drill.
- [ ] Xác minh collector chỉ đọc Club logs; Node/cAdvisor có quyền đọc host rộng, chỉ chạy sau review.
- [ ] Promtail EOL chỉ dùng khi chấp nhận rủi ro legacy; Alloy là mặc định.
- [ ] Không có password public registration/MFA; MFA chưa nằm phạm vi nghiệp vụ hiện tại.

Rate limiter theo process không dùng shared store; mô hình hiện tại một backend. Nếu scale nhiều replica cần thiết kế limiter chung. Không log metric label theo user/request ID để tránh lộ dữ liệu và cardinality. Không tuyên bố hệ thống không có lỗ hổng chỉ dựa vào audit dependency.
