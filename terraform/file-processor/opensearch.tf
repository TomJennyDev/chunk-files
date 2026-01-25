# OpenSearch Domain for file chunks indexing and search
resource "aws_opensearch_domain" "file_chunks" {
  domain_name    = var.opensearch_domain_name
  engine_version = "OpenSearch_2.11"

  cluster_config {
    instance_type          = "t3.small.search"
    instance_count         = 1
    zone_awareness_enabled = false
  }

  ebs_options {
    ebs_enabled = true
    volume_size = 10 # GB
    volume_type = "gp3"
  }

  # Advanced security options - Disabled for LocalStack
  advanced_security_options {
    enabled                        = false
    internal_user_database_enabled = false
  }

  # Encryption at rest - Disabled for LocalStack
  encrypt_at_rest {
    enabled = false
  }

  # Node-to-node encryption - Disabled for LocalStack
  node_to_node_encryption {
    enabled = false
  }

  # Domain endpoint options
  domain_endpoint_options {
    enforce_https       = false
    tls_security_policy = "Policy-Min-TLS-1-0-2019-07"
  }

  # Access policies - Open for LocalStack (not recommended for production)
  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "es:*"
        Resource = "arn:aws:es:${var.aws_region}:000000000000:domain/${var.opensearch_domain_name}/*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-opensearch"
  })

  # LocalStack doesn't require VPC configuration
  # In production, OpenSearch should be in VPC for security
}

# Wait for OpenSearch domain to be ready before Lambda tries to connect
resource "null_resource" "wait_for_opensearch" {
  depends_on = [aws_opensearch_domain.file_chunks]

  provisioner "local-exec" {
    command = "echo 'Waiting for OpenSearch domain to be ready...' && sleep 10"
  }
}

# Create OpenSearch index with mapping (using aws CLI and curl)
resource "null_resource" "create_opensearch_index" {
  depends_on = [
    aws_opensearch_domain.file_chunks,
    null_resource.wait_for_opensearch
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Creating OpenSearch index: ${var.opensearch_domain_name}"
      # Note: LocalStack OpenSearch may not fully support index creation via HTTP
      # Index will be auto-created when Lambda first writes data
      # Or manually create via: curl -X PUT http://localhost:4566/file-chunks
    EOT

    interpreter = ["bash", "-c"]
  }

  # Trigger recreation if domain changes
  triggers = {
    domain_endpoint = aws_opensearch_domain.file_chunks.endpoint
  }
}
