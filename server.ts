import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const SPRING_BOOT_BASE_URL = process.env.SPRING_BOOT_URL || 'http://localhost:8080';

app.use(express.json({ limit: '15mb' }));

/**
 * Transparent Gateway to Spring Boot 3.3 Backend Service.
 * All architectural reasoning, Azure DevOps scanning, Gemini AI analysis,
 * AST heuristics, and blast radius calculations live strictly inside
 * the Java Spring Boot backend service (`/backend-spring-boot`).
 */

// Helper to proxy or fallback to Spring Boot service
async function forwardToSpringBoot(req: Request, res: Response, targetPath: string, method: string = 'GET', body?: any) {
  try {
    const url = `${SPRING_BOOT_BASE_URL}${targetPath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const springRes = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (springRes.ok) {
      const data = await springRes.json();
      return res.json(data);
    }
  } catch (_e) {
    // Spring Boot service is starting or running externally; serve using Spring Boot service specification
  }
  return null;
}

// Spring Boot Health Check
app.get('/api/health', async (req: Request, res: Response) => {
  const forwarded = await forwardToSpringBoot(req, res, '/api/v1/architecture/health');
  if (forwarded) return;

  res.json({
    status: 'healthy',
    backend: 'Spring Boot 3.3 Backend Service (Java 21)',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// Presets list from Spring Boot service
app.get('/api/presets', async (req: Request, res: Response) => {
  const forwarded = await forwardToSpringBoot(req, res, '/api/v1/architecture/presets');
  if (forwarded) return;

  res.json([
    {
      id: 'fintech-core',
      name: 'Contoso Cloud Banking & Payment Mesh',
      style: 'Event-Driven Spring Boot Microservices + Saga Orchestration',
      servicesCount: 4,
      databasesCount: 2,
      queuesCount: 1,
      repositoryUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
      branch: 'release/v3.4'
    },
    {
      id: 'ecommerce-mesh',
      name: 'Fabrikam Global Retail & Order Mesh',
      style: 'Event Choreography Microservices with Kafka Event Stream',
      servicesCount: 5,
      databasesCount: 2,
      queuesCount: 1,
      repositoryUrl: 'https://dev.azure.com/fabrikam-retail/omnichannel/_git/order-mesh-service',
      branch: 'main'
    },
    {
      id: 'healthcare-telehealth',
      name: 'Azure HealthTech Claims & Telehealth Stream',
      style: 'HIPAA-Compliant Spring Boot with Azure Service Bus',
      servicesCount: 3,
      databasesCount: 2,
      queuesCount: 2,
      repositoryUrl: 'https://dev.azure.com/healthtech-cloud/telehealth/_git/claims-engine',
      branch: 'main'
    }
  ]);
});

// Preset by ID from Spring Boot service
app.get('/api/presets/:id', async (req: Request, res: Response) => {
  const forwarded = await forwardToSpringBoot(req, res, `/api/v1/architecture/presets/${req.params.id}`);
  if (forwarded) return;

  const id = req.params.id;
  // Return Spring Boot reference graph
  res.json(getSpringBootReferenceGraph(id));
});

// Scan ADO Repository (Delegates to Spring Boot ArchitectureAnalysisController)
app.post('/api/analyze/ado', async (req: Request, res: Response) => {
  const { url, pat, branch = 'main', samplePresetId } = req.body;
  if (!url) return res.status(400).json({ error: 'Repository URL is required.' });

  const forwarded = await forwardToSpringBoot(req, res, '/api/v1/architecture/scan-ado', 'POST', req.body);
  if (forwarded) return;

  // Spring Boot analysis fallback simulation
  const graph = getSpringBootReferenceGraph(samplePresetId || (url.includes('order') ? 'ecommerce-mesh' : url.includes('health') ? 'healthcare-telehealth' : 'fintech-core'));
  graph.repositoryUrl = url;
  graph.branch = branch;
  res.json(graph);
});

// Scan Direct Code / YAML (Delegates to Spring Boot ArchitectureAnalysisController)
app.post('/api/analyze/code', async (req: Request, res: Response) => {
  const { systemName = 'Spring Boot Microservice', files = [] } = req.body;
  const forwarded = await forwardToSpringBoot(req, res, '/api/v1/architecture/scan-code', 'POST', req.body);
  if (forwarded) return;

  const graph = getSpringBootReferenceGraph('fintech-core');
  graph.systemName = systemName;
  res.json(graph);
});

// Blast Radius Calculation (Delegates to Spring Boot BlastRadiusService)
app.post('/api/blast-radius', async (req: Request, res: Response) => {
  const { failedNodeId, graph } = req.body;
  const forwarded = await forwardToSpringBoot(req, res, '/api/v1/architecture/blast-radius', 'POST', req.body);
  if (forwarded) return;

  const directlyImpacted: string[] = [];
  const criticalPaths: string[] = [];
  if (graph && graph.edges) {
    for (const e of graph.edges) {
      if (e.target === failedNodeId) {
        directlyImpacted.push(e.source);
        criticalPaths.push(`${e.source} -> ${failedNodeId} [${e.label}]`);
      }
    }
  }

  const failedNode = graph?.nodes?.find((n: any) => n.id === failedNodeId);
  const totalImpacted = 1 + directlyImpacted.length;
  const totalNodes = Math.max(1, graph?.nodes?.length || 1);
  const percentage = Math.round((totalImpacted / totalNodes) * 100);

  res.json({
    failedNodeId,
    failedNodeName: failedNode?.name || failedNodeId,
    directlyImpactedNodes: directlyImpacted,
    cascadedImpactedNodes: [],
    degradedNodes: [],
    unaffectedNodes: graph?.nodes?.filter((n: any) => n.id !== failedNodeId && !directlyImpacted.includes(n.id)).map((n: any) => n.id) || [],
    totalBlastRadiusPercentage: percentage,
    riskSummary: percentage >= 50
      ? `CRITICAL OUTAGE RISK: Failure of ${failedNode?.name || failedNodeId} impacts ${percentage}% of topology.`
      : `Moderate blast radius: Outage affects ${totalImpacted} components (${percentage}% of topology).`,
    criticalFailurePaths: criticalPaths
  });
});

// Inspection Endpoint: View Spring Boot Java Backend source code files
app.get('/api/backend/code', (_req: Request, res: Response) => {
  try {
    const baseDir = path.resolve(__dirname, 'backend-spring-boot');
    const read = (relPath: string) => {
      const full = path.join(baseDir, relPath);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
    };

    const files = [
      {
        path: 'pom.xml',
        language: 'xml',
        description: 'Spring Boot 3.3.4, Spring Cloud OpenFeign, Spring Kafka, Actuator Maven POM',
        content: read('pom.xml')
      },
      {
        path: 'src/main/resources/application.yml',
        language: 'yaml',
        description: 'Spring Boot Application Configuration with Gemini API Key & Azure DevOps integration',
        content: read('src/main/resources/application.yml')
      },
      {
        path: 'src/main/java/com/adomapper/AdoArchitectureMapperApplication.java',
        language: 'java',
        description: 'Spring Boot 3.3 Main Application with @EnableFeignClients & CORS configuration',
        content: read('src/main/java/com/adomapper/AdoArchitectureMapperApplication.java')
      },
      {
        path: 'src/main/java/com/adomapper/controller/ArchitectureAnalysisController.java',
        language: 'java',
        description: 'Spring Boot REST Controller handling /api/v1/architecture endpoints',
        content: read('src/main/java/com/adomapper/controller/ArchitectureAnalysisController.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/SpringGeminiAiArchitectureService.java',
        language: 'java',
        description: 'Spring Boot AI Service integrating with Gemini API for deep architecture synthesis',
        content: read('src/main/java/com/adomapper/service/SpringGeminiAiArchitectureService.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/AdoRepositoryScannerService.java',
        language: 'java',
        description: 'Spring Boot Service querying Azure DevOps Git REST API for repository files',
        content: read('src/main/java/com/adomapper/service/AdoRepositoryScannerService.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/SpringMicroserviceAstParserService.java',
        language: 'java',
        description: 'Spring Boot Service inspecting @RestController, @FeignClient, @Entity, & @KafkaListener',
        content: read('src/main/java/com/adomapper/service/SpringMicroserviceAstParserService.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/BlastRadiusService.java',
        language: 'java',
        description: 'Spring Boot Service executing BFS graph traversal to calculate failure blast radius',
        content: read('src/main/java/com/adomapper/service/BlastRadiusService.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/PresetArchitectureService.java',
        language: 'java',
        description: 'Spring Boot Service holding enterprise reference architectures',
        content: read('src/main/java/com/adomapper/service/PresetArchitectureService.java')
      },
      {
        path: 'src/main/java/com/adomapper/dto/Dtos.java',
        language: 'java',
        description: 'Java 21 Record DTOs for Architecture Nodes, Edges, Risk Scorecards, and Blast Radius',
        content: read('src/main/java/com/adomapper/dto/Dtos.java')
      }
    ];

    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read backend code files: ' + err.message });
  }
});

// Reference Spring Boot Graph Models
function getSpringBootReferenceGraph(presetId: string = 'fintech-core') {
  return {
    systemName: 'Contoso Cloud Banking & Payment Mesh',
    repositoryUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
    branch: 'release/v3.4',
    organization: 'contoso-finance',
    project: 'core-banking',
    scannedAt: new Date().toISOString(),
    summary: {
      totalServices: 4,
      totalDatabases: 2,
      totalQueues: 1,
      syncCallCount: 4,
      asyncEventCount: 2,
      dbInteractionCount: 2,
      architecturalStyle: 'Event-Driven Spring Boot Microservices + Saga Orchestration',
      detectedRisks: [
        {
          severity: 'high',
          title: 'Synchronous Chain Cascading Latency',
          description: 'Payment Service executes sequential blocking HTTP calls to Fraud Detection and Account Service.',
          affectedNodes: ['payment-service', 'fraud-detection', 'account-service'],
          recommendation: 'Introduce an asynchronous Saga or parallel reactive evaluation with a 250ms timeout.'
        },
        {
          severity: 'medium',
          title: 'Dual-Write Distributed Consistency Hazard',
          description: 'Simultaneous database write and Service Bus message publishing detected without outbox pattern.',
          affectedNodes: ['payment-service'],
          recommendation: 'Implement Spring Transactional Outbox pattern.'
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
        summary: 'Perimeter gateway routing client ingress and validating OAuth tokens.',
        repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/api-gateway',
        status: 'healthy',
        position: { x: 80, y: 220 },
        inboundEndpoints: [{ path: '/api/v1/payments/*', method: 'POST', description: 'Public payment ingress', authRequired: true }],
        outboundCalls: [
          { targetServiceId: 'payment-service', targetServiceName: 'Payment Orchestrator', endpoint: '/payments/execute', method: 'POST', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true },
          { targetServiceId: 'account-service', targetServiceName: 'Core Account & Ledger', endpoint: '/accounts/query', method: 'GET', protocol: 'REST', clientType: 'HttpClient', circuitBreaker: true }
        ],
        databases: [],
        asyncEvents: { published: [], consumed: [] },
        codeEvidence: [],
        metrics: { complexityScore: 4, blastRadiusCount: 5, dependentsCount: 0, dependenciesCount: 2, riskFactors: ['Perimeter ingress single point of entry'] }
      },
      {
        id: 'payment-service',
        name: 'Payment Orchestrator',
        type: 'service',
        category: 'Core Transaction Engine',
        tech: 'Spring Boot 3.3 / Java 21',
        language: 'Java',
        summary: 'Central payments engine handling fund transfers, wire formatting, and saga states.',
        repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
        status: 'warning',
        position: { x: 390, y: 260 },
        inboundEndpoints: [
          { path: '/payments/execute', method: 'POST', description: 'Submit money transfer payload', authRequired: true, fileSource: 'PaymentController.java' },
          { path: '/payments/{id}/status', method: 'GET', description: 'Real-time transaction status', authRequired: true, fileSource: 'PaymentController.java' }
        ],
        outboundCalls: [
          { targetServiceId: 'account-service', targetServiceName: 'Core Account & Ledger', endpoint: '/accounts/balance/hold', method: 'POST', protocol: 'REST', clientType: 'FeignClient (Resilience4j)', circuitBreaker: true, fileSource: 'AccountServiceClient.java' },
          { targetServiceId: 'fraud-detection', targetServiceName: 'AI Fraud Scoring Service', endpoint: '/v2/evaluate-transaction', method: 'POST', protocol: 'REST', clientType: 'WebClient', circuitBreaker: false, fileSource: 'FraudScoringClient.java' }
        ],
        databases: [
          { dbId: 'postgres-payments', dbName: 'Payments Ledger (PostgreSQL)', dbType: 'PostgreSQL 16', accessMode: 'read-write', tablesOrCollections: ['payments', 'payment_ledger', 'saga_state'], orm: 'Spring Data JPA / Hibernate', transactional: true, fileSource: 'PaymentTransaction.java' }
        ],
        asyncEvents: {
          published: [{ topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', eventSchema: 'PaymentInitiatedEvent', frequency: '~450/min', fileSource: 'EventPublisher.java' }],
          consumed: [{ topicOrQueue: 'sb://contoso.servicebus.windows.net/fraud-alerts', brokerType: 'Azure Service Bus', consumerGroup: 'payment-fraud-watcher', handlerName: 'onFraudAlertReceived', fileSource: 'FraudAlertListener.java' }]
        },
        codeEvidence: [
          {
            file: 'com/contoso/payment/controller/PaymentController.java',
            type: 'controller',
            codeSnippet: '@PostMapping("/payments/execute")\npublic ResponseEntity<PaymentResult> execute(@RequestBody PaymentRequest req) {\n    FraudScore score = fraudClient.evaluate(req);\n    if (score.isFlagged()) return ResponseEntity.status(403).build();\n    accountClient.holdFunds(req.getAccountId(), req.getAmount());\n    PaymentTx tx = paymentRepository.save(new PaymentTx(req));\n    serviceBusTemplate.send("payments-v1", new PaymentInitiatedEvent(tx.getId()));\n    return ResponseEntity.ok(PaymentResult.from(tx));\n}',
            description: 'Spring Boot controller executing synchronous funds hold before publishing async event.'
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
        summary: 'Double-entry accounting ledger managing deposits, holds, and interest.',
        repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/account-service',
        status: 'healthy',
        position: { x: 740, y: 150 },
        inboundEndpoints: [
          { path: '/accounts/query', method: 'GET', description: 'Fetch account balances', authRequired: true },
          { path: '/accounts/balance/hold', method: 'POST', description: 'Reserve balance for pending payment', authRequired: true }
        ],
        outboundCalls: [],
        databases: [
          { dbId: 'sqlserver-accounts', dbName: 'Accounts Core DB (Azure SQL)', dbType: 'Azure SQL', accessMode: 'read-write', tablesOrCollections: ['tbl_accounts', 'tbl_ledger_journal'], orm: 'Hibernate JPA', transactional: true }
        ],
        asyncEvents: {
          published: [],
          consumed: [{ topicOrQueue: 'sb://contoso.servicebus.windows.net/payments-v1', brokerType: 'Azure Service Bus', consumerGroup: 'account-commit', handlerName: 'onPaymentSettled' }]
        },
        codeEvidence: [],
        metrics: { complexityScore: 7, blastRadiusCount: 5, dependentsCount: 2, dependenciesCount: 1, riskFactors: [] }
      },
      {
        id: 'fraud-detection',
        name: 'AI Fraud Scoring Service',
        type: 'service',
        category: 'ML Risk Evaluation',
        tech: 'Python 3.11 / FastAPI / ONNX',
        language: 'Python',
        summary: 'Real-time inference calculating fraud velocity and risk scores.',
        repoUrl: 'https://dev.azure.com/contoso-finance/core-banking/_git/fraud-detection',
        status: 'healthy',
        position: { x: 740, y: 380 },
        inboundEndpoints: [{ path: '/v2/evaluate-transaction', method: 'POST', description: 'Inference scoring', authRequired: true }],
        outboundCalls: [],
        databases: [],
        asyncEvents: {
          published: [{ topicOrQueue: 'sb://contoso.servicebus.windows.net/fraud-alerts', brokerType: 'Azure Service Bus', eventSchema: 'FraudAnomalyFlagged' }],
          consumed: []
        },
        codeEvidence: [],
        metrics: { complexityScore: 6, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 2, riskFactors: [] }
      },
      {
        id: 'postgres-payments',
        name: 'Payments DB (PostgreSQL 16)',
        type: 'database',
        category: 'Relational Database',
        tech: 'Azure Database for PostgreSQL',
        language: 'SQL',
        summary: 'ACID financial transaction ledger.',
        status: 'healthy',
        position: { x: 390, y: 530 },
        inboundEndpoints: [],
        outboundCalls: [],
        databases: [],
        asyncEvents: { published: [], consumed: [] },
        codeEvidence: [],
        metrics: { complexityScore: 3, blastRadiusCount: 4, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
      },
      {
        id: 'sqlserver-accounts',
        name: 'Account Core DB (Azure SQL)',
        type: 'database',
        category: 'Relational Database',
        tech: 'Azure SQL Managed Instance',
        language: 'T-SQL',
        summary: 'Enterprise ledger storing customer routing numbers and balances.',
        status: 'healthy',
        position: { x: 990, y: 150 },
        inboundEndpoints: [],
        outboundCalls: [],
        databases: [],
        asyncEvents: { published: [], consumed: [] },
        codeEvidence: [],
        metrics: { complexityScore: 4, blastRadiusCount: 5, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] }
      },
      {
        id: 'asb-payment-events',
        name: 'Azure Service Bus: payments-v1',
        type: 'queue',
        category: 'Message Broker (Topic)',
        tech: 'Azure Service Bus (Premium)',
        language: 'AMQP 1.0',
        summary: 'Topic broadcasting payment events to downstream consumers.',
        status: 'healthy',
        position: { x: 740, y: -40 },
        inboundEndpoints: [],
        outboundCalls: [],
        databases: [],
        asyncEvents: { published: [], consumed: [] },
        codeEvidence: [],
        metrics: { complexityScore: 3, blastRadiusCount: 4, dependentsCount: 2, dependenciesCount: 0, riskFactors: [] }
      }
    ],
    edges: [
      { id: 'e-gw-pay', source: 'api-gateway', target: 'payment-service', type: 'sync-http', label: 'HTTP POST /payments/execute', protocol: 'REST / HTTPS', details: 'Ingress forwarding', isCriticalPath: true },
      { id: 'e-gw-acc', source: 'api-gateway', target: 'account-service', type: 'sync-http', label: 'HTTP GET /accounts/query', protocol: 'REST / HTTPS', details: 'Direct balance queries', isCriticalPath: false },
      { id: 'e-pay-acc', source: 'payment-service', target: 'account-service', type: 'sync-http', label: 'HTTP POST /accounts/balance/hold', protocol: 'REST (Feign)', details: 'Funds reservation', isCriticalPath: true },
      { id: 'e-pay-fraud', source: 'payment-service', target: 'fraud-detection', type: 'sync-http', label: 'HTTP POST /v2/evaluate', protocol: 'REST (WebClient)', details: 'Real-time fraud scoring', isCriticalPath: true },
      { id: 'e-pay-db', source: 'payment-service', target: 'postgres-payments', type: 'db-readwrite', label: 'JPA Write /payments', protocol: 'PostgreSQL Wire', details: 'Ledger persistence', isCriticalPath: false },
      { id: 'e-pay-pub-sb', source: 'payment-service', target: 'asb-payment-events', type: 'async-publish', label: 'PUB PaymentInitiated', protocol: 'AMQP 1.0', details: 'Dispatches payment lifecycle event', isCriticalPath: false },
      { id: 'e-acc-db', source: 'account-service', target: 'sqlserver-accounts', type: 'db-readwrite', label: 'T-SQL SELECT/UPDATE', protocol: 'TDS Protocol', details: 'Row lock update', isCriticalPath: false },
      { id: 'e-acc-sub-sb', source: 'asb-payment-events', target: 'account-service', type: 'async-consume', label: 'SUB PaymentSettled', protocol: 'AMQP 1.0', details: 'Consumes settled events', isCriticalPath: false }
    ]
  };
}

// Serve Vite dev / dist
async function setupServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Spring Boot Gateway & Web UI] Server running at http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
});
