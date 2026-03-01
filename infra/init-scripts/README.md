# LocalStack Initialization Scripts

Scripts trong folder này được tự động chạy khi LocalStack starts.

## Thứ tự thực thi

Scripts chạy theo alphabetical order:
1. `01-s3-setup.sh`
2. `02-sqs-setup.sh`
3. `03-dynamodb-setup.sh`
4. ...

## Cách sử dụng

### 1. Tạo script mới
```bash
# Tạo file với số thứ tự
touch 04-my-setup.sh
chmod +x 04-my-setup.sh
```

### 2. Viết script
```bash
#!/bin/bash
echo "Initializing my service..."

# Your initialization commands here
awslocal s3 mb s3://my-bucket
awslocal sqs create-queue --queue-name my-queue

echo "Initialization complete!"
```

### 3. Restart LocalStack
```bash
docker-compose restart
```

## Examples

### Create S3 buckets
```bash
#!/bin/bash
awslocal s3 mb s3://dev-bucket
awslocal s3 mb s3://prod-bucket
```

### Create SQS queues
```bash
#!/bin/bash
awslocal sqs create-queue --queue-name orders-queue
awslocal sqs create-queue --queue-name notifications-queue.fifo \
  --attributes FifoQueue=true
```

### Create DynamoDB tables
```bash
#!/bin/bash
awslocal dynamodb create-table \
  --table-name users \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Create SNS topics
```bash
#!/bin/bash
awslocal sns create-topic --name my-topic
```

## Notes

- Scripts phải có execute permission (`chmod +x`)
- Sử dụng `awslocal` command (wrapper cho AWS CLI với LocalStack endpoint)
- Scripts chạy trong container LocalStack
- Có thể check logs: `docker-compose logs localstack`
