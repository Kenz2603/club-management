# Monitoring và logging

## Phiên bản và phạm vi

Compose bổ sung không tự chạy. Prometheus 7 ngày/512MB; Loki 72 giờ, ingest 2MB/s, query parallelism 2; mỗi service có giới hạn RAM/CPU. Tổng RAM cần tính thêm MySQL/backend/host. Không có endpoint quản trị bind public: Grafana 127.0.0.1:3001, Prometheus 127.0.0.1:9090; exporters/Loki chỉ bridge network. Dùng SSH tunnel nếu cần truy cập từ Windows. Không bật anonymous Grafana.

Promtail đã EOL 2026-03-02: [Grafana chính thức](https://grafana.com/docs/loki/latest/send-data/promtail/). Cấu hình được cung cấp để đối chiếu đồ án trong profile `legacy-promtail`; Alloy là collector mặc định còn được hỗ trợ. Không chạy hai collector cùng lúc trên cùng file. Quy trình migration: [Grafana Alloy](https://grafana.com/docs/alloy/latest/set-up/migrate/from-promtail/).

## Secret prerequisites

Tạo thư mục secrets ngoài Git, chmod 700; file password Grafana và mysql-exporter.cnf chmod 600. Compose secrets dùng file, không tự mã hóa file trên host. Không gửi nội dung vào chat.

Exporter dùng tài khoản riêng, SELECT/PROCESS/REPLICATION CLIENT và MAX_USER_CONNECTIONS nhỏ theo [mysqld_exporter](https://github.com/prometheus/mysqld_exporter). Host/phạm vi account phải phù hợp bridge thực tế. File cấu hình có phần [client], user, password, host=mysql, port=3306. Không dùng root hoặc app account. Khai báo GRAFANA_ADMIN_PASSWORD_FILE và MYSQL_EXPORTER_CONFIG_FILE nếu đường dẫn khác mặc định. Không lưu secret vào datasource/dashboard.

## Triển khai sau phê duyệt trên Ubuntu

```bash
docker compose -f compose.yaml -f compose.backend.yaml -f compose.monitoring.yaml -f compose.logging.yaml config --quiet
docker compose -f compose.yaml -f compose.backend.yaml -f compose.monitoring.yaml -f compose.logging.yaml up -d
```

Lệnh trên là triển khai, chưa được chạy bởi Codex. Giữ nguyên project production. Theo dõi memory/disk sau khi bật; Grafana provisioning UID cố định club-prometheus/club-loki, dashboard Club Management Operations.

Node Exporter mount root host read-only và pid host; cAdvisor cần /sys,/var/lib/docker,/dev/kmsg. Đây là quyền host rộng, không phải container ứng dụng least-privilege. Không bật privileged tự động nếu exporter thất bại; kiểm tra cgroup/permission và giảm collector phù hợp. Nginx exporter dùng host.docker.internal:8081; cấu hình status bind đúng docker0 và allow subnet cụ thể. Docker Desktop metrics không thay thế số liệu Ubuntu VMware.

## Chỉ thu thập Club logs

Đặt CLUB_BACKEND_LOG_DIR là thư mục chứa LogPath của đúng backend Club container. Dùng `docker inspect --format '{{.LogPath}}' <exact-backend-container>` để lấy path; không dump env. Đặt CLUB_NGINX_LOG_DIR=/var/log/nginx; collector chỉ match tên club-management.access.log/error.log. Không mount Docker socket. Sau recreate backend cần cập nhật LogPath/thư mục và collector; file path cũ không tự theo container mới.

Backend stdout JSON có level/event/method/route chuẩn hóa/status/duration/request ID, không có body, query string, password/cookie/Authorization. Nginx access format chỉ thời gian, method, status, bytes, duration. Nginx error raw có thể chứa request URI; collector thay bằng thông điệp tổng quát nginx_error để không gửi nội dung nhạy cảm. Raw error chỉ nằm host dưới quyền quản trị. Tránh dùng đường dẫn chứa secret trong client request.

## Kiểm chứng

1. Prometheus /targets: prometheus, club-backend, node, containers, mysql, nginx đều UP. Ngoài up, mysql_up/nginx_up phải bằng 1.
2. Grafana datasource Save & Test; dashboard hiển thị request rate/p95/RSS, host CPU/RAM, container CPU/RAM, MySQL connections và Nginx request rate.
3. Gây 404 bằng URL không tồn tại và quan sát metric/log. Chỉ thử 5xx trên môi trường test, không ngắt DB production.
4. Loki /ready từ internal network; Grafana Explore tìm các log dưới đây. Export request query/secret không được xuất hiện.
5. Kiểm tra retention bằng config và dung lượng theo thời gian; retention thời gian không đảm bảo giới hạn tuyệt đối disk. Backup/đặt alert disk trước khi đầy.

## LogQL

```logql
{service="backend"} | json | level="error"
{service="backend"} | json | event="http_request" | status >= 400
sum by (service) (count_over_time({service=~"backend|nginx"} | json | status >= 500 [5m]))
{service="nginx",stream="error"} |= "nginx_error"
```

Ba truy vấn đầu lần lượt tìm lỗi, HTTP 4xx/5xx và đếm 5xx theo service. Request ID dùng tìm log nhưng không làm Prometheus label. Chưa có Alertmanager receiver: rules đánh giá trong Prometheus, không tuyên bố có email/Slack notification. PENDING_UBUNTU_EVIDENCE cho target UP, quyền đọc file, host metrics, retention thực và dashboard screenshots.

## Legacy profile

Nếu buộc dùng Promtail cho lab: người vận hành phải dừng service alloy của đúng project trước, rồi chỉ up service promtail/loki bằng --profile legacy-promtail. Không chạy lệnh up toàn bộ profile khi Alloy đang chạy vì sẽ gửi log trùng. Đây là thao tác triển khai cần người vận hành quyết định, chưa được Codex thực hiện.

## Runtime c?ch ly ?? ki?m ch?ng tr?n Windows

`node scripts/test-grafana.js`: Grafana health, provisioning hai datasource UID v? dashboard 12 panel. `node scripts/test-logging.js`: t?o application log b?ng logger th?t, bao Docker JSON log, cho Alloy ??c file v? g?i v?o Loki t?m. Ba truy v?n x?c nh?n l?i backend, HTTP 404/500 v? Nginx error ?? ???c thay n?i dung nh?y c?m; fixture b? m?t kh?ng xu?t hi?n trong k?t qu?. Container/network ri?ng, tmpfs v? c?ng localhost ng?u nhi?n; kh?ng mount Docker socket ho?c log production. C?c k?t qu? n?y kh?ng ch?ng minh exporter ho?c collector Ubuntu ?? ho?t ??ng.
