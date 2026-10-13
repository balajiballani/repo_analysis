import { ArchitectureGraph } from './types.js';

export const PRESET_FINTECH: ArchitectureGraph = {
  systemName: 'Contoso Cloud Banking & Payment Mesh',
  repositoryUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
  branch: 'release/v3.4',
  organization: 'contoso-finance',
  project: 'core-banking',
  scannedAt: new Date().toISOString(),
  summary: {
    totalServices: 6,
    totalDatabases: 4,
    totalQueues: 3,
    syncCallCount: 8,
    asyncEventCount: 6,
    dbInteractionCount: 5,
    architecturalStyle: 'Event-Driven Microservices + CQRS with Saga Orchestration',
    detectedRisks: [
      {
        severity: 'high',
        title: 'Synchronous Chain Cascading Latency',
        description: 'Payment Service performs blocking HTTP calls to Fraud Detection and Account Service sequentially during transaction processing.',
        affectedNodes: ['payment-service', 'fraud-detection', 'account-service'],
        recommendation: 'Introduce an asynchronous Saga or parallel asynchronous evaluation with a 250ms fallback timeout.'
      },
      {
        severity: 'medium',
        title: 'Missing Dead-Letter Queue (DLQ) Alerting on Settlement Stream',
        description: 'Settlement Worker consumes settlement batches from Azure Service Bus without active DLQ telemetry.',
        affectedNodes: ['settlement-worker', 'asb-settlement-queue'],
        recommendation: 'Configure Azure Monitor metric alerts on DeadLetterMessageCount > 0 with PagerDuty escalation.'
      },
      {
        severity: 'low',
        title: 'Distributed Transaction Dual-Write on Payment DB and Kafka',
        description: 'Payment Service writes to PostgreSQL orders table and emits to Kafka without the Outbox Pattern.',
        affectedNodes: ['payment-service', 'postgres-payments', 'asb-payment-events'],
        recommendation: 'Implement Transactional Outbox Pattern using Debezium CDC or Spring Transactional Event Listener.'
      }
    ]
  },
  nodes: [
    {
      id: 'api-gateway',
      name: 'Azure API Gateway (YARP)',
      type: 'gateway',
      category: 'Reverse Proxy & Auth Perimeter',
      tech: 'YARP (.NET 8) / Azure App Service',
      language: 'C#',
      summary: 'Perimeter gateway terminating mTLS, validating OAuth2 JWT tokens and routing client traffic.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/api-gateway',
      status: 'healthy',
      position: { x: 80, y: 220 },
      inboundEndpoints: [
        { path: '/api/v1/payments/*', method: 'POST', description: 'Public mobile/web payment ingress', authRequired: true, rateLimit: '100 req/sec' },
        { path: '/api/v1/accounts/*', method: 'GET', description: 'Customer account balances & history', authRequired: true }
      ],
      outboundCalls: [
        { targetServiceId: 'auth-service', targetServiceName: 'Identity & Auth Service', endpoint: '/oauth/v2/introspect', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
        { targetServiceId: 'payment-service', targetServiceName: 'Payment Orchestrator', endpoint: '/payments/execute', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
        { targetServiceId: 'account-service', targetServiceName: 'Core Account & Ledger', endpoint: '/accounts/query', method: 'GET', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true }
      ],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [
        {
          file: 'src/Gateway/appsettings.json',
          type: 'config',
          codeSnippet: '{\n  "ReverseProxy": {\n    "Routes": {\n      "paymentRoute": { "ClusterId": "paymentCluster", "Match": { "Path": "/api/v1/payments/{**catch-all}" } }\n    }\n  }\n}',
          description: 'YARP Reverse Proxy routes config pointing to internal service cluster.'
        }
      ],
      metrics: { complexityScore: 4, blastRadiusCount: 5, dependentsCount: 0, dependenciesCount: 3, riskFactors: ['Perimeter Single Point of Entry'] }
    },
    {
      id: 'auth-service',
      name: 'Auth & Identity Service',
      type: 'service',
      category: 'Security Microservice',
      tech: 'ASP.NET Core 8 / IdentityServer',
      language: 'C#',
      summary: 'Issues OIDC JWTs, manages MFA authentication, and verifies HMAC signatures for banking partners.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/auth-service',
      status: 'healthy',
      position: { x: 380, y: 70 },
      inboundEndpoints: [
        { path: '/oauth/v2/token', method: 'POST', description: 'OAuth2 token issuance & refresh' },
        { path: '/oauth/v2/introspect', method: 'POST', description: 'Validate bearer token claims and active sessions' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'redis-session-cache', dbName: 'Redis Session & Rate Cache', dbType: 'Azure Cache for Redis', accessMode: 'read-write', tablesOrCollections: ['tokens:blacklist', 'user:sessions'], orm: 'StackExchange.Redis', transactional: false }
      ],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [
        {
          file: 'Controllers/TokenController.cs',
          type: 'controller',
          codeSnippet: '[HttpPost("introspect")]\npublic async Task<IActionResult> Introspect([FromBody] TokenRequest req) {\n    var isValid = await _cache.KeyExistsAsync($"tokens:valid:{req.TokenId}");\n    return Ok(new { active = isValid });\n}',
          description: 'High-throughput token validation controller hitting Redis.'
        }
      ],
      metrics: { complexityScore: 5, blastRadiusCount: 6, dependentsCount: 2, dependenciesCount: 1, riskFactors: ['High blast radius if down'] }
    },
    {
      id: 'payment-service',
      name: 'Payment Orchestrator',
      type: 'service',
      category: 'Core Transaction Engine',
      tech: 'Spring Boot 3.3 / Java 21',
      language: 'Java',
      summary: 'Central payments engine handling fund transfers, ISO20022 wire formatting, and transaction saga states.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
      status: 'warning',
      position: { x: 390, y: 260 },
      inboundEndpoints: [
        { path: '/payments/execute', method: 'POST', description: 'Submit money transfer or bill pay payload', authRequired: true, fileSource: 'com/contoso/payment/controller/PaymentController.java' },
        { path: '/payments/{id}/status', method: 'GET', description: 'Retrieve real-time transaction state and audit trace' }
      ],
      outboundCalls: [
        { targetServiceId: 'account-service', targetServiceName: 'Core Account & Ledger', endpoint: '/accounts/balance/hold', method: 'POST', protocol: 'REST', clientType: 'FeignClient (Resilience4j)', circuitBreaker: true, timeoutMs: 800, fileSource: 'client/AccountServiceClient.java' },
        { targetServiceId: 'fraud-detection', targetServiceName: 'AI Fraud Scoring Service', endpoint: '/v2/evaluate-transaction', method: 'POST', protocol: 'REST', clientType: 'WebClient', circuitBreaker: false, timeoutMs: 300, fileSource: 'client/FraudScoringClient.java' }
      ],
      databases: [
        { dbId: 'postgres-payments', dbName: 'Payments Ledger (PostgreSQL)', dbType: 'PostgreSQL 16', accessMode: 'read-write', tablesOrCollections: ['payments', 'payment_ledger', 'saga_state'], orm: 'Spring Data JPA / Hibernate', transactional: true, fileSource: 'entity/PaymentTransaction.java' }
      ],
      asyncEvents: {
        published: [
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', eventSchema: 'Contoso.Banking.Events.PaymentInitiated', frequency: '~450 events/min', fileSource: 'service/EventPublisher.java' },
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', eventSchema: 'Contoso.Banking.Events.PaymentSettled', frequency: '~430 events/min', fileSource: 'service/EventPublisher.java' }
        ],
        consumed: [
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/fraud-alerts', brokerType: 'Azure Service Bus', consumerGroup: 'payment-fraud-watcher', handlerName: 'onFraudAlertReceived', fileSource: 'listener/FraudAlertListener.java' }
        ]
      },
      codeEvidence: [
        {
          file: 'com/contoso/payment/controller/PaymentController.java',
          type: 'controller',
          codeSnippet: '@PostMapping("/payments/execute")\npublic ResponseEntity<PaymentResult> execute(@RequestBody PaymentRequest req) {\n    FraudScore score = fraudClient.evaluate(req);\n    if (score.isFlagged()) return ResponseEntity.status(403).build();\n    accountClient.holdFunds(req.getAccountId(), req.getAmount());\n    PaymentTx tx = paymentRepository.save(new PaymentTx(req));\n    serviceBusTemplate.send("payments-v1", new PaymentInitiatedEvent(tx.getId()));\n    return ResponseEntity.ok(PaymentResult.from(tx));\n}',
          description: 'Controller executing synchronous fraud evaluation and funds hold before publishing async event.'
        },
        {
          file: 'com/contoso/payment/client/AccountServiceClient.java',
          type: 'client',
          codeSnippet: '@FeignClient(name = "account-service", url = "${services.account.url}")\n@CircuitBreaker(name = "accountServiceCircuit")\npublic interface AccountServiceClient {\n    @PostMapping("/accounts/balance/hold")\n    HoldResult holdFunds(@RequestParam("accountId") String id, @RequestParam("amount") BigDecimal amount);\n}',
          description: 'Spring Cloud OpenFeign client with Resilience4j circuit breaker.'
        }
      ],
      metrics: { complexityScore: 8, blastRadiusCount: 7, dependentsCount: 2, dependenciesCount: 4, riskFactors: ['Cascading failure vulnerability', 'Dual-write anomaly'] }
    },
    {
      id: 'account-service',
      name: 'Core Account & Ledger',
      type: 'service',
      category: 'Banking Core System',
      tech: 'Spring Boot 3.3 / Java 21',
      language: 'Java',
      summary: 'Double-entry accounting ledger managing deposits, holds, interest calculations, and bank accounts.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/account-service',
      status: 'healthy',
      position: { x: 740, y: 150 },
      inboundEndpoints: [
        { path: '/accounts/query', method: 'GET', description: 'Fetch account balances & routing numbers' },
        { path: '/accounts/balance/hold', method: 'POST', description: 'Reserve ledger balance for pending payment' },
        { path: '/accounts/ledger/commit', method: 'POST', description: 'Commit settlement debit/credit entry' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'sqlserver-accounts', dbName: 'Accounts Core DB (Azure SQL)', dbType: 'Azure SQL Managed Instance', accessMode: 'read-write', tablesOrCollections: ['tbl_accounts', 'tbl_ledger_journal', 'tbl_holds'], orm: 'Hibernate / JPA with pessimistic locking', transactional: true, fileSource: 'repository/AccountRepository.java' }
      ],
      asyncEvents: {
        published: [],
        consumed: [
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', consumerGroup: 'account-ledger-commit', handlerName: 'handlePaymentSettledEvent' }
        ]
      },
      codeEvidence: [
        {
          file: 'src/main/java/com/contoso/account/AccountService.java',
          type: 'database',
          codeSnippet: '@Transactional(isolation = Isolation.SERIALIZABLE)\npublic AccountHold reserveBalance(String accountId, BigDecimal amount) {\n    Account account = accountRepository.findByIdForUpdate(accountId);\n    account.deductAvailable(amount);\n    return holdRepository.save(new AccountHold(account, amount));\n}',
          description: 'Pessimistic serializable transaction ensuring zero double-spend in core ledger.'
        }
      ],
      metrics: { complexityScore: 7, blastRadiusCount: 5, dependentsCount: 2, dependenciesCount: 1, riskFactors: ['Database lock contention under high load'] }
    },
    {
      id: 'fraud-detection',
      name: 'AI Fraud Scoring Service',
      type: 'service',
      category: 'ML Risk Evaluation',
      tech: 'Python 3.11 / FastAPI / ONNX Runtime',
      language: 'Python',
      summary: 'Real-time inference calculating fraud velocity, geolocation divergence, and transaction risk scores under 40ms.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/fraud-detection',
      status: 'healthy',
      position: { x: 740, y: 380 },
      inboundEndpoints: [
        { path: '/v2/evaluate-transaction', method: 'POST', description: 'Real-time scoring model inference' },
        { path: '/v2/rules/update', method: 'PUT', description: 'Hot-reload blacklisted IBANs and merchant categories' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'mongo-fraud-features', dbName: 'Feature Store (Cosmos DB Mongo)', dbType: 'Azure Cosmos DB', accessMode: 'read-write', tablesOrCollections: ['device_fingerprints', 'velocity_vectors', 'ip_reputation'], orm: 'Motor / PyMongo async driver', transactional: false }
      ],
      asyncEvents: {
        published: [
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/fraud-alerts', brokerType: 'Azure Service Bus', eventSchema: 'Contoso.Fraud.RiskAnomalyFlagged', frequency: '~5-12/hour' }
        ],
        consumed: []
      },
      codeEvidence: [
        {
          file: 'app/main.py',
          type: 'controller',
          codeSnippet: '@app.post("/v2/evaluate-transaction")\nasync def evaluate(tx: TxPayload):\n    features = await feature_store.get_features(tx.user_id, tx.device_hash)\n    risk_score = onnx_session.run(None, {"input": features})[0][0]\n    if risk_score > 0.85:\n        await service_bus.send("fraud-alerts", {"tx_id": tx.id, "score": float(risk_score)})\n    return {"risk_score": float(risk_score), "flagged": risk_score > 0.85}',
          description: 'FastAPI async endpoint doing ONNX model inference and feature lookup.'
        }
      ],
      metrics: { complexityScore: 6, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 2, riskFactors: ['Inference latency spikes'] }
    },
    {
      id: 'settlement-worker',
      name: 'Settlement & Clearing Worker',
      type: 'service',
      category: 'Background Worker',
      tech: 'Go 1.22 / Azure Container Apps',
      language: 'Go',
      summary: 'Batches settled payments, formats ACH / FedNow / SEPA clearing files, and interacts with central clearinghouses.',
      repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/settlement-clearing',
      status: 'warning',
      position: { x: 1040, y: 260 },
      inboundEndpoints: [
        { path: '/health/liveness', method: 'GET', description: 'Kubelet probe endpoint' }
      ],
      outboundCalls: [
        { targetServiceId: 'account-service', targetServiceName: 'Core Account & Ledger', endpoint: '/accounts/ledger/commit', method: 'POST', protocol: 'REST', clientType: 'net/http standard client', circuitBreaker: false }
      ],
      databases: [
        { dbId: 'postgres-payments', dbName: 'Payments Ledger (PostgreSQL)', dbType: 'PostgreSQL 16', accessMode: 'read-write', tablesOrCollections: ['settlement_batches', 'payments'], orm: 'pgx / sqlc generated queries', transactional: true }
      ],
      asyncEvents: {
        published: [],
        consumed: [
          { topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', consumerGroup: 'settlement-clearing-group', handlerName: 'ProcessSettlementBatch' }
        ]
      },
      codeEvidence: [
        {
          file: 'worker/subscriber.go',
          type: 'messaging',
          codeSnippet: 'func (w *SettlementWorker) Start(ctx context.Context) error {\n    receiver, _ := w.sbClient.NewReceiverForSubscription("payments-v1", "settlement-clearing-group", nil)\n    for {\n        messages, _ := receiver.ReceiveMessages(ctx, 50, nil)\n        for _, msg := range messages {\n            w.processBatchItem(ctx, msg)\n            receiver.CompleteMessage(ctx, msg, nil)\n        }\n    }\n}',
          description: 'Azure Service Bus batch receiver consuming completed payments.'
        }
      ],
      metrics: { complexityScore: 5, blastRadiusCount: 2, dependentsCount: 0, dependenciesCount: 3, riskFactors: ['No DLQ alarm configured'] }
    },
    // Databases
    {
      id: 'postgres-payments',
      name: 'Payments DB (PostgreSQL 16)',
      type: 'database',
      category: 'Relational Database',
      tech: 'Azure Database for PostgreSQL Flexible Server',
      language: 'SQL',
      summary: 'ACID compliant financial transaction record with row-level security and write-ahead log archiving.',
      status: 'healthy',
      position: { x: 390, y: 530 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [
        {
          file: 'migrations/V01__create_payments.sql',
          type: 'database',
          codeSnippet: 'CREATE TABLE payments (\n    id UUID PRIMARY KEY,\n    account_id VARCHAR(64) NOT NULL,\n    recipient_iban VARCHAR(34) NOT NULL,\n    amount DECIMAL(18, 4) NOT NULL,\n    currency CHAR(3) NOT NULL,\n    state VARCHAR(32) NOT NULL,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);',
          description: 'PostgreSQL schema with ledger integrity constraints.'
        }
      ],
      metrics: { complexityScore: 3, blastRadiusCount: 4, dependentsCount: 2, dependenciesCount: 0, riskFactors: ['Shared database by 2 services (payment & settlement)'] }
    },
    {
      id: 'sqlserver-accounts',
      name: 'Account Core DB (Azure SQL)',
      type: 'database',
      category: 'Relational Database',
      tech: 'Azure SQL Managed Instance (Business Critical Tier)',
      language: 'T-SQL',
      summary: 'Enterprise ledger storing bank account balances, customer routing numbers and audit trails.',
      status: 'healthy',
      position: { x: 990, y: 70 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 4, blastRadiusCount: 5, dependentsCount: 1, dependenciesCount: 0, riskFactors: ['Single point of persistence failure'] }
    },
    {
      id: 'redis-session-cache',
      name: 'Redis Session Cache',
      type: 'cache',
      category: 'In-Memory Cache & Token Store',
      tech: 'Azure Cache for Redis (Enterprise Clustering)',
      language: 'RESP / Key-Value',
      summary: 'Ultra-low latency (<1ms) JWT validation, IP velocity rate limiter and user session store.',
      status: 'healthy',
      position: { x: 50, y: 70 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 2, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'mongo-fraud-features',
      name: 'Cosmos DB Feature Store',
      type: 'database',
      category: 'Document NoSQL / Feature Store',
      tech: 'Azure Cosmos DB (Mongo vCore API)',
      language: 'BSON / Document',
      summary: 'Stores 90-day transaction history, device fingerprints, and calculated behavioral heuristics.',
      status: 'healthy',
      position: { x: 990, y: 530 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    // Async Queues / Topics
    {
      id: 'asb-payment-events',
      name: 'Azure Service Bus: payments-v1',
      type: 'queue',
      category: 'Message Broker (Topic / Subscription)',
      tech: 'Azure Service Bus (Premium Tier)',
      language: 'AMQP 1.0',
      summary: 'High-reliability enterprise topic broadcasting payment lifecycle events to multiple downstream microservices.',
      status: 'healthy',
      position: { x: 740, y: -60 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [
        {
          file: 'infra/servicebus.bicep',
          type: 'config',
          codeSnippet: 'resource topic \'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview\' = {\n  name: \'payments-v1\'\n  properties: { defaultMessageTimeToLive: \'P7D\', requiresDuplicateDetection: true }\n}',
          description: 'Azure Bicep template declaring idempotent payment topic.'
        }
      ],
      metrics: { complexityScore: 3, blastRadiusCount: 4, dependentsCount: 3, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'asb-fraud-alerts',
      name: 'Azure Service Bus: fraud-alerts',
      type: 'queue',
      category: 'Message Broker (Queue)',
      tech: 'Azure Service Bus (Queue)',
      language: 'AMQP 1.0',
      summary: 'Asynchronous alerts emitted by AI scoring to halt suspicious in-flight payments.',
      status: 'healthy',
      position: { x: 580, y: 440 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 2, blastRadiusCount: 2, dependentsCount: 2, dependenciesCount: 0, riskFactors: [] }
    }
  ],
  edges: [
    // API Gateway edges
    { id: 'e-gw-auth', source: 'api-gateway', target: 'auth-service', type: 'sync-http', label: 'HTTP POST /oauth/introspect', protocol: 'REST / HTTPS', details: 'Token introspection and claims extraction on every API call.' },
    { id: 'e-gw-pay', source: 'api-gateway', target: 'payment-service', type: 'sync-http', label: 'HTTP POST /payments/execute', protocol: 'REST / HTTPS', details: 'Ingress forwarding of payment authorization payload.', isCriticalPath: true },
    { id: 'e-gw-acc', source: 'api-gateway', target: 'account-service', type: 'sync-http', label: 'HTTP GET /accounts/query', protocol: 'REST / HTTPS', details: 'Direct balance queries routed to core account service.' },

    // Auth DB
    { id: 'e-auth-redis', source: 'auth-service', target: 'redis-session-cache', type: 'db-readwrite', label: 'RESP GET/SET Session', protocol: 'Redis TCP', details: 'Sub-millisecond token revocation lookup.' },

    // Payment service sync calls
    { id: 'e-pay-acc', source: 'payment-service', target: 'account-service', type: 'sync-http', label: 'HTTP POST /accounts/balance/hold', protocol: 'REST (Feign)', details: 'Holds funds prior to ledger execution with Resilience4j circuit breaker.', isCriticalPath: true },
    { id: 'e-pay-fraud', source: 'payment-service', target: 'fraud-detection', type: 'sync-http', label: 'HTTP POST /v2/evaluate', protocol: 'REST (WebClient)', details: 'Synchronous ML inference call before authorizing payment.', isCriticalPath: true },

    // Payment DB
    { id: 'e-pay-db', source: 'payment-service', target: 'postgres-payments', type: 'db-readwrite', label: 'JPA Write /payments', protocol: 'PostgreSQL Wire', details: 'Writes transaction record and updates saga state.' },

    // Payment Service Bus Pub
    { id: 'e-pay-pub-sb', source: 'payment-service', target: 'asb-payment-events', type: 'async-publish', label: 'PUB PaymentInitiated', protocol: 'AMQP 1.0', details: 'Emits event for downstream ledger and settlement.' },

    // Account Service DB & Sub
    { id: 'e-acc-db', source: 'account-service', target: 'sqlserver-accounts', type: 'db-readwrite', label: 'T-SQL SELECT/UPDATE', protocol: 'TDS / Azure SQL', details: 'Pessimistic row lock update on ledger balances.' },
    { id: 'e-acc-sub-sb', source: 'asb-payment-events', target: 'account-service', type: 'async-consume', label: 'SUB PaymentSettled', protocol: 'AMQP 1.0', details: 'Consumes settled event to commit held balances.' },

    // Fraud Detection DB & Alerts
    { id: 'e-fraud-db', source: 'fraud-detection', target: 'mongo-fraud-features', type: 'db-readwrite', label: 'Mongo Find / Update', protocol: 'Mongo Wire', details: 'Fetches behavioral vector and velocity metrics.' },
    { id: 'e-fraud-pub', source: 'fraud-detection', target: 'asb-fraud-alerts', type: 'async-publish', label: 'PUB FraudAnomalyFlagged', protocol: 'AMQP 1.0', details: 'Emits anomaly trigger if score exceeds 0.85 threshold.' },
    { id: 'e-fraud-sub-pay', source: 'asb-fraud-alerts', target: 'payment-service', type: 'async-consume', label: 'SUB FraudAlerts', protocol: 'AMQP 1.0', details: 'Payment service aborts in-flight transaction on alert.' },

    // Settlement Worker
    { id: 'e-sb-settle', source: 'asb-payment-events', target: 'settlement-worker', type: 'async-consume', label: 'SUB payments-v1 (50 batch)', protocol: 'AMQP 1.0', details: 'Batches 50 transactions for clearinghouse transmission.' },
    { id: 'e-settle-db', source: 'settlement-worker', target: 'postgres-payments', type: 'db-readwrite', label: 'sqlc UPDATE settlement_batches', protocol: 'PostgreSQL Wire', details: 'Marks payment records as CLEARED.' },
    { id: 'e-settle-acc', source: 'settlement-worker', target: 'account-service', type: 'sync-http', label: 'HTTP POST /accounts/ledger/commit', protocol: 'REST / HTTPS', details: 'Notifies ledger of completed clearinghouse batch.' }
  ]
};

export const PRESET_ECOMMERCE: ArchitectureGraph = {
  systemName: 'Fabrikam Global Retail & Order Mesh',
  repositoryUrl: 'https://dev.azure.com/fabrikam-retail/omnichannel/_git/order-mesh-service',
  branch: 'main',
  organization: 'fabrikam-retail',
  project: 'omnichannel',
  scannedAt: new Date().toISOString(),
  summary: {
    totalServices: 6,
    totalDatabases: 3,
    totalQueues: 2,
    syncCallCount: 7,
    asyncEventCount: 5,
    dbInteractionCount: 4,
    architecturalStyle: 'Event Choreography Microservices with Kafka Event Stream',
    detectedRisks: [
      {
        severity: 'high',
        title: 'Inventory Dual Booking Risk',
        description: 'Inventory Service receives synchronous reservation from Order Service without distributed lock lease or idempotency key header.',
        affectedNodes: ['order-service', 'inventory-service', 'inventory-postgres'],
        recommendation: 'Use Redis Redlock or optimistic locking with idempotency key generated at API Gateway.'
      },
      {
        severity: 'medium',
        title: 'Kafka Consumer Lag in Shipping Fulfillment',
        description: 'Fulfillment & Shipping service single partition consumer could bottleneck during peak flash-sales.',
        affectedNodes: ['kafka-order-lifecycle', 'fulfillment-service'],
        recommendation: 'Increase partition count on order.lifecycle to 16 and scale consumer replicas.'
      }
    ]
  },
  nodes: [
    {
      id: 'storefront-gateway',
      name: 'Storefront Web API Gateway',
      type: 'gateway',
      category: 'API Gateway',
      tech: 'Azure API Management / Envoy',
      language: 'C# / Envoy YAML',
      summary: 'Public retail gateway routing mobile apps and web frontend traffic.',
      repoUrl: 'https://dev.azure.com/fabrikam-retail/omnichannel/_git/storefront-gateway',
      status: 'healthy',
      position: { x: 70, y: 220 },
      inboundEndpoints: [
        { path: '/v1/orders/checkout', method: 'POST', description: 'Cart checkout initiation', authRequired: true }
      ],
      outboundCalls: [
        { targetServiceId: 'order-service', targetServiceName: 'Order Orchestrator', endpoint: '/orders', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
        { targetServiceId: 'catalog-service', targetServiceName: 'Product Catalog Service', endpoint: '/products', method: 'GET', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true }
      ],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 5, dependentsCount: 0, dependenciesCount: 2, riskFactors: [] }
    },
    {
      id: 'order-service',
      name: 'Order Orchestrator',
      type: 'service',
      category: 'Order Management',
      tech: 'ASP.NET Core 8 Web API',
      language: 'C#',
      summary: 'Coordinates order creation, inventory checks, payment authorization and status updates.',
      repoUrl: 'https://dev.azure.com/fabrikam-retail/omnichannel/_git/order-mesh-service',
      status: 'healthy',
      position: { x: 380, y: 150 },
      inboundEndpoints: [
        { path: '/orders', method: 'POST', description: 'Create order and initiate reservation' },
        { path: '/orders/{id}', method: 'GET', description: 'Get order details and track shipment' }
      ],
      outboundCalls: [
        { targetServiceId: 'inventory-service', targetServiceName: 'Inventory Service', endpoint: '/inventory/reserve', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
        { targetServiceId: 'payment-gateway-ext', targetServiceName: 'External Payment Gateway (Stripe)', endpoint: '/v1/charges', method: 'POST', protocol: 'REST', clientType: 'StripeClient', circuitBreaker: true }
      ],
      databases: [
        { dbId: 'orders-cosmosdb', dbName: 'Orders DB (Cosmos DB)', dbType: 'Azure Cosmos DB NoSQL', accessMode: 'read-write', tablesOrCollections: ['orders', 'customer_carts'], orm: 'Microsoft.Azure.Cosmos SDK', transactional: false }
      ],
      asyncEvents: {
        published: [
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', eventSchema: 'OrderCreatedEvent', frequency: '~800/min' },
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', eventSchema: 'OrderCancelledEvent', frequency: '~25/min' }
        ],
        consumed: [
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', consumerGroup: 'order-fulfillment-ack', handlerName: 'OnShipmentCreated' }
        ]
      },
      codeEvidence: [
        {
          file: 'Controllers/OrdersController.cs',
          type: 'controller',
          codeSnippet: '[HttpPost]\npublic async Task<IActionResult> CreateOrder([FromBody] OrderDto dto) {\n    var reserved = await _inventoryClient.ReserveAsync(dto.Items);\n    var order = await _cosmosRepo.InsertAsync(new Order(dto));\n    await _kafkaProducer.ProduceAsync("order.lifecycle.v1", new OrderCreatedEvent(order.Id));\n    return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);\n}',
          description: 'Controller executing synchronous reservation then producing Kafka event.'
        }
      ],
      metrics: { complexityScore: 7, blastRadiusCount: 6, dependentsCount: 1, dependenciesCount: 3, riskFactors: ['Critical path bottleneck'] }
    },
    {
      id: 'catalog-service',
      name: 'Product Catalog Service',
      type: 'service',
      category: 'Catalog & Search',
      tech: 'Go 1.22 / Gin Framework',
      language: 'Go',
      summary: 'Serves multi-tenant catalog items, pricing tiers, and elastic product search.',
      status: 'healthy',
      position: { x: 380, y: 390 },
      inboundEndpoints: [
        { path: '/products', method: 'GET', description: 'List and filter product catalog' },
        { path: '/products/{sku}', method: 'GET', description: 'Get SKU specs and images' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'catalog-redis', dbName: 'Catalog Redis Cache', dbType: 'Redis 7', accessMode: 'read-write', tablesOrCollections: ['catalog:sku:*', 'pricing:cache'], orm: 'go-redis', transactional: false }
      ],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 4, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 1, riskFactors: [] }
    },
    {
      id: 'inventory-service',
      name: 'Inventory Service',
      type: 'service',
      category: 'Warehouse & Stock',
      tech: 'Spring Boot 3.3 / Java 21',
      language: 'Java',
      summary: 'Tracks warehouse bin locations, reserve allocations and safety stock levels.',
      status: 'warning',
      position: { x: 740, y: 80 },
      inboundEndpoints: [
        { path: '/inventory/reserve', method: 'POST', description: 'Reserve stock with TTL hold' },
        { path: '/inventory/release', method: 'POST', description: 'Release expired cart reservation' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'inventory-postgres', dbName: 'Inventory DB (PostgreSQL)', dbType: 'PostgreSQL 16', accessMode: 'read-write', tablesOrCollections: ['stock_levels', 'reservations'], orm: 'Spring Data JPA', transactional: true }
      ],
      asyncEvents: {
        published: [],
        consumed: [
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', consumerGroup: 'inventory-consumer', handlerName: 'onOrderCancelled' }
        ]
      },
      codeEvidence: [],
      metrics: { complexityScore: 6, blastRadiusCount: 4, dependentsCount: 1, dependenciesCount: 1, riskFactors: ['Dual booking race condition under load'] }
    },
    {
      id: 'fulfillment-service',
      name: 'Fulfillment & Shipping',
      type: 'service',
      category: 'Logistics',
      tech: 'Node.js 20 / NestJS',
      language: 'TypeScript',
      summary: 'Automates warehouse picking slips, parcel packing, and FedEx/UPS shipping label generation.',
      status: 'healthy',
      position: { x: 740, y: 320 },
      inboundEndpoints: [
        { path: '/shipments/tracking/{id}', method: 'GET', description: 'Real-time carrier parcel location' }
      ],
      outboundCalls: [],
      databases: [],
      asyncEvents: {
        published: [
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', eventSchema: 'ShipmentDispatchedEvent', frequency: '~400/min' }
        ],
        consumed: [
          { topicOrQueue: 'kafka://order.lifecycle.v1', brokerType: 'Kafka', consumerGroup: 'shipping-dispatch', handlerName: 'processOrderCreated' }
        ]
      },
      codeEvidence: [
        {
          file: 'src/fulfillment/fulfillment.consumer.ts',
          type: 'messaging',
          codeSnippet: '@SubscribeTo({ topic: "order.lifecycle.v1", groupId: "shipping-dispatch" })\nasync handleOrder(@Payload() event: OrderCreatedEvent) {\n  const label = await this.carrierService.createLabel(event.destination);\n  await this.producer.emit("order.lifecycle.v1", new ShipmentDispatchedEvent(event.orderId, label.trackingNumber));\n}',
          description: 'NestJS Kafka consumer generating shipping label upon OrderCreated.'
        }
      ],
      metrics: { complexityScore: 5, blastRadiusCount: 2, dependentsCount: 0, dependenciesCount: 2, riskFactors: [] }
    },
    {
      id: 'payment-gateway-ext',
      name: 'Stripe Payment Gateway',
      type: 'external',
      category: 'External 3rd Party Provider',
      tech: 'Stripe REST API',
      language: 'REST / JSON',
      summary: 'Card authorization, 3D-Secure 2.0 and credit card billing.',
      status: 'healthy',
      position: { x: 1040, y: 150 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 1, blastRadiusCount: 1, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    // Databases & Queues
    {
      id: 'orders-cosmosdb',
      name: 'Orders DB (Cosmos DB)',
      type: 'database',
      category: 'Document NoSQL Database',
      tech: 'Azure Cosmos DB (Global Multi-Region)',
      language: 'JSON / NoSQL',
      summary: 'Multi-region replicated order documents with 99.999% SLA.',
      status: 'healthy',
      position: { x: 380, y: -40 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'inventory-postgres',
      name: 'Inventory DB (PostgreSQL)',
      type: 'database',
      category: 'Relational Database',
      tech: 'Azure Database for PostgreSQL',
      language: 'SQL',
      summary: 'Warehouse stock balances and inventory audit trail.',
      status: 'healthy',
      position: { x: 990, y: 0 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'catalog-redis',
      name: 'Catalog Redis Cache',
      type: 'cache',
      category: 'In-Memory Cache',
      tech: 'Redis 7 / MemoryStore',
      language: 'Key-Value',
      summary: 'Fast catalog cache reducing database hits by 94%.',
      status: 'healthy',
      position: { x: 380, y: 550 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 2, blastRadiusCount: 1, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'kafka-order-lifecycle',
      name: 'Apache Kafka: order.lifecycle.v1',
      type: 'queue',
      category: 'Distributed Event Stream',
      tech: 'Apache Kafka / Azure Event Hubs (Kafka Surface)',
      language: 'Kafka Binary Protocol',
      summary: 'Event backbone distributing OrderCreated, Shipped, Cancelled events across services.',
      status: 'healthy',
      position: { x: 740, y: 520 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 4, blastRadiusCount: 4, dependentsCount: 3, dependenciesCount: 0, riskFactors: [] }
    }
  ],
  edges: [
    { id: 'e-gw-ord', source: 'storefront-gateway', target: 'order-service', type: 'sync-http', label: 'HTTP POST /orders', protocol: 'REST / HTTPS', isCriticalPath: true },
    { id: 'e-gw-cat', source: 'storefront-gateway', target: 'catalog-service', type: 'sync-http', label: 'HTTP GET /products', protocol: 'REST / HTTPS' },
    { id: 'e-ord-inv', source: 'order-service', target: 'inventory-service', type: 'sync-http', label: 'HTTP POST /inventory/reserve', protocol: 'REST / HTTPS', details: 'Blocking inventory reservation before payment.', isCriticalPath: true },
    { id: 'e-ord-pay', source: 'order-service', target: 'payment-gateway-ext', type: 'sync-http', label: 'HTTP POST /v1/charges', protocol: 'REST / HTTPS', details: 'External card charge authorization.' },
    { id: 'e-ord-db', source: 'order-service', target: 'orders-cosmosdb', type: 'db-readwrite', label: 'Cosmos Insert/Query', protocol: 'Cosmos TCP Wire' },
    { id: 'e-ord-kafka', source: 'order-service', target: 'kafka-order-lifecycle', type: 'async-publish', label: 'PUB OrderCreatedEvent', protocol: 'Kafka Protocol' },
    { id: 'e-cat-redis', source: 'catalog-service', target: 'catalog-redis', type: 'db-readwrite', label: 'Redis GET/SET Product', protocol: 'Redis TCP' },
    { id: 'e-inv-db', source: 'inventory-service', target: 'inventory-postgres', type: 'db-readwrite', label: 'SQL UPDATE stock_levels', protocol: 'PostgreSQL Wire' },
    { id: 'e-kafka-fulfill', source: 'kafka-order-lifecycle', target: 'fulfillment-service', type: 'async-consume', label: 'SUB OrderCreatedEvent', protocol: 'Kafka Protocol' },
    { id: 'e-fulfill-kafka', source: 'fulfillment-service', target: 'kafka-order-lifecycle', type: 'async-publish', label: 'PUB ShipmentDispatchedEvent', protocol: 'Kafka Protocol' },
    { id: 'e-kafka-ord', source: 'kafka-order-lifecycle', target: 'order-service', type: 'async-consume', label: 'SUB ShipmentDispatchedEvent', protocol: 'Kafka Protocol' }
  ]
};

export const PRESET_HEALTHCARE: ArchitectureGraph = {
  systemName: 'Azure HealthTech Claims & Telehealth Stream',
  repositoryUrl: 'https://dev.azure.com/healthtech-cloud/telehealth/_git/claims-engine',
  branch: 'main',
  organization: 'healthtech-cloud',
  project: 'telehealth',
  scannedAt: new Date().toISOString(),
  summary: {
    totalServices: 5,
    totalDatabases: 3,
    totalQueues: 2,
    syncCallCount: 6,
    asyncEventCount: 4,
    dbInteractionCount: 4,
    architecturalStyle: 'HIPAA-Compliant Microservices with Azure Service Bus & WebRTC',
    detectedRisks: [
      {
        severity: 'high',
        title: 'PHI Data Encryption at Rest Key Rotation Verification',
        description: 'Claims Adjudication Service accesses sensitive PHI database without customer-managed HSM key attestation check in startup probe.',
        affectedNodes: ['claims-engine', 'claims-postgres'],
        recommendation: 'Enforce Azure Key Vault Managed HSM key validation in ASP.NET startup.'
      }
    ]
  },
  nodes: [
    {
      id: 'patient-portal-api',
      name: 'Patient Portal API',
      type: 'gateway',
      category: 'Perimeter Gateway',
      tech: 'ASP.NET Core 8 / Azure App Service',
      language: 'C#',
      summary: 'Patient facing portal for telehealth appointments, records review, and claims filing.',
      repoUrl: 'https://dev.azure.com/healthtech-cloud/telehealth/_git/patient-portal-api',
      status: 'healthy',
      position: { x: 80, y: 200 },
      inboundEndpoints: [
        { path: '/api/v1/claims/submit', method: 'POST', description: 'Submit electronic medical claim' },
        { path: '/api/v1/telehealth/session', method: 'POST', description: 'Initiate WebRTC video room' }
      ],
      outboundCalls: [
        { targetServiceId: 'claims-engine', targetServiceName: 'Claims Adjudication Engine', endpoint: '/claims/adjudicate', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
        { targetServiceId: 'telehealth-signaling', targetServiceName: 'WebRTC Signaling Service', endpoint: '/rooms/create', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true }
      ],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 4, blastRadiusCount: 4, dependentsCount: 0, dependenciesCount: 2, riskFactors: [] }
    },
    {
      id: 'claims-engine',
      name: 'Claims Adjudication Engine',
      type: 'service',
      category: 'Insurance Core',
      tech: 'Spring Boot 3.3 / Java 21',
      language: 'Java',
      summary: 'Validates ICD-10 diagnostic codes, CPT procedure codes and computes deductible co-pays.',
      repoUrl: 'https://dev.azure.com/healthtech-cloud/telehealth/_git/claims-engine',
      status: 'healthy',
      position: { x: 400, y: 120 },
      inboundEndpoints: [
        { path: '/claims/adjudicate', method: 'POST', description: 'Execute real-time rule engine on clinical claim' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'claims-postgres', dbName: 'HIPAA Encrypted PostgreSQL', dbType: 'PostgreSQL 16', accessMode: 'read-write', tablesOrCollections: ['claims', 'adjudications', 'audit_log'], orm: 'Spring Data JPA', transactional: true }
      ],
      asyncEvents: {
        published: [
          { topicOrQueue: 'sb://healthtech.servicebus.windows.net/claims-adjudicated', brokerType: 'Azure Service Bus', eventSchema: 'ClaimApprovedEvent', frequency: '~320/hour' }
        ],
        consumed: []
      },
      codeEvidence: [
        {
          file: 'src/main/java/com/health/claims/ClaimService.java',
          type: 'controller',
          codeSnippet: '@PostMapping("/claims/adjudicate")\npublic ClaimOutcome adjudicate(@RequestBody ClaimRequest req) {\n    RulesResult result = rulesEngine.execute(req.getIcdCodes(), req.getCptCodes());\n    ClaimEntity claim = claimRepo.save(new ClaimEntity(req, result));\n    serviceBus.send("claims-adjudicated", new ClaimApprovedEvent(claim.getId(), result.getPayableAmount()));\n    return ClaimOutcome.from(claim);\n}',
          description: 'Adjudication controller evaluating ICD codes and publishing approval event.'
        }
      ],
      metrics: { complexityScore: 7, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 2, riskFactors: [] }
    },
    {
      id: 'telehealth-signaling',
      name: 'WebRTC Signaling Service',
      type: 'service',
      category: 'Real-time Communications',
      tech: 'Go 1.22 / Gorilla WebSocket',
      language: 'Go',
      summary: 'Maintains live WebRTC SDP offer/answer exchange, ICE candidates and doctor-patient presence.',
      status: 'healthy',
      position: { x: 400, y: 360 },
      inboundEndpoints: [
        { path: '/rooms/create', method: 'POST', description: 'Provision secure room token' },
        { path: '/ws/signal', method: 'GET', description: 'WebSocket upgrade for SDP/ICE exchange' }
      ],
      outboundCalls: [],
      databases: [
        { dbId: 'redis-presence', dbName: 'Doctor/Patient Presence Cache', dbType: 'Redis 7', accessMode: 'read-write', tablesOrCollections: ['rooms:active', 'session:peer:*'], orm: 'go-redis', transactional: false }
      ],
      asyncEvents: {
        published: [
          { topicOrQueue: 'eventhub://clinical-telemetry', brokerType: 'Event Hubs', eventSchema: 'ConsultationEndedTelemetry', frequency: '~150/hour' }
        ],
        consumed: []
      },
      codeEvidence: [],
      metrics: { complexityScore: 5, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 2, riskFactors: [] }
    },
    {
      id: 'claims-postgres',
      name: 'Claims DB (Encrypted PostgreSQL)',
      type: 'database',
      category: 'Relational Database',
      tech: 'Azure PostgreSQL Flexible Server (TDE + Key Vault)',
      language: 'SQL',
      summary: 'HIPAA compliant encrypted storage for patient insurance claims and diagnoses.',
      status: 'healthy',
      position: { x: 740, y: 120 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'redis-presence',
      name: 'Presence Cache (Redis)',
      type: 'cache',
      category: 'In-Memory Cache',
      tech: 'Azure Cache for Redis',
      language: 'Key-Value',
      summary: 'Maintains ephemeral doctor and patient room peering metadata.',
      status: 'healthy',
      position: { x: 740, y: 360 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 2, blastRadiusCount: 1, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'asb-claims-events',
      name: 'Azure Service Bus: claims-adjudicated',
      type: 'queue',
      category: 'Message Broker',
      tech: 'Azure Service Bus',
      language: 'AMQP',
      summary: 'Event stream triggering patient notifications and electronic remittance advice.',
      status: 'healthy',
      position: { x: 740, y: -20 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 2, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    },
    {
      id: 'eventhub-telemetry',
      name: 'Azure Event Hubs: clinical-telemetry',
      type: 'queue',
      category: 'Event Ingestion Stream',
      tech: 'Azure Event Hubs',
      language: 'Kafka / AMQP',
      summary: 'High-volume stream capturing video call quality metrics, packet loss and consultation duration.',
      status: 'healthy',
      position: { x: 740, y: 500 },
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
    }
  ],
  edges: [
    { id: 'e-pat-claim', source: 'patient-portal-api', target: 'claims-engine', type: 'sync-http', label: 'HTTP POST /claims/adjudicate', protocol: 'REST / HTTPS', isCriticalPath: true },
    { id: 'e-pat-tele', source: 'patient-portal-api', target: 'telehealth-signaling', type: 'sync-http', label: 'HTTP POST /rooms/create', protocol: 'REST / HTTPS' },
    { id: 'e-claim-db', source: 'claims-engine', target: 'claims-postgres', type: 'db-readwrite', label: 'JPA Write /claims', protocol: 'PostgreSQL Wire' },
    { id: 'e-claim-sb', source: 'claims-engine', target: 'asb-claims-events', type: 'async-publish', label: 'PUB ClaimApprovedEvent', protocol: 'AMQP 1.0' },
    { id: 'e-tele-redis', source: 'telehealth-signaling', target: 'redis-presence', type: 'db-readwrite', label: 'Redis Room Presence', protocol: 'Redis TCP' },
    { id: 'e-tele-eh', source: 'telehealth-signaling', target: 'eventhub-telemetry', type: 'async-publish', label: 'PUB ConsultationTelemetry', protocol: 'Event Hubs API' }
  ]
};

export const PRESETS: Record<string, ArchitectureGraph> = {
  'fintech-core': PRESET_FINTECH,
  'ecommerce-mesh': PRESET_ECOMMERCE,
  'healthcare-telehealth': PRESET_HEALTHCARE
};
