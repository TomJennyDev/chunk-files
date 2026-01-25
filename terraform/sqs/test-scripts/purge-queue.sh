#!/bin/bash

# Script để purge (xóa tất cả messages) từ queue
# Usage: ./purge-queue.sh <queue-url>

QUEUE_URL=$1

if [ -z "$QUEUE_URL" ]; then
    echo "Usage: $0 <queue-url>"
    echo "Example: $0 http://localhost:4566/000000000000/test-basic-queue"
    exit 1
fi

echo "WARNING: This will delete ALL messages from the queue!"
echo "Queue: $QUEUE_URL"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Purge cancelled."
    exit 0
fi

aws --endpoint-url=http://localhost:4566 \
    sqs purge-queue \
    --queue-url "$QUEUE_URL" \
    --region us-east-1

echo "Queue purged successfully!"
