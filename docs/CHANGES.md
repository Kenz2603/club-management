# Các nhóm thay đổi

Baseline main: 293cf25. Nhánh phát triển: feature/club-management-completion. Không sửa migration 001–007, không thay dữ liệu Ubuntu, không rewrite lịch sử hoặc merge main.

| Nhóm | SHA trước bước tài liệu cuối | Nội dung |
|---|---|---|
| 1 | 117deee | Auth, session, scrypt, CSRF, rate limits, transaction helper và regression |
| 2 | 2dd266a | Resource metadata, CRUD API, dashboard, RBAC, legacy serialization, validation và test |
| 3 | d5a948a | Frontend workspace responsive, dashboard, năm nghiệp vụ, hồ sơ và tài khoản |
| 4 | 380953a | Schema verifier, manifest, migration runner, MySQL/browser tests và backup/restore |
| 5 | 2e177f0 | Docker hardening, migration assets, readiness, Nginx HTTP/TLS/status và headers |
| 6 | 5ca2f8b | Metrics/logging middleware, Prometheus/exporters/Grafana, Loki/Alloy, runtime validators |
| 7 | Xem HEAD và báo cáo Git cuối | CI, scripts kiểm tra, kết quả, runbook, README và PDF |

Nhóm deploy bổ sung test readiness thành công; nhóm cuối sửa tài liệu RBAC đã duyệt, cập nhật kết quả thực tế và chuẩn hóa tiếng Việt. Test readiness thuộc commit 5. Các test metrics/hardening đã được tách khỏi business để snapshot commit 2 hoạt động độc lập. Staging chọn lọc ban đầu của app.js được dùng làm cơ sở commit API; các hunk còn lại vào đúng nhóm 5/6.

Danh sách file chính xác theo nhóm: `git show --stat <SHA>`. Tổng diff: `git diff --stat 293cf25..HEAD`. .env thật, secrets, artifacts, backup và cache không được đưa vào commit. PDF chỉ có nội dung đồ án và ảnh fixture thật trên Windows.
