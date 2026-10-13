package com.adomapper.controller;

import com.adomapper.dto.Dtos.*;
import com.adomapper.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Spring Boot REST Controller orchestrating Azure DevOps scanning,
 * Gemini AI architecture synthesis, Spring AST analysis, and blast radius simulation.
 */
@RestController
@RequestMapping("/api/v1/architecture")
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

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "framework", "Spring Boot 3.3.4",
                "javaVersion", System.getProperty("java.version"),
                "geminiAiAvailable", geminiAiService.isGeminiConfigured(),
                "timestamp", java.time.Instant.now().toString()
        ));
    }

    @GetMapping("/presets")
    public ResponseEntity<List<Map<String, Object>>> getPresets() {
        return ResponseEntity.ok(presetService.listPresets());
    }

    @GetMapping("/presets/{id}")
    public ResponseEntity<ArchitectureGraphDto> getPreset(@PathVariable String id) {
        return presetService.getPreset(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/scan-ado")
    public ResponseEntity<ArchitectureGraphDto> scanAdoRepository(@RequestBody AdoScanRequest request) {
        String url = request.url() != null ? request.url().trim() : "";
        if (url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        if (request.samplePresetId() != null && presetService.getPreset(request.samplePresetId()).isPresent()) {
            return ResponseEntity.ok(presetService.getPreset(request.samplePresetId()).get());
        }

        AdoRepositoryScannerService.AdoRepoDetails details = adoScannerService.parseAdoUrl(url, request.branch());

        // Fetch files from Azure DevOps if PAT supplied
        Map<String, String> files = adoScannerService.fetchRepositoryFiles(details, request.pat());

        // 1. Primary path: Gemini AI architectural extraction
        if (geminiAiService.isGeminiConfigured()) {
            Optional<ArchitectureGraphDto> aiGraph = geminiAiService.analyzeArchitectureWithGemini(
                    url, details.repository(), files
            );
            if (aiGraph.isPresent()) {
                return ResponseEntity.ok(aiGraph.get());
            }
        }

        // 2. Deterministic Fallback path: Spring AST Annotation heuristic engine
        ArchitectureGraphDto astGraph = astParserService.parseRepository(
                details.repository(),
                details.organization(),
                details.project(),
                details.branch(),
                url,
                files
        );

        return ResponseEntity.ok(astGraph);
    }

    @PostMapping("/scan-code")
    public ResponseEntity<ArchitectureGraphDto> scanDirectCode(
            @RequestParam(defaultValue = "Order Service") String systemName,
            @RequestBody Map<String, String> files
    ) {
        String repoName = systemName.toLowerCase().replace(" ", "-");
        String dummyUrl = "https://dev.azure.com/custom-org/spring-mesh/_git/" + repoName;

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

    @PostMapping("/blast-radius")
    public ResponseEntity<BlastRadiusResponseDto> calculateBlastRadius(@RequestBody BlastRadiusRequest request) {
        BlastRadiusResponseDto response = blastRadiusService.computeBlastRadius(
                request.failedNodeId(), request.currentGraph()
        );
        return ResponseEntity.ok(response);
    }
}
