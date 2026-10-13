package com.adomapper.controller;

import com.adomapper.dto.Dtos.*;
import com.adomapper.service.SpringMicroserviceAstParserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/architecture")
public class ArchitectureAnalysisController {

    private final SpringMicroserviceAstParserService astParserService;

    public ArchitectureAnalysisController(SpringMicroserviceAstParserService astParserService) {
        this.astParserService = astParserService;
    }

    @PostMapping("/scan-ado")
    public ResponseEntity<ArchitectureGraphDto> scanAdoRepository(@RequestBody AdoScanRequest request) {
        String url = request.url() != null ? request.url() : "https://dev.azure.com/contoso/banking/_git/payment-service";
        String repoName = extractRepoName(url);

        // Analyze or synthesize Java Spring Boot microservice architecture
        Map<String, String> sampleFiles = Map.of(
                "PaymentController.java", "@RestController\n@RequestMapping(\"/api/v1/payments\")\npublic class PaymentController {\n    @Autowired private AccountClient accountClient;\n    @PostMapping(\"/execute\")\n    public PaymentResult executePayment(@RequestBody PaymentRequest req) { return null; }\n}",
                "AccountClient.java", "@FeignClient(name = \"account-service\", url = \"${account.service.url}\")\npublic interface AccountClient {\n    @PostMapping(\"/api/v1/accounts/hold\")\n    HoldResult holdBalance(@RequestBody HoldRequest req);\n}",
                "PaymentEntity.java", "@Entity\n@Table(name = \"tbl_payments\")\npublic class PaymentEntity {\n    @Id private UUID id;\n    private BigDecimal amount;\n}",
                "PaymentEventListener.java", "@Service\npublic class PaymentEventListener {\n    @KafkaListener(topics = \"payment.settled.v1\")\n    public void onPaymentSettled(String event) {}\n}"
        );

        ArchitectureGraphDto graph = astParserService.parseRepository(
                repoName,
                "contoso-org",
                "core-banking",
                request.branch() != null ? request.branch() : "main",
                url,
                sampleFiles
        );

        return ResponseEntity.ok(graph);
    }

    @PostMapping("/blast-radius")
    public ResponseEntity<BlastRadiusResponseDto> calculateBlastRadius(@RequestBody BlastRadiusRequest request) {
        String failedId = request.failedNodeId();
        List<String> directlyImpacted = List.of();
        List<String> cascaded = List.of();

        // Calculate impacted nodes from edges
        if (request.currentGraph() != null && request.currentGraph().edges() != null) {
            directlyImpacted = request.currentGraph().edges().stream()
                    .filter(e -> e.target().equals(failedId))
                    .map(ArchitectureEdgeDto::source)
                    .toList();
        }

        BlastRadiusResponseDto response = new BlastRadiusResponseDto(
                failedId,
                failedId,
                directlyImpacted,
                cascaded,
                List.of(),
                List.of(),
                35,
                "Outage of " + failedId + " halts upstream transactions",
                List.of("ingress -> " + failedId)
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Spring Boot ADO Architecture Mapper",
                "version", "3.3.4",
                "java", "21"
        ));
    }

    private String extractRepoName(String url) {
        String[] parts = url.split("/");
        return parts.length > 0 ? parts[parts.length - 1].replace(".git", "") : "service";
    }
}
