# LocalStack Lab Environment

Environment LocalStack để test và lab với các AWS services locally.

> **Note**: Sử dụng [localstack-persist](https://github.com/GREsau/localstack-persist) để enable automatic persistence trong Community Edition (free).

## 🚀 Quick Start

### Start LocalStack
```bash
# Start all services
docker-compose up -d

# Check health
curl http://localhost:4566/_localstack/health

# View logs
docker-compose logs -f
```

### Stop LocalStack
```bash
# Stop but keep data
docker-compose stop

# Stop and remove (data persisted in ./data folder)
docker-compose down

# Clean everything including data
docker-compose down -v
rm -rf data/
```

## 📦 Available Services

LocalStack đang chạy các services sau:
- **S3** - Object storage
- **SQS** - Message queuing
- **SNS** - Pub/sub messaging
- **DynamoDB** - NoSQL database
- **Lambda** - Serverless functions
- **API Gateway** - REST/HTTP APIs
- **KMS** - Key management
- **IAM** - Identity and access management
- **CloudWatch** - Monitoring and logs
- **Secrets Manager** - Secret storage
- **SSM** - Parameter store
- **EC2** - Virtual machines (basic support)
- **ECR** - Container registry
- **ECS** - Container orchestration
- **RDS** - Relational databases

## 🗂️ Lab Structure

```
localstack/
├── docker-compose.yml          # Main LocalStack setup
├── data/                       # Persisted data (gitignored)
├── init-scripts/              # Initialization scripts
│   ├── 01-s3-setup.sh
│   ├── 02-sqs-setup.sh
│   └── ...
├── lambdas/                    # Lambda function code
├── s3/                         # S3 specific labs
│   ├── terraform/
│   └── README.md
├── sqs/                        # SQS specific labs
│   ├── terraform/
│   ├── test-scripts/
│   └── README.md
├── dynamodb/                   # DynamoDB labs
├── lambda/                     # Lambda labs
└── README.md                   # This file
```

## 🔧 Configuration

### AWS CLI Setup
```bash
# Configure AWS CLI with dummy credentials
aws configure set aws_access_key_id test
aws configure set aws_secret_access_key test
aws configure set region us-east-1

# Or set environment variables
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
```

### Terraform Setup
Tất cả Terraform configs phải point đến LocalStack endpoint:

```hcl
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3             = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    sns            = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    apigateway     = "http://localhost:4566"
    kms            = "http://localhost:4566"
    iam            = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    ssm            = "http://localhost:4566"
    ecr            = "http://localhost:4566"
    ecs            = "http://localhost:4566"
  }
}
```

## 📝 Common Commands

### AWS CLI với LocalStack

```bash
# General format
aws --endpoint-url=http://localhost:4566 <service> <command> --region us-east-1

# Examples:
# List S3 buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List SQS queues
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1

# List DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1

# List Lambda functions
aws --endpoint-url=http://localhost:4566 lambda list-functions --region us-east-1
```

### Health Checks

```bash
# Overall health
curl http://localhost:4566/_localstack/health | jq

# Specific service status
curl http://localhost:4566/_localstack/health | jq '.services.sqs'

# List running services
curl http://localhost:4566/_localstack/health | jq '.services | keys'
```

### Debugging

```bash
# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f localstack

# Execute commands inside container
docker-compose exec localstack bash

# Check LocalStack version
docker-compose exec localstack localstack --version
```

## 🧪 Lab Modules

### S3 Lab
```bash
cd s3/
# Follow README.md in s3/ folder
```

### SQS Lab
```bash
cd sqs/
# Follow README.md in sqs/ folder
```

### DynamoDB Lab
```bash
cd dynamodb/
# Coming soon...
```

### Lambda Lab
```bash
cd lambda/
# Coming soon...
```

## 🎯 Example Workflows

### Workflow 1: S3 + Lambda Trigger
1. Create S3 bucket
2. Deploy Lambda function
3. Configure S3 event notification
4. Upload file → Lambda triggered

### Workflow 2: API Gateway + Lambda + DynamoDB
1. Create DynamoDB table
2. Deploy Lambda function
3. Create API Gateway
4. Test REST API endpoints

### Workflow 3: SQS + SNS Fan-out
1. Create SNS topic
2. Create multiple SQS queues
3. Subscribe queues to topic
4. Publish message → All queues receive

### Workflow 4: Complete Microservice Stack
1. ECR - Store container images
2. ECS - Run containers
3. API Gateway - Expose APIs
4. DynamoDB - Data storage
5. SQS - Async processing
6. CloudWatch - Monitoring

## 🔐 Persistence

Sử dụng **localstack-persist** image cho automatic persistence:
- Tự động save state mỗi 10 giây (configurable)
- Data được persist trong folder `./data/` (mounted vào `/persisted-data`)
- Survives container restarts
- Survives `docker-compose down`
- Deleted only with `docker-compose down -v` or manual deletion

### Persistence Configuration

```yaml
# docker-compose.yml
environment:
  - PERSIST_FORMAT=json        # json (readable) hoặc binary (faster)
  - PERSIST_FREQUENCY=10       # Save every 10 seconds
  
  # Disable persistence cho specific services
  - PERSIST_CLOUDWATCH=0
  
  # Hoặc enable only specific services
  - PERSIST_DEFAULT=0
  - PERSIST_DYNAMODB=1
  - PERSIST_S3=1
  - PERSIST_SQS=1
```

### Backup & Restore

```bash
# Backup data
tar -czf localstack-backup-$(date +%Y%m%d).tar.gz data/

# Restore data
tar -xzf localstack-backup-20260124.tar.gz

# Clean start (remove all persisted data)
rm -rf data/
docker-compose up -d
```

### Supported Services

Services với persistence support:
- ✅ **DynamoDB** - Tables, items, streams
- ✅ **S3** - Buckets, objects (individual files)
- ✅ **SQS** - Queues, messages
- ✅ **Lambda** - Functions, code
- ✅ **IAM** - Users, roles, policies
- ✅ **ACM** - Certificates
- ✅ **Elasticsearch** - Domains
- ✅ And more... [See full list](https://docs.localstack.cloud/aws/capabilities/state-management/persistence/#persistence-coverage-overview)

## 🐛 Troubleshooting

### Port conflicts
```bash
# Check if port 4566 is in use
netstat -ano | findstr :4566  # Windows
lsof -i :4566                  # Linux/Mac

# Use different port
# Edit docker-compose.yml: "4567:4566"
# Update endpoint URLs accordingly
```

### Services not starting
```bash
# Check logs
docker-compose logs localstack

# Restart with fresh start
docker-compose down -v
docker-compose up -d

# Check Docker resources
# Ensure Docker has enough memory (>= 2GB recommended)
```

### Connection refused
```bash
# Wait for LocalStack to be ready
sleep 10

# Check health endpoint
curl http://localhost:4566/_localstack/health

# Verify Docker network
docker network ls
docker network inspect terraform-localstack-lab
```

## 📚 Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [LocalStack GitHub](https://github.com/localstack/localstack)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## 💡 Tips

1. **Use shell aliases** for common commands:
   ```bash
   alias awslocal="aws --endpoint-url=http://localhost:4566 --region us-east-1"
   
   # Usage:
   awslocal s3 ls
   awslocal sqs list-queues
   ```

2. **Install awslocal CLI** (wrapper around AWS CLI):
   ```bash
   pip install awscli-local
   
   # Usage (no need to specify endpoint):
   awslocal s3 ls
   awslocal sqs list-queues
   ```

3. **Use tflocal** (wrapper around Terraform):
   ```bash
   pip install terraform-local
   
   # Automatically sets LocalStack endpoints
   tflocal init
   tflocal apply
   ```

4. **Enable debug mode** for troubleshooting:
   ```yaml
   # In docker-compose.yml
   environment:
     - DEBUG=1
     - LS_LOG=trace  # Verbose logging
   ```

5. **Backup before experiments**:
   ```bash
   docker-compose exec localstack localstack status services
   tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/
   ```

## 🚦 Status Indicators

Check service status:
```bash
# All services
curl -s http://localhost:4566/_localstack/health | jq -r '.services | to_entries[] | "\(.key): \(.value)"'

# Example output:
# s3: running
# sqs: running
# sns: running
# ...
```

## 📋 Next Steps

1. ✅ Start LocalStack
2. ✅ Configure AWS CLI
3. ✅ Navigate to specific lab folder (s3/, sqs/, etc.)
4. ✅ Follow lab-specific README
5. ✅ Build and test!

Happy Learning! 🎓
