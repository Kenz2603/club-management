# Kiểm thử

## Mock suite

`npm test` dùng Node test runner. Preloader cưỡng chế DB mock trên loopback port 1 và thay query/execute/getConnection thật bằng guard. Transaction adapter chỉ chuyển tiếp mock query; nó KHÔNG chứng minh transaction MySQL. Mỗi file đóng pool; HTTP tests đóng server. Không truyền `.env` vào mock suite.

Baseline trước sửa: 109/109 PASS. File phase2-integration untracked ban đầu được giữ đủ 26 test; chỉ điều chỉnh fixture transaction cho truy vấn khóa mới, không loại hoặc làm yếu assertion. Test migration được viết lại để assertion chứng minh đã tới nhánh checksum/lock, đồng thời kiểm tra type/default/unique/FK/CHECK.

## MySQL thật và Chromium

`npm run test:db` chạy orchestrator tạo container MySQL 8.4 disposable, tmpfs và cổng ngẫu nhiên loopback; mật khẩu sinh trong bộ nhớ. Migration up, strict verify toàn bộ schema, up lần hai để kiểm tra idempotency. Sau đó API tests dùng database thật, Playwright Chromium headless chạy giao diện thực và chụp ảnh thật vào artifacts (gitignored). Cuối cùng chỉ xóa đúng container có nhãn disposable do lượt chạy tạo.

Suite MySQL sử dụng database thật. Các ca cạnh tranh dùng mock điều phối thời điểm gọi hàm password/query nhưng vẫn chạy scrypt, SQL và transaction thật; ca lỗi last_login_at chủ động inject lỗi để kiểm tra rollback. Đây không phải suite SQL hoàn toàn không có test double. Khẳng định guard database tên `club_management_test` và host 127.0.0.1 trước thao tác. Docker không hoạt động hoặc chưa cài Chromium là BLOCKED, không được đánh dấu PASS. Không dùng production volume. Nếu process bị kill cưỡng bức, kiểm tra thủ công container tên test và nhãn trước cleanup; không xóa wildcard.

## Cấu hình

`npm run test:syntax`; Compose `config --quiet` dùng env placeholder; image build bằng tag verification. `promtool check config`, Loki verify-config, Alloy validate và Nginx -t chạy trong container tạm. Windows không xác minh bind IP docker0 Ubuntu, host exporters, log permissions, TLS trust hoặc site demo.local.

`npm run test:config` tái lập 11 bước kiểm tra cấu hình/certificate tạm/bash; `npm run test:observability` chạy Grafana disposable tmpfs kiểm tra provisioning và dashboard thật. Không cần credential Ubuntu. Đặt CLUB_TEST_BACKEND_IMAGE=club-management:verification khi chạy test:db để kiểm tra thêm backend image đã build, non-root/read-only và healthcheck.

## Bằng chứng

Kết quả hiện tại ở TEST_RESULTS.md. Mỗi lần thay code cần chạy lại suite liên quan và regression. Screenshot được sinh bằng browser trên dữ liệu test, không phải minh chứng Ubuntu. Coverage percentage chưa đo; không suy ra từ test count.

## Backup, logging và kiểm tra Git

`npm run test:backup` thực thi backup/restore trên hai MySQL dùng một lần, kiểm tra schema/dữ liệu và ba điều kiện từ chối nguy hiểm. Windows cần Git Bash hoặc BASH_BIN; Linux dùng bash.

`npm run test:logging` chạy Loki và Alloy trên network riêng, dùng log tạo bởi logger thật cùng fixture Nginx; ba truy vấn LogQL phải có dữ liệu và không chứa marker bí mật. Không đọc log production.

`node scripts/check-secrets.js --history-base=293cf25` quét mẫu credential trong source/config/docs, nội dung và đường dẫn index, cùng các snapshot Git sau baseline. Binary PDF và .env thật không được đọc bởi scanner; PDF được kiểm tra nội dung riêng. Không coi pattern scanner là bằng chứng loại trừ mọi dạng secret.
