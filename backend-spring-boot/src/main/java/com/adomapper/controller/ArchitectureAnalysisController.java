package com.adomapper.controller;

import com.adomapper.dto.Dtos.*;
import com.adomapper.service.*;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Spring Boot REST Controller orchestrating Azure DevOps & GitHub repository scanning,
 * internal microservice subpath routing, Gemini AI architecture synthesis,
 * Spring AST heuristic analysis, blast radius calculation, and pure Java backend inspection.
 */
@RestController
@CrossOrigin(origins = "*")
public class ArchitectureAnalysisController {

    private final AdoRepositoryScannerService adoScannerService;
    private final SpringGeminiAiArchitectureService geminiAiService;
    private final SpringMicroserviceAstParserService astParserService;
    private final BlastRadiusService blastRadiusService;
    private final PresetArchitectureService presetService;

    public ArchitectureAnalysisController(
            AdoRepositoryScannerService adoScannerService,
            SpringGeminiAiArchitectureService geminiAiService,
            SpringMicroserviceAstParserService astParserService,
            BlastRadiusService blastRadiusService,
            PresetArchitectureService presetService
    ) {
        this.adoScannerService = adoScannerService;
        this.geminiAiService = geminiAiService;
        this.astParserService = astParserService;
        this.blastRadiusService = blastRadiusService;
        this.presetService = presetService;
    }

    @GetMapping({"/api/health", "/api/v1/architecture/health"})
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "framework", "Spring Boot 3.3.4",
                "javaVersion", System.getProperty("java.version"),
                "deploymentModel", "Pure Java Deployment (Zero Node.js Runtime)",
                "geminiAiAvailable", geminiAiService.isGeminiConfigured(),
                "timestamp", java.time.Instant.now().toString()
        ));
    }

    @GetMapping({"/api/presets", "/api/v1/architecture/presets"})
    public ResponseEntity<List<Map<String, Object>>> getPresets() {
        return ResponseEntity.ok(presetService.listPresets());
    }

    @GetMapping({"/api/presets/{id}", "/api/v1/architecture/presets/{id}"})
    public ResponseEntity<ArchitectureGraphDto> getPreset(@PathVariable String id) {
        return presetService.getPreset(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Unified Repository Analysis Endpoint:
     * - Handles both GitHub and Azure DevOps URLs
     * - Dynamically isolates internal microservices if a subfolder is specified
     *   (e.g., github.com/.../tree/main/payment-service or dev.azure.com/.../_git/repo?path=/payment-service)
     * - Resets session data and focuses strictly on that single microservice
     */
    @PostMapping({"/api/analyze", "/api/analyze/ado", "/api/v1/architecture/scan-ado"})
    public ResponseEntity<ArchitectureGraphDto> scanAdoRepository(@RequestBody AdoScanRequest request) {
        String url = request.url() != null ? request.url().trim() : "";
        if (url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }


        AdoRepositoryScannerService.AdoRepoDetails details = adoScannerService.parseAdoUrl(url, request.branch());

        // 1. Live Remote Fetch: Strictly read files from the repository at this URL (no stored presets)
        Map<String, String> files = adoScannerService.fetchRepositoryFiles(details, request.pat());

        // 3. Primary path: Gemini AI architectural extraction
        if (geminiAiService.isGeminiConfigured() && !files.isEmpty()) {
            Optional<ArchitectureGraphDto> aiGraph = geminiAiService.analyzeArchitectureWithGemini(
                    url, details.serviceName(), files
            );
            if (aiGraph.isPresent()) {
                return ResponseEntity.ok(aiGraph.get());
            }
        }

        // 4. Deterministic Spring AST Annotation heuristic engine
        ArchitectureGraphDto astGraph = astParserService.parseRepository(
                details.serviceName(),
                details.organization(),
                details.project(),
                details.branch(),
                url,
                files
        );

        return ResponseEntity.ok(astGraph);
    }

    @PostMapping({"/api/analyze/code", "/api/v1/architecture/scan-code"})
    public ResponseEntity<ArchitectureGraphDto> scanDirectCode(
            @RequestBody Map<String, Object> body
    ) {
        String systemName = (String) body.getOrDefault("systemName", "Custom Spring Boot Microservice");
        @SuppressWarnings("unchecked")
        Map<String, String> files = (Map<String, String>) body.getOrDefault("files", Collections.emptyMap());

        String repoName = systemName.toLowerCase().replaceAll("[^a-z0-9_-]", "-");
        String dummyUrl = "https://github.com/custom-org/" + repoName;

        if (geminiAiService.isGeminiConfigured()) {
            Optional<ArchitectureGraphDto> aiGraph = geminiAiService.analyzeArchitectureWithGemini(
                    dummyUrl, repoName, files
            );
            if (aiGraph.isPresent()) {
                return ResponseEntity.ok(aiGraph.get());
            }
        }

        ArchitectureGraphDto graph = astParserService.parseRepository(
                repoName, "custom-org", "spring-mesh", "main", dummyUrl, files
        );
        return ResponseEntity.ok(graph);
    }

    @PostMapping({"/api/blast-radius", "/api/v1/architecture/blast-radius"})
    public ResponseEntity<BlastRadiusResponseDto> calculateBlastRadius(@RequestBody BlastRadiusRequest request) {
        ArchitectureGraphDto graph = request.effectiveGraph();
        BlastRadiusResponseDto response = blastRadiusService.computeBlastRadius(
                request.failedNodeId(), graph
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/api/backend/code", "/api/v1/architecture/backend/code"})
    public ResponseEntity<List<Map<String, String>>> getBackendCode() {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath*:**/*.java");

            for (Resource res : resources) {
                String uriStr = res.getURI().toString();
                if (uriStr.contains("com/adomapper")) {
                    String filename = res.getFilename();
                    String path = uriStr.substring(uriStr.indexOf("com/adomapper"));
                    try (InputStream is = res.getInputStream()) {
                        String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                        result.add(Map.of(
                                "name", filename != null ? filename : "Source.java",
                                "path", path,
                                "language", "java",
                                "content", content
                        ));
                    }
                }
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(result);
    }
}
