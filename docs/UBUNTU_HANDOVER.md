# Bàn giao Ubuntu VMware

PENDING_UBUNTU_EVIDENCE. Codex không SSH, không triển khai và không đọc database Ubuntu. Các lệnh dưới đây dành cho người vận hành sau khi kiểm tra target và backup; không chạy toàn bộ tài liệu như một script.

## 1. Nhận đúng mã nguồn

Repository: https://github.com/Kenz2603/club-management. Nhánh: `feature/club-management-completion`. Dùng SHA cuối trong báo cáo bàn giao Codex để đối chiếu, tránh triển khai nhầm branch cũ.

```bash
git status --short
git fetch origin feature/club-management-completion
git log -7 --oneline origin/feature/club-management-completion
```

Nếu workspace Ubuntu có thay đổi, dừng để bảo toàn chúng. Chỉ chuyển sang feature branch khi đã kiểm tra working tree; không dùng reset/restore/clean hoặc force pull. Không thay `.env` hiện có bằng template. Không chạy npm/test orchestration trên production để lấy minh chứng.

## 2. Kiểm kê project, dữ liệu, cổng và Nginx

Chọn chính xác container MySQL Club đang dùng; không tự lấy container đầu tiên có tên mysql. Ghi lại image ID backend hiện tại, project label, mount MySQL, server block Club và trạng thái demo.local vào nơi bảo mật ngoài Git.

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
ss -ltn
docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$MYSQL_CONTAINER"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Type}} {{.Name}} {{.Source}}{{end}}{{end}}' "$MYSQL_CONTAINER"
docker inspect --format '{{.Image}}' "$BACKEND_CONTAINER"
sudo nginx -t
curl --resolve demo.local:80:127.0.0.1 -I http://demo.local/
```

Không in `docker inspect` toàn bộ hoặc Compose expanded vì có thể chứa secret. Không giả định cổng 80/443/3000/8080/9090/3001/8081 hoặc 3306 trống. `scripts/ubuntu-precheck.sh` cũ có truy vấn database và tự chọn container; không chạy nguyên script này khi chưa review. Các lệnh kiểm kê tách riêng ở trên an toàn hơn cho môi trường nhiều dịch vụ.

Giữ nguyên `COMPOSE_PROJECT_NAME` của hệ thống hiện có. Nếu MySQL dùng named volume khác quy ước project, cần override volume `external: true` với đúng tên đã xác minh trước khi dùng Compose. Không để Compose tạo volume rỗng thay thế. Nếu MySQL không do Compose hiện tại quản lý, dừng để đối chiếu network/volume trước; không tạo thêm MySQL production.

## 3. Biến môi trường và secret

| Biến | Yêu cầu |
|---|---|
| MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD | Giữ đúng database/account hiện tại; không đổi password bằng cách chỉ sửa env |
| MYSQL_ROOT_PASSWORD | Giá trị hiện có khi dùng Compose MySQL; không dùng root cho backend/exporter |
| DB_HOST, DB_PORT | Trong Compose: mysql, 3306; không dùng cổng publish của host |
| NODE_ENV, PORT | production, 3000 cho cấu hình hiện tại |
| APP_ORIGIN | Chính xác http://club.local hoặc https://club.local sau chuyển TLS |
| COOKIE_SECURE | false cho HTTP lab; true khi HTTPS được xác minh |
| TRUST_PROXY | Đúng chuỗi proxy thực tế; backend chỉ bind loopback trên host |
| SESSION_TTL_HOURS | Theo chính sách, mặc định 8 |
| GRAFANA_ADMIN_PASSWORD_FILE | File password riêng, ngoài Git, chmod 600 |
| MYSQL_EXPORTER_CONFIG_FILE | File client config của account exporter riêng, ngoài Git |
| CLUB_BACKEND_LOG_DIR | Thư mục LogPath của đúng backend Club hiện tại |
| CLUB_NGINX_LOG_DIR | Thư mục có log Club riêng, thường /var/log/nginx |

Đặt quyền `.env` là 600, thư mục secrets là 700. Không gửi credential lên chat, terminal transcript, PR hoặc báo cáo. Không tái tạo Admin nếu Ubuntu đã có Admin.

## 4. Backup và rehearsal trước thay đổi

Đặt `MYSQL_CONTAINER` đúng tên đã kiểm kê, `BACKUP_DIR` ngoài repository rồi chạy `bash scripts/backup.sh`. Script từ chối container không có tên Club/MySQL phù hợp; không bỏ guard nếu tên không khớp. Nhờ người quản trị xác nhận workflow backup tương đương thay vì đổi tên container đang chạy.

Kiểm tra checksum và diễn tập restore lên container mới tên `club-management-restore-<mã>`, label `club-management.restore-test=true`, database rỗng, tmpfs/volume riêng. Dùng `RESTORE_CONTAINER`, `BACKUP_FILE`, `CONFIRM_RESTORE` theo BACKUP_RESTORE.md. Script từ chối target thiếu label, confirmation sai hoặc database có bảng. Không gắn volume production vào target rehearsal.

Đối chiếu schema, ledger, số dòng, tổng đóng góp và dữ liệu quan trọng. Mã hóa backup và lưu bản sao ngoài VM theo chính sách. Backup chỉ có giá trị nghiệm thu khi restore và dữ liệu đã được kiểm chứng. Không dùng dump chứa dữ liệu thật làm fixture CI hoặc commit.

## 5. Build và kiểm tra schema

Chỉ sau khi xác minh project/volume/network và backup:

```bash
club_compose=(docker compose -p "$COMPOSE_PROJECT_NAME" -f compose.yaml -f compose.backend.yaml -f compose.migrate.yaml)
"${club_compose[@]}" config --quiet
"${club_compose[@]}" build backend migrate
"${club_compose[@]}" run --rm --no-deps migrate node backend/scripts/migrate.js status
"${club_compose[@]}" run --rm --no-deps migrate node backend/scripts/migrate.js verify --all
```

`status` và `verify` chỉ đọc. Nếu ledger khớp và đủ 001–007, không cần thay schema. Nếu schema đủ nhưng thiếu ledger, review rồi chọn `adopt --through=007 --confirm`. Nếu chỉ có 001–005, chọn verify/baseline trước khi up phần thiếu. Nếu drift/checksum mismatch, dừng; không sửa migration hoặc checksum để vượt kiểm tra. Không chạy adopt/up chỉ vì chúng được nhắc trong tài liệu. MySQL DDL có implicit commit; không có rollback phá hủy schema tự động.

## 6. Backend và host Nginx

```bash
"${club_compose[@]}" up -d --no-deps backend
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/ready
```

`--no-deps` tránh recreate MySQL đang có. Dừng nếu backend chưa healthy hoặc không đọc đúng dữ liệu cũ. Không chạy `down -v`, prune, rm volume hoặc init lại database.

Cấu hình repository dùng **Nginx trên host** proxy đến 127.0.0.1:3000. Không đưa nguyên server block này vào Nginx container vì loopback khi đó là container. Nếu host đang chạy demo.local, chỉ thêm/sửa server block club.local; không thay nginx.conf toàn hệ thống hoặc server block demo.local. Cài club-logging.conf trong http context trước khi dùng format club_json. Backup cấu hình Club hiện tại, `sudo nginx -t` thành công rồi mới reload. TLS self-signed là bước riêng trong DEPLOYMENT.md, không tự chiếm cổng 443 hoặc bật HSTS.

## 7. Smoke test và nghiệp vụ

```bash
curl --fail --resolve club.local:80:127.0.0.1 http://club.local/api/health
curl --resolve club.local:80:127.0.0.1 -s -o /dev/null -w '%{http_code}\n' http://club.local/api/members
curl --resolve club.local:80:127.0.0.1 -s -o /dev/null -w '%{http_code}\n' http://club.local/metrics
curl --resolve demo.local:80:127.0.0.1 -I http://demo.local/
```

Mong đợi: health 200; members chưa login 401; metrics public 404; demo.local giữ hành vi trước triển khai. Không coi đây là kết quả đã chạy. Dùng trình duyệt kiểm tra cookie/CSRF, login/logout, Viewer không ghi, Manager ghi và Admin quản lý tài khoản trên fixture được phép. Đổi mật khẩu, disable và tạo dữ liệu cần kế hoạch kiểm thử được người vận hành chấp thuận; không thử tùy tiện lên tài khoản/dữ liệu thật. Ghi lại số liệu cũ trước/sau và chụp ảnh thật.

## 8. Monitoring và logging

Triển khai sau backend ổn định và còn đủ RAM/disk. Kiểm tra cổng loopback 9090/3001, tên project và volume giám sát riêng trước khi bật. Chỉ start các service được chọn; không chạy up toàn bộ khiến MySQL cũ bị recreate ngoài ý muốn.

Prometheus cần các target backend/node/cAdvisor/MySQL/Nginx UP; đồng thời mysql_up và nginx_up bằng 1. Account MySQL exporter có quyền tối thiểu và giới hạn kết nối. Node exporter/cAdvisor có quyền đọc host rộng: review cgroup, /dev/kmsg, mounts và tài nguyên trước khi bật. Không bật privileged chỉ để vượt lỗi.

Grafana dùng UID club-prometheus và club-loki; xem dashboard Club Management Operations. Alloy là collector mặc định; Promtail chỉ profile legacy, không chạy cả hai trên cùng file. LogPath thay đổi khi recreate backend: cập nhật CLUB_BACKEND_LOG_DIR rồi restart đúng collector. Không mount Docker socket hoặc thu log demo.local. Kiểm tra ba truy vấn LogQL trong OBSERVABILITY.md, retention và disk. Local Windows PASS không chứng minh exporter/collector Ubuntu đã UP.

## 9. Rollback

Trước nâng cấp, lưu image ID cũ và gắn một tag rollback riêng, cùng bản Compose/env/Nginx Club có quyền truy cập hạn chế. Nếu ứng dụng mới lỗi, dùng override image tag cũ và `up -d --no-deps --no-build backend` cho đúng project; kiểm tra health và dữ liệu. Khôi phục riêng server block Club cũ rồi nginx -t trước reload. Không ảnh hưởng demo.local.

Không rollback dữ liệu bằng xóa volume hoặc chạy restore đè production. Mã nguồn không thêm migration schema mới, nên rollback ứng dụng vẫn dùng schema 001–007. Nếu người vận hành đã có thay đổi dữ liệu/schema khác, dừng và dùng kế hoạch phục hồi riêng đã diễn tập. Không xóa backup hoặc image cũ trước nghiệm thu.

## 10. Minh chứng còn phải lấy

PENDING_UBUNTU_EVIDENCE: schema/ledger thực, dữ liệu cũ bảo toàn, health sau reboot, Nginx và demo.local, HTTPS trust/cookie nếu bật, firewall/cổng, host/exporter UP, quyền đọc log, retention thực, backup/restore dữ liệu Ubuntu, tài nguyên VMware và review CVE OS/container image. Không có bước nào ở đây đã được Codex thực hiện trên Ubuntu.
