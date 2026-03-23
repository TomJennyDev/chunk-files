#!/bin/bash
# ============================================
# Health Check — Kiểm tra Docker container đang chạy
# Dùng bên trong LXC container qua pct exec
# ============================================

CONTAINER_NAME="${1:-}"
MAX_RETRIES="${2:-12}"
RETRY_INTERVAL="${3:-10}"

if [ -z "$CONTAINER_NAME" ]; then
  echo "Usage: health-check.sh <container_name> [max_retries] [retry_interval]"
  exit 1
fi

echo ">>> Health check: $CONTAINER_NAME (max ${MAX_RETRIES} retries, ${RETRY_INTERVAL}s interval)"

for i in $(seq 1 "$MAX_RETRIES"); do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "not_found")
  
  if [ "$STATUS" = "running" ]; then
    echo ">>> $CONTAINER_NAME is RUNNING!"
    docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
  fi

  echo ">>> [$i/$MAX_RETRIES] Status: $STATUS - đợi ${RETRY_INTERVAL}s..."
  
  # Nếu container exited, show logs
  if [ "$STATUS" = "exited" ] || [ "$STATUS" = "dead" ]; then
    echo ">>> Container logs (last 20 lines):"
    docker logs --tail 20 "$CONTAINER_NAME" 2>&1 || true
  fi

  sleep "$RETRY_INTERVAL"
done

echo ">>> FAILED: $CONTAINER_NAME không healthy sau $((MAX_RETRIES * RETRY_INTERVAL))s"
docker logs --tail 50 "$CONTAINER_NAME" 2>&1 || true
exit 1
