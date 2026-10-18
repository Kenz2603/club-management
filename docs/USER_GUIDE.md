# Hướng dẫn sử dụng

## Vai trò

Admin quản lý tài khoản, role, khóa và reset mật khẩu. Manager quản lý nghiệp vụ của tất cả CLB. Viewer chỉ đọc, bao gồm dữ liệu thành viên và đóng góp theo ma trận đã duyệt. Khách chỉ xem home và API CLB công khai cũ.

## Luồng làm việc

1. Admin tạo tài khoản trong trang Tài khoản. Không có đăng ký công khai.
2. Đăng nhập; mở Tổng quan để xem số CLB/thành viên/hoạt động, tổng đóng góp confirmed và 10 lịch họp tương lai gần nhất.
3. Tạo CLB trước, ghi lại ID. Tạo thành viên bằng CLB ID; email duy nhất trong cùng CLB.
4. Tạo hoạt động/họp với CLB ID, thời gian kết thúc phải sau bắt đầu. Thời gian nhập theo timezone trình duyệt.
5. Tạo đóng góp bằng member ID, số tiền dương với tối đa hai số lẻ. Chỉ confirmed được tính vào tổng dashboard; các trạng thái khác được thống kê riêng.
6. Dùng Chi tiết để xem toàn bộ trường; Sửa để cập nhật. Ngừng/Hủy có xác nhận và chỉ đổi trạng thái, không xóa vật lý.
7. Tìm kiếm và lọc trạng thái/CLB ID; phân trang 20 dòng. Trang đóng góp hiển thị tổng theo trạng thái dựa trên bộ lọc hiện tại.
8. Hồ sơ cho phép đổi mật khẩu bản thân, giữ phiên hiện tại và thu hồi các phiên khác. Admin reset password thu hồi mọi phiên của tài khoản đích.
9. Đăng xuất chỉ chuyển trang khi server xác nhận thành công. Nếu mất mạng, thử lại.

Không nhập thông tin cá nhân vào trường tên CLB nếu danh sách đó cần công khai. Các trang nghiệp vụ mới yêu cầu đăng nhập. Không đưa tài khoản thật lên báo cáo hoặc screenshot công khai. Giao diện ID cho liên kết dùng ID có thật; server kiểm tra FK, không tự tạo CLB/thành viên thay thế.
