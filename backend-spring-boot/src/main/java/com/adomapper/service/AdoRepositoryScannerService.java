package com.adomapper.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Spring Boot Service handling both Azure DevOps and GitHub REST API queries
 * to fetch Git trees, inspect subfolder microservices, and fetch Java/YAML source code files.
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
            String subPath,
            String serviceName,
            boolean isGithub,
            String cleanUrl
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
        String subPath = null;
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

                    if (segments.length >= 4 && ("tree".equalsIgnoreCase(segments[2]) || "blob".equalsIgnoreCase(segments[2]))) {
                        branch = segments[3];
                        if (segments.length >= 5) {
                            subPath = String.join("/", Arrays.copyOfRange(segments, 4, segments.length));
                        }
                    } else if (segments.length >= 3) {
                        subPath = String.join("/", Arrays.copyOfRange(segments, 2, segments.length));
                    }
                }
            } else if (host.contains("dev.azure.com") || host.contains("visualstudio.com")) {
                isGithub = false;
                if (host.contains("dev.azure.com")) {
                    if (segments.length >= 4 && "_git".equalsIgnoreCase(segments[2])) {
                        org = segments[0];
                        project = segments[1];
                        repo = segments[3].replace(".git", "");
                        if (segments.length >= 5) {
                            subPath = String.join("/", Arrays.copyOfRange(segments, 4, segments.length));
                        }
                    } else if (segments.length >= 3 && "_git".equalsIgnoreCase(segments[1])) {
                        org = segments[0];
                        project = segments[0];
                        repo = segments[2].replace(".git", "");
                        if (segments.length >= 4) {
                            subPath = String.join("/", Arrays.copyOfRange(segments, 3, segments.length));
                        }
                    } else if (segments.length >= 2) {
                        org = segments[0];
                        repo = segments[1].replace(".git", "");
                    }
                } else {
                    org = host.split("\\.")[0];
                    if (segments.length >= 4 && "_git".equalsIgnoreCase(segments[2])) {
                        project = segments[0];
                        repo = segments[3].replace(".git", "");
                        if (segments.length >= 5) {
                            subPath = String.join("/", Arrays.copyOfRange(segments, 4, segments.length));
                        }
                    } else if (segments.length >= 3 && "_git".equalsIgnoreCase(segments[1])) {
                        project = segments[0];
                        repo = segments[2].replace(".git", "");
                        if (segments.length >= 4) {
                            subPath = String.join("/", Arrays.copyOfRange(segments, 3, segments.length));
                        }
                    }
                }

                // Check query params for path or version
                if (uri.getQuery() != null) {
                    for (String param : uri.getQuery().split("&")) {
                        String[] pair = param.split("=", 2);
                        if (pair.length == 2) {
                            String key = pair[0].toLowerCase();
                            String val = URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
                            if ("path".equals(key)) {
                                subPath = val.replaceAll("^/+", "");
                            } else if ("version".equals(key)) {
                                branch = val.replaceAll("^(?i)GB", "");
                            }
                        }
                    }
                }
            } else if (segments.length > 0) {
                repo = segments[segments.length - 1].replace(".git", "");
            }
        } catch (Exception ignored) {}

        if (subPath != null) {
            subPath = subPath.replaceAll("^/+|/+$", "");
        }

        String serviceName = repo;
        if (subPath != null && !subPath.isBlank()) {
            String[] subSegments = subPath.split("/");
            serviceName = subSegments[subSegments.length - 1];
        }

        return new AdoRepoDetails(org, project, repo, branch, subPath, serviceName, isGithub, clean);
    }

    public Map<String, String> fetchRepositoryFiles(
            AdoRepoDetails details,
            String personalAccessToken
    ) {
        if (details.isGithub()) {
            return fetchGithubFiles(details, personalAccessToken);
        }
        return fetchAzureDevOpsFiles(details, personalAccessToken);
    }

    private Map<String, String> fetchGithubFiles(AdoRepoDetails details, String pat) {
        Map<String, String> files = new LinkedHashMap<>();
        try {
            String activeBranch = details.branch();
            String treeUrl = String.format(
                    "https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1",
                    details.organization(), details.repository(), activeBranch
            );

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(treeUrl))
                    .header("User-Agent", "aistudio-microservice-mapper")
                    .header("Accept", "application/vnd.github.v3+json")
                    .timeout(Duration.ofSeconds(15))
                    .GET();

            if (pat != null && !pat.isBlank()) {
                reqBuilder.header("Authorization", "token " + pat);
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            // If branch not found, query default branch
            if (response.statusCode() != 200) {
                String repoMetaUrl = String.format("https://api.github.com/repos/%s/%s", details.organization(), details.repository());
                HttpRequest.Builder metaReq = HttpRequest.newBuilder()
                        .uri(URI.create(repoMetaUrl))
                        .header("User-Agent", "aistudio-microservice-mapper")
                        .GET();
                if (pat != null && !pat.isBlank()) {
                    metaReq.header("Authorization", "token " + pat);
                }
                HttpResponse<String> metaRes = httpClient.send(metaReq.build(), HttpResponse.BodyHandlers.ofString());
                if (metaRes.statusCode() == 200) {
                    JsonNode metaNode = objectMapper.readTree(metaRes.body());
                    activeBranch = metaNode.path("default_branch").asText("main");
                    reqBuilder.uri(URI.create(String.format("https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1", details.organization(), details.repository(), activeBranch)));
                    response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
                }
            }

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode tree = root.path("tree");
                if (tree.isArray()) {
                    List<JsonNode> candidates = new ArrayList<>();
                    String subPathFilter = details.subPath() != null ? details.subPath().toLowerCase().replaceAll("^/+|/+$", "") : null;

                    for (JsonNode item : tree) {
                        String type = item.path("type").asText();
                        if (!"blob".equals(type)) continue;

                        String path = item.path("path").asText();
                        String lower = path.toLowerCase();

                        // Strict filter if subPath is provided
                        if (subPathFilter != null && !subPathFilter.isBlank()) {
                            if (!lower.startsWith(subPathFilter + "/") && !lower.equals(subPathFilter)) {
                                continue;
                            }
                        }

                        candidates.add(item);
                    }

                    // Score candidates so configuration, controllers, and clients are prioritized
                    candidates.sort((a, b) -> Integer.compare(scorePath(a.path("path").asText()), scorePath(b.path("path").asText())));

                    int fetched = 0;
                    for (JsonNode item : candidates) {
                        if (fetched >= 25) break;
                        String path = item.path("path").asText();
                        String rawUrl = String.format("https://raw.githubusercontent.com/%s/%s/%s/%s",
                                details.organization(), details.repository(), activeBranch, path);
                        HttpRequest rawReq = HttpRequest.newBuilder().uri(URI.create(rawUrl)).GET().build();
                        try {
                            HttpResponse<String> rawRes = httpClient.send(rawReq, HttpResponse.BodyHandlers.ofString());
                            if (rawRes.statusCode() == 200) {
                                files.put(path, rawRes.body());
                                fetched++;
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }

            // Direct raw fallback if tree API is rate-limited (403) or tree was empty
            if (files.isEmpty()) {
                String prefix = details.subPath() != null ? details.subPath().replaceAll("^/+|/+$", "") : "";
                String prefixSlash = prefix.isEmpty() ? "" : prefix + "/";
                String cleanPkg = prefix.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
                if (cleanPkg.isEmpty()) cleanPkg = details.repository().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
                String cleanPascal = prefix.replaceAll("(?:^|[-_])(\\w)", "$1").toUpperCase();
                if (cleanPascal.isEmpty()) cleanPascal = details.repository().replaceAll("(?:^|[-_])(\\w)", "$1").toUpperCase();

                List<String> candidatePaths = List.of(
                        prefixSlash + "src/main/resources/application.yml",
                        prefixSlash + "src/main/resources/application.yaml",
                        prefixSlash + "src/main/resources/application.properties",
                        prefixSlash + "src/main/resources/bootstrap.yml",
                        prefixSlash + "pom.xml",
                        prefixSlash + "build.gradle",
                        prefixSlash + "Dockerfile",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/" + cleanPascal + "Application.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/controller/" + cleanPascal + "Controller.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/controller/" + cleanPascal.replaceAll("(?i)Service$", "") + "Controller.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/service/" + cleanPascal + "Service.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/service/" + cleanPascal.replaceAll("(?i)Service$", "") + "Service.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/model/" + cleanPascal.replaceAll("(?i)Service$", "") + ".java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/entity/" + cleanPascal.replaceAll("(?i)Service$", "") + ".java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/repository/" + cleanPascal.replaceAll("(?i)Service$", "") + "Repository.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/service/CallAPI.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/event/EventConsumer.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/event/EventProducer.java",
                        prefixSlash + "src/main/java/com/ecommerce/" + cleanPkg + "/constant/KafkaConstant.java"
                );

                for (String cp : candidatePaths) {
                    try {
                        String rawUrl = String.format("https://raw.githubusercontent.com/%s/%s/%s/%s",
                                details.organization(), details.repository(), activeBranch, cp);
                        HttpRequest rawReq = HttpRequest.newBuilder().uri(URI.create(rawUrl)).timeout(Duration.ofSeconds(3)).GET().build();
                        HttpResponse<String> rawRes = httpClient.send(rawReq, HttpResponse.BodyHandlers.ofString());
                        if (rawRes.statusCode() == 200) {
                            files.put(cp, rawRes.body());
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching files from GitHub: " + e.getMessage());
        }
        return files;
    }

    private Map<String, String> fetchAzureDevOpsFiles(AdoRepoDetails details, String personalAccessToken) {
        Map<String, String> files = new LinkedHashMap<>();
        try {
            String itemsUrl = String.format(
                    "https://dev.azure.com/%s/%s/_apis/git/repositories/%s/items?recursionLevel=full&versionDescriptor.version=%s&api-version=7.1",
                    details.organization(), details.project(), details.repository(), details.branch()
            );

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(itemsUrl))
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .GET();

            if (personalAccessToken != null && !personalAccessToken.isBlank()) {
                String basicAuth = Base64.getEncoder().encodeToString((":" + personalAccessToken).getBytes(StandardCharsets.UTF_8));
                reqBuilder.header("Authorization", "Basic " + basicAuth);
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode values = root.path("value");
                if (values.isArray()) {
                    List<JsonNode> candidates = new ArrayList<>();
                    String subPathFilter = details.subPath() != null ? details.subPath().toLowerCase().replaceAll("^/+|/+$", "") : null;

                    for (JsonNode item : values) {
                        if (item.path("isFolder").asBoolean(false)) continue;
                        String path = item.path("path").asText().replaceAll("^/+", "");
                        String lower = path.toLowerCase();

                        if (subPathFilter != null && !subPathFilter.isBlank()) {
                            if (!lower.startsWith(subPathFilter + "/") && !lower.equals(subPathFilter)) {
                                continue;
                            }
                        }
                        candidates.add(item);
                    }

                    candidates.sort((a, b) -> Integer.compare(scorePath(a.path("path").asText()), scorePath(b.path("path").asText())));

                    int fetched = 0;
                    for (JsonNode item : candidates) {
                        if (fetched >= 25) break;
                        String path = item.path("path").asText();
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
        } catch (Exception e) {
            System.err.println("Error fetching files from Azure DevOps: " + e.getMessage());
        }

        return files;
    }

    private int scorePath(String path) {
        String p = path.toLowerCase();
        if (p.contains("application.") || p.contains("bootstrap.")) return 1;
        if (p.endsWith("pom.xml") || p.endsWith("build.gradle")) return 2;
        if (p.contains("controller")) return 3;
        if (p.contains("client") || p.contains("feign") || p.contains("callapi")) return 4;
        if (p.contains("producer") || p.contains("consumer") || p.contains("listener") || p.contains("event")) return 5;
        if (p.contains("repository") || p.contains("entity")) return 6;
        if (p.contains("config") || p.contains("constant")) return 7;
        if (p.endsWith("application.java")) return 8;
        if (p.endsWith(".java") && !p.contains("test")) return 9;
        return 10;
    }
}
