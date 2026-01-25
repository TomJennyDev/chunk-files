#!/bin/bash

# Script để test send messages vào SQS queue
# Usage: ./send-message.sh <queue-url> <message>

QUEUE_URL=$1
MESSAGE=${2:-"Test message from LocalStack"}

if [ -z "$QUEUE_URL" ]; then
    echo "Usage: $0 <queue-url> [message]"
    echo "Example: $0 http://localhost:4566/000000000000/test-basic-queue"
    exit 1
fi

echo "Sending message to queue: $QUEUE_URL"

aws --endpoint-url=http://localhost:4566 \
    sqs send-message \
    --queue-url "$QUEUE_URL" \
    --message-body "$MESSAGE" \
    --region us-east-1

echo "Message sent successfully!"
