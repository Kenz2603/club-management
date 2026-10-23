# Club Management - Backend Log Forwarder

Dich vu chuyen tiep log JSON tu Docker Backend sang file de Promtail gui den Loki.

## Thanh phan

- scripts/club-log-forwarder.py
- systemd/club-log-forwarder.service
- logrotate/club-backend

## Cai dat tren Ubuntu

Chay cac lenh sau tu thu muc goc repository:

    sudo install -d -m 0755 /usr/local/lib/club-management
    sudo install -d -m 0700 /var/lib/club-log-forwarder
    sudo install -d -m 2750 -o root -g adm /var/log/club
    sudo install -d -m 2750 -o root -g adm /var/log/club/backend
    sudo install -m 0755 deploy/scripts/club-log-forwarder.py /usr/local/lib/club-management/club-log-forwarder.py
    sudo install -m 0644 deploy/systemd/club-log-forwarder.service /etc/systemd/system/club-log-forwarder.service
    sudo install -m 0644 deploy/logrotate/club-backend /etc/logrotate.d/club-backend
    sudo systemctl daemon-reload
    sudo systemctl enable --now club-log-forwarder.service

## Kiem tra

    sudo systemctl is-active club-log-forwarder.service
    sudo tail -n 5 /var/log/club/backend/backend.log

## Luu y

- Backend container phai co ten club-management-backend-1.
- Docker phai hoat dong truoc khi khoi dong dich vu.
- Khong cap Docker socket cho Promtail.
- Log Backend: /var/log/club/backend/backend.log.
- State: /var/lib/club-log-forwarder/last_timestamp.
- Khong commit .env, secrets, mat khau hoac du lieu MySQL.
- Timestamp checkpoint khong bao dam chong mat/trung log tuyet doi.
