#!/bin/bash
# LocalStack initialization script for SQS
# This script runs when LocalStack starts

echo "Initializing SQS resources..."

# Wait for SQS to be ready
sleep 2

# Example: Create some test queues
# awslocal sqs create-queue --queue-name test-queue-1
# awslocal sqs create-queue --queue-name test-queue-2

echo "SQS initialization complete!"
