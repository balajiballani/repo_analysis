package com.adomapper.service;

import com.adomapper.dto.Dtos.*;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Spring Boot Service that executes graph traversal algorithms to compute
 * microservice failure blast radius and cascading failure paths.
 */
@Service
public class BlastRadiusService {

    public BlastRadiusResponseDto computeBlastRadius(
            String failedNodeId,
            ArchitectureGraphDto graph
    ) {
        if (graph == null || graph.nodes() == null || graph.edges() == null) {
            return new BlastRadiusResponseDto(
                    failedNodeId, failedNodeId, List.of(), List.of(), List.of(), List.of(), 0, "No graph loaded", List.of()
            );
        }

        String failedNodeName = graph.nodes().stream()
                .filter(n -> n.id().equals(failedNodeId))
                .map(ArchitectureNodeDto::name)
                .findFirst()
                .orElse(failedNodeId);

        ArchitectureNodeDto failedNode = graph.nodes().stream()
                .filter(n -> n.id().equals(failedNodeId))
                .findFirst()
                .orElse(null);

        Set<String> directlyImpacted = new LinkedHashSet<>();
        List<String> criticalPaths = new ArrayList<>();

        // Upstream callers that directly call the failed node
        for (ArchitectureEdgeDto edge : graph.edges()) {
            if (edge.target().equals(failedNodeId)) {
                directlyImpacted.add(edge.source());
                criticalPaths.add(edge.source() + " -> " + failedNodeId + " [" + edge.label() + "]");
            }
        }

        // Secondary callers (cascaded BFS traversal)
        Set<String> cascaded = new LinkedHashSet<>();
        Queue<String> queue = new ArrayDeque<>(directlyImpacted);
        Set<String> visited = new HashSet<>(directlyImpacted);

        while (!queue.isEmpty()) {
            String current = queue.poll();
            for (ArchitectureEdgeDto edge : graph.edges()) {
                if (edge.target().equals(current) && !directlyImpacted.contains(edge.source()) && !edge.source().equals(failedNodeId)) {
                    if (!visited.contains(edge.source())) {
                        visited.add(edge.source());
                        cascaded.add(edge.source());
                        queue.add(edge.source());
                        criticalPaths.add(edge.source() + " -> " + current + " (Cascading Failure)");
                    }
                }
            }
        }

        // Degraded consumers if failed node is queue or database
        Set<String> degraded = new LinkedHashSet<>();
        if (failedNode != null && ("queue".equals(failedNode.type()) || "database".equals(failedNode.type()) || "cache".equals(failedNode.type()))) {
            for (ArchitectureEdgeDto edge : graph.edges()) {
                if (edge.source().equals(failedNodeId)) {
                    degraded.add(edge.target());
                }
            }
        }

        int totalImpacted = 1 + directlyImpacted.size() + cascaded.size() + degraded.size();
        int totalNodes = Math.max(1, graph.nodes().size());
        int percentage = Math.min(100, Math.round(((float) totalImpacted / totalNodes) * 100));

        List<String> unaffected = graph.nodes().stream()
                .map(ArchitectureNodeDto::id)
                .filter(id -> !id.equals(failedNodeId) && !directlyImpacted.contains(id) && !cascaded.contains(id) && !degraded.contains(id))
                .toList();

        String riskSummary = percentage >= 50
                ? "CRITICAL OUTAGE RISK: Failure of " + failedNodeName + " compromises " + percentage + "% of the enterprise microservice topology."
                : "Moderate blast radius: Outage affects " + totalImpacted + " components (" + percentage + "% of system).";

        return new BlastRadiusResponseDto(
                failedNodeId,
                failedNodeName,
                new ArrayList<>(directlyImpacted),
                new ArrayList<>(cascaded),
                new ArrayList<>(degraded),
                unaffected,
                percentage,
                riskSummary,
                criticalPaths
        );
    }
}
