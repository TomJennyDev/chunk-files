# 🔄 Saga Pattern: Distributed Transactions With AWS Step Functions

How do Order Service, Payment Service, and Inventory Service all consistently "Commit" info simultaneously while living on 3 different Databases? Solve the Distributed Transactions problem entirely by turning **AWS Step Functions** into an "Orchestrator" overseeing the direct call flow.

## 🗺️ Ordering State Machine Diagram (Saga)

If `ProcessPayment` fails while scanning the credit card, the flow automatically routes to the `RefundInventory` path to return the item to the warehouse database (**Compensating Transaction** concept).

```mermaid
stateDiagram-v2
    [*] --> CreateOrder
    CreateOrder --> ReserveInventory
    
    ReserveInventory --> ProcessPayment: Inventory Reserved
    ReserveInventory --> CancelOrder: Out Of Stock (Update Status to Cancelled)
    
    ProcessPayment --> ConfirmOrder: Payment OK
    ProcessPayment --> RefundInventory: Payment Failed
    
    RefundInventory --> CancelOrder: Trigger Inventory Undo
    
    CancelOrder --> [*]: Notify user failure
    ConfirmOrder --> [*]: Notify user success!
    
    note right of ProcessPayment
        Call REST API or Lambda
        of Payment Microservice
    end note
```

## Practical Implementation:
- **AWS Step Functions** creates a visual State Machine running on the Cloud. You drag and drop JSON/ASL (Amazon States Language) to define the flow above.
- Each State (Block) will Invoke an **AWS Lambda Function**, call an **ECS/Fargate Task**, or throw a message directly into **SQS**.
- Why use Step Functions and NOT Choreography via Kafka/SQS directly?
  - Easy Monitoring (looking at the Step Functions graph, you know exactly which block a Transaction is stuck at).
  - Built-in error handling blocks (Catchers & Retries).
  - Huge scale and very cheap (AWS charges by State Transitions).
