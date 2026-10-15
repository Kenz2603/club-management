#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "UBUNTU ENVIRONMENT PRECHECK (READ-ONLY)"
echo "=========================================="
echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Host: $(hostname)"
echo ""

echo "--- 1. OS AND KERNEL ---"
uname -a
if [ -f /etc/os-release ]; then
    cat /etc/os-release | grep -E '^(NAME|VERSION)='
fi
echo ""

echo "--- 2. CPU AND SYSTEM LOAD ---"
if command -v lscpu >/dev/null 2>&1; then
    lscpu | grep -E '^(Model name|CPU\(s\)|Thread\(s\) per core|Core\(s\) per socket|CPU MHz|Architecture):' || true
else
    echo "CPU cores: $(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 'unknown')"
fi
echo ""
echo "Uptime and Load Average:"
uptime || true
echo ""

echo "--- 3. NETWORK INTERFACES AND IP ADDRESSES ---"
if command -v ip >/dev/null 2>&1; then
    ip -br addr || ip addr || true
elif command -v hostname >/dev/null 2>&1; then
    hostname -I || true
fi
echo ""

echo "--- 4. CGROUP VERSION ---"
if [ -d /sys/fs/cgroup ]; then
    stat -fc %T /sys/fs/cgroup/ || true
fi
echo ""

echo "--- 5. MEMORY, SWAP AND STORAGE ---"
free -h || true
echo ""
swapon --show || true
echo ""
df -h / || true
echo ""

echo "--- 6. DOCKER ENGINE AND COMPOSE ---"
if command -v docker >/dev/null 2>&1; then
    docker --version || true
    docker compose version || true
else
    echo "docker command not found"
fi
echo ""

echo "--- 7. DOCKER CONTAINERS, NETWORKS, VOLUMES ---"
if command -v docker >/dev/null 2>&1; then
    echo "[Containers]"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    echo ""
    echo "[Networks]"
    docker network ls || true
    echo ""
    echo "[Volumes]"
    docker volume ls || true
fi
echo ""

echo "--- 8. NGINX STATUS AND CONFIGURATION ---"
if command -v nginx >/dev/null 2>&1; then
    nginx -v || true
    if command -v systemctl >/dev/null 2>&1; then
        systemctl is-active nginx || true
    fi
    echo ""
    echo "[Nginx Server Blocks]"
    nginx -T 2>/dev/null | grep -E '(server_name|listen|proxy_pass)' || true
else
    echo "nginx command not found"
fi
echo ""

echo "--- 9. LISTENING PORTS ---"
if command -v ss >/dev/null 2>&1; then
    ss -ltn || true
elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn || true
fi
echo ""

echo "--- 10. FIREWALL (UFW) ---"
if command -v ufw >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
        ufw status verbose || true
    else
        echo "Requires sudo: run 'sudo ufw status verbose' manually if needed"
    fi
else
    echo "ufw command not found"
fi
echo ""

echo "--- 11. LOGS AND DIRECTORY PERMISSIONS ---"
if [ -d /var/log/nginx ]; then
    ls -ld /var/log/nginx || true
    ls -l /var/log/nginx || true
else
    echo "/var/log/nginx not present"
fi
echo ""
if [ -d /var/lib/docker/containers ]; then
    ls -ld /var/lib/docker/containers || true
else
    echo "/var/lib/docker/containers not directly accessible or not present"
fi
echo ""

echo "--- 12. DATABASE CONTAINER STATUS AND SCHEMA CHECK ---"
if command -v docker >/dev/null 2>&1; then
    MYSQL_CONTAINER=$(docker ps --filter "name=mysql" --format "{{.Names}}" | head -n 1 || true)
    if [ -n "${MYSQL_CONTAINER}" ]; then
        echo "Found MySQL container: ${MYSQL_CONTAINER}"
        CONTAINER_STATUS=$(docker inspect --format '{{.State.Status}} (healthy: {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}})' "${MYSQL_CONTAINER}" 2>/dev/null || true)
        echo "Container status: ${CONTAINER_STATUS}"
        if docker exec -i "${MYSQL_CONTAINER}" mysql --batch --skip-column-names -e "SELECT table_name FROM information_schema.tables WHERE table_schema='club_management';" 2>/dev/null; then
            echo "Schema tables retrieved successfully via default authentication."
        else
            echo "[SKIPPED] Database schema query skipped: requires authentication credentials. Passwords are not accepted, read, or exposed during precheck."
        fi
    else
        echo "[SKIPPED] MySQL container is not currently running."
    fi
else
    echo "[SKIPPED] Docker command not found."
fi
echo ""

echo "=========================================="
echo "PRECHECK COMPLETED"
echo "=========================================="
