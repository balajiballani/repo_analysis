package com.adomapper.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Spring Boot Service handling both Azure DevOps and GitHub REST API queries
 * to fetch Git trees and source code files.
 */
@Service
public class AdoRepositoryScannerService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public record AdoRepoDetails(
            String organization,
            String project,
            String repository,
            String branch,
            boolean isGithub
    ) {}

    public AdoRepositoryScannerService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public AdoRepoDetails parseAdoUrl(String url, String defaultBranch) {
        String clean = url != null ? url.trim() : "";
        String org = "contoso-finance";
        String project = "core-banking";
        String repo = "payment-orchestrator";
        String branch = defaultBranch != null && !defaultBranch.isBlank() ? defaultBranch : "main";
        boolean isGithub = false;

        try {
            URI uri = URI.create(clean.startsWith("http") ? clean : "https://" + clean);
            String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
            String[] segments = Arrays.stream(uri.getPath().split("/"))
                    .filter(s -> !s.isBlank())
                    .toArray(String[]::new);

            if (host.contains("github.com")) {
                isGithub = true;
                if (segments.length >= 2) {
                    org = segments[0];
                    project = segments[0];
                    repo = segments[1].replace(".git", "");
                    if (segments.length >= 4 && "tree".equalsIgnoreCase(segments[2])) {
                        branch = segments[3];
                    }
                }
            } else if (host.contains("dev.azure.com")) {
                if (segments.length >= 4 && "_git".equalsIgnoreCase(segments[2])) {
                    org = segments[0];
                    project = segments[1];
                    repo = segments[3];
                } else if (segments.length >= 3 && "_git".equalsIgnoreCase(segments[1])) {
                    org = segments[0];
                    project = segments[0];
                    repo = segments[2];
                }
            } else if (host.contains("visualstudio.com")) {
                org = host.split("\\.")[0];
                if (segments.length >= 3 && "_git".equalsIgnoreCase(segments[1])) {
                    project = segments[0];
                    repo = segments[2];
                }
            } else if (segments.length > 0) {
                repo = segments[segments.length - 1];
            }
        } catch (Exception ignored) {}

        return new AdoRepoDetails(org, project, repo.replace(".git", ""), branch, isGithub);
    }

    public Map<String, String> fetchRepositoryFiles(
            AdoRepoDetails details,
            String personalAccessToken
    ) {
        if (details.isGithub()) {
            return fetchGithubFiles(details);
        }
        return fetchAzureDevOpsFiles(details, personalAccessToken);
    }

    private Map<String, String> fetchGithubFiles(AdoRepoDetails details) {
        Map<String, String> files = new LinkedHashMap<>();
        try {
            String treeUrl = String.format(
                    "https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1",
                    details.organization(), details.repository(), details.branch()
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(treeUrl))
                    .header("User-Agent", "aistudio-microservice-mapper")
                    .header("Accept", "application/vnd.github.v3+json")
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String activeBranch = details.branch();

            // If branch not found, query default branch
            if (response.statusCode() != 200) {
                String repoMetaUrl = String.format("https://api.github.com/repos/%s/%s", details.organization(), details.repository());
                HttpRequest metaReq = HttpRequest.newBuilder()
                        .uri(URI.create(repoMetaUrl))
                        .header("User-Agent", "aistudio-microservice-mapper")
                        .GET().build();
                HttpResponse<String> metaRes = httpClient.send(metaReq, HttpResponse.BodyHandlers.ofString());
                if (metaRes.statusCode() == 200) {
                    JsonNode metaNode = objectMapper.readTree(metaRes.body());
                    activeBranch = metaNode.path("default_branch").asText("master");
                    request = HttpRequest.newBuilder()
                            .uri(URI.create(String.format("https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1", details.organization(), details.repository(), activeBranch)))
                            .header("User-Agent", "aistudio-microservice-mapper")
                            .GET().build();
                    response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                }
            }

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode tree = root.path("tree");
                if (tree.isArray()) {
                    int fetched = 0;
                    for (JsonNode item : tree) {
                        if (fetched >= 15) break;
                        String path = item.path("path").asText();
                        String lower = path.toLowerCase();
                        if (lower.endsWith("pom.xml") ||
                            lower.contains("application.yml") ||
                            lower.contains("application.properties") ||
                            lower.endsWith("controller.java") ||
                            lower.endsWith("client.java") ||
                            lower.endsWith("entity.java") ||
                            lower.endsWith("listener.java") ||
                            lower.endsWith("service.java") ||
                            (lower.endsWith(".java") && !lower.contains("test"))) {

                            String rawUrl = String.format("https://raw.githubusercontent.com/%s/%s/%s/%s",
                                    details.organization(), details.repository(), activeBranch, path);
                            HttpRequest rawReq = HttpRequest.newBuilder().uri(URI.create(rawUrl)).GET().build();
                            HttpResponse<String> rawRes = httpClient.send(rawReq, HttpResponse.BodyHandlers.ofString());
                            if (rawRes.statusCode() == 200) {
                                files.put(path, rawRes.body());
                                fetched++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching files from GitHub: " + e.getMessage());
        }
        return files;
    }

    private Map<String, String> fetchAzureDevOpsFiles(AdoRepoDetails details, String personalAccessToken) {
        Map<String, String> files = new LinkedHashMap<>();
        if (personalAccessToken == null || personalAccessToken.isBlank()) {
            return files;
        }

        try {
            String basicAuth = Base64.getEncoder().encodeToString((":" + personalAccessToken).getBytes(StandardCharsets.UTF_8));
            String itemsUrl = String.format(
                    "https://dev.azure.com/%s/%s/_apis/git/repositories/%s/items?recursionLevel=full&versionDescriptor.version=%s&api-version=7.1",
                    details.organization(), details.project(), details.repository(), details.branch()
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(itemsUrl))
                    .header("Authorization", "Basic " + basicAuth)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode values = root.path("value");
                if (values.isArray()) {
                    int fetched = 0;
                    for (JsonNode item : values) {
                        if (fetched >= 15) break;
                        boolean isFolder = item.path("isFolder").asBoolean(false);
                        String path = item.path("path").asText();
                        String lower = path.toLowerCase();

                        if (!isFolder && (
                                lower.endsWith("pom.xml") ||
                                lower.contains("application.yml") ||
                                lower.contains("application.properties") ||
                                lower.endsWith("controller.java") ||
                                lower.endsWith("client.java") ||
                                lower.endsWith("service.java") ||
                                lower.endsWith("repository.java") ||
                                lower.endsWith("listener.java")
                        )) {
                            String contentUrl = String.format(
                                    "https://dev.azure.com/%s/%s/_apis/git/repositories/%s/items?path=%s&api-version=7.1",
                                    details.organization(), details.project(), details.repository(), path
                            );
                            HttpRequest contentReq = HttpRequest.newBuilder()
                                    .uri(URI.create(contentUrl))
                                    .header("Authorization", "Basic " + basicAuth)
                                    .timeout(Duration.ofSeconds(10))
                                    .GET()
                                    .build();
                            HttpResponse<String> contentRes = httpClient.send(contentReq, HttpResponse.BodyHandlers.ofString());
                            if (contentRes.statusCode() == 200) {
                                files.put(path, contentRes.body());
                                fetched++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching files from Azure DevOps: " + e.getMessage());
        }

        return files;
    }
}
