# LocalStack Testing cho SQS Module

Hướng dẫn setup và test SQS module với LocalStack - emulate AWS services locally.

> **Note**: LocalStack container được quản lý ở thư mục `localstack/` (root level). 
> Lab này sử dụng shared LocalStack instance.

## Prerequisites

### 1. Docker & Docker Compose
```bash
# Check docker installation
docker --version
docker-compose --version

# Start LocalStack (from localstack root directory)
cd ../../  # Go to localstack/
docker-compose up -d
cd sqs/    # Back to sqs lab
```

### 2. AWS CLI
```bash
# Install AWS CLI
# Windows: https://aws.amazon.com/cli/
# Linux/Mac: 
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI cho LocalStack (dummy credentials)
aws configure set aws_access_key_id test
aws configure set aws_secret_access_key test
aws configure set region us-east-1
```

### 3. Terraform
```bash
# Check terraform installation
terraform --version
```

### 4. Python (optional - cho test scripts)
```bash
# Install boto3
pip install boto3
```

## Quick Start

### Bước 1: Verify LocalStack đang chạy

```bash
# Check LocalStack status (từ localstack root)
cd ../../ && make health && cd sqs/

# Hoặc check trực tiếp
curl http://localhost:4566/_localstack/health | jq '.services.sqs'

# Nếu LocalStack chưa chạy, start nó
cd ../../ && docker-compose up -d && cd sqs/
```

**Output mong đợi:**
```json
{
  "services": {
    "sqs": "running",
    "kms": "running",
    "sns": "running",
    "s3": "running",
    "iam": "running"
  }
}
```

### Bước 2: Deploy Infrastructure với Terraform

```bash
# Chuyển vào thư mục terraform
cd terraform/

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply infrastructure
terraform apply -auto-approve

# Back to sqs root
cd ..
```

**Terraform sẽ tạo:**
- ✅ Basic Standard Queue
- ✅ FIFO Queue với Dead Letter Queue
- ✅ Custom Configuration Queue
- ✅ SNS Topic + SQS Integration
- ✅ External DLQ Setup

### Bước 3: Verify Queues

```bash
# List all queues
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1

# Hoặc dùng script
chmod +x test-scripts/*.sh
./test-scripts/list-queues.sh
```

### Bước 4: Test với Scripts

#### Test Basic Queue - Send & Receive

```bash
# Send message
./test-scripts/send-message.sh \
  http://localhost:4566/000000000000/test-basic-queue \
  "Hello from LocalStack!"

# Receive messages
./test-scripts/receive-message.sh \
  http://localhost:4566/000000000000/test-basic-queue
```

#### Test FIFO Queue

```bash
# Send FIFO messages
./test-scripts/send-fifo-message.sh \
  http://localhost:4566/000000000000/test-fifo-queue.fifo \
  "FIFO Message 1" \
  "tenant-123"

./test-scripts/send-fifo-message.sh \
  http://localhost:4566/000000000000/test-fifo-queue.fifo \
  "FIFO Message 2" \
  "tenant-123"

# Receive - messages sẽ theo thứ tự
./test-scripts/receive-message.sh \
  http://localhost:4566/000000000000/test-fifo-queue.fifo
```

#### Test SNS → SQS Integration

```bash
# Get outputs từ Terraform
terraform output -json > outputs.json

# Extract topic ARN và queue URL
TOPIC_ARN=$(cat outputs.json | jq -r '.sns_integration.value.topic_arn')
QUEUE_URL=$(cat outputs.json | jq -r '.sns_integration.value.queue_url')

# Test SNS to SQS
./test-scripts/test-sns-to-sqs.sh "$TOPIC_ARN" "$QUEUE_URL" "Test SNS Message"
```

## Advanced Testing với Python

### Producer Examples

#### 1. Send Single Message
```bash
python test-producer.py \
  http://localhost:4566/000000000000/test-basic-queue \
  single \
  "Hello World"
```

#### 2. Send Batch Messages
```bash
# Send 20 messages
python test-producer.py \
  http://localhost:4566/000000000000/test-basic-queue \
  batch \
  20
```

#### 3. Send FIFO Messages với Multiple Groups
```bash
# Send 15 messages across 5 message groups
python test-producer.py \
  http://localhost:4566/000000000000/test-fifo-queue.fifo \
  fifo \
  15 \
  5
```

#### 4. Send Delayed Messages
```bash
# Send messages với different delays
python test-producer.py \
  http://localhost:4566/000000000000/test-custom-queue \
  delayed \
  5
```

### Consumer Examples

#### 1. Consume Messages (One-time)
```bash
python test-consumer.py \
  http://localhost:4566/000000000000/test-basic-queue
```

#### 2. Continuous Consumer (Long-running)
```bash
# Ctrl+C để stop
python test-consumer.py \
  http://localhost:4566/000000000000/test-basic-queue \
  --continuous
```

#### 3. Consume Without Auto-Delete
```bash
# Messages sẽ không bị xóa (để test visibility timeout)
python test-consumer.py \
  http://localhost:4566/000000000000/test-basic-queue \
  --no-delete
```

## Test Scenarios

### Scenario 1: Dead Letter Queue Testing

```bash
# 1. Send message vào main queue
python test-producer.py \
  http://localhost:4566/000000000000/test-main-queue \
  single \
  "Test DLQ Message"

# 2. Receive nhưng KHÔNG delete (simulate processing failure)
aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/test-main-queue \
  --region us-east-1

# 3. Message sẽ return về queue sau visibility timeout
# 4. Sau max_receive_count (3 lần), message sẽ move sang DLQ
# 5. Check DLQ
./test-scripts/receive-message.sh \
  http://localhost:4566/000000000000/test-external-dlq
```

### Scenario 2: FIFO Ordering & Deduplication

```bash
# 1. Send duplicate messages (same content)
python test-producer.py \
  http://localhost:4566/000000000000/test-fifo-queue.fifo \
  fifo \
  10 \
  2

# 2. Verify ordering trong mỗi message group
python test-consumer.py \
  http://localhost:4566/000000000000/test-fifo-queue.fifo

# Messages trong cùng group sẽ theo thứ tự
```

### Scenario 3: Long Polling vs Short Polling

```bash
# Short polling (không efficient)
time aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/test-basic-queue \
  --wait-time-seconds 0 \
  --region us-east-1

# Long polling (efficient, wait 20s cho messages)
time aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/test-basic-queue \
  --wait-time-seconds 20 \
  --region us-east-1
```

### Scenario 4: Message Delay Testing

```bash
# Send delayed messages
python test-producer.py \
  http://localhost:4566/000000000000/test-custom-queue \
  delayed \
  5

# Try receive immediately - không có messages
./test-scripts/receive-message.sh \
  http://localhost:4566/000000000000/test-custom-queue

# Wait và receive lại sau delay period
```

## Monitoring & Debugging

### Get Queue Attributes

```bash
aws --endpoint-url=http://localhost:4566 \
  sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/test-basic-queue \
  --attribute-names All \
  --region us-east-1
```

**Important Attributes:**
- `ApproximateNumberOfMessages`: Messages trong queue
- `ApproximateNumberOfMessagesNotVisible`: Messages đang được process (invisible)
- `ApproximateNumberOfMessagesDelayed`: Messages delayed
- `ApproximateAgeOfOldestMessage`: Age của oldest message (seconds)

### Purge Queue (Xóa tất cả messages)

```bash
./test-scripts/purge-queue.sh \
  http://localhost:4566/000000000000/test-basic-queue
```

### View LocalStack Logs

```bash
# Real-time logs
docker-compose logs -f localstack

# Last 100 lines
docker-compose logs --tail=100 localstack
```

## Cleanup

### Destroy Infrastructure

```bash
# Destroy Terraform resources
terraform destroy -auto-approve

# Stop LocalStack
docker-compose down

# Remove volumes (bao gồm persisted data)
docker-compose down -v
```

## Troubleshooting

### Issue: LocalStack không start

```bash
# Check Docker status
docker ps

# Check port 4566 có bị chiếm không
netstat -ano | findstr :4566  # Windows
lsof -i :4566                  # Linux/Mac

# Restart LocalStack
docker-compose down
docker-compose up -d
```

### Issue: Terraform endpoint errors

```bash
# Verify LocalStack health
curl http://localhost:4566/_localstack/health

# Re-initialize Terraform
rm -rf .terraform .terraform.lock.hcl
terraform init
```

### Issue: Messages không xuất hiện

```bash
# Check queue attributes
aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes \
  --queue-url <YOUR-QUEUE-URL> \
  --attribute-names All

# Check visibility timeout
# Messages có thể đang invisible (being processed)

# Check delay settings
# Messages có thể đang delayed
```

## Differences: LocalStack vs Real AWS

### ✅ Supported Features
- Standard & FIFO queues
- Dead Letter Queues
- Long polling
- Message delays
- SNS → SQS integration
- Basic encryption (SQS-managed)

### ⚠️ Limited Features (LocalStack Community)
- KMS encryption (cần LocalStack Pro)
- Một số advanced monitoring metrics
- Cross-region replication
- Server-side encryption với custom KMS keys

### 💡 Tips
- LocalStack endpoint: `http://localhost:4566`
- Account ID luôn là: `000000000000`
- Region mặc định: `us-east-1`
- Credentials: `test` / `test` (dummy)

## Next Steps

1. **Modify configurations** trong `main.tf` để test different scenarios
2. **Add more test scripts** cho specific use cases
3. **Integrate với CI/CD** pipeline
4. **Load testing** với nhiều concurrent producers/consumers
5. **Monitor metrics** và tune parameters

## Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Boto3 SQS Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html)
