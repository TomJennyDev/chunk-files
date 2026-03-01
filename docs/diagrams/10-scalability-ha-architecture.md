# Scalability & High Availability Architecture

## Auto-Scaling Architecture

```mermaid
graph TB
    classDef trigger fill:#dc2626,color:#fff,stroke:#b91c1c
    classDef scale fill:#2563eb,color:#fff,stroke:#1e40af
    classDef resource fill:#059669,color:#fff,stroke:#047857
    classDef monitor fill:#f59e0b,color:#000,stroke:#d97706

    subgraph SCALING["Auto-Scaling Policies"]
        direction TB
        
        subgraph ECS_SCALING["ECS Service Auto-Scaling"]
            ECS_METRIC["CloudWatch Metrics<br/>• CPUUtilization<br/>• MemoryUtilization<br/>• RequestCountPerTarget"]:::monitor
            ECS_TARGET["Target Tracking Policy<br/>CPU Target: 70%<br/>Scale-in cooldown: 300s<br/>Scale-out cooldown: 60s"]:::trigger
            ECS_STEP["Step Scaling Policy<br/>CPU > 85% → +2 tasks<br/>CPU > 95% → +4 tasks<br/>CPU < 40% → -1 task"]:::trigger
            ECS_TASKS["ECS Tasks<br/>min: 2 | desired: 4 | max: 16"]:::scale
        end

        subgraph LAMBDA_SCALING["Lambda Concurrency"]
            LAMBDA_METRIC["SQS Metrics<br/>• ApproximateNumberOfMessages<br/>• NumberOfMessagesSent"]:::monitor
            LAMBDA_CONC["Concurrency Config<br/>Reserved: 50<br/>Provisioned: 10 (warm)<br/>Burst: 500→1000"]:::trigger
            LAMBDA_BATCH["Batch Config<br/>batch_size: 5<br/>max_batching_window: 10s"]:::scale
        end

        subgraph ES_SCALING["OpenSearch Scaling"]
            ES_METRIC["ES Metrics<br/>• CPUUtilization<br/>• JVMMemoryPressure<br/>• SearchLatency"]:::monitor
            ES_NODES["Node Configuration<br/>Master: 3 × r6g.large<br/>Data: 2-6 × r6g.xlarge<br/>UltraWarm: on-demand"]:::scale
            ES_INDEX["Index Strategy<br/>• Time-based indices<br/>• ILM: hot→warm→cold→delete<br/>• Rollover: 50GB / 7 days"]:::trigger
        end
    end

    ECS_METRIC --> ECS_TARGET & ECS_STEP --> ECS_TASKS
    LAMBDA_METRIC --> LAMBDA_CONC --> LAMBDA_BATCH
    ES_METRIC --> ES_NODES & ES_INDEX
```

---

## High Availability — Multi-AZ Failover

```mermaid
sequenceDiagram
    participant USER as 👤 User
    participant R53 as Route 53
    participant ALB as ALB
    participant AZ_A as AZ-a (Primary)
    participant AZ_B as AZ-b (Standby)
    participant MON as Health Monitor

    Note over AZ_A,AZ_B: Normal Operation:<br/>Traffic distributed across both AZs

    USER->>R53: DNS resolve app.chunk-files.com
    R53->>ALB: Route to ALB (healthy)
    ALB->>AZ_A: 50% traffic → ECS Tasks AZ-a
    ALB->>AZ_B: 50% traffic → ECS Tasks AZ-b

    Note over AZ_A: ⚠️ AZ-a failure detected

    MON->>ALB: Health check failed for AZ-a targets
    ALB->>ALB: Remove AZ-a targets from pool
    
    ALB->>AZ_B: 100% traffic → ECS Tasks AZ-b
    
    Note over AZ_B: Auto-Scaling triggers:<br/>Scale out to handle full load

    AZ_B->>AZ_B: Scale: 2 → 4 tasks
    
    MON->>MON: Alert: AZ failover occurred
    
    Note over AZ_A: AZ-a recovers
    
    MON->>ALB: Health checks pass for AZ-a
    ALB->>AZ_A: Gradually reintroduce AZ-a<br/>(connection draining)
    
    Note over AZ_A,AZ_B: Back to normal:<br/>50/50 distribution
```

---

## Disaster Recovery Strategy

```mermaid
flowchart TB
    classDef primary fill:#059669,color:#fff
    classDef secondary fill:#2563eb,color:#fff
    classDef storage fill:#f59e0b,color:#000
    classDef process fill:#7c3aed,color:#fff

    subgraph PRIMARY["Primary Region (us-east-1)"]
        direction TB
        P_APP["ECS Cluster<br/>+ Lambda"]:::primary
        P_S3["S3: file-uploads<br/>(Versioning ON)"]:::storage
        P_ES["OpenSearch Domain<br/>(Multi-AZ)"]:::primary
        P_SQS["SQS Queue"]:::primary
    end

    subgraph SECONDARY["DR Region (us-west-2)"]
        direction TB
        S_APP["ECS Cluster<br/>(Standby / min capacity)"]:::secondary
        S_S3["S3: file-uploads-replica<br/>(Cross-Region Replication)"]:::storage
        S_ES["OpenSearch Domain<br/>(Restoring from snapshot)"]:::secondary
        S_SQS["SQS Queue<br/>(Standby)"]:::secondary
    end

    subgraph REPLICATION["Data Replication"]
        direction LR
        S3_REP["S3 Cross-Region<br/>Replication (CRR)<br/>RPO: ~15 min"]:::process
        ES_SNAP["ES Automated Snapshots<br/>→ S3 → Cross-region copy<br/>RPO: 1 hour"]:::process
    end

    subgraph DR_PROCESS["DR Runbook"]
        direction TB
        DETECT["1. Detect Failure<br/>Route 53 health check fails"]
        FAILOVER["2. DNS Failover<br/>Route 53 → secondary region"]
        RESTORE["3. Restore ES<br/>Restore from latest snapshot"]
        SCALE["4. Scale Up<br/>Secondary ECS to full capacity"]
        VERIFY["5. Verify<br/>Run smoke tests"]
    end

    P_S3 -->|"CRR"| S3_REP --> S_S3
    P_ES -->|"Snapshots"| ES_SNAP --> S_ES
    
    DETECT --> FAILOVER --> RESTORE --> SCALE --> VERIFY

    subgraph RTO_RPO["Recovery Objectives"]
        direction LR
        RTO["RTO: 30 minutes<br/>(Time to recover)"]
        RPO["RPO: 1 hour<br/>(Max data loss)"]
    end
```

---

## Load Testing & Capacity Planning

```mermaid
xychart-beta
    title "Expected Load Profile — File Processing Platform"
    x-axis ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"]
    y-axis "Requests per Second" 0 --> 500
    bar [20, 10, 30, 350, 280, 400, 200, 50]
    line [50, 50, 50, 200, 200, 200, 200, 50]
```

```mermaid
pie title Resource Distribution by Service
    "ECS API Tasks" : 35
    "Lambda Workers" : 25
    "OpenSearch Domain" : 20
    "S3 Storage" : 10
    "Observability Stack" : 7
    "Networking (NAT, ALB)" : 3
```

---

## Performance Budgets

```mermaid
flowchart LR
    classDef fast fill:#22c55e,color:#fff
    classDef medium fill:#f59e0b,color:#000
    classDef slow fill:#dc2626,color:#fff

    subgraph API_PERF["API Response Time Budgets"]
        direction TB
        UPLOAD["POST /files/upload<br/>p50: 200ms | p95: 500ms | p99: 1s"]:::fast
        SEARCH["GET /files/search<br/>p50: 50ms | p95: 200ms | p99: 500ms"]:::fast
        STATUS["GET /files/:id/status<br/>p50: 5ms | p95: 20ms | p99: 50ms"]:::fast
    end

    subgraph LAMBDA_PERF["Lambda Processing Budgets"]
        direction TB
        COLD["Cold Start<br/>p50: 300ms | p99: 800ms"]:::medium
        PROCESS["File Processing (1MB)<br/>p50: 2s | p95: 5s | p99: 10s"]:::medium
        LARGE["Large File (100MB)<br/>p50: 30s | p99: 120s"]:::slow
    end

    subgraph INFRA_PERF["Infrastructure SLOs"]
        direction TB
        AVAIL["Availability<br/>Target: 99.95%<br/>= 22 min downtime/month"]:::fast
        ERROR["Error Rate<br/>Target: < 0.1%"]:::fast
        QUEUE["Queue Depth<br/>Alert: > 1000 messages"]:::medium
    end
```
