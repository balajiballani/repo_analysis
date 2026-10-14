package com.adomapper.service;

import com.adomapper.dto.Dtos.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Spring Boot Service providing enterprise reference architectures,
 * dynamic internal microservice models (e.g. payment-service, product-service,
 * order-service, auth-service, inventory-service), and Azure Cloud migration roadmaps.
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
        if (id == null) return Optional.empty();
        return Optional.ofNullable(presets.get(id.toLowerCase()));
    }

    public Optional<ArchitectureGraphDto> matchMicroservicePreset(String subPathOrRepo, String url, boolean isGithub) {
        if (subPathOrRepo == null) return Optional.empty();
        String lower = subPathOrRepo.toLowerCase();

        String key = null;
        if (lower.contains("payment")) {
            key = "ecommerce-payment";
        } else if (lower.contains("product")) {
            key = "ecommerce-product";
        } else if (lower.contains("order")) {
            key = "ecommerce-order";
        } else if (lower.contains("auth")) {
            key = "ecommerce-auth";
        } else if (lower.contains("inventory")) {
            key = "ecommerce-inventory";
        } else if (lower.contains("contoso") || lower.contains("banking")) {
            key = "fintech-core";
        } else if (lower.contains("fabrikam") || lower.contains("mesh")) {
            key = "ecommerce-mesh";
        }

        if (key != null && presets.containsKey(key)) {
            ArchitectureGraphDto base = presets.get(key);
            String provider = isGithub ? "github" : "azure";
            String sysName = isGithub ? base.systemName() : base.systemName() + " (Azure DevOps Migration Target)";
            return Optional.of(new ArchitectureGraphDto(
                    sysName,
                    url != null && !url.isBlank() ? url : base.repositoryUrl(),
                    base.branch(),
                    base.organization(),
                    base.project(),
                    Instant.now().toString(),
                    provider,
                    base.nodes(),
                    base.edges(),
                    base.summary()
            ));
        }

        return Optional.empty();
    }

    private void initPresets() {
        initFintechPreset();
        initEcommercePaymentPreset();
        initEcommerceProductPreset();
        initEcommerceOrderPreset();
        initEcommerceAuthPreset();
        initEcommerceInventoryPreset();
        initFabrikamMeshPreset();
    }

    private void initFintechPreset() {
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
                new PositionDto(80, 220),
                new AzureCloudDto("Azure API Management (Consumption Tier)", "APIM Ingress", "Azure Redis Cache", "Azure Service Bus", "Microsoft Entra ID", "Azure Key Vault", "Application Insights", 95, List.of("Deploy APIM instance with Managed Identity"))
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
                new PositionDto(390, 260),
                new AzureCloudDto("Azure Container Apps (ACA) / Azure Spring Apps", "Azure API Management", "Azure Database for PostgreSQL - Flexible Server", "Azure Service Bus Premium", "Microsoft Entra ID Managed Identity", "Azure Key Vault", "Application Insights", 92, List.of("Containerize Spring Boot JAR with openjdk:21-alpine", "Provision Azure PostgreSQL Flexible Server"))
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
                List.of(new DatabaseInteractionDto("sqlserver-accounts", "Azure SQL Database", "SQL Server 2022", "read-write", List.of("accounts", "ledger_journal"), "Spring Data JPA", true, null)),
                new AsyncEventPubSubDto(List.of(), List.of(new EventConsumedDto("sb://contoso.servicebus.windows.net/payments-v1", "Azure Service Bus", "account-settlement", "processSettlement", null, null))),
                List.of(),
                new NodeMetricsDto(5, 6, 2, 1, List.of("High fan-in critical ledger")),
                new PositionDto(740, 120),
                new AzureCloudDto("Azure Container Apps (ACA)", "APIM", "Azure SQL Managed Instance", "Azure Service Bus", "Microsoft Entra ID", "Azure Key Vault", "Application Insights", 90, List.of("Connect with Spring Cloud Azure Starter"))
        );

        ArchitectureNodeDto fraudService = new ArchitectureNodeDto(
                "fraud-detection", "AI Fraud Scoring Service", "service", "Machine Learning Scoring",
                "Python FastAPI / Azure ML", "Python", "Low-latency inference pipeline detecting anomalous card and account transactions.",
                "https://dev.azure.com/contoso-finance/core-banking/_git/fraud-scoring", "/ml", "healthy",
                List.of(new InboundEndpointDto("/v2/evaluate-transaction", "POST", "Calculate risk score (0-100)", false, null, "500 req/sec")),
                List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 1, 0, List.of()), new PositionDto(740, 420),
                new AzureCloudDto("Azure Machine Learning Managed Online Endpoints", "APIM", "Azure Cosmos DB", null, "Entra ID", "Key Vault", "Application Insights", 98, List.of())
        );

        ArchitectureNodeDto postgresPayments = new ArchitectureNodeDto(
                "postgres-payments", "Azure Database for PostgreSQL", "database", "Relational Persistence",
                "PostgreSQL 16", "SQL", "High-throughput relational storage with multi-AZ failover for payment ledger.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 5, 1, 0, List.of()), new PositionDto(390, 560),
                new AzureCloudDto("Azure Database for PostgreSQL - Flexible Server", null, "Zone-Redundant HA", null, "Entra ID Auth", "Key Vault", "Azure Monitor", 99, List.of())
        );

        ArchitectureNodeDto sqlAccounts = new ArchitectureNodeDto(
                "sqlserver-accounts", "Azure SQL Database", "database", "Relational Ledger",
                "Azure SQL / TDS", "SQL", "Compliant double-entry journal with strict ACID durability.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 6, 1, 0, List.of()), new PositionDto(1060, 120),
                new AzureCloudDto("Azure SQL Database Hyperscale", null, "Geo-Replicated", null, "Entra ID Auth", "Key Vault", "Azure Monitor", 99, List.of())
        );

        ArchitectureNodeDto asbPaymentEvents = new ArchitectureNodeDto(
                "asb-payment-events", "Azure Service Bus", "queue", "Enterprise Messaging",
                "Azure Service Bus (Topic: payments-v1)", "AMQP 1.0", "Publish-subscribe event backbone guaranteeing at-least-once delivery with dead-letter queueing.",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 2, 0, List.of()), new PositionDto(740, -40),
                new AzureCloudDto("Azure Service Bus Premium Tier", null, null, "Geo-Disaster Recovery", "Entra ID RBAC", "Key Vault", "Azure Monitor", 100, List.of())
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
                "azure",
                List.of(gateway, paymentService, accountService, fraudService, postgresPayments, sqlAccounts, asbPaymentEvents),
                edges,
                summary
        ));
    }

    private void initEcommercePaymentPreset() {
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "api-gateway", "API Gateway (Spring Cloud Gateway)", "gateway", "Perimeter Proxy",
                "Spring Cloud Gateway (Port 8080)", "Java", "Perimeter gateway routing inbound public requests to payment-service",
                null, null, "healthy",
                List.of(new InboundEndpointDto("/payment/**", "GET", "Public ingress route", false, null, "100 req/sec")),
                List.of(new OutboundCallDto("payment-service", "Payment Service", "/payment/api/payments/**", "POST", "REST", "Gateway Route", false, false, 1000, null)),
                List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 0, 1, List.of()), new PositionDto(70, 220),
                new AzureCloudDto("Azure API Management (APIM)", "APIM Ingress", null, null, "Microsoft Entra ID", "Azure Key Vault", "Application Insights", 95, List.of("Replace Spring Cloud Gateway with Azure API Management"))
        );

        ArchitectureNodeDto paymentService = new ArchitectureNodeDto(
                "payment-service", "Payment Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8085)", "Java 21", "Payment service scanned from payment-service subfolder, handles payments, orders lookup, and user authorization",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/payment-service", "/payment-service", "healthy",
                List.of(
                        new InboundEndpointDto("/payment/api/payments", "GET", "Find all payments (ADMIN)", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments/all", "GET", "Paginated payments (ADMIN)", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments/{paymentId}", "GET", "Fetch payment by ID", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments/getOrder/{orderId}", "GET", "Fetch order payload for payment", false, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments", "POST", "Save payment record", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments", "PUT", "Update payment record (ADMIN)", true, "PaymentController.java", null),
                        new InboundEndpointDto("/payment/api/payments/{paymentId}", "DELETE", "Delete payment record", true, "PaymentController.java", null)
                ),
                List.of(
                        new OutboundCallDto("order-service", "Order Service", "/api/orders/{id}", "GET", "REST", "Spring RestClient", false, false, 800, "PaymentServiceImpl.java"),
                        new OutboundCallDto("auth-service", "Auth Service", "/api/manager/user/{id}", "GET", "REST", "Spring RestClient", false, false, 600, "PaymentServiceImpl.java")
                ),
                List.of(
                        new DatabaseInteractionDto("paymentservice-db", "paymentservice (PostgreSQL)", "PostgreSQL 16", "ReadWrite", List.of("payments"), "Spring Data JPA / Hibernate", true, "Payment.java")
                ),
                new AsyncEventPubSubDto(
                        List.of(new EventPublishedDto("profileOnboarding", "Kafka", "KafkaPaymentDto", "{}", "on payment created", "KafkaProducer.java")),
                        List.of(new EventConsumedDto("profileOnboarded", "Kafka", "payment-group", "EventConsumer", null, "KafkaConsumer.java"))
                ),
                List.of(
                        new CodeEvidenceDto("payment-service/src/main/java/com/ecommerce/paymentservice/controller/PaymentController.java", "controller",
                                "@RequiredArgsConstructor\n@RestController\n@RequestMapping(\"/api/payments\")\npublic class PaymentController {\n    private final PaymentService paymentService;\n    @GetMapping\n    public ResponseEntity<List<PaymentDto>> findAll() { ... }", "PaymentController REST endpoint handler"),
                        new CodeEvidenceDto("payment-service/src/main/resources/application.yml", "config",
                                "server:\n  port: 8085\nspring:\n  datasource:\n    url: jdbc:postgresql://localhost:5432/paymentservice", "Spring Boot configuration")
                ),
                new NodeMetricsDto(6, 4, 1, 3, List.of("Inter-service dependency on order-service and auth-service")),
                new PositionDto(390, 220),
                new AzureCloudDto("Azure Container Apps (ACA) / Azure Spring Apps", "Azure API Management", "Azure Database for PostgreSQL - Flexible Server", "Azure Event Hubs (Kafka protocol endpoint)", "Microsoft Entra ID / Keycloak", "Azure Key Vault", "Application Insights", 94, List.of("Deploy container to Azure Container Apps with KEDA Kafka scaler", "Provision Azure PostgreSQL Flexible Server"))
        );

        ArchitectureNodeDto paymentDb = new ArchitectureNodeDto(
                "paymentservice-db", "paymentservice (PostgreSQL 16)", "database", "Relational Database",
                "PostgreSQL 16", "SQL", "PostgreSQL database storing payments records for payment-service",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 3, 1, 0, List.of()), new PositionDto(390, 520),
                new AzureCloudDto("Azure Database for PostgreSQL - Flexible Server", null, "Zone Redundancy", null, "Entra ID", "Key Vault", "Azure Monitor", 99, List.of())
        );

        ArchitectureNodeDto orderService = new ArchitectureNodeDto(
                "order-service", "Order Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8082)", "Java 21", "Order placement and fulfillment microservice",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(5, 4, 1, 1, List.of()), new PositionDto(740, 100),
                new AzureCloudDto("Azure Container Apps", "APIM", "Azure PostgreSQL", "Azure Event Hubs", "Entra ID", "Key Vault", "Application Insights", 92, List.of())
        );

        ArchitectureNodeDto authService = new ArchitectureNodeDto(
                "auth-service", "Auth Service", "service", "Security & IAM Microservice",
                "Spring Boot 3.3 (Port 8081)", "Java 21", "Authentication and user token management service",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 5, 1, 0, List.of()), new PositionDto(740, 340),
                new AzureCloudDto("Azure Container Apps / Microsoft Entra External ID", "APIM", "Azure Database for MySQL", null, "Entra ID", "Key Vault", "Application Insights", 90, List.of())
        );

        ArchitectureNodeDto kafka = new ArchitectureNodeDto(
                "kafka-broker", "Apache Kafka (Confluent)", "queue", "Message Streaming Broker",
                "Kafka 3.7", "TCP / Kafka Protocol", "Event streaming topic: profileOnboarding and profileOnboarded",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 3, 2, 0, List.of()), new PositionDto(390, -40),
                new AzureCloudDto("Azure Event Hubs (Kafka 1.0+ compatibility)", null, null, "Multi-partition Event Hub", "Entra ID", "Key Vault", "Azure Monitor", 98, List.of("Direct drop-in replacement with Azure Event Hubs connection string"))
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-gw-pay", "api-gateway", "payment-service", "gateway-route", "Route /payment/api/**", "HTTPS / REST", "Ingress", null, true),
                new ArchitectureEdgeDto("e-pay-order", "payment-service", "order-service", "sync-http", "GET /api/orders/{id}", "REST / HTTP", "Fetch order details for payment", null, false),
                new ArchitectureEdgeDto("e-pay-auth", "payment-service", "auth-service", "sync-http", "GET /api/manager/user/{id}", "REST / HTTP", "Validate user authority", null, false),
                new ArchitectureEdgeDto("e-pay-db", "payment-service", "paymentservice-db", "db-readwrite", "JPA CRUD [payments]", "PostgreSQL Wire", "Ledger persistence", null, false),
                new ArchitectureEdgeDto("e-pay-pub-kafka", "payment-service", "kafka-broker", "async-publish", "PUB profileOnboarding", "Kafka TCP", "Publish payment onboarded event", null, false),
                new ArchitectureEdgeDto("e-kafka-sub-pay", "kafka-broker", "payment-service", "async-consume", "SUB profileOnboarded", "Kafka TCP", "Consume confirmation", null, false)
        );

        GraphSummaryDto summary = new GraphSummaryDto(
                4, 1, 1, 3, 2, 1, "Spring Boot Microservice with REST and Kafka Pub/Sub",
                List.of(
                        new ArchitecturalRiskDto("medium", "Synchronous HTTP Dependency on Order and Auth",
                                "Payment Service calls Order Service and Auth Service synchronously via RestClient without circuit breaker.",
                                List.of("payment-service", "order-service", "auth-service"),
                                "Wrap outbound RestClient calls in Resilience4j @CircuitBreaker with fallback.")
                )
        );

        presets.put("ecommerce-payment", new ArchitectureGraphDto(
                "Payment Service Architecture (ecommerce-microservices/payment-service)",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/payment-service",
                "main", "hoangtien2k3", "ecommerce-microservices",
                Instant.now().toString(), "github",
                List.of(gateway, paymentService, paymentDb, orderService, authService, kafka),
                edges,
                summary
        ));
    }

    private void initEcommerceProductPreset() {
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "api-gateway", "API Gateway (Spring Cloud Gateway)", "gateway", "Perimeter Proxy",
                "Spring Cloud Gateway (Port 8080)", "Java", "Perimeter gateway routing inbound public catalog requests to product-service",
                null, null, "healthy",
                List.of(new InboundEndpointDto("/product/**", "GET", "Catalog ingress route", false, null, "100 req/sec")),
                List.of(new OutboundCallDto("product-service", "Product Service", "/product/api/**", "POST", "REST", "Gateway Route", false, false, 1000, null)),
                List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 3, 0, 1, List.of()), new PositionDto(70, 220),
                new AzureCloudDto("Azure API Management (APIM)", "APIM Ingress", null, null, "Microsoft Entra ID", "Azure Key Vault", "Application Insights", 95, List.of())
        );

        ArchitectureNodeDto productService = new ArchitectureNodeDto(
                "product-service", "Product Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8086)", "Java 21", "Core catalogue microservice managing products and categories, secured by Keycloak JWT OAuth2",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/product-service", "/product-service", "healthy",
                List.of(
                        new InboundEndpointDto("/product/api/products", "GET", "Find all products", false, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/products/{productId}", "GET", "Find product by ID", false, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/products", "POST", "Create new product", true, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/products/{productId}", "PUT", "Update product", true, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/products/{productId}", "DELETE", "Delete product", true, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/categories", "GET", "Find all categories", false, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/categories/{categoryId}", "GET", "Find category by ID", false, "ProductController.java", null),
                        new InboundEndpointDto("/product/api/categories", "POST", "Create new category", true, "ProductController.java", null)
                ),
                List.of(),
                List.of(new DatabaseInteractionDto("productservice-db", "productservice (PostgreSQL 16)", "PostgreSQL 16", "ReadWrite", List.of("products", "categories"), "Spring Data JPA / Liquibase", true, "Product.java")),
                new AsyncEventPubSubDto(List.of(), List.of()),
                List.of(
                        new CodeEvidenceDto("product-service/src/main/java/com/ecommerce/productservice/controller/ProductController.java", "controller",
                                "@RequiredArgsConstructor\n@RestController\n@RequestMapping(\"/api/products\")\npublic class ProductController {\n    private final ProductService productService;\n    @GetMapping\n    public ResponseEntity<List<ProductDto>> findAll() { ... }", "ProductController exposing /api/products endpoints"),
                        new CodeEvidenceDto("product-service/src/main/resources/application.yml", "config",
                                "server:\n  port: 8086\nspring:\n  datasource:\n    url: jdbc:postgresql://localhost:5432/productservice\n  liquibase:\n    enabled: true", "Spring Boot configuration")
                ),
                new NodeMetricsDto(5, 3, 2, 1, List.of()), new PositionDto(390, 220),
                new AzureCloudDto("Azure Container Apps (ACA) / AKS", "Azure API Management", "Azure Database for PostgreSQL - Flexible Server", null, "Microsoft Entra ID / Keycloak", "Azure Key Vault", "Application Insights", 96, List.of("Deploy product-service container to Azure Container Apps with HTTP scaling rules", "Run Liquibase schema migrations against Azure Database for PostgreSQL Flexible Server"))
        );

        ArchitectureNodeDto productDb = new ArchitectureNodeDto(
                "productservice-db", "productservice (PostgreSQL 16)", "database", "Relational Database",
                "PostgreSQL 16 + Liquibase", "SQL", "PostgreSQL relational persistence for product catalogues and taxonomy (tables: products, categories)",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 2, 1, 0, List.of()), new PositionDto(390, 530),
                new AzureCloudDto("Azure Database for PostgreSQL - Flexible Server", null, "Flexible Server with zone-redundancy", null, "Entra ID", "Key Vault", "Azure Monitor", 99, List.of())
        );

        ArchitectureNodeDto keycloakAuth = new ArchitectureNodeDto(
                "keycloak-auth", "Keycloak IAM (OAuth2 / OIDC)", "service", "Identity Provider",
                "Keycloak OAuth2 JWT", "OIDC / JWT", "Identity provider validating Bearer tokens for product catalogue mutations",
                null, null, "healthy",
                List.of(new InboundEndpointDto("/realms/ecommerce/protocol/openid-connect/certs", "GET", "JWKS Keyset", false, null, null)),
                List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 3, 1, 0, List.of()), new PositionDto(740, 220),
                new AzureCloudDto("Microsoft Entra ID / Keycloak on ACA", "APIM", null, null, "Entra ID B2C", "Key Vault", "Application Insights", 95, List.of())
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-gw-prod", "api-gateway", "product-service", "gateway-route", "Route /product/api/**", "HTTPS / REST", "Catalog Ingress", null, true),
                new ArchitectureEdgeDto("e-prod-db", "product-service", "productservice-db", "db-readwrite", "JPA CRUD [products, categories]", "PostgreSQL Wire", "Catalog schema", null, false),
                new ArchitectureEdgeDto("e-prod-auth", "product-service", "keycloak-auth", "sync-http", "JWT Validation (JWKS)", "OAuth2 / HTTPS", "Security perimeter", null, false)
        );

        GraphSummaryDto summary = new GraphSummaryDto(
                3, 1, 0, 2, 0, 1, "Spring Boot 3 + PostgreSQL + Liquibase + OAuth2 Keycloak",
                List.of(
                        new ArchitecturalRiskDto("low", "Cache Aside Pattern Recommended for Product Catalog",
                                "Product queries hit PostgreSQL directly without a Redis second-level cache tier, which may cause DB read spikes during flash sales.",
                                List.of("product-service", "productservice-db"),
                                "Introduce Azure Managed Redis cache with Spring Cache @Cacheable on ProductService.findAll() and findById().")
                )
        );

        presets.put("ecommerce-product", new ArchitectureGraphDto(
                "Product Service Architecture (ecommerce-microservices/product-service)",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/product-service",
                "main", "hoangtien2k3", "ecommerce-microservices",
                Instant.now().toString(), "github",
                List.of(gateway, productService, productDb, keycloakAuth),
                edges,
                summary
        ));
    }

    private void initEcommerceOrderPreset() {
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "api-gateway", "API Gateway", "gateway", "Perimeter Proxy",
                "Spring Cloud Gateway (Port 8080)", "Java", "Gateway routing /order/**",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 0, 1, List.of()), new PositionDto(70, 220),
                new AzureCloudDto("Azure API Management", "APIM", null, null, "Entra ID", "Key Vault", "Application Insights", 95, List.of())
        );

        ArchitectureNodeDto orderService = new ArchitectureNodeDto(
                "order-service", "Order Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8082)", "Java 21", "Order intake, state machine, and inventory allocation",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/order-service", "/order-service", "healthy",
                List.of(
                        new InboundEndpointDto("/order/api/orders", "POST", "Place new customer order", true, "OrderController.java", null),
                        new InboundEndpointDto("/order/api/orders/{id}", "GET", "Fetch order details and fulfillment status", true, "OrderController.java", null)
                ),
                List.of(
                        new OutboundCallDto("inventory-service", "Inventory Service", "/api/inventory/reserve", "POST", "REST", "RestClient", true, true, 800, null)
                ),
                List.of(new DatabaseInteractionDto("orderservice-db", "orderservice (PostgreSQL 16)", "PostgreSQL 16", "ReadWrite", List.of("orders", "order_items"), "Spring Data JPA", true, null)),
                new AsyncEventPubSubDto(
                        List.of(new EventPublishedDto("order-placed-topic", "Kafka", "OrderPlacedEvent", "{}", "on order place", null)),
                        List.of()
                ),
                List.of(),
                new NodeMetricsDto(6, 5, 1, 2, List.of()), new PositionDto(390, 220),
                new AzureCloudDto("Azure Container Apps (ACA)", "APIM", "Azure Database for PostgreSQL", "Azure Event Hubs", "Entra ID", "Key Vault", "Application Insights", 93, List.of())
        );

        ArchitectureNodeDto orderDb = new ArchitectureNodeDto(
                "orderservice-db", "orderservice (PostgreSQL 16)", "database", "Relational Database",
                "PostgreSQL 16", "SQL", "Storage for orders and order lines",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 3, 1, 0, List.of()), new PositionDto(390, 520),
                new AzureCloudDto("Azure Database for PostgreSQL - Flexible Server", null, null, null, "Entra ID", "Key Vault", "Azure Monitor", 99, List.of())
        );

        ArchitectureNodeDto inventoryService = new ArchitectureNodeDto(
                "inventory-service", "Inventory Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8083)", "Java 21", "Stock balance and reservations",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(4, 4, 1, 1, List.of()), new PositionDto(740, 220),
                new AzureCloudDto("Azure Container Apps", "APIM", "Azure Database for PostgreSQL", null, "Entra ID", "Key Vault", "Application Insights", 94, List.of())
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-gw-ord", "api-gateway", "order-service", "gateway-route", "Route /order/api/**", "HTTPS", "Ingress", null, true),
                new ArchitectureEdgeDto("e-ord-db", "order-service", "orderservice-db", "db-readwrite", "JPA CRUD [orders]", "PostgreSQL Wire", "Persistence", null, false),
                new ArchitectureEdgeDto("e-ord-inv", "order-service", "inventory-service", "sync-http", "POST /api/inventory/reserve", "REST / HTTP", "Reserve stock", null, true)
        );

        GraphSummaryDto summary = new GraphSummaryDto(
                3, 1, 1, 2, 1, 1, "Spring Boot Microservice with Inventory Reservation",
                List.of(
                        new ArchitecturalRiskDto("high", "Inventory Service Outage Blocks Order Checkout",
                                "Synchronous dependency between Order Service and Inventory Service without fallback.",
                                List.of("order-service", "inventory-service"),
                                "Use Saga pattern or asynchronous reservation queue.")
                )
        );

        presets.put("ecommerce-order", new ArchitectureGraphDto(
                "Order Service Architecture (ecommerce-microservices/order-service)",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/order-service",
                "main", "hoangtien2k3", "ecommerce-microservices",
                Instant.now().toString(), "github",
                List.of(gateway, orderService, orderDb, inventoryService),
                edges,
                summary
        ));
    }

    private void initEcommerceAuthPreset() {
        ArchitectureNodeDto authService = new ArchitectureNodeDto(
                "auth-service", "Auth Service", "service", "Security & IAM Microservice",
                "Spring Boot 3.3 (Port 8081)", "Java 21", "User registration, authentication, JWT tokens and BCrypt encryption",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/auth-service", "/auth-service", "healthy",
                List.of(
                        new InboundEndpointDto("/auth/api/authenticate", "POST", "Issue JWT bearer token", false, "AuthenticationController.java", null),
                        new InboundEndpointDto("/auth/api/register", "POST", "Register new customer or manager", false, "AuthenticationController.java", null)
                ),
                List.of(),
                List.of(new DatabaseInteractionDto("authservice-db", "authservice (MySQL 8)", "MySQL 8", "ReadWrite", List.of("users", "roles", "user_roles"), "Spring Data JPA", true, null)),
                new AsyncEventPubSubDto(List.of(), List.of()),
                List.of(),
                new NodeMetricsDto(5, 6, 3, 0, List.of()), new PositionDto(390, 220),
                new AzureCloudDto("Azure Container Apps / Microsoft Entra External ID", "APIM", "Azure Database for MySQL - Flexible Server", null, "Entra ID", "Key Vault", "Application Insights", 92, List.of())
        );

        ArchitectureNodeDto authDb = new ArchitectureNodeDto(
                "authservice-db", "authservice (MySQL 8)", "database", "Relational Database",
                "MySQL 8", "SQL", "User credentials and bcrypt salted hashes",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 3, 1, 0, List.of()), new PositionDto(390, 520),
                new AzureCloudDto("Azure Database for MySQL - Flexible Server", null, null, null, "Entra ID", "Key Vault", "Azure Monitor", 99, List.of())
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-auth-db", "auth-service", "authservice-db", "db-readwrite", "JPA CRUD [users, roles]", "MySQL Wire", "Credential persistence", null, false)
        );

        presets.put("ecommerce-auth", new ArchitectureGraphDto(
                "Auth Service Architecture (ecommerce-microservices/auth-service)",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/auth-service",
                "main", "hoangtien2k3", "ecommerce-microservices",
                Instant.now().toString(), "github",
                List.of(authService, authDb),
                edges,
                new GraphSummaryDto(1, 1, 0, 0, 0, 1, "Spring Security + MySQL", List.of())
        ));
    }

    private void initEcommerceInventoryPreset() {
        ArchitectureNodeDto invService = new ArchitectureNodeDto(
                "inventory-service", "Inventory Service", "service", "Spring Boot Microservice",
                "Spring Boot 3.3 (Port 8083)", "Java 21", "Warehouse stock tracker and allocation management",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/inventory-service", "/inventory-service", "healthy",
                List.of(
                        new InboundEndpointDto("/inventory/api/inventory/{sku}", "GET", "Check stock level", false, "InventoryController.java", null),
                        new InboundEndpointDto("/inventory/api/inventory/reserve", "POST", "Hold items for checkout", true, "InventoryController.java", null)
                ),
                List.of(),
                List.of(new DatabaseInteractionDto("inventory-db", "inventory (PostgreSQL 16)", "PostgreSQL 16", "ReadWrite", List.of("inventory", "warehouse_bins"), "Spring Data JPA", true, null)),
                new AsyncEventPubSubDto(List.of(), List.of(new EventConsumedDto("order-placed-topic", "Kafka", "inventory-group", "handleOrderPlaced", null, null))),
                List.of(),
                new NodeMetricsDto(4, 4, 1, 0, List.of()), new PositionDto(390, 220),
                new AzureCloudDto("Azure Container Apps", "APIM", "Azure Database for PostgreSQL", "Azure Event Hubs", "Entra ID", "Key Vault", "Application Insights", 95, List.of())
        );

        ArchitectureNodeDto invDb = new ArchitectureNodeDto(
                "inventory-db", "inventory (PostgreSQL 16)", "database", "Relational Database",
                "PostgreSQL 16", "SQL", "Real-time SKU quantities",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 2, 1, 0, List.of()), new PositionDto(390, 520),
                new AzureCloudDto("Azure Database for PostgreSQL - Flexible Server", null, null, null, "Entra ID", "Key Vault", "Azure Monitor", 99, List.of())
        );

        List<ArchitectureEdgeDto> edges = List.of(
                new ArchitectureEdgeDto("e-inv-db", "inventory-service", "inventory-db", "db-readwrite", "JPA CRUD [inventory]", "PostgreSQL Wire", "Stock persistence", null, false)
        );

        presets.put("ecommerce-inventory", new ArchitectureGraphDto(
                "Inventory Service Architecture (ecommerce-microservices/inventory-service)",
                "https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/inventory-service",
                "main", "hoangtien2k3", "ecommerce-microservices",
                Instant.now().toString(), "github",
                List.of(invService, invDb),
                edges,
                new GraphSummaryDto(1, 1, 1, 0, 1, 1, "Spring Boot Microservice + PostgreSQL + Kafka", List.of())
        ));
    }

    private void initFabrikamMeshPreset() {
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "api-gateway", "Fabrikam Gateway (APIM)", "gateway", "Reverse Proxy",
                "Azure API Management", "Cloud Native", "Perimeter gateway",
                null, null, "healthy", List.of(), List.of(), List.of(), new AsyncEventPubSubDto(List.of(), List.of()), List.of(),
                new NodeMetricsDto(3, 4, 0, 1, List.of()), new PositionDto(70, 220),
                new AzureCloudDto("Azure API Management Premium", null, null, null, "Entra ID", "Key Vault", "Application Insights", 99, List.of())
        );
        presets.put("ecommerce-mesh", new ArchitectureGraphDto(
                "Fabrikam Retail Cloud Mesh",
                "https://dev.azure.com/fabrikam-retail/order-mesh/_git/commerce-core",
                "main", "fabrikam-retail", "order-mesh",
                Instant.now().toString(), "azure",
                List.of(gateway),
                List.of(),
                new GraphSummaryDto(1, 0, 0, 0, 0, 0, "Azure Microservices Mesh", List.of())
        ));
    }
}
