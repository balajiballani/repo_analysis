package com.adomapper.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class Dtos {

    public record AdoScanRequest(
            String url,
            String pat,
            String branch,
            String samplePresetId
    ) {}

    public record BlastRadiusRequest(
            String failedNodeId,
            ArchitectureGraphDto currentGraph
    ) {}

    public record BlastRadiusResponseDto(
            String failedNodeId,
            String failedNodeName,
            List<String> directlyImpactedNodes,
            List<String> cascadedImpactedNodes,
            List<String> degradedNodes,
            List<String> unaffectedNodes,
            int totalBlastRadiusPercentage,
            String riskSummary,
            List<String> criticalFailurePaths
    ) {}

    public record InboundEndpointDto(
            String path,
            String method,
            String description,
            boolean authRequired,
            String fileSource,
            String rateLimit
    ) {}

    public record OutboundCallDto(
            String targetServiceId,
            String targetServiceName,
            String endpoint,
            String method,
            String protocol,
            String clientType,
            boolean circuitBreaker,
            boolean retryPolicy,
            Integer timeoutMs,
            String fileSource
    ) {}

    public record DatabaseInteractionDto(
            String dbId,
            String dbName,
            String dbType,
            String accessMode,
            List<String> tablesOrCollections,
            String orm,
            boolean transactional,
            String fileSource
    ) {}

    public record AsyncEventPubSubDto(
            List<EventPublishedDto> published,
            List<EventConsumedDto> consumed
    ) {}

    public record EventPublishedDto(
            String topicOrQueue,
            String brokerType,
            String eventSchema,
            String payloadExample,
            String frequency,
            String fileSource
    ) {}

    public record EventConsumedDto(
            String topicOrQueue,
            String brokerType,
            String consumerGroup,
            String handlerName,
            String deadLetterQueue,
            String fileSource
    ) {}

    public record CodeEvidenceDto(
            String file,
            String type,
            String codeSnippet,
            String description
    ) {}

    public record NodeMetricsDto(
            int complexityScore,
            int blastRadiusCount,
            int dependentsCount,
            int dependenciesCount,
            List<String> riskFactors
    ) {}

    public record PositionDto(
            double x,
            double y
    ) {}

    public record ArchitectureNodeDto(
            String id,
            String name,
            String type, // "service", "database", "queue", "cache", "gateway", "external"
            String category,
            String tech,
            String language,
            String summary,
            String repoUrl,
            String repoPath,
            String status,
            List<InboundEndpointDto> inboundEndpoints,
            List<OutboundCallDto> outboundCalls,
            List<DatabaseInteractionDto> databases,
            AsyncEventPubSubDto asyncEvents,
            List<CodeEvidenceDto> codeEvidence,
            NodeMetricsDto metrics,
            PositionDto position
    ) {}

    public record ArchitectureEdgeDto(
            String id,
            String source,
            String target,
            String type, // "sync-http", "sync-grpc", "db-readwrite", "async-publish", "async-consume", etc.
            String label,
            String protocol,
            String details,
            String evidence,
            boolean isCriticalPath
    ) {}

    public record ArchitecturalRiskDto(
            String severity,
            String title,
            String description,
            List<String> affectedNodes,
            String recommendation
    ) {}

    public record GraphSummaryDto(
            int totalServices,
            int totalDatabases,
            int totalQueues,
            int syncCallCount,
            int asyncEventCount,
            int dbInteractionCount,
            String architecturalStyle,
            List<ArchitecturalRiskDto> detectedRisks
    ) {}

    public record ArchitectureGraphDto(
            String systemName,
            String repositoryUrl,
            String branch,
            String organization,
            String project,
            String scannedAt,
            List<ArchitectureNodeDto> nodes,
            List<ArchitectureEdgeDto> edges,
            GraphSummaryDto summary
    ) {}
}
