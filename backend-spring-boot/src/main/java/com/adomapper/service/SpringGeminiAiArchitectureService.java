package com.adomapper.service;

import com.adomapper.dto.Dtos.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Spring Boot AI Service that integrates directly with Google Gemini API
 * to analyze Azure DevOps repository files and synthesize microservice architecture graphs.
 */
@Service
public class SpringGeminiAiArchitectureService {

    @Value("${gemini.api-key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Value("${gemini.model:gemini-3.8-flash}")
    private String geminiModel;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public SpringGeminiAiArchitectureService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public boolean isGeminiConfigured() {
        return geminiApiKey != null && !geminiApiKey.trim().isEmpty() && !geminiApiKey.equals("MY_GEMINI_API_KEY");
    }

    public Optional<ArchitectureGraphDto> analyzeArchitectureWithGemini(
            String repoUrl,
            String repoName,
            Map<String, String> files
    ) {
        if (!isGeminiConfigured()) {
            return Optional.empty();
        }

        try {
            StringBuilder fileContext = new StringBuilder();
            int count = 0;
            for (Map.Entry<String, String> entry : files.entrySet()) {
                if (count++ >= 12) break;
                String snippet = entry.getValue().length() > 2000 ? entry.getValue().substring(0, 2000) : entry.getValue();
                fileContext.append("--- File: ").append(entry.getKey()).append(" ---\n")
                        .append(snippet).append("\n\n");
            }

            String prompt = """
                    You are a Principal Cloud & Microservices Enterprise Architect analyzing an Azure DevOps (ADO) repository.
                    Repository URL: %s
                    Repository Name: %s

                    Analyze the provided Spring Boot and microservice files and extract a complete microservice architecture graph:
                    1. Microservices / API Gateways / Background workers
                    2. Where each service makes outbound calls to other microservices (HTTP REST, FeignClient, WebClient, RestTemplate)
                    3. Inbound API endpoints exposed by each service (@RestController, @GetMapping, @PostMapping)
                    4. Database interactions (PostgreSQL, Azure SQL, Cosmos DB, MongoDB, Redis) with tables and ORM
                    5. Asynchronous event interactions (Kafka topics, Azure Service Bus queues/topics, RabbitMQ) - both published and consumed
                    6. Code evidence snippets (file paths, controller/client/messaging snippets)
                    7. Architectural risks (e.g. cascading failures, shared database anti-pattern, missing circuit breakers, circular dependencies)

                    Files to analyze:
                    %s
                    """.formatted(repoUrl, repoName, fileContext.length() > 0 ? fileContext.toString() : "Analyze standard enterprise Spring Boot microservice topology for this repository.");

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(Map.of("text", prompt)))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json"
                    )
            );

            String requestJson = objectMapper.writeValueAsString(requestBody);
            String endpointUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl))
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "aistudio-build")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                System.err.println("Gemini API returned error: " + response.statusCode() + " " + response.body());
                return Optional.empty();
            }

            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode candidateTextNode = rootNode.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (candidateTextNode.isMissingNode()) {
                return Optional.empty();
            }

            String jsonText = candidateTextNode.asText();
            JsonNode graphNode = objectMapper.readTree(jsonText);

            // Parse JSON into DTOs
            return Optional.of(parseGraphJson(graphNode, repoUrl, repoName));
        } catch (Exception e) {
            System.err.println("Error invoking Gemini AI in Spring Boot service: " + e.getMessage());
            return Optional.empty();
        }
    }

    private ArchitectureGraphDto parseGraphJson(JsonNode root, String repoUrl, String repoName) {
        String systemName = root.path("systemName").asText(repoName + " Microservice Mesh");
        String style = root.path("architecturalStyle").asText("Event-Driven Spring Boot Microservices");

        List<ArchitectureNodeDto> nodes = new ArrayList<>();
        JsonNode nodesArray = root.path("nodes");
        if (nodesArray.isArray()) {
            int idx = 0;
            for (JsonNode n : nodesArray) {
                String id = n.path("id").asText("node-" + idx);
                String type = n.path("type").asText("service");

                int col = 1;
                if ("gateway".equalsIgnoreCase(type)) col = 0;
                else if ("queue".equalsIgnoreCase(type) || "database".equalsIgnoreCase(type) || "cache".equalsIgnoreCase(type)) col = 2;
                else if ("external".equalsIgnoreCase(type)) col = 3;
                int row = idx % 4;

                List<InboundEndpointDto> inbounds = new ArrayList<>();
                for (JsonNode ep : n.path("inboundEndpoints")) {
                    inbounds.add(new InboundEndpointDto(
                            ep.path("path").asText("/api"),
                            ep.path("method").asText("GET"),
                            ep.path("description").asText("Endpoint"),
                            ep.path("authRequired").asBoolean(false),
                            null,
                            null
                    ));
                }

                List<OutboundCallDto> outbounds = new ArrayList<>();
                for (JsonNode ob : n.path("outboundCalls")) {
                    outbounds.add(new OutboundCallDto(
                            ob.path("targetServiceId").asText("target"),
                            ob.path("targetServiceName").asText("Target Service"),
                            ob.path("endpoint").asText("/api"),
                            ob.path("method").asText("POST"),
                            ob.path("protocol").asText("REST"),
                            ob.path("clientType").asText("Spring Cloud OpenFeign"),
                            ob.path("circuitBreaker").asBoolean(true),
                            true,
                            800,
                            null
                    ));
                }

                List<DatabaseInteractionDto> dbs = new ArrayList<>();
                for (JsonNode db : n.path("databases")) {
                    List<String> tables = new ArrayList<>();
                    db.path("tablesOrCollections").forEach(t -> tables.add(t.asText()));
                    dbs.add(new DatabaseInteractionDto(
                            db.path("dbId").asText("db"),
                            db.path("dbName").asText("Database"),
                            db.path("dbType").asText("PostgreSQL 16"),
                            db.path("accessMode").asText("read-write"),
                            tables,
                            db.path("orm").asText("Spring Data JPA"),
                            true,
                            null
                    ));
                }

                List<EventPublishedDto> pubs = new ArrayList<>();
                for (JsonNode p : n.path("asyncEvents").path("published")) {
                    pubs.add(new EventPublishedDto(
                            p.path("topicOrQueue").asText("topic"),
                            p.path("brokerType").asText("Kafka"),
                            p.path("eventSchema").asText("Event"),
                            null,
                            null,
                            null
                    ));
                }

                List<EventConsumedDto> subs = new ArrayList<>();
                for (JsonNode s : n.path("asyncEvents").path("consumed")) {
                    subs.add(new EventConsumedDto(
                            s.path("topicOrQueue").asText("topic"),
                            s.path("brokerType").asText("Kafka"),
                            "group",
                            "onMessage",
                            null,
                            null
                    ));
                }

                List<CodeEvidenceDto> evidence = new ArrayList<>();
                for (JsonNode ev : n.path("codeEvidence")) {
                    evidence.add(new CodeEvidenceDto(
                            ev.path("file").asText("File.java"),
                            ev.path("type").asText("controller"),
                            ev.path("codeSnippet").asText(""),
                            ev.path("description").asText("")
                    ));
                }

                nodes.add(new ArchitectureNodeDto(
                        id,
                        n.path("name").asText(id),
                        type,
                        n.path("category").asText("Spring Boot Microservice"),
                        n.path("tech").asText("Spring Boot 3.3 / Java 21"),
                        n.path("language").asText("Java"),
                        n.path("summary").asText("Component discovered by Gemini AI"),
                        repoUrl,
                        "/" + id,
                        "healthy",
                        inbounds,
                        outbounds,
                        dbs,
                        new AsyncEventPubSubDto(pubs, subs),
                        evidence,
                        new NodeMetricsDto(5, 3, 1, outbounds.size() + dbs.size(), List.of()),
                        new PositionDto(80 + col * 340, 70 + row * 190)
                ));
                idx++;
            }
        }

        List<ArchitectureEdgeDto> edges = new ArrayList<>();
        JsonNode edgesArray = root.path("edges");
        if (edgesArray.isArray()) {
            for (JsonNode e : edgesArray) {
                edges.add(new ArchitectureEdgeDto(
                        e.path("id").asText("e-" + edges.size()),
                        e.path("source").asText(),
                        e.path("target").asText(),
                        e.path("type").asText("sync-http"),
                        e.path("label").asText("Call"),
                        e.path("protocol").asText("REST"),
                        e.path("details").asText(),
                        null,
                        e.path("isCriticalPath").asBoolean(false)
                ));
            }
        }

        List<ArchitecturalRiskDto> risks = new ArrayList<>();
        JsonNode risksArray = root.path("summary").path("detectedRisks");
        if (risksArray.isArray()) {
            for (JsonNode r : risksArray) {
                List<String> affected = new ArrayList<>();
                r.path("affectedNodes").forEach(an -> affected.add(an.asText()));
                risks.add(new ArchitecturalRiskDto(
                        r.path("severity").asText("medium"),
                        r.path("title").asText("Architectural Risk"),
                        r.path("description").asText(""),
                        affected,
                        r.path("recommendation").asText("")
                ));
            }
        }

        GraphSummaryDto summary = new GraphSummaryDto(
                (int) nodes.stream().filter(n -> n.type().equals("service") || n.type().equals("gateway")).count(),
                (int) nodes.stream().filter(n -> n.type().equals("database") || n.type().equals("cache")).count(),
                (int) nodes.stream().filter(n -> n.type().equals("queue")).count(),
                edges.size(),
                nodes.stream().mapToInt(n -> n.asyncEvents().published().size() + n.asyncEvents().consumed().size()).sum(),
                nodes.stream().mapToInt(n -> n.databases().size()).sum(),
                style,
                risks
        );

        return new ArchitectureGraphDto(
                systemName,
                repoUrl,
                "main",
                "enterprise-org",
                "platform-mesh",
                java.time.Instant.now().toString(),
                nodes,
                edges,
                summary
        );
    }
}
