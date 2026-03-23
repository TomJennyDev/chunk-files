#!/bin/bash
# ============================================
# Setup Docker + Docker Compose trên LXC container
# Chạy tự động qua pct exec từ Proxmox host
# ============================================
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Skip nếu Docker đã cài
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo "Docker đã cài và đang chạy, bỏ qua..."
  docker --version
  exit 0
fi

echo "=== [1/7] Đợi apt lock release ==="
# Đợi nếu có process khác đang dùng apt
for i in $(seq 1 30); do
  if ! fuser /var/lib/dpkg/lock-frontend &> /dev/null 2>&1 && \
     ! fuser /var/lib/apt/lists/lock &> /dev/null 2>&1; then
    break
  fi
  echo "Đợi apt lock... ($i/30)"
  sleep 5
done

echo "=== [2/7] Cập nhật packages ==="
apt-get update -qq
apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  htop \
  git \
  jq \
  unzip \
  net-tools \
  software-properties-common \
  apt-transport-https \
  > /dev/null 2>&1

echo "=== [3/7] Thêm Docker GPG key + repo ==="
install -m 0755 -d /etc/apt/keyrings

# Xóa key cũ nếu tồn tại
rm -f /etc/apt/keyrings/docker.gpg

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "=== [4/7] Cài Docker Engine + Compose ==="
apt-get update -qq
apt-get install -y -qq \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin \
  > /dev/null 2>&1

echo "=== [5/7] Cấu hình Docker daemon ==="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "default-address-pools": [
    {
      "base": "172.20.0.0/16",
      "size": 24
    }
  ],
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true,
  "live-restore": true
}
EOF

echo "=== [6/7] Enable & start Docker ==="
systemctl enable docker
systemctl restart docker

# Đợi Docker daemon sẵn sàng
echo "Đợi Docker daemon..."
for i in $(seq 1 30); do
  if docker info &> /dev/null; then
    echo "Docker daemon sẵn sàng!"
    break
  fi
  echo "Đợi Docker... ($i/30)"
  sleep 3
done

echo "=== [7/7] Tạo thư mục data ==="
mkdir -p /opt/data
mkdir -p /opt/app

# Verify
echo ""
echo "======================================="
echo "  Docker setup hoàn tất!"
echo "  Host: $(hostname)"
echo "  Docker: $(docker --version)"
echo "  Compose: $(docker compose version)"
echo "======================================="
