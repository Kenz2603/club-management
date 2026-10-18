# Backup và restore

Named volume không phải backup. Không xóa mysql_data và không chạy restore lên database đang phục vụ để thử nghiệm.

## Backup

Chạy `bash scripts/backup.sh` trên Ubuntu sau khi đặt MYSQL_CONTAINER đúng tên container Club MySQL và BACKUP_DIR trên nơi lưu trữ đủ dung lượng. Script chỉ chấp nhận tên có club-management và mysql, dùng credential có sẵn trong container, không in hoặc truyền password qua argv. mysqldump single-transaction/no-tablespaces tạo file partial, đổi tên khi thành công và sinh SHA-256. Thư mục/file chỉ owner truy cập theo umask 077.

Không chạy DDL đồng thời với single-transaction dump. Xem xét quyền routines/events của app user; nếu thiếu dùng tài khoản backup riêng do quản trị viên cấp, không tăng quyền app chỉ để dump. Script không tự cấp quyền. Bản backup chứa thông tin cá nhân, password hash và session metadata; không commit/chia sẻ công khai. Mã hóa bằng công cụ quản trị đã phê duyệt và lưu bản sao ngoài VM. Không ghi khóa mã hóa vào repo.

## Restore drill

Tạo container riêng tên club-management-restore-<mã>, database rỗng, volume riêng. Đặt RESTORE_CONTAINER, BACKUP_FILE, CONFIRM_RESTORE=<đúng tên container> rồi `bash scripts/restore-test.sh`. Script kiểm tra checksum và chỉ cho phép target prefix restore. Không tự tạo/xóa volume, không chấp nhận tên production.

Sau restore: verify --all, đối chiếu row count/tổng đóng góp, FK/CHECK/index, đăng nhập bằng tài khoản test được quản trị viên cho phép, kiểm tra không dùng session production. Chỉ kết luận restore thành công khi nội dung được kiểm chứng, không chỉ vì mysql exit 0. Runbook phục hồi production phải có downtime, backup trước thay đổi, quyền truy cập và rollback riêng do quản trị viên duyệt.

## Lịch và retention đề xuất

Backup hàng ngày, trước migration/nâng cấp; giữ 7 bản ngày và 4 bản tuần theo dung lượng thực; diễn tập restore định kỳ. Đây là đề xuất, chưa cài cron/timer hoặc xóa backup tự động. PENDING_UBUNTU_EVIDENCE: dump/restore thực, mã hóa, quyền file, lịch chạy và RPO/RTO đã duyệt.
