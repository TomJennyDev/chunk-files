#!/bin/bash
# LocalStack initialization script for S3
# This script runs when LocalStack starts

echo "Initializing S3 resources..."

# Wait for S3 to be ready
sleep 2

# Example: Create some test buckets
# awslocal s3 mb s3://test-bucket-1
# awslocal s3 mb s3://test-bucket-2

echo "S3 initialization complete!"
