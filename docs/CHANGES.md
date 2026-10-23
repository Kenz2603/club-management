# Các nhóm thay đổi

## Rà soát và chuẩn bị push ngày 24/10/2026

- Bổ sung giao diện SaaS, sidebar, Dark Mode, responsive và accessibility; đăng ký Viewer qua luồng scrypt/Origin/rate limit hiện có; chọn CLB/thành viên theo tên nhưng giữ ID nội bộ.
- Nginx ẩn security headers từ upstream trước khi phát header của proxy, tránh giá trị bị lặp. Không đổi mô hình Nginx host Ubuntu.
- Kiểm tra mọi file đang tracked: giữ source, test, migration, schema verifier, Compose, monitoring/logging, tài liệu nguồn và PDF bản thảo vì đều còn phục vụ chạy, kiểm thử, bàn giao hoặc yêu cầu đồ án. Không xóa file chỉ vì chưa được commit.
- Dọn file local đã Git ignore: render QA trong pdf-review/report-qa/report-evidence-20261023/qa; snapshot before-source; fixture backup/log của script kiểm thử; chứng chỉ và cấu hình validation tạm; helper .py/.cjs/.js và Compose demo chỉ dùng để chụp báo cáo. Giữ ảnh minh chứng gốc, log kết quả, .env, node_modules, dữ liệu Docker và tài liệu trong Downloads.
- Loại chế độ chụp baseline phụ thuộc artifacts khỏi script UI; test:ui chạy độc lập từ source hiện tại và được gọi trong CI. Bổ sung ignore cache Python, file .tmp và lock Word. Thư mục .vscode rỗng đã được dọn.
- Thay liên kết REGISTRATION.md không còn tồn tại bằng mô tả API trực tiếp; README đánh dấu PDF/report cũ là mốc lịch sử. Kết quả mới nằm trong TEST_RESULTS.md.
- Không đổi migration 001–007, không truy cập Ubuntu, không chỉnh dữ liệu local, không merge/main hoặc force push. Push nhánh feature/club-management-completion theo yêu cầu; không đồng bộ thay đổi độc lập từ origin/main vào nhánh này.

## Các commit nền tảng

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
