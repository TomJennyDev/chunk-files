#!/bin/bash

# Script để list tất cả queues trong LocalStack
# Usage: ./list-queues.sh

echo "Listing all SQS queues in LocalStack..."
echo ""

aws --endpoint-url=http://localhost:4566 \
    sqs list-queues \
    --region us-east-1 \
    --output table

echo ""
echo "To get queue attributes, use:"
echo "aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes --queue-url <URL> --attribute-names All"
