package com.adomapper.service;

import com.adomapper.dto.Dtos.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service that inspects Java and Spring Boot source files using static AST heuristics,
 * identifying @RestController, @FeignClient, RestTemplate, WebClient, Spring Data JPA @Entity,
 * and Spring Kafka / Azure Service Bus messaging.
 */
@Service
public class SpringMicroserviceAstParserService {

    private static final Pattern REST_MAPPING_PATTERN = Pattern.compile(
            "@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\\s*\\(\\s*(?:(?:value|path)\\s*=\\s*)?[\"']([^\"']+)[\"']"
    );

    private static final Pattern FEIGN_CLIENT_PATTERN = Pattern.compile(
            "@FeignClient\\s*\\(\\s*(?:(?:name|value)\\s*=\\s*)?[\"']([^\"']+)[\"']"
    );

    private static final Pattern KAFKA_LISTENER_PATTERN = Pattern.compile(
            "@KafkaListener\\s*\\(\\s*(?:topics\\s*=\\s*)?[\"']([^\"']+)[\"']"
    );

    private static final Pattern TABLE_PATTERN = Pattern.compile(
            "@Table\\s*\\(\\s*(?:name\\s*=\\s*)?[\"']([^\"']+)[\"']"
    );

    public ArchitectureGraphDto parseRepository(
            String repoName,
            String org,
            String project,
            String branch,
            String repoUrl,
            Map<String, String> fileContents
    ) {
        String serviceId = repoName.toLowerCase().replaceAll("[^a-z0-9_-]", "-");
        String formattedServiceName = formatName(repoName);

        List<InboundEndpointDto> inboundEndpoints = new ArrayList<>();
        List<OutboundCallDto> outboundCalls = new ArrayList<>();
        List<DatabaseInteractionDto> databases = new ArrayList<>();
        List<EventPublishedDto> publishedEvents = new ArrayList<>();
        List<EventConsumedDto> consumedEvents = new ArrayList<>();
        List<CodeEvidenceDto> codeEvidence = new ArrayList<>();

        Map<String, ArchitectureNodeDto> downstreamNodes = new LinkedHashMap<>();
        List<ArchitectureEdgeDto> edges = new ArrayList<>();

        for (Map.Entry<String, String> entry : fileContents.entrySet()) {
            String path = entry.getKey();
            String code = entry.getValue();

            // 1. Inbound REST Endpoints (@RestController)
            Matcher restMatcher = REST_MAPPING_PATTERN.matcher(code);
            while (restMatcher.find()) {
                String verb = restMatcher.group(1).replace("Mapping", "").toUpperCase();
                String endpointPath = restMatcher.group(2);
                inboundEndpoints.add(new InboundEndpointDto(
                        endpointPath,
                        verb.equals("REQUEST") ? "GET" : verb,
                        "Exposed by Spring @RestController in " + getFilename(path),
                        code.contains("@PreAuthorize") || code.contains("@Secured"),
                        path,
                        "100 req/sec"
                ));
            }

            if (code.contains("@RestController") || code.contains("@Controller")) {
                codeEvidence.add(new CodeEvidenceDto(
                        path,
                        "controller",
                        extractSnippet(code, "@RestController"),
                        "Spring Boot REST Controller handling HTTP inbound traffic"
                ));
            }

            // 2. Outbound Inter-service calls (@FeignClient)
            Matcher feignMatcher = FEIGN_CLIENT_PATTERN.matcher(code);
            while (feignMatcher.find()) {
                String targetName = feignMatcher.group(1);
                String targetId = targetName.toLowerCase().replaceAll("[^a-z0-9_-]", "-");

                outboundCalls.add(new OutboundCallDto(
                        targetId,
                        formatName(targetName),
                        "/api/v1/" + targetId,
                        "POST",
                        "REST",
                        "Spring Cloud OpenFeign",
                        code.contains("@CircuitBreaker") || code.contains("resilience4j"),
                        true,
                        800,
                        path
                ));

                if (!downstreamNodes.containsKey(targetId)) {
                    downstreamNodes.put(targetId, createStubService(targetId, targetName));
                }

                edges.add(new ArchitectureEdgeDto(
                        "e-" + serviceId + "-" + targetId,
                        serviceId,
                        targetId,
                        "sync-http",
                        "FeignClient -> " + targetName,
                        "HTTP/REST",
                        "Synchronous Spring Cloud Feign client call",
                        path,
                        true
                ));
            }

            // 3. Database Interactions (@Entity, JpaRepository)
            if (code.contains("@Entity") || code.contains("JpaRepository") || code.contains("jdbc:postgresql")) {
                List<String> tables = new ArrayList<>();
                Matcher tableMatcher = TABLE_PATTERN.matcher(code);
                while (tableMatcher.find()) {
                    tables.add(tableMatcher.group(1));
                }
                if (tables.isEmpty()) tables.add("entities");

                databases.add(new DatabaseInteractionDto(
                        "postgres-" + serviceId,
                        formattedServiceName + " DB (PostgreSQL)",
                        "PostgreSQL 16",
                        "read-write",
                        tables,
                        "Spring Data JPA / Hibernate",
                        code.contains("@Transactional"),
                        path
                ));

                codeEvidence.add(new CodeEvidenceDto(
                        path,
                        "database",
                        extractSnippet(code, "@Entity"),
                        "JPA Entity and persistence mapping"
                ));
            }

            // 4. Kafka Topics (@KafkaListener, KafkaTemplate)
            Matcher kafkaMatcher = KAFKA_LISTENER_PATTERN.matcher(code);
            while (kafkaMatcher.find()) {
                String topic = kafkaMatcher.group(1);
                consumedEvents.add(new EventConsumedDto(
                        topic,
                        "Kafka",
                        serviceId + "-group",
                        "onMessageReceived",
                        topic + ".DLQ",
                        path
                ));
            }

            if (code.contains("KafkaTemplate") || code.contains(".send(")) {
                publishedEvents.add(new EventPublishedDto(
                        serviceId + ".events.v1",
                        "Kafka",
                        formattedServiceName + "Event",
                        "{\"id\": \"UUID\", \"timestamp\": 1690000000}",
                        "~300/min",
                        path
                ));
            }
        }

        // Defaults if empty
        if (inboundEndpoints.isEmpty()) {
            inboundEndpoints.add(new InboundEndpointDto("/api/v1/" + serviceId, "GET", "Standard query endpoint", false, null, null));
            inboundEndpoints.add(new InboundEndpointDto("/actuator/health", "GET", "Spring Boot Actuator probe", false, null, null));
        }

        ArchitectureNodeDto primaryNode = new ArchitectureNodeDto(
                serviceId,
                formattedServiceName,
                "service",
                "Spring Boot Microservice",
                "Spring Boot 3.3 / Java 21",
                "Java",
                "Scanned Spring Boot microservice from ADO repository",
                repoUrl,
                "/" + repoName,
                "healthy",
                inboundEndpoints,
                outboundCalls,
                databases,
                new AsyncEventPubSubDto(publishedEvents, consumedEvents),
                codeEvidence,
                new NodeMetricsDto(6, 4, 1, outboundCalls.size() + databases.size(), List.of()),
                new PositionDto(380, 220)
        );

        List<ArchitectureNodeDto> allNodes = new ArrayList<>();
        allNodes.add(primaryNode);
        allNodes.addAll(downstreamNodes.values());

        // Add Ingress Gateway
        ArchitectureNodeDto gateway = new ArchitectureNodeDto(
                "azure-api-gateway",
                "Azure API Management / Spring Cloud Gateway",
                "gateway",
                "Ingress Perimeter",
                "Spring Cloud Gateway / Azure APIM",
                "Java",
                "Perimeter gateway routing public client ingress",
                null,
                null,
                "healthy",
                List.of(new InboundEndpointDto("/api/v1/**", "GET", "Client traffic", false, null, null)),
                List.of(new OutboundCallDto(serviceId, formattedServiceName, "/api/v1/" + serviceId, "GET", "REST", "Route", true, true, 500, null)),
                List.of(),
                new AsyncEventPubSubDto(List.of(), List.of()),
                List.of(),
                new NodeMetricsDto(3, 4, 0, 1, List.of()),
                new PositionDto(70, 220)
        );
        allNodes.add(0, gateway);

        edges.add(0, new ArchitectureEdgeDto(
                "e-gateway-" + serviceId,
                "azure-api-gateway",
                serviceId,
                "gateway-route",
                "Route /api/v1/**",
                "HTTPS/REST",
                "Forwarding ingress traffic to Spring Boot microservice",
                null,
                true
        ));

        GraphSummaryDto summary = new GraphSummaryDto(
                (int) allNodes.stream().filter(n -> n.type().equals("service") || n.type().equals("gateway")).count(),
                (int) allNodes.stream().filter(n -> n.type().equals("database") || n.type().equals("cache")).count(),
                (int) allNodes.stream().filter(n -> n.type().equals("queue")).count(),
                edges.size(),
                publishedEvents.size() + consumedEvents.size(),
                databases.size(),
                "Spring Boot Cloud Microservices + Event Mesh",
                List.of(new ArchitecturalRiskDto(
                        "medium",
                        "Verify Circuit Breaker Fallbacks",
                        "Ensure all @FeignClient interfaces define fallback or fallbackFactory classes",
                        List.of(serviceId),
                        "Configure Resilience4j circuit breakers in application.yml"
                ))
        );

        return new ArchitectureGraphDto(
                formattedServiceName + " Architecture",
                repoUrl,
                branch,
                org,
                project,
                Instant.now().toString(),
                allNodes,
                edges,
                summary
        );
    }

    private ArchitectureNodeDto createStubService(String id, String name) {
        return new ArchitectureNodeDto(
                id,
                formatName(name),
                "service",
                "Spring Boot Microservice",
                "Spring Boot 3.3 / Java 21",
                "Java",
                "Downstream microservice invoked via @FeignClient",
                null,
                null,
                "healthy",
                List.of(new InboundEndpointDto("/api/v1/" + id, "POST", "Service endpoint", true, null, null)),
                List.of(),
                List.of(),
                new AsyncEventPubSubDto(List.of(), List.of()),
                List.of(),
                new NodeMetricsDto(4, 2, 1, 0, List.of()),
                new PositionDto(740, 180)
        );
    }

    private String formatName(String name) {
        return name.replace("-", " ").replace("_", " ")
                .replaceAll("(?i)\\bservice\\b", "Service")
                .trim();
    }

    private String getFilename(String p) {
        int idx = p.lastIndexOf('/');
        return idx >= 0 ? p.substring(idx + 1) : p;
    }

    private String extractSnippet(String code, String keyword) {
        int idx = code.indexOf(keyword);
        if (idx == -1) return code.substring(0, Math.min(250, code.length()));
        int start = Math.max(0, idx - 30);
        int end = Math.min(code.length(), idx + 350);
        return code.substring(start, end);
    }
}
