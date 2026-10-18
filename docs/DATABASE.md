# Database và migration

MySQL 8.4, InnoDB, utf8mb4_unicode_ci. Không sửa migration 001–007 đã áp dụng. Không cần migration mới vì các bảng hiện có đáp ứng CRUD đã được phê duyệt. Không có seed production.

## clubs (001_create_clubs.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| name | varchar(150) | False | None |
| description | text | True | None |
| founded_date | date | True | None |
| status | enum('active','inactive') | False | active |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}}

Foreign keys: []

CHECK: {}

## members (002_create_members.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| club_id | bigint unsigned | False | None |
| full_name | varchar(150) | False | None |
| email | varchar(191) | False | None |
| phone | varchar(20) | True | None |
| student_code | varchar(50) | True | None |
| joined_date | date | True | None |
| role | enum('member','leader','vice_leader') | False | member |
| status | enum('active','inactive') | False | active |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "uq_members_club_email": {"columns": ["club_id", "email"], "unique": true}, "idx_members_club_status": {"columns": ["club_id", "status"], "unique": false}}

Foreign keys: [{"name": "fk_members_club", "column": "club_id", "table": "clubs", "target": "id", "update": "CASCADE", "delete": "RESTRICT"}]

CHECK: {}

## activities (003_create_activities.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| club_id | bigint unsigned | False | None |
| title | varchar(200) | False | None |
| description | text | True | None |
| location | varchar(255) | True | None |
| start_time | datetime | False | None |
| end_time | datetime | False | None |
| max_participants | int unsigned | True | None |
| status | enum('planned','ongoing','completed','cancelled') | False | planned |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "idx_activities_club_start": {"columns": ["club_id", "start_time"], "unique": false}, "idx_activities_status": {"columns": ["status"], "unique": false}}

Foreign keys: [{"name": "fk_activities_club", "column": "club_id", "table": "clubs", "target": "id", "update": "CASCADE", "delete": "RESTRICT"}]

CHECK: {"chk_activities_time": "end_time > start_time"}

## contributions (004_create_contributions.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| member_id | bigint unsigned | False | None |
| amount | decimal(12,2) | False | None |
| contribution_date | date | False | None |
| payment_method | enum('cash','bank_transfer','other') | False | cash |
| status | enum('pending','confirmed','cancelled') | False | pending |
| description | text | True | None |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "idx_contributions_member_date": {"columns": ["member_id", "contribution_date"], "unique": false}, "idx_contributions_status": {"columns": ["status"], "unique": false}}

Foreign keys: [{"name": "fk_contributions_member", "column": "member_id", "table": "members", "target": "id", "update": "CASCADE", "delete": "RESTRICT"}]

CHECK: {"chk_contributions_amount": "amount > 0"}

## meetings (005_create_meetings.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| club_id | bigint unsigned | False | None |
| title | varchar(200) | False | None |
| agenda | text | True | None |
| location | varchar(255) | True | None |
| start_time | datetime | False | None |
| end_time | datetime | False | None |
| status | enum('scheduled','completed','cancelled') | False | scheduled |
| notes | text | True | None |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "idx_meetings_club_start": {"columns": ["club_id", "start_time"], "unique": false}, "idx_meetings_status": {"columns": ["status"], "unique": false}}

Foreign keys: [{"name": "fk_meetings_club", "column": "club_id", "table": "clubs", "target": "id", "update": "CASCADE", "delete": "RESTRICT"}]

CHECK: {"chk_meetings_time": "end_time > start_time"}

## users (006_create_users.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| username | varchar(50) | False | None |
| email | varchar(191) | False | None |
| password_hash | varchar(255) | False | None |
| full_name | varchar(150) | False | None |
| role | enum('admin','manager','viewer') | False | viewer |
| status | enum('active','disabled') | False | active |
| last_login_at | datetime | True | None |
| password_changed_at | datetime | False | current_timestamp |
| created_at | timestamp | False | current_timestamp |
| updated_at | timestamp | False | current_timestamp |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "uq_users_username": {"columns": ["username"], "unique": true}, "uq_users_email": {"columns": ["email"], "unique": true}, "idx_users_role": {"columns": ["role"], "unique": false}, "idx_users_status": {"columns": ["status"], "unique": false}}

Foreign keys: []

CHECK: {}

## user_sessions (007_create_user_sessions.sql)

| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | bigint unsigned | False | None |
| user_id | bigint unsigned | False | None |
| token_hash | char(64) | False | None |
| csrf_secret | char(64) | False | None |
| ip_address | varchar(45) | True | None |
| user_agent | varchar(255) | True | None |
| created_at | timestamp | False | current_timestamp |
| last_active_at | timestamp | False | current_timestamp |
| expires_at | datetime | False | None |
| revoked_at | datetime | True | None |

Index: {"PRIMARY": {"columns": ["id"], "unique": true}, "uq_sessions_token_hash": {"columns": ["token_hash"], "unique": true}, "idx_sessions_user_active": {"columns": ["user_id", "revoked_at", "expires_at"], "unique": false}, "idx_sessions_expires": {"columns": ["expires_at"], "unique": false}}

Foreign keys: [{"name": "fk_sessions_user", "column": "user_id", "table": "users", "target": "id", "update": "CASCADE", "delete": "CASCADE"}]

CHECK: {}

## Quan hệ và dữ liệu

clubs 1-n members/activities/meetings; members 1-n contributions; users 1-n sessions. FK nghiệp vụ RESTRICT DELETE/CASCADE UPDATE; session CASCADE DELETE. API không xóa vật lý; inactive/cancelled giữ lịch sử. Username/email user unique toàn hệ thống; member email unique theo CLB. Amount DECIMAL trả chuỗi, không cộng tiền bằng float trong backend. ID BIGINT trong miền an toàn giữ kiểu number như API cũ; vượt Number.MAX_SAFE_INTEGER được driver trả chuỗi để tránh mất chính xác. Routes legacy CLB/user serialize ngày giờ thành ISO như trước, API nghiệp vụ mới dùng DATE/DATETIME UTC dạng chuỗi.

## Quy trình schema

- Database trống: `node --env-file=.env backend/scripts/migrate.js up --confirm` áp dụng SQL theo thứ tự dưới advisory lock. Chỉ chạy khi đã kiểm tra đúng target và backup.
- Database có 001–005: `verify`, rồi `baseline --confirm`, kiểm tra status, sau đó up cho phần thiếu.
- Database có đủ 001–007 do dev init hoặc triển khai cũ: `verify --all`, rồi `adopt --through=007 --confirm`. Adopt chỉ ghi ledger sau kiểm tra type/null/default/auto-update/PK/unique/index/FK/CHECK. Không sửa bảng hoặc dữ liệu.
- `status` chỉ đọc; `verify --all` chỉ đọc. `up` không có --confirm chỉ in status. Không tự migrate khi backend khởi động.
- Không tự adopt khi schema drift; dừng và điều tra. Schema khác manifest cần migration mới được review.

## Rủi ro và rollback

MySQL DDL có implicit commit; CREATE TABLE và ghi ledger không atomic. Nếu SQL thành công rồi ledger thất bại, runner dừng vì bảng tồn tại; không chạy lặp mù quáng. So sánh schema, snapshot và checksum, sau đó adopt có kiểm tra nếu đúng. Không sửa checksum cũ để che drift. Rollback ứng dụng bằng image cũ; schema chỉ thay đổi bổ sung tương thích. Khôi phục dữ liệu cần backup và thử trên DB cách ly trước; không có down migration phá hủy bảng.

## Transaction

Login xác minh scrypt ngoài transaction; sau đó khóa và đọc lại user, đối chiếu ID, trạng thái và password hash trước khi tạo session. Change/reset password khóa user và cập nhật hash/thu hồi session trong cùng transaction. Update role/status khóa active admins trước target, kiểm tra admin cuối, update và revoke cùng commit. Ghi nghiệp vụ khóa record và parent. Deadlock và lock timeout của MySQL trả 409; client thử lại thao tác sau khi kiểm tra trạng thái, không retry mù để tránh tạo bản ghi trùng.

PENDING_UBUNTU_EVIDENCE: đối chiếu full schema, timezone, collation và ledger thật; không giả định database Ubuntu trống.
