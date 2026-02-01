# OpenSearch Configuration for LocalStack

## 📋 Tổng quan

OpenSearch domain đã được cấu hình trong Terraform để lưu trữ và search file chunks. 

## ✅ Cấu hình hiện tại

### OpenSearch Domain
- **Domain Name**: `file-chunks`
- **Engine Version**: OpenSearch 2.11
- **Instance Type**: t3.small.search
- **Instance Count**: 1
- **Storage**: 10GB EBS (gp3)
- **Endpoint**: `file-chunks.us-east-1.opensearch.localhost.localstack.cloud:4566`

### Security Settings (LocalStack)
- Advanced Security: **Disabled** (for local development)
- Encryption at Rest: **Disabled**
- Node-to-node Encryption: **Disabled**
- HTTPS: **Disabled**
- Access Policy: **Open** (`*` allowed)

⚠️ **Warning**: These settings are for LOCAL DEVELOPMENT ONLY. Production should use proper security.

## 🔧 Lambda Environment Variables

Lambda function được cấu hình với các environment variables sau:

```bash
ELASTICSEARCH_NODE=http://localhost:4566
ELASTICSEARCH_INDEX=file-chunks
ELASTICSEARCH_USERNAME=admin
ELASTICSEARCH_PASSWORD=admin
OPENSEARCH_ENDPOINT=file-chunks.us-east-1.opensearch.localhost.localstack.cloud:4566
OPENSEARCH_DOMAIN=file-chunks
```

## 📊 Index Mapping

Index `file-chunks` sẽ được tự động tạo khi Lambda ghi dữ liệu lần đầu với mapping:

```json
{
  "properties": {
    "fileId": { "type": "keyword" },
    "chunkIndex": { "type": "integer" },
    "content": { "type": "text" },
    "startByte": { "type": "long" },
    "endByte": { "type": "long" },
    "metadata": {
      "properties": {
        "fileName": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
        "fileSize": { "type": "long" },
        "contentType": { "type": "keyword" },
        "chunkSize": { "type": "integer" }
      }
    }
  }
}
```

## 🧪 Test Commands

### Check OpenSearch cluster health
```bash
curl http://localhost:4566/_cluster/health?pretty
```

### List all indices
```bash
curl http://localhost:4566/_cat/indices?v
```

### Check index mapping
```bash
curl http://localhost:4566/file-chunks/_mapping?pretty
```

### Search documents
```bash
curl -X POST http://localhost:4566/file-chunks/_search?pretty \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "content": "search term"
      }
    }
  }'
```

### Get document by ID
```bash
curl http://localhost:4566/file-chunks/_doc/{fileId}-{chunkIndex}?pretty
```

### Count documents
```bash
curl http://localhost:4566/file-chunks/_count?pretty
```

## 🔄 Manual Index Creation (Optional)

Nếu cần tạo index thủ công với custom mapping:

```bash
curl -X PUT "http://localhost:4566/file-chunks" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "fileId": {"type": "keyword"},
        "chunkIndex": {"type": "integer"},
        "content": {"type": "text"},
        "startByte": {"type": "long"},
        "endByte": {"type": "long"},
        "metadata": {
          "properties": {
            "fileName": {"type": "text"},
            "fileSize": {"type": "long"},
            "contentType": {"type": "keyword"},
            "chunkSize": {"type": "integer"}
          }
        }
      }
    }
  }'
```

## 📊 OpenSearch Dashboard

LocalStack OpenSearch dashboard (Kibana equivalent):

```
http://file-chunks.us-east-1.opensearch.localhost.localstack.cloud:4566/_dashboards
```

## ⚠️ LocalStack OpenSearch Limitations

LocalStack Community Edition có một số hạn chế về OpenSearch:

1. **Limited API Support**: Không phải tất cả OpenSearch APIs đều được implement
2. **Basic Features**: Chỉ có basic indexing và search
3. **No Clustering**: Single node only
4. **Performance**: Slower than production OpenSearch

## 🚀 Terraform Outputs

Sau khi apply Terraform, các outputs sau sẽ available:

```bash
terraform output opensearch_endpoint
terraform output opensearch_domain_name
terraform output opensearch_arn
terraform output opensearch_kibana_endpoint
```

## 🔍 Troubleshooting

### Issue: Index creation fails
**Solution**: Index sẽ được auto-created khi Lambda writes data lần đầu.

### Issue: Cannot connect to OpenSearch
**Solution**: Check LocalStack health:
```bash
curl http://localhost:4566/_localstack/health | jq '.services.opensearch'
```

### Issue: Lambda cannot index data
**Solution**: Check Lambda logs và verify environment variables:
```bash
aws --endpoint-url=http://localhost:4566 lambda get-function \
  --function-name file-processor-worker \
  --query 'Configuration.Environment'
```

## 📦 Dependencies

Lambda function cần các npm packages sau để connect OpenSearch:

```json
{
  "@elastic/elasticsearch": "^8.19.1"
}
```

## 🎯 Next Steps

1. ✅ OpenSearch domain đã được tạo
2. ✅ Lambda có permissions để access OpenSearch
3. ✅ Environment variables đã được cấu hình
4. 📝 Test Lambda function với file upload
5. 📝 Verify data được indexed vào OpenSearch
6. 📝 Test search functionality

## 📚 Related Documentation

- [OpenSearch API Reference](https://opensearch.org/docs/latest/api-reference/)
- [LocalStack OpenSearch](https://docs.localstack.cloud/user-guide/aws/opensearch/)
- [Lambda + OpenSearch Integration](https://docs.aws.amazon.com/lambda/latest/dg/with-opensearch.html)
