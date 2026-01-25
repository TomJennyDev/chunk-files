# Makefile for LocalStack SQS Testing

.PHONY: help start stop restart logs health init plan apply destroy test-basic test-fifo test-sns clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start LocalStack
	docker-compose up -d
	@echo "Waiting for LocalStack to be ready..."
	@sleep 5
	@make health

stop: ## Stop LocalStack
	docker-compose down

restart: ## Restart LocalStack
	docker-compose restart
	@sleep 5
	@make health

logs: ## Show LocalStack logs
	docker-compose logs -f

health: ## Check LocalStack health
	@curl -s http://localhost:4566/_localstack/health | jq

init: ## Initialize Terraform
	terraform init

plan: ## Terraform plan
	terraform plan

apply: ## Apply Terraform configuration
	terraform apply -auto-approve
	@terraform output -json > outputs.json
	@echo "Outputs saved to outputs.json"

destroy: ## Destroy Terraform resources
	terraform destroy -auto-approve

test-basic: ## Test basic queue
	@echo "Testing basic queue..."
	./test-scripts/send-message.sh http://localhost:4566/000000000000/test-basic-queue "Test message"
	@sleep 1
	./test-scripts/receive-message.sh http://localhost:4566/000000000000/test-basic-queue

test-fifo: ## Test FIFO queue
	@echo "Testing FIFO queue..."
	./test-scripts/send-fifo-message.sh http://localhost:4566/000000000000/test-fifo-queue.fifo "Message 1" "group-1"
	./test-scripts/send-fifo-message.sh http://localhost:4566/000000000000/test-fifo-queue.fifo "Message 2" "group-1"
	@sleep 1
	./test-scripts/receive-message.sh http://localhost:4566/000000000000/test-fifo-queue.fifo

test-sns: ## Test SNS to SQS integration
	@echo "Testing SNS to SQS..."
	@TOPIC_ARN=$$(cat outputs.json | jq -r '.sns_integration.value.topic_arn'); \
	QUEUE_URL=$$(cat outputs.json | jq -r '.sns_integration.value.queue_url'); \
	./test-scripts/test-sns-to-sqs.sh "$$TOPIC_ARN" "$$QUEUE_URL" "Test SNS message"

list-queues: ## List all queues
	./test-scripts/list-queues.sh

full-test: start apply test-basic test-fifo test-sns ## Run full test suite
	@echo "All tests completed!"

clean: destroy stop ## Clean everything
	rm -rf .terraform .terraform.lock.hcl terraform.tfstate* outputs.json
	rm -rf localstack-data/
	@echo "Cleanup complete!"

setup: ## Initial setup (start + init + apply)
	@make start
	@make init
	@make apply
	@echo "Setup complete! Run 'make test-basic' to test."
