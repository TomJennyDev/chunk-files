#!/bin/bash
# LocalStack initialization script for DynamoDB
# This script runs when LocalStack starts

echo "Initializing DynamoDB resources..."

# Wait for DynamoDB to be ready
sleep 2

# Example: Create test tables
# awslocal dynamodb create-table \
#   --table-name test-table \
#   --attribute-definitions AttributeName=id,AttributeType=S \
#   --key-schema AttributeName=id,KeyType=HASH \
#   --billing-mode PAY_PER_REQUEST

echo "DynamoDB initialization complete!"
