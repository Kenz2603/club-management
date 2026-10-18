# Giới thiệu đề tài

Club Management hỗ trợ quản lý câu lạc bộ trong môi trường học tập với dữ liệu câu lạc bộ, thành viên, hoạt động, lịch họp và đóng góp. Mục tiêu là kết hợp chức năng web với kiến thức triển khai dịch vụ Linux, bảo mật và quan sát hệ thống. Một giao diện chạy được chưa đủ chứng minh chất lượng vận hành; đồ án cần mô tả dữ liệu, quyền, quy trình phục hồi và kết quả kiểm thử có nguồn gốc rõ ràng.

Ứng dụng được phát triển tiếp từ repository hiện có, không tạo dự án thay thế. Baseline main tại commit 293cf25 cung cấp Express, MySQL, frontend thuần và authentication giai đoạn hai. Các migration 001–007 được bảo toàn vì Ubuntu đã có dữ liệu. Mọi kiểm thử ghi dữ liệu trong quá trình hoàn thiện chỉ thực hiện trên MySQL dùng một lần ở Windows Docker Desktop.

Phạm vi gồm tài khoản do Admin tạo, ba vai trò Admin/Manager/Viewer, CRUD và quy trình ngừng hoạt động hoặc hủy giữ lịch sử. Không có đăng ký công khai, thanh toán trực tuyến, đăng ký/điểm danh hoạt động hoặc phân công manager theo từng CLB. Những chức năng ngoài phạm vi này cần yêu cầu nghiệp vụ và migration bổ sung được review.

Ma trận quyền nghiệp vụ đã được người dùng phê duyệt trong hội thoại: Viewer đọc dữ liệu nghiệp vụ kể cả thành viên/đóng góp, Manager đọc và ghi toàn bộ CLB, Admin quản lý thêm tài khoản. Dữ liệu CLB công khai cũ giữ nguyên hợp đồng API. Quyết định mở dữ liệu nội bộ cho người đã đăng nhập phải được nhắc lại trong hướng dẫn vận hành để người quản trị tạo tài khoản đúng đối tượng.

Bản thảo sử dụng bằng chứng từ source, kết quả Node tests, MySQL 8.4 cách ly, Chromium headless và validators của cấu hình Docker/monitoring. Các ảnh cuối báo cáo là ảnh thực từ môi trường test Windows. Mọi nội dung chưa kiểm chứng trên Ubuntu mang nhãn PENDING_UBUNTU_EVIDENCE; báo cáo không suy diễn rằng cấu hình tồn tại đồng nghĩa dịch vụ production hoạt động.
