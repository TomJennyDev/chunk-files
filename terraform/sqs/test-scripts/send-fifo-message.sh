#!/bin/bash

# Script để test send FIFO messages
# Usage: ./send-fifo-message.sh <queue-url> <message> <group-id>

QUEUE_URL=$1
MESSAGE=${2:-"Test FIFO message"}
MESSAGE_GROUP_ID=${3:-"test-group-1"}
DEDUP_ID=$(date +%s%N)

if [ -z "$QUEUE_URL" ]; then
    echo "Usage: $0 <queue-url> [message] [message-group-id]"
    echo "Example: $0 http://localhost:4566/000000000000/test-fifo-queue.fifo 'Hello FIFO' tenant-123"
    exit 1
fi

echo "Sending FIFO message to queue: $QUEUE_URL"
echo "Message Group ID: $MESSAGE_GROUP_ID"
echo "Deduplication ID: $DEDUP_ID"
echo ""

aws --endpoint-url=http://localhost:4566 \
    sqs send-message \
    --queue-url "$QUEUE_URL" \
    --message-body "$MESSAGE" \
    --message-group-id "$MESSAGE_GROUP_ID" \
    --message-deduplication-id "$DEDUP_ID" \
    --region us-east-1

echo ""
echo "FIFO message sent successfully!"
