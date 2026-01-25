output "basic_queue" {
  description = "Basic queue details"
  value = {
    id   = module.basic_queue.queue_id
    arn  = module.basic_queue.queue_arn
    url  = module.basic_queue.queue_url
    name = module.basic_queue.queue_name
  }
}

output "fifo_queue" {
  description = "FIFO queue details"
  value = {
    queue_id  = module.fifo_queue.queue_id
    queue_arn = module.fifo_queue.queue_arn
    dlq_id    = module.fifo_queue.dlq_id
    dlq_arn   = module.fifo_queue.dlq_arn
  }
}

output "custom_queue" {
  description = "Custom queue details"
  value = {
    id  = module.custom_queue.queue_id
    arn = module.custom_queue.queue_arn
    url = module.custom_queue.queue_url
  }
}

output "sns_integration" {
  description = "SNS integration test details"
  value = {
    topic_arn      = aws_sns_topic.test_topic.arn
    queue_url      = module.sns_integration_queue.queue_url
    subscription   = aws_sns_topic_subscription.test_subscription.id
  }
}

output "external_dlq_setup" {
  description = "External DLQ setup details"
  value = {
    main_queue_url = module.main_queue_with_external_dlq.queue_url
    dlq_url        = module.external_dlq.queue_url
    dlq_arn        = module.external_dlq.queue_arn
  }
}

output "all_queue_urls" {
  description = "All queue URLs for testing"
  value = {
    basic_queue          = module.basic_queue.queue_url
    fifo_queue           = module.fifo_queue.queue_url
    fifo_dlq             = module.fifo_queue.dlq_url
    custom_queue         = module.custom_queue.queue_url
    sns_integration      = module.sns_integration_queue.queue_url
    main_queue_ext_dlq   = module.main_queue_with_external_dlq.queue_url
    external_dlq         = module.external_dlq.queue_url
  }
}
