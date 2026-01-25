#!/bin/bash

# Script để test receive messages từ SQS queue
# Usage: ./receive-message.sh <queue-url>

QUEUE_URL=$1
MAX_MESSAGES=${2:-10}
WAIT_TIME=${3:-20}

if [ -z "$QUEUE_URL" ]; then
    echo "Usage: $0 <queue-url> [max-messages] [wait-time-seconds]"
    echo "Example: $0 http://localhost:4566/000000000000/test-basic-queue 10 20"
    exit 1
fi

echo "Receiving messages from queue: $QUEUE_URL"
echo "Max messages: $MAX_MESSAGES"
echo "Wait time: $WAIT_TIME seconds (long polling)"
echo ""

aws --endpoint-url=http://localhost:4566 \
    sqs receive-message \
    --queue-url "$QUEUE_URL" \
    --max-number-of-messages "$MAX_MESSAGES" \
    --wait-time-seconds "$WAIT_TIME" \
    --region us-east-1 \
    --output json
