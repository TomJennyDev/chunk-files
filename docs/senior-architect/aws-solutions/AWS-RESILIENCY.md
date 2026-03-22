# 🛡️ Resiliency & High Availability On AWS

Architectural design must be ready to endure a Database suddenly crashing, or worse, an entire Amazon Data Center (Zone) losing power. That's why you configure a 2-layer Fallback.

## 🗺️ Multi-AZ Self-Healing Capability Diagram

```mermaid
graph TD
    User((Client Request))
    DNS[Route 53 - Health Checks]
    
    subgraph region ["Region: ap-southeast-1 - Singapore"]
        subgraph AZ_A ["AZ A: Datacenter 1"]
            ALB_A[ALB] --> App_A[ECS Container]
            App_A --> DB_Primary[(Amazon RDS - Primary)]
        end
        
        subgraph AZ_B ["AZ B: Datacenter 2"]
            ALB_B[ALB] --> App_B[ECS Container]
            App_B --> DB_Standby[(Amazon RDS - Standby)]
        end
        
        DB_Primary -.->|Synchronous Replication| DB_Standby
    end
    
    User -->|Smooth Ping| DNS
    DNS -->|Primary Route| AZ-A
    DNS -.->|Failover when AZ-A down| AZ-B
    
    App_A -->|"Call 3rd Party API"| API_Ext[Stripe Payment Gateway]
    App_A -.->|"Circuit Breaker = OPEN"| Fallback_Mock[Fallback Cache Or Fast Fail]
    
    style AZ_A fill:#fdfdff,stroke:#0055d4
    style AZ_B fill:#f8f9fa,stroke:#6c757d
    style DB_Primary fill:#d4edda,stroke:#28a745
    style DB_Standby fill:#fff3cd,stroke:#ffc107
    style Fallback_Mock fill:#f8d7da,stroke:#dc3545
```

## Durability Factors Architects Must Memorize:
1. **Multi-AZ Deployment for Amazon RDS**: 
   - AWS maintains a *hidden Standby* in another Zone via Sync Connection. When Primary hits disk bottlenecks or loses power, AWS elevates Standby to Primary and repoints the CNAME within 60 seconds (Auto-Failover). Zero Downtime Database.
2. **Route 53 Health Checks & Failover**: 
   - Route53 continually Pings `ALB_A`. If ALB dies, it redirects all global Traffic to the `ALB_B` standby cluster. 
3. **AWS API Gateway Rate Limiting vs WAF**: 
   - Prevent internal server collapse due to unexpected Peak Traffic or DDoS attacks using Quotas/Throttling right at the API Layer, before Requests reach the back-end Lambda/EC2s.
4. **In-Code Circuit Breaker**:
   - If Stripe cable cuts, App_A shouldn't attempt to Retry 10,000 times (It will crash internal servers from exhausted Connection Pools). The Circuit Breaker trips instantly, returning a "Wallet under maintenance" message immediately.
