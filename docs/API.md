# API

Response thành công: `{success:true,data:...}`; list mới thêm pagination `{page,limit,total,totalPages}`. Lỗi `{success:false,message}`. Health cũ giữ nguyên `{status,application,message}`.

Login nhận `{username,password}`; username có thể là email. Session cookie HttpOnly, không trả raw token trong body. `/api/auth/me` và `/csrf` trả CSRF token. Request ghi gửi `X-CSRF-Token` và Origin cùng APP_ORIGIN.

| Method | Endpoint | Quyền |
|---|---|---|
| GET | /api/health | Public |
| GET | /api/ready | Public, không tiết lộ DB error |
| GET | /api/clubs | Public, response legacy không pagination |
| POST | /api/auth/login | Public + Origin + limiter |
| POST | /api/auth/logout | Auth + CSRF |
| GET | /api/auth/me, /api/auth/csrf | Auth |
| PUT | /api/auth/password | Auth + CSRF + sensitive limiter |
| GET | /api/users, /api/users/:id | Admin |
| POST | /api/users | Admin + CSRF |
| PUT | /api/users/:id | Admin + CSRF |
| PATCH | /api/users/:id/status | Admin + CSRF |
| POST | /api/users/:id/reset-password | Admin + CSRF + sensitive limiter |
| GET | /api/dashboard, /api/catalog | Auth |
| GET | /metrics | Internal network; Nginx public block |

## /api/manage/clubs

| Method | Path suffix | Hành vi |
|---|---|---|
| GET | / | List, tìm kiếm, phân trang, role đã đăng nhập |
| GET | /:id | Chi tiết, role đã đăng nhập |
| POST | / | Tạo, Manager/Admin + CSRF |
| PUT | /:id | Sửa một phần hoặc đầy đủ field cho phép, Manager/Admin + CSRF |
| PATCH | /:id/status | Cập nhật status, Manager/Admin + CSRF |
| DELETE | /:id | Chuyển inactive/cancelled, giữ lịch sử, Manager/Admin + CSRF |

## /api/members

| Method | Path suffix | Hành vi |
|---|---|---|
| GET | / | List, tìm kiếm, phân trang, role đã đăng nhập |
| GET | /:id | Chi tiết, role đã đăng nhập |
| POST | / | Tạo, Manager/Admin + CSRF |
| PUT | /:id | Sửa một phần hoặc đầy đủ field cho phép, Manager/Admin + CSRF |
| PATCH | /:id/status | Cập nhật status, Manager/Admin + CSRF |
| DELETE | /:id | Chuyển inactive/cancelled, giữ lịch sử, Manager/Admin + CSRF |

## /api/activities

| Method | Path suffix | Hành vi |
|---|---|---|
| GET | / | List, tìm kiếm, phân trang, role đã đăng nhập |
| GET | /:id | Chi tiết, role đã đăng nhập |
| POST | / | Tạo, Manager/Admin + CSRF |
| PUT | /:id | Sửa một phần hoặc đầy đủ field cho phép, Manager/Admin + CSRF |
| PATCH | /:id/status | Cập nhật status, Manager/Admin + CSRF |
| DELETE | /:id | Chuyển inactive/cancelled, giữ lịch sử, Manager/Admin + CSRF |

## /api/meetings

| Method | Path suffix | Hành vi |
|---|---|---|
| GET | / | List, tìm kiếm, phân trang, role đã đăng nhập |
| GET | /:id | Chi tiết, role đã đăng nhập |
| POST | / | Tạo, Manager/Admin + CSRF |
| PUT | /:id | Sửa một phần hoặc đầy đủ field cho phép, Manager/Admin + CSRF |
| PATCH | /:id/status | Cập nhật status, Manager/Admin + CSRF |
| DELETE | /:id | Chuyển inactive/cancelled, giữ lịch sử, Manager/Admin + CSRF |

## /api/contributions

| Method | Path suffix | Hành vi |
|---|---|---|
| GET | / | List, tìm kiếm, phân trang, role đã đăng nhập |
| GET | /:id | Chi tiết, role đã đăng nhập |
| POST | / | Tạo, Manager/Admin + CSRF |
| PUT | /:id | Sửa một phần hoặc đầy đủ field cho phép, Manager/Admin + CSRF |
| PATCH | /:id/status | Cập nhật status, Manager/Admin + CSRF |
| DELETE | /:id | Chuyển inactive/cancelled, giữ lịch sử, Manager/Admin + CSRF |

`GET /api/clubs/:id`, POST/PUT/PATCH/DELETE `/api/clubs` cũng hỗ trợ thao tác tương ứng; chỉ GET list giữ legacy. `/api/contributions/summary` trả array `{status,count,total}` theo bộ lọc; tổng tiền là chuỗi DECIMAL.

## Query

`page` mặc định 1, `limit` 20, tối đa 100. `q` tối đa 200 ký tự; status/role theo enum; `club_id` cho member/activity/meeting và contributions qua member; `member_id` cho contributions. Search literal escape % và _. Query sai trả 400; không có pagination trong GET /api/clubs cũ.

## Payload

Danh sách field và enum từ `/api/catalog` hoặc DATABASE.md. Tạo yêu cầu các field NOT NULL nghiệp vụ trừ giá trị có default. PUT không nhận id/timestamps/field lạ. DATE YYYY-MM-DD; DATETIME UTC YYYY-MM-DD HH:mm:ss. Amount chuỗi decimal dương tối đa 9999999999.99. Không tạo/sửa dữ liệu dưới parent inactive; vẫn cho hủy/ngừng bản ghi để bảo toàn lịch sử.

## Mã lỗi

400 validation; 401 chưa đăng nhập/hết phiên; 403 sai role/CSRF/origin; 404 không tìm thấy; 409 duplicate/FK/admin cuối/parent inactive; 429 limiter; 500 lỗi nội bộ; 503 readiness DB. Error 500 production không trả SQL/error.message. Không có public registration.
