# Network & Security Architecture

## Network Topology — Production

```mermaid
graph TB
    classDef internet fill:#dc2626,color:#fff,stroke:#b91c1c
    classDef dmz fill:#f59e0b,color:#000,stroke:#d97706
    classDef private fill:#2563eb,color:#fff,stroke:#1e40af
    classDef data fill:#059669,color:#fff,stroke:#047857
    classDef security fill:#7c3aed,color:#fff,stroke:#5b21b6

    INTERNET([🌐 Internet]):::internet

    subgraph EDGE["Edge Layer"]
        direction LR
        R53["Route 53<br/>DNS Resolution<br/>Health checks<br/>Failover routing"]:::internet
        CF["CloudFront<br/>CDN Edge Locations<br/>Static asset caching<br/>SSL/TLS termination"]:::internet
        WAF["AWS WAF<br/>• Rate limiting (1000 req/5min)<br/>• SQL injection protection<br/>• XSS prevention<br/>• Geo-blocking<br/>• Bot detection"]:::security
    end

    subgraph VPC["VPC: 10.0.0.0/16"]
        direction TB
        
        subgraph PUBLIC_A["Public Subnet AZ-a<br/>10.0.1.0/24"]
            ALB_A["ALB Node<br/>AZ-a"]:::dmz
            NAT_A["NAT Gateway<br/>AZ-a"]:::dmz
            BASTION["Bastion Host<br/>(SSH jump box)"]:::security
        end
        
        subgraph PUBLIC_B["Public Subnet AZ-b<br/>10.0.2.0/24"]
            ALB_B["ALB Node<br/>AZ-b"]:::dmz
            NAT_B["NAT Gateway<br/>AZ-b"]:::dmz
        end

        subgraph PRIVATE_APP_A["Private App Subnet AZ-a<br/>10.0.10.0/24"]
            ECS_A1["ECS Task 1<br/>NestJS API"]:::private
            ECS_A2["ECS Task 2<br/>NestJS API"]:::private
        end
        
        subgraph PRIVATE_APP_B["Private App Subnet AZ-b<br/>10.0.11.0/24"]
            ECS_B1["ECS Task 1<br/>NestJS API"]:::private
            ECS_B2["ECS Task 2<br/>NestJS API"]:::private
        end

        subgraph PRIVATE_DATA_A["Private Data Subnet AZ-a<br/>10.0.20.0/24"]
            ES_A["OpenSearch<br/>Data Node AZ-a"]:::data
            ES_M1["OpenSearch<br/>Master Node 1"]:::data
        end
        
        subgraph PRIVATE_DATA_B["Private Data Subnet AZ-b<br/>10.0.21.0/24"]
            ES_B["OpenSearch<br/>Data Node AZ-b"]:::data
            ES_M2["OpenSearch<br/>Master Node 2"]:::data
        end

        subgraph VPC_ENDPOINTS["VPC Endpoints (Private Link)"]
            EP_S3["S3 Gateway<br/>Endpoint"]:::security
            EP_SQS["SQS Interface<br/>Endpoint"]:::security
            EP_KMS["KMS Interface<br/>Endpoint"]:::security
            EP_CW["CloudWatch<br/>Endpoint"]:::security
        end
    end

    subgraph LAMBDA_VPC["Lambda VPC Integration"]
        LAMBDA_ENI["Lambda ENI<br/>(Elastic Network Interface)<br/>Private subnet"]:::private
    end

    INTERNET --> R53 --> CF --> WAF
    WAF --> ALB_A & ALB_B
    ALB_A --> ECS_A1 & ECS_A2
    ALB_B --> ECS_B1 & ECS_B2
    
    ECS_A1 & ECS_A2 --> EP_S3 & EP_SQS
    ECS_B1 & ECS_B2 --> EP_S3 & EP_SQS
    ECS_A1 & ECS_A2 --> ES_A
    ECS_B1 & ECS_B2 --> ES_B
    
    EP_SQS -.-> LAMBDA_ENI
    LAMBDA_ENI --> EP_S3
    LAMBDA_ENI --> ES_A & ES_B
    
    ECS_A1 & ECS_A2 -->|"outbound"| NAT_A
    ECS_B1 & ECS_B2 -->|"outbound"| NAT_B
```

---

## Security Architecture — Defense in Depth

```mermaid
graph TB
    classDef layer1 fill:#dc2626,color:#fff
    classDef layer2 fill:#f59e0b,color:#000
    classDef layer3 fill:#2563eb,color:#fff
    classDef layer4 fill:#059669,color:#fff
    classDef layer5 fill:#7c3aed,color:#fff
    classDef layer6 fill:#475569,color:#fff

    subgraph L1["Layer 1: Perimeter Security"]
        direction LR
        WAF_S["AWS WAF<br/>Web Application Firewall"]:::layer1
        SHIELD["AWS Shield<br/>DDoS Protection"]:::layer1
        CF_S["CloudFront<br/>Edge Security"]:::layer1
        GEO["Geo Restrictions<br/>Allowed regions only"]:::layer1
    end

    subgraph L2["Layer 2: Network Security"]
        direction LR
        VPC_S["VPC Isolation<br/>Private subnets"]:::layer2
        SG["Security Groups<br/>• API: 3000 from ALB only<br/>• ES: 9200 from API SG only<br/>• Lambda: outbound only"]:::layer2
        NACL["Network ACLs<br/>Stateless packet filtering"]:::layer2
        EP["VPC Endpoints<br/>No internet traverse"]:::layer2
    end

    subgraph L3["Layer 3: Identity & Access"]
        direction LR
        IAM_S["IAM Roles<br/>Least-privilege policies"]:::layer3
        STS["STS<br/>Temporary credentials"]:::layer3
        COGNITO["Cognito (Future)<br/>User authentication"]:::layer3
        MFA["MFA<br/>Admin access"]:::layer3
    end

    subgraph L4["Layer 4: Application Security"]
        direction LR
        CORS["CORS Policy<br/>Allowed origins only"]:::layer4
        HELMET["Helmet.js<br/>HTTP security headers"]:::layer4
        RATE["Rate Limiting<br/>Throttle per IP"]:::layer4
        INPUT["Input Validation<br/>NestJS ValidationPipe"]:::layer4
        FILE_VAL["File Validation<br/>Type + Size limits"]:::layer4
    end

    subgraph L5["Layer 5: Data Security"]
        direction LR
        KMS_S["KMS Encryption<br/>• S3: SSE-KMS<br/>• SQS: SSE-SQS<br/>• ES: at-rest encryption"]:::layer5
        TLS["TLS in Transit<br/>HTTPS everywhere"]:::layer5
        SECRETS["Secrets Manager<br/>No hardcoded secrets"]:::layer5
        BACKUP["Backup & Recovery<br/>• S3 versioning<br/>• ES snapshots"]:::layer5
    end

    subgraph L6["Layer 6: Monitoring & Audit"]
        direction LR
        CT["CloudTrail<br/>API audit trail"]:::layer6
        CW_S["CloudWatch<br/>Security alarms"]:::layer6
        GUARD["GuardDuty<br/>Threat detection"]:::layer6
        CONFIG["AWS Config<br/>Compliance checks"]:::layer6
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

---

## IAM Role & Policy Architecture

```mermaid
graph TB
    classDef role fill:#2563eb,color:#fff
    classDef policy fill:#f59e0b,color:#000
    classDef resource fill:#059669,color:#fff

    subgraph ROLES["IAM Roles"]
        direction TB
        ECS_ROLE["ECS Task Role<br/>chunk-files-api-role"]:::role
        ECS_EXEC["ECS Task Execution Role<br/>chunk-files-api-exec-role"]:::role
        LAMBDA_ROLE["Lambda Execution Role<br/>file-processor-lambda-role"]:::role
    end

    subgraph POLICIES["IAM Policies"]
        direction TB
        S3_POLICY["S3 Access Policy<br/>• s3:PutObject<br/>• s3:GetObject<br/>• s3:DeleteObject<br/>Resource: arn:aws:s3:::file-uploads/*"]:::policy
        SQS_POLICY["SQS Access Policy<br/>• sqs:SendMessage (API)<br/>• sqs:ReceiveMessage (Lambda)<br/>• sqs:DeleteMessage (Lambda)<br/>Resource: arn:aws:sqs:*:*:file-processing-queue"]:::policy
        ES_POLICY["OpenSearch Access Policy<br/>• es:ESHttpPost<br/>• es:ESHttpGet<br/>Resource: arn:aws:es:*:*:domain/file-processor/*"]:::policy
        CW_POLICY["CloudWatch Policy<br/>• logs:CreateLogGroup<br/>• logs:PutLogEvents<br/>• xray:PutTraceSegments"]:::policy
        ECR_POLICY["ECR Pull Policy<br/>• ecr:GetDownloadUrlForLayer<br/>• ecr:BatchGetImage"]:::policy
        KMS_POLICY["KMS Policy<br/>• kms:Decrypt<br/>• kms:GenerateDataKey"]:::policy
        SM_POLICY["Secrets Manager Policy<br/>• secretsmanager:GetSecretValue"]:::policy
    end

    subgraph RESOURCES["AWS Resources"]
        direction TB
        S3_R["S3: file-uploads"]:::resource
        SQS_R["SQS: file-processing-queue"]:::resource
        ES_R["OpenSearch Domain"]:::resource
        CW_R["CloudWatch Logs"]:::resource
        KMS_R["KMS Key"]:::resource
    end

    ECS_ROLE --> S3_POLICY & SQS_POLICY & ES_POLICY & CW_POLICY & KMS_POLICY & SM_POLICY
    ECS_EXEC --> ECR_POLICY & CW_POLICY
    LAMBDA_ROLE --> S3_POLICY & SQS_POLICY & ES_POLICY & CW_POLICY & KMS_POLICY

    S3_POLICY --> S3_R
    SQS_POLICY --> SQS_R
    ES_POLICY --> ES_R
    CW_POLICY --> CW_R
    KMS_POLICY --> KMS_R
```

---

## Data Encryption Architecture

```mermaid
flowchart TB
    classDef encrypt fill:#7c3aed,color:#fff
    classDef transit fill:#2563eb,color:#fff
    classDef rest fill:#059669,color:#fff
    classDef key fill:#f59e0b,color:#000

    subgraph IN_TRANSIT["🔒 Encryption in Transit"]
        direction TB
        TLS_CLIENT["Client → CloudFront<br/>TLS 1.3 (ACM Certificate)"]:::transit
        TLS_ALB["CloudFront → ALB<br/>TLS 1.2+ (Internal cert)"]:::transit
        TLS_API["ALB → ECS<br/>TLS (Container port)"]:::transit
        TLS_ES["API → OpenSearch<br/>TLS (VPC endpoint)"]:::transit
    end

    subgraph AT_REST["🔐 Encryption at Rest"]
        direction TB
        S3_ENC["S3 Bucket<br/>SSE-KMS<br/>(AES-256)"]:::rest
        SQS_ENC["SQS Queue<br/>SSE-SQS<br/>(Server-side)"]:::rest
        ES_ENC["OpenSearch<br/>Node-to-node encryption<br/>At-rest: KMS"]:::rest
        EBS_ENC["EBS Volumes<br/>KMS encrypted"]:::rest
    end

    subgraph KEY_MGMT["🔑 Key Management"]
        direction LR
        CMK["KMS Customer<br/>Managed Key<br/>(Auto-rotation: 1 year)"]:::key
        ALIAS["Key Alias:<br/>alias/chunk-files-encryption"]:::key
        GRANT["Key Grants:<br/>• ECS Task Role<br/>• Lambda Role"]:::key
    end

    CMK --> S3_ENC & SQS_ENC & ES_ENC & EBS_ENC
    ALIAS --> CMK
    GRANT --> CMK
```
