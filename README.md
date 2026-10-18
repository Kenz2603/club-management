# Club Management

Hệ thống quản lý câu lạc bộ bằng Node.js 22, Express, MySQL 8.4 và HTML/CSS/JavaScript. Không có đăng ký công khai; Admin tạo tài khoản.

## Chức năng

- Đăng nhập, đăng xuất, session cookie, CSRF, đổi mật khẩu, thu hồi phiên.
- Admin quản lý tài khoản và quyền; Manager ghi nghiệp vụ; Viewer đọc nghiệp vụ.
- CLB, thành viên, hoạt động, lịch họp, đóng góp: danh sách, chi tiết, tạo, sửa, lọc, phân trang và ngừng/hủy giữ lịch sử.
- Dashboard lấy số liệu thật; hồ sơ và giao diện tiếng Việt responsive.
- Docker, migration có kiểm tra schema, Nginx HTTP/TLS mẫu, Prometheus/Grafana, Loki/Alloy và Promtail legacy.

## Chạy trên Windows

Yêu cầu Node 22, npm, Docker Desktop Linux containers nếu chạy MySQL/integration tests. `.npmrc` không cưỡng chế engine; chủ động dùng Node 22. Không dùng dữ liệu Ubuntu cho thử nghiệm.

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm use 22
npm ci
Copy-Item .env.example .env
```

Chỉnh `.env` cục bộ: mật khẩu ngẫu nhiên mạnh do bạn chọn; không commit. `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `APP_ORIGIN=http://localhost:3000`, `COOKIE_SECURE=false` chỉ cho HTTP lab. Bốn biến MYSQL bắt buộc với Compose. Không ghi đè `.env` đã có.

```powershell
docker compose -p club-management-dev -f compose.yaml -f compose.dev.yaml up -d mysql
node --env-file=.env backend/scripts/migrate.js verify --all
```

Dev override khởi tạo cả 001–007 trên volume MỚI. Sau khi verify thành công, ghi nhận ledger cho schema đã tồn tại:

```powershell
node --env-file=.env backend/scripts/migrate.js adopt --through=007 --confirm
node --env-file=.env backend/scripts/create-admin.js --username your_admin --email admin@example.test --name "Quản trị viên"
node --env-file=.env backend/src/server.js
```

Password Admin nhập tại prompt ẩn; không truyền `--password`. `npm start` không tự đọc `.env`; dùng lệnh `node --env-file` ở trên hoặc nạp env qua hệ thống vận hành. Mở http://localhost:3000, đăng nhập rồi vào `/dashboard.html`.

## Kiểm thử

```powershell
npm test
npm run test:syntax
npx playwright install chromium
npm run test:db
npm audit
npm run test:config
npm run test:observability
npm run test:logging
npm run test:backup
node scripts/check-secrets.js --history-base=293cf25
```

`npm test` khóa kết nối DB thật trong process con. `test:db` tạo container tên ngẫu nhiên `club-management-test-*`, database test, mật khẩu ngẫu nhiên và tmpfs, chạy migration/API/browser rồi chỉ xóa container có đúng tên và nhãn disposable. Không dùng `.env`, database/volume production. Cần đủ RAM/disk Docker. Xem [kết quả thực](docs/TEST_RESULTS.md).

## Triển khai Ubuntu

Không chạy lệnh reset volume hoặc `down -v`. Không thay server block `demo.local`. Đọc [runbook Ubuntu](docs/DEPLOYMENT.md), chụp backup và đối chiếu schema/ledger trước mọi migration. Không tự migrate lúc backend startup. Các bước cuối chưa có bằng chứng được đánh dấu `PENDING_UBUNTU_EVIDENCE`.

## Tài liệu

- [Kiểm toán ban đầu](docs/PROJECT_AUDIT.md)
- [Ma trận quyền đã duyệt](docs/RBAC_PROPOSAL.md)
- [API](docs/API.md), [database](docs/DATABASE.md), [kiến trúc](docs/ARCHITECTURE.md)
- [Hướng dẫn sử dụng](docs/USER_GUIDE.md)
- [Triển khai và HTTPS](docs/DEPLOYMENT.md)
- [Monitoring và logging](docs/OBSERVABILITY.md)
- [Backup/restore](docs/BACKUP_RESTORE.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)
- [Kiểm thử](docs/TESTING.md), [kết quả](docs/TEST_RESULTS.md)
- [Khắc phục lỗi](docs/TROUBLESHOOTING.md)
- [Bản thảo báo cáo](docs/REPORT_DRAFT.md) và PDF `output/pdf/Club_Management_Report_Draft.pdf`

API cũ `/api/health`, `/api/clubs`, `/api/auth/*`, `/api/users/*` giữ URL và response schema. Danh sách CLB phân trang dùng `/api/manage/clubs`; `/api/clubs` công khai vẫn không phân trang.

## Dựng lại báo cáo

PDF đã được cung cấp trong output/pdf. Nếu muốn dựng lại trên Windows: cài Python reportlab, pymupdf và pypdf, chạy `npm run report`. Renderer dùng Arial Windows hoặc DejaVu trên Linux. Ảnh minh chứng là ảnh test thật ở artifacts, không phải Ubuntu. `test:config` dùng OpenSSL Git for Windows hoặc biến OPENSSL_BIN cho binary hệ thống; chỉ tạo certificate tạm trong artifacts.

## CI chuẩn bị sẵn

`.github/workflows/ci.yml` chạy Node 22, mock/security/syntax, MySQL/Chromium cách ly, image/config validators và Grafana provisioning trên GitHub runner. Workflow chỉ có contents:read, không deploy hoặc dùng production secret. Kết quả GitHub Actions được kiểm tra riêng trên PR; local PASS không đồng nghĩa workflow GitHub đã PASS.

## Bàn giao

Đọc [trình tự bàn giao Ubuntu](docs/UBUNTU_HANDOVER.md) trước triển khai. Tất cả chứng cứ Ubuntu vẫn PENDING_UBUNTU_EVIDENCE. Các commit được giữ trên feature branch, không tự merge vào main.
