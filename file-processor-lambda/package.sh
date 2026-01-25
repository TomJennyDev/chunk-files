#!/bin/bash

# Package Lambda function for production deployment
set -e

echo "📦 Packaging Lambda function for production..."

# Clean previous builds
rm -rf dist
rm -f lambda-function.zip

# Create dist directory
mkdir -p dist

# Copy source files
echo "📄 Copying source files..."
cp -r src dist/

# Install production dependencies
echo "📥 Installing production dependencies..."
cd dist
npm init -y > /dev/null
npm install --production --no-optional \
  @aws-sdk/client-s3 \
  @aws-sdk/client-sqs \
  @elastic/elasticsearch

# Create zip package
echo "🗜️  Creating zip package..."
zip -r ../lambda-function.zip . > /dev/null

cd ..

# Show package info
PACKAGE_SIZE=$(du -h lambda-function.zip | cut -f1)
echo ""
echo "✅ Package created successfully!"
echo "📊 Size: $PACKAGE_SIZE"
echo "📦 File: lambda-function.zip"
echo ""
echo "🚀 Ready to deploy to AWS:"
echo "  aws lambda update-function-code \\"
echo "    --function-name file-processor-worker \\"
echo "    --zip-file fileb://lambda-function.zip"
echo ""
echo "📋 Or use Terraform/CloudFormation with this zip file"
