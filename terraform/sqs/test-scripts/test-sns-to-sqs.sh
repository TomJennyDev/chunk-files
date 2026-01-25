#!/bin/bash

# Script để test SNS → SQS integration
# Usage: ./test-sns-to-sqs.sh <topic-arn> <queue-url>

TOPIC_ARN=$1
QUEUE_URL=$2
MESSAGE=${3:-"Test message from SNS to SQS"}

if [ -z "$TOPIC_ARN" ] || [ -z "$QUEUE_URL" ]; then
    echo "Usage: $0 <topic-arn> <queue-url> [message]"
    echo "Example: $0 arn:aws:sns:us-east-1:000000000000:test-topic http://localhost:4566/000000000000/test-sns-queue"
    exit 1
fi

echo "Publishing message to SNS topic: $TOPIC_ARN"
echo "Message will be delivered to SQS queue: $QUEUE_URL"
echo ""

# Publish to SNS
aws --endpoint-url=http://localhost:4566 \
    sns publish \
    --topic-arn "$TOPIC_ARN" \
    --message "$MESSAGE" \
    --region us-east-1

echo ""
echo "Message published to SNS!"
echo "Waiting 2 seconds for delivery..."
sleep 2

echo ""
echo "Checking SQS queue for messages..."
aws --endpoint-url=http://localhost:4566 \
    sqs receive-message \
    --queue-url "$QUEUE_URL" \
    --max-number-of-messages 10 \
    --region us-east-1 \
    --output json | jq '.Messages[].Body' | jq -r '.' | jq '.'
