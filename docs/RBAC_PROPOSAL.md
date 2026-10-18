# Ma trận quyền nghiệp vụ đề xuất

Trạng thái: APPROVED. Người dùng đã trả lời “Duyệt ma trận đề xuất” trong hội thoại. Đây là ma trận đang được triển khai và kiểm thử; các quyền/API cũ được bảo toàn.

| Thao tác | Khách | Viewer | Manager | Admin |
|---|---|---|---|---|
| GET /api/health và GET /api/clubs cũ | Có | Có | Có | Có |
| Đọc chi tiết CLB, thành viên, hoạt động, họp, đóng góp, dashboard | Không | Có | Có | Có |
| Tạo/sửa/ngừng CLB và các dữ liệu nghiệp vụ | Không | Không | Có | Có |
| Quản lý tài khoản/role/status/reset password | Không | Không | Không | Có |
| Hồ sơ, đổi mật khẩu bản thân | Không | Có | Có | Có |

Manager quản lý tất cả CLB vì schema chưa có user-club assignment. Viewer đọc được dữ liệu thành viên và đóng góp, có thể chứa thông tin cá nhân. Người vận hành phải cấp tài khoản phù hợp quyết định nghiệp vụ đã được duyệt này.

GET /api/clubs công khai cũ giữ nguyên. Mọi thao tác ghi đều có auth, RBAC, CSRF và validation. DELETE mới chỉ đổi trạng thái, không xóa vật lý.

Thay đổi phạm vi đọc dữ liệu nhạy cảm hoặc phân công manager theo từng CLB về sau cần yêu cầu nghiệp vụ mới; không tự thay đổi ma trận này khi triển khai.
