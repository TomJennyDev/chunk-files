.PHONY: help init plan apply destroy clean fmt validate test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

init: ## Initialize Terraform
	terraform init

plan: ## Create Terraform plan
	terraform plan -out=tfplan

apply: ## Apply Terraform changes
	terraform apply tfplan

apply-auto: ## Apply Terraform changes without approval
	terraform apply -auto-approve

destroy: ## Destroy all resources
	terraform destroy -auto-approve

clean: ## Clean Terraform files
	rm -rf .terraform
	rm -f .terraform.lock.hcl
	rm -f tfplan
	rm -f lambda-function.zip
	rm -f terraform.tfstate*

fmt: ## Format Terraform files
	terraform fmt -recursive

validate: ## Validate Terraform configuration
	terraform validate

output: ## Show Terraform outputs
	terraform output

refresh: ## Refresh Terraform state
	terraform refresh

state-list: ## List resources in state
	terraform state list

# LocalStack specific commands
localstack-up: ## Start LocalStack
	cd ../../file-processor && docker-compose up -d localstack

localstack-down: ## Stop LocalStack
	cd ../../file-processor && docker-compose stop localstack

localstack-restart: ## Restart LocalStack
	cd ../../file-processor && docker-compose restart localstack

localstack-health: ## Check LocalStack health
	@curl -s http://localhost:4566/_localstack/health | jq

# Testing commands
test-s3: ## Test S3 bucket
	@echo "Testing S3 bucket..."
	awslocal s3 ls s3://file-uploads

test-sqs: ## Test SQS queue
	@echo "Testing SQS queue..."
	awslocal sqs get-queue-url --queue-name file-processing-queue

test-lambda: ## Test Lambda function
	@echo "Testing Lambda function..."
	awslocal lambda list-functions --query 'Functions[?FunctionName==`file-processor-worker`]'

test-all: test-s3 test-sqs test-lambda ## Run all tests

# Complete workflow
setup: init apply-auto ## Complete setup (assumes LocalStack is running)

setup-full: localstack-up init apply-auto ## Complete setup with LocalStack start

teardown: destroy clean ## Complete teardown (keeps LocalStack running)

teardown-full: destroy localstack-down clean ## Complete teardown including LocalStack

# Lambda commands
lambda-package: ## Package Lambda function manually
	cd ../../file-processor-lambda && npm install && zip -r ../terraform/file-processor/lambda-function.zip src/ node_modules/

lambda-invoke: ## Invoke Lambda function
	awslocal lambda invoke \
		--function-name file-processor-worker \
		--payload '{"Records":[{"messageId":"test","body":"{\"fileId\":\"test-123\",\"s3Key\":\"test.txt\",\"fileName\":\"test.txt\",\"fileSize\":1000,\"contentType\":\"text/plain\"}"}]}' \
		response.json
	@cat response.json | jq
	@rm response.json

lambda-logs: ## View Lambda logs
	awslocal logs tail /aws/lambda/file-processor-worker --follow

# SQS commands
sqs-send: ## Send test message to SQS
	awslocal sqs send-message \
		--queue-url http://localhost:4566/000000000000/file-processing-queue \
		--message-body '{"fileId":"test-123","s3Key":"test.txt","fileName":"test.txt","fileSize":1000,"contentType":"text/plain"}'

sqs-receive: ## Receive messages from SQS
	awslocal sqs receive-message \
		--queue-url http://localhost:4566/000000000000/file-processing-queue \
		--max-number-of-messages 10

sqs-purge: ## Purge SQS queue
	awslocal sqs purge-queue \
		--queue-url http://localhost:4566/000000000000/file-processing-queue

# Monitoring
logs: ## View all logs
	@echo "=== Lambda Logs ==="
	awslocal logs tail /aws/lambda/file-processor-worker --format short
	@echo ""
	@echo "=== SQS Queue Stats ==="
	awslocal sqs get-queue-attributes \
		--queue-url http://localhost:4566/000000000000/file-processing-queue \
		--attribute-names All | jq

status: ## Show resource status
	@echo "=== S3 Buckets ==="
	awslocal s3 ls
	@echo ""
	@echo "=== SQS Queues ==="
	awslocal sqs list-queues
	@echo ""
	@echo "=== Lambda Functions ==="
	awslocal lambda list-functions --query 'Functions[].FunctionName'
	@echo ""
	@echo "=== LocalStack Health ==="
	curl -s http://localhost:4566/_localstack/health | jq '.services | to_entries[] | select(.value == "running") | .key'
