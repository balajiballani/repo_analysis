package com.adomapper.service;

import com.adomapper.dto.Dtos.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Spring Boot Service providing enterprise reference architectures
 * for testing and immediate topology exploration.
 */
@Service
public class PresetArchitectureService {

    private final Map<String, ArchitectureGraphDto> presets = new LinkedHashMap<>();

    public PresetArchitectureService() {
        initPresets();
    }

    public List<Map<String, Object>> listPresets() {
        List<Map<String, Object>> list = new ArrayList<>();
        presets.forEach((id, g) -> {
            list.add(Map.of(
                    "id", id,
                    "name", g.systemName(),
                    "style", g.summary().architecturalStyle(),
                    "servicesCount", g.summary().totalServices(),
                    "databasesCount", g.summary().totalDatabases(),
                    "queuesCount", g.summary().totalQueues(),
                    "repositoryUrl", g.repositoryUrl(),
                    "branch", g.branch()
            ));
        });
        return list;
    }

    public Optional<ArchitectureGraphDto> getPreset(String id) {
        return Optional.ofNullable(presets.get(id));
    }

    private void initPresets() {
        // Preset 1: Contoso Core Banking & Payments (Azure DevOps)
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "api-gateway", "Azure API Gateway (YARP)", "gateway", "Reverse Proxy & Auth Perimeter",
                "YARP (.NET 8) / Azure App Service", "C#", "Perimeter gateway routing client ingress and validating OAuth tokens.",
                "https://dev.azure.com/contoso-finance/core-banking/_git/api-gateway", "/Gateway", "healthy",
                List.of(new InboundEndpointDto("/api/v1/payments/*", "POST", "Public payment ingress", true, null, "100 req/sec")),
                List.of(
                        new OutboundCallDto("payment-service", "Payment Orchestrator", "/payments/execute", "POST", "REST", "HttpClient", true, true, 800, null),
                        new OutboundCallDto("account-service", "Core Account & Ledger", "/accounts/query", "GET", "REST", "HttpClient", true, true, 500, null)
                ),
                List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 5, 0, 2, List.of("Perimeter ingress single point of entry")),
                new PositionDto(80, 220)
        );

        ArchitectureNodeDto paymentService = new ArchitectureNodeDto(
                "payment-service", "Payment Orchestrator", "service", "Core Transaction Engine",
                "Spring Boot 3.3 / Java 21", "Java", "Central payments engine handling fund transfers, wire formatting, and saga states.",
                "https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator", "/PaymentService", "warning",
                List.of(
                        new InboundEndpointDto("/payments/execute", "POST", "Submit money transfer payload", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payments/{id}/status", "GET", "Real-time transaction status", true, "PaymentController.java", null)
                ),
                List.of(
                        new OutboundCallDto("account-service", "Core Account & Ledger", "/accounts/balance/hold", "POST", "REST", "FeignClient (Resilience4j)", true, true, 800, "AccountServiceClient.java"),
                        new OutboundCallDto("fraud-detection", "AI Fraud Scoring Service", "/v2/evaluate-transaction", "POST", "REST", "WebClient", false, false, 300, "FraudScoringClient.java")
                ),
                List.of(
                        new DatabaseInteractionDto("postgres-payments", "Payments Ledger (PostgreSQL)", "PostgreSQL 16", "read-write", List.of("payments", "payment_ledger", "saga_state"), "Spring Data JPA / Hibernate", true, "PaymentTransaction.java")
                ),
                new AsyncEventPubSubDto(
                        List.of(
                                new EventPublishedDto("sb://contoso.servicebus.windows.net/payments-v1", "Azure Service Bus", "PaymentInitiatedEvent", "{}", "~450/min", "EventPublisher.java")
                        ),
                        List.of(
                                new EventConsumedDto("sb://contoso.servicebus.windows.net/fraud-alerts", "Azure Service Bus", "payment-fraud-watcher", "onFraudAlertReceived", null, "FraudAlertListener.java")
                        )
                ),
                List.of(
                        new CodeEvidenceDto("com/contoso/payment/controller/PaymentController.java", "controller",
                                "@PostMapping(\"/payments/execute\")\npublic ResponseEntity<PaymentResult> execute(@RequestBody PaymentRequest req) {\n    FraudScore score = fraudClient.evaluate(req);\n    if (score.isFlagged()) return ResponseEntity.status(403).build();\n    accountClient.holdFunds(req.getAccountId(), req.getAmount());\n    PaymentTx tx = paymentRepository.save(new PaymentTx(req));\n    serviceBusTemplate.send(\"payments-v1\", new PaymentInitiatedEvent(tx.getId()));\n    return ResponseEntity.ok(PaymentResult.from(tx));\n}",
                                "Spring Boot controller executing synchronous funds hold before publishing async event."),
                        new CodeEvidenceDto("com/contoso/payment/client/AccountServiceClient.java", "client",
                                "@FeignClient(name = \"account-service\", url = \"${services.account.url}\")\n@CircuitBreaker(name = \"accountServiceCircuit\")\npublic interface AccountServiceClient {\n    @PostMapping(\"/accounts/balance/hold\")\n    HoldResult holdFunds(@RequestParam(\"accountId\") String id, @RequestParam(\"amount\") BigDecimal amount);\n}",
                                "Spring Cloud OpenFeign client with Resilience4j circuit breaker.")
                ),
                new NodeMetricsDto(8, 7, 2, 4, List.of("Cascading failure vulnerability", "Dual-write anomaly")),
                new PositionDto(390, 260)
        );

        ArchitectureNodeDto accountService = new ArchitectureNodeDto(
                "account-service", "Core Account & Ledger", "service", "Banking Core System",
                "Spring Boot 3.3 / Java 21", "Java", "Double-entry accounting ledger managing deposits, holds, and interest.",
                "https://dev.azure.com/contoso-finance/core-banking/_git/account-service", "/AccountService", "healthy",
                List.of(
                        new InboundEndpointDto("/accounts/query", "GET", "Fetch account balances", true, null, null),
                        new InboundEndpointDto("/accounts/balance/hold", "POST", "Reserve balance for pending payment", true, null, null)
                ),
                List.of(),
                List.of(new DatabaseInteractionDto("sqlserver-accounts", "Accounts Core DB (Azure SQL)", "Azure SQL", "read-write", List.of("tbl_accounts", "tbl_ledger_journal"), "Hibernate JPA", true, null)),
                new AsyncEventPubSubDto(List.of(), List.of(new EventConsumedDto("sb://contoso.servicebus.windows.net/payments-v1", "Azure Service Bus", "account-commit", "onPaymentSettled", null, null))),
                List.of(),
                new NodeMetricsDto(7, 5, 2, 1, List.of()),
                new PositionDto(740, 150)
        );

        ArchitectureNodeDto fraudService = new ArchitectureNodeDto(
                "fraud-detection", "AI Fraud Scoring Service", "service", "ML Risk Evaluation",
                "Python 3.11 / FastAPI / ONNX", "Python", "Real-time inference calculating fraud velocity and risk scores.",
                "https://dev.azure.com/contoso-finance/core-banking/_git/fraud-detection", "/FraudEngine", "healthy",
                List.of(new InboundEndpointDto("/v2/evaluate-transaction", "POST", "Inference scoring", true, null, null)),
                List.of(),
                List.of(new DatabaseInteractionDto("mongo-fraud-features", "Feature Store (Cosmos DB)", "Azure Cosmos DB", "read-write", List.of("device_fingerprints", "ip_reputation"), "PyMongo", false, null)),
                new AsyncEventPubSubDto(List.of(new EventPublishedDto("sb://contoso.servicebus.windows.net/fraud-alerts", "Azure Service Bus", "FraudAnomalyFlagged", "{}", "~8/hr", null)), List.of()),
                List.of(),
                new NodeMetricsDto(6, 3, 1, 2, List.of()),
                new PositionDto(740, 380)
        );

        ArchitectureNodeDto postgresPayments = new ArchitectureNodeDto(
                "postgres-payments", "Payments DB (PostgreSQL 16)", "database", "Relational Database",
                "Azure Database for PostgreSQL", "SQL", "ACID financial transaction ledger.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 1, 0, List.of()), new PositionDto(390, 530)
        );

        ArchitectureNodeDto sqlAccounts = new ArchitectureNodeDto(
                "sqlserver-accounts", "Account Core DB (Azure SQL)", "database", "Relational Database",
                "Azure SQL Managed Instance", "T-SQL", "Enterprise ledger storing customer routing numbers and balances.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 5, 1, 0, List.of()), new PositionDto(990, 150)
        );

        ArchitectureNodeDto asbPaymentEvents = new ArchitectureNodeDto(
                "asb-payment-events", "Azure Service Bus: payments-v1", "queue", "Message Broker (Topic)",
                "Azure Service Bus (Premium)", "AMQP 1.0", "Topic broadcasting payment events to downstream consumers.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 2, 0, List.of()), new PositionDto(740, -40)
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-gw-pay", "api-gateway", "payment-service", "sync-http", "HTTP POST /payments/execute", "REST / HTTPS", "Ingress forwarding", null, true),
                new ArchitectureEdgeDto("e-gw-acc", "api-gateway", "account-service", "sync-http", "HTTP GET /accounts/query", "REST / HTTPS", "Direct balance queries", null, false),
                new ArchitectureEdgeDto("e-pay-acc", "payment-service", "account-service", "sync-http", "HTTP POST /accounts/balance/hold", "REST (Feign)", "Funds reservation", null, true),
                new ArchitectureEdgeDto("e-pay-fraud", "payment-service", "fraud-detection", "sync-http", "HTTP POST /v2/evaluate", "REST (WebClient)", "Real-time fraud scoring", null, true),
                new ArchitectureEdgeDto("e-pay-db", "payment-service", "postgres-payments", "db-readwrite", "JPA Write /payments", "PostgreSQL Wire", "Ledger persistence", null, false),
                new ArchitectureEdgeDto("e-pay-pub-sb", "payment-service", "asb-payment-events", "async-publish", "PUB PaymentInitiated", "AMQP 1.0", "Dispatches payment lifecycle event", null, false),
                new ArchitectureEdgeDto("e-acc-db", "account-service", "sqlserver-accounts", "db-readwrite", "T-SQL SELECT/UPDATE", "TDS Protocol", "Row lock update", null, false),
                new ArchitectureEdgeDto("e-acc-sub-sb", "asb-payment-events", "account-service", "async-consume", "SUB PaymentSettled", "AMQP 1.0", "Consumes settled events", null, false)
        );

        GraphSummaryDto summary = new GraphSummaryDto(
                4, 2, 1, 4, 2, 2, "Event-Driven Spring Boot Microservices + Saga Orchestration",
                List.of(
                        new ArchitecturalRiskDto("high", "Synchronous Chain Cascading Latency",
                                "Payment Service executes sequential blocking HTTP calls to Fraud Detection and Account Service.",
                                List.of("payment-service", "fraud-detection", "account-service"),
                                "Introduce an asynchronous Saga or parallel reactive evaluation with a 250ms timeout."),
                        new ArchitecturalRiskDto("medium", "Dual-Write Distributed Consistency Hazard",
                                "Simultaneous database write and Service Bus message publishing detected without outbox pattern.",
                                List.of("payment-service"),
                                "Implement Spring Transactional Outbox pattern.")
                )
        );

        presets.put("fintech-core", new ArchitectureGraphDto(
                "Contoso Cloud Banking & Payment Mesh",
                "https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator",
                "release/v3.4", "contoso-finance", "core-banking",
                Instant.now().toString(),
                List.of(gateway, paymentService, accountService, fraudService, postgresPayments, sqlAccounts, asbPaymentEvents),
                edges,
                summary
        ));
    }
}
