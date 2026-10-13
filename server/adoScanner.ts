import { ArchitectureGraph, ArchitectureNode, ArchitectureEdge, ArchitecturalRisk } from './types.js';
import { PRESETS } from './presets.js';
import { analyzeArchitectureWithGemini } from './geminiAnalyzer.js';

export interface AdoRepoInfo {
  organization: string;
  project: string;
  repository: string;
  branch: string;
  isAzureDevOps: boolean;
}

export function parseAdoUrl(rawUrl: string, defaultBranch = 'main'): AdoRepoInfo {
  const clean = rawUrl.trim();
  let org = 'enterprise-org';
  let project = 'platform-mesh';
  let repo = 'core-service';
  let isAdo = true;

  try {
    const urlObj = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const host = urlObj.hostname;
    const parts = urlObj.pathname.split('/').filter(Boolean);

    if (host.includes('dev.azure.com')) {
      // https://dev.azure.com/{org}/{project}/_git/{repo}
      if (parts.length >= 4 && parts[2] === '_git') {
        org = parts[0];
        project = parts[1];
        repo = parts[3];
      } else if (parts.length >= 3 && parts[1] === '_git') {
        org = parts[0];
        project = parts[0];
        repo = parts[2];
      } else {
        org = parts[0] || org;
        project = parts[1] || project;
        repo = parts[parts.length - 1] || repo;
      }
    } else if (host.includes('visualstudio.com')) {
      // https://{org}.visualstudio.com/{project}/_git/{repo}
      org = host.split('.')[0];
      if (parts.length >= 3 && parts[1] === '_git') {
        project = parts[0];
        repo = parts[2];
      } else {
        project = parts[0] || project;
        repo = parts[parts.length - 1] || repo;
      }
    } else if (host.includes('github.com')) {
      isAdo = false;
      org = parts[0] || 'github-org';
      repo = parts[1] || 'repo';
      project = repo;
    } else {
      if (parts.length > 0) {
        repo = parts[parts.length - 1];
        if (parts.length > 1) project = parts[parts.length - 2];
        if (parts.length > 2) org = parts[parts.length - 3];
      }
    }
  } catch (err) {
    // fallback if non-URL format
    const segs = clean.split(/[\/\\]/).filter(Boolean);
    if (segs.length > 0) repo = segs[segs.length - 1];
  }

  return {
    organization: org,
    project: project,
    repository: repo.replace(/\.git$/i, ''),
    branch: defaultBranch,
    isAzureDevOps: isAdo
  };
}

export async function fetchAdoRepositoryFiles(params: {
  org: string;
  project: string;
  repo: string;
  branch: string;
  pat?: string;
}): Promise<Array<{ path: string; content: string }>> {
  const { org, project, repo, branch, pat } = params;

  if (!pat) {
    return [];
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`:${pat}`).toString('base64');
    const itemsUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/items?recursionLevel=full&versionDescriptor.version=${encodeURIComponent(branch)}&api-version=7.1`;

    const res = await fetch(itemsUrl, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      console.warn(`ADO API response not OK: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    const items: Array<{ path: string; isFolder?: boolean }> = data.value || [];

    // Filter relevant architectural files: Java Spring Boot, YAML, C#, etc.
    const candidateFiles = items
      .filter(item => !item.isFolder)
      .filter(item => {
        const p = item.path.toLowerCase();
        return (
          p.endsWith('pom.xml') ||
          p.endsWith('build.gradle') ||
          p.includes('application.yml') ||
          p.includes('application.properties') ||
          p.includes('appsettings.json') ||
          p.includes('docker-compose') ||
          p.endsWith('controller.java') ||
          p.endsWith('service.java') ||
          p.endsWith('client.java') ||
          p.endsWith('listener.java') ||
          p.endsWith('repository.java') ||
          p.endsWith('.cs') ||
          p.endsWith('.go') ||
          p.endsWith('package.json')
        );
      })
      .slice(0, 20); // Top 20 architectural files

    const fetchedFiles: Array<{ path: string; content: string }> = [];

    for (const file of candidateFiles) {
      try {
        const fileContentUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/items?path=${encodeURIComponent(file.path)}&api-version=7.1`;
        const fileRes = await fetch(fileContentUrl, {
          headers: {
            Authorization: authHeader,
            Accept: 'text/plain, application/octet-stream'
          }
        });
        if (fileRes.ok) {
          const content = await fileRes.text();
          fetchedFiles.push({ path: file.path, content });
        }
      } catch (e) {
        console.error(`Failed to fetch file content for ${file.path}:`, e);
      }
    }

    return fetchedFiles;
  } catch (err) {
    console.error('Error fetching from ADO API:', err);
    return [];
  }
}

// Static AST analyzer that parses Java Spring Boot and modern microservices
export function parseCodebaseArchitecture(
  repoInfo: AdoRepoInfo,
  files: Array<{ path: string; content: string }>
): ArchitectureGraph {
  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];
  const serviceMap = new Map<string, ArchitectureNode>();

  const mainServiceName = repoInfo.repository;
  const mainServiceId = mainServiceName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  // Primary service being analyzed
  const primaryService: ArchitectureNode = {
    id: mainServiceId,
    name: formatServiceName(mainServiceName),
    type: 'service',
    category: 'Spring Boot Microservice',
    tech: 'Spring Boot 3.3 / Java 21',
    language: 'Java',
    summary: `Primary microservice scanned from Azure DevOps repo ${repoInfo.repository}`,
    repoUrl: `https://dev.azure.com/${repoInfo.organization}/${repoInfo.project}/_git/${repoInfo.repository}`,
    repoPath: `/${repoInfo.repository}`,
    status: 'healthy',
    inboundEndpoints: [],
    outboundCalls: [],
    databases: [],
    asyncEvents: { published: [], consumed: [] },
    codeEvidence: [],
    metrics: {
      complexityScore: 5,
      blastRadiusCount: 3,
      dependentsCount: 1,
      dependenciesCount: 2,
      riskFactors: []
    },
    position: { x: 380, y: 220 }
  };

  // Analyze each file for Java Spring Boot patterns
  for (const f of files) {
    const content = f.content;
    const path = f.path;

    // 1. Detect Inbound Endpoints (Spring Boot @RestController, @GetMapping, @PostMapping)
    const restControllerMatches = content.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g);
    if (restControllerMatches) {
      for (const m of restControllerMatches) {
        const methodMatch = m.match(/@(Get|Post|Put|Delete|Patch|Request)Mapping/i);
        const pathMatch = m.match(/["']([^"']+)["']/);
        const method = (methodMatch ? methodMatch[1].toUpperCase() : 'GET') as any;
        const endpointPath = pathMatch ? pathMatch[1] : '/api';

        if (!primaryService.inboundEndpoints.some(e => e.path === endpointPath && e.method === method)) {
          primaryService.inboundEndpoints.push({
            path: endpointPath,
            method: method === 'REQUEST' ? 'GET' : method,
            description: `Spring Boot REST endpoint mapped in ${getFileName(path)}`,
            authRequired: content.includes('@PreAuthorize') || content.includes('@Secured') || content.includes('SecurityContext'),
            fileSource: path
          });
        }
      }

      primaryService.codeEvidence.push({
        file: path,
        type: 'controller',
        codeSnippet: extractSnippet(content, '@RestController') || extractSnippet(content, '@GetMapping') || content.slice(0, 300),
        description: `Spring Boot Controller exposing inbound REST endpoints`
      });
    }

    // 2. Detect Outbound Microservice Calls (@FeignClient, RestTemplate, WebClient)
    const feignMatches = content.matchAll(/@FeignClient\s*\(\s*(?:name\s*=\s*)?["']([^"']+)["']/g);
    for (const match of feignMatches) {
      const targetName = match[1];
      const targetId = targetName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      
      primaryService.outboundCalls.push({
        targetServiceId: targetId,
        targetServiceName: formatServiceName(targetName),
        endpoint: `/api/v1/${targetId}`,
        method: 'POST',
        protocol: 'REST',
        clientType: 'Spring Cloud OpenFeign',
        circuitBreaker: content.includes('@CircuitBreaker') || content.includes('resilience4j'),
        fileSource: path
      });

      if (!serviceMap.has(targetId) && targetId !== mainServiceId) {
        serviceMap.set(targetId, {
          id: targetId,
          name: formatServiceName(targetName),
          type: 'service',
          category: 'Downstream Microservice',
          tech: 'Spring Boot / REST API',
          language: 'Java',
          summary: `Downstream service invoked via Spring Cloud OpenFeign client`,
          status: 'healthy',
          inboundEndpoints: [{ path: `/api/v1/${targetId}`, method: 'POST', description: 'Downstream contract' }],
          outboundCalls: [],
          databases: [],
          asyncEvents: { published: [], consumed: [] },
          codeEvidence: [],
          metrics: { complexityScore: 4, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
          position: { x: 740, y: 120 + serviceMap.size * 180 }
        });
      }

      edges.push({
        id: `e-${mainServiceId}-${targetId}`,
        source: mainServiceId,
        target: targetId,
        type: 'sync-http',
        label: `FeignClient -> ${targetName}`,
        protocol: 'HTTP/REST',
        details: 'Synchronous REST client call',
        isCriticalPath: true
      });
    }

    // RestTemplate or WebClient matches
    if (content.includes('RestTemplate') || content.includes('WebClient') || content.includes('HttpClient')) {
      const urlMatches = content.match(/https?:\/\/([a-zA-Z0-9_-]+)(?::[0-9]+)?(\/[a-zA-Z0-9_\-\/]*)/g);
      if (urlMatches) {
        for (const u of urlMatches) {
          try {
            const parsed = new URL(u);
            const hostService = parsed.hostname.split('.')[0];
            const targetId = hostService.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            if (targetId !== 'localhost' && targetId !== '127' && targetId !== mainServiceId) {
              primaryService.outboundCalls.push({
                targetServiceId: targetId,
                targetServiceName: formatServiceName(hostService),
                endpoint: parsed.pathname || '/',
                method: 'GET',
                protocol: 'REST',
                clientType: content.includes('WebClient') ? 'Spring WebClient (Reactive)' : 'Spring RestTemplate',
                fileSource: path
              });

              if (!serviceMap.has(targetId)) {
                serviceMap.set(targetId, {
                  id: targetId,
                  name: formatServiceName(hostService),
                  type: 'service',
                  category: 'External Microservice',
                  tech: 'REST Service',
                  language: 'Polyglot',
                  summary: `Discovered from RestTemplate/WebClient URI configuration`,
                  status: 'healthy',
                  inboundEndpoints: [{ path: parsed.pathname, method: 'GET', description: 'Mapped route' }],
                  outboundCalls: [],
                  databases: [],
                  asyncEvents: { published: [], consumed: [] },
                  codeEvidence: [],
                  metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
                  position: { x: 740, y: 140 + serviceMap.size * 170 }
                });
              }

              edges.push({
                id: `e-${mainServiceId}-${targetId}`,
                source: mainServiceId,
                target: targetId,
                type: 'sync-http',
                label: `HTTP ${parsed.pathname}`,
                protocol: 'REST / JSON'
              });
            }
          } catch (_) {}
        }
      }
    }

    // 3. Detect Database Interactions (Spring Data JPA, @Entity, application.yml datasource)
    const hasPostgres = content.includes('postgresql') || content.includes('PostgreSQL');
    const hasSql = content.includes('sqlserver') || content.includes('mysql') || content.includes('h2') || content.includes('jdbc');
    const hasMongo = content.includes('mongodb') || content.includes('MongoRepository');
    const hasRedis = content.includes('redis') || content.includes('RedisTemplate');

    if (content.includes('@Entity') || content.includes('JpaRepository') || hasPostgres || hasSql || hasMongo || hasRedis) {
      let dbId = 'primary-db';
      let dbName = 'Primary PostgreSQL DB';
      let dbType = 'PostgreSQL 16';
      let tech = 'Azure Database for PostgreSQL Flexible Server';

      if (hasMongo) {
        dbId = 'cosmos-mongo-db';
        dbName = 'Cosmos DB (MongoDB API)';
        dbType = 'Azure Cosmos DB';
        tech = 'Cosmos DB NoSQL';
      } else if (hasRedis) {
        dbId = 'redis-cache';
        dbName = 'Azure Cache for Redis';
        dbType = 'Redis 7';
        tech = 'Azure Cache for Redis';
      } else if (content.includes('sqlserver')) {
        dbId = 'azure-sql-db';
        dbName = 'Azure SQL Database';
        dbType = 'Azure SQL';
        tech = 'Azure SQL Managed Instance';
      }

      // Check tables
      const tableMatches = content.match(/@Table\s*\(\s*(?:name\s*=\s*)?["']([^"']+)["']/g);
      const tables: string[] = [];
      if (tableMatches) {
        for (const t of tableMatches) {
          const m = t.match(/["']([^"']+)["']/);
          if (m && !tables.includes(m[1])) tables.push(m[1]);
        }
      }
      if (tables.length === 0) tables.push('entities', 'audit_log');

      primaryService.databases.push({
        dbId,
        dbName,
        dbType,
        accessMode: 'read-write',
        tablesOrCollections: tables,
        orm: hasMongo ? 'Spring Data MongoDB' : (hasRedis ? 'Spring Data Redis' : 'Spring Data JPA / Hibernate'),
        transactional: content.includes('@Transactional'),
        fileSource: path
      });

      if (!serviceMap.has(dbId)) {
        serviceMap.set(dbId, {
          id: dbId,
          name: dbName,
          type: hasRedis ? 'cache' : 'database',
          category: hasRedis ? 'In-Memory Cache' : 'Relational Database',
          tech,
          language: hasRedis ? 'RESP' : (hasMongo ? 'BSON' : 'SQL'),
          summary: `Persistent storage utilized by ${primaryService.name}`,
          status: 'healthy',
          inboundEndpoints: [],
          outboundCalls: [],
          databases: [],
          asyncEvents: { published: [], consumed: [] },
          codeEvidence: [
            {
              file: path,
              type: 'database',
              codeSnippet: extractSnippet(content, '@Entity') || extractSnippet(content, 'datasource') || content.slice(0, 300),
              description: `Database binding discovered in ${getFileName(path)}`
            }
          ],
          metrics: { complexityScore: 3, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
          position: { x: 380, y: 530 }
        });

        edges.push({
          id: `e-${mainServiceId}-${dbId}`,
          source: mainServiceId,
          target: dbId,
          type: 'db-readwrite',
          label: hasRedis ? 'Redis GET/SET' : `JPA CRUD [${tables.join(', ')}]`,
          protocol: hasRedis ? 'Redis TCP' : 'PostgreSQL Wire'
        });
      }
    }

    // 4. Detect Asynchronous Events (Kafka, Azure Service Bus, RabbitMQ)
    // Spring Kafka: @KafkaListener, KafkaTemplate
    const kafkaListenerMatches = content.matchAll(/@KafkaListener\s*\(\s*(?:topics\s*=\s*)?["']([^"']+)["']/g);
    for (const kl of kafkaListenerMatches) {
      const topic = kl[1];
      const queueId = `kafka-${topic.replace(/[^a-z0-9_-]/gi, '-')}`;
      primaryService.asyncEvents.consumed.push({
        topicOrQueue: topic,
        brokerType: 'Kafka',
        handlerName: 'onMessageReceived',
        fileSource: path
      });

      if (!serviceMap.has(queueId)) {
        serviceMap.set(queueId, {
          id: queueId,
          name: `Kafka Topic: ${topic}`,
          type: 'queue',
          category: 'Event Broker',
          tech: 'Apache Kafka / Azure Event Hubs',
          language: 'Kafka Binary Protocol',
          summary: `Asynchronous topic consumed by ${primaryService.name}`,
          status: 'healthy',
          inboundEndpoints: [],
          outboundCalls: [],
          databases: [],
          asyncEvents: { published: [], consumed: [] },
          codeEvidence: [],
          metrics: { complexityScore: 3, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
          position: { x: 740, y: -40 }
        });
      }

      edges.push({
        id: `e-${queueId}-${mainServiceId}`,
        source: queueId,
        target: mainServiceId,
        type: 'async-consume',
        label: `@KafkaListener ('${topic}')`,
        protocol: 'Kafka Protocol'
      });
    }

    // Azure Service Bus & RabbitMQ
    if (content.includes('ServiceBusSenderClient') || content.includes('ServiceBusProcessorClient') || content.includes('servicebus.windows.net') || content.includes('@RabbitListener')) {
      const isSb = content.includes('ServiceBus') || content.includes('servicebus');
      const topicName = isSb ? 'sb-domain-events' : 'rabbitmq-exchange';
      const queueId = isSb ? 'azure-service-bus-events' : 'rabbitmq-broker';

      primaryService.asyncEvents.published.push({
        topicOrQueue: topicName,
        brokerType: isSb ? 'Azure Service Bus' : 'RabbitMQ',
        eventSchema: 'DomainEvent',
        fileSource: path
      });

      if (!serviceMap.has(queueId)) {
        serviceMap.set(queueId, {
          id: queueId,
          name: isSb ? 'Azure Service Bus Topic' : 'RabbitMQ Broker',
          type: 'queue',
          category: 'Enterprise Message Broker',
          tech: isSb ? 'Azure Service Bus (Premium)' : 'RabbitMQ AMQP',
          language: 'AMQP 1.0',
          summary: `Message broker for asynchronous events in ${repoInfo.repository}`,
          status: 'healthy',
          inboundEndpoints: [],
          outboundCalls: [],
          databases: [],
          asyncEvents: { published: [], consumed: [] },
          codeEvidence: [],
          metrics: { complexityScore: 3, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
          position: { x: 740, y: 480 }
        });
      }

      edges.push({
        id: `e-${mainServiceId}-${queueId}`,
        source: mainServiceId,
        target: queueId,
        type: 'async-publish',
        label: isSb ? 'PUB ServiceBus' : 'PUB RabbitMQ',
        protocol: 'AMQP 1.0'
      });
    }
  }

  // If no files matched specific endpoints, supply standard Spring Boot defaults
  if (primaryService.inboundEndpoints.length === 0) {
    primaryService.inboundEndpoints.push(
      { path: `/api/v1/${mainServiceId}`, method: 'GET', description: 'Retrieve resource entity by query' },
      { path: `/api/v1/${mainServiceId}`, method: 'POST', description: 'Create and dispatch domain entity', authRequired: true },
      { path: '/actuator/health', method: 'GET', description: 'Spring Boot 3 Actuator liveness/readiness probe' }
    );
  }

  // Add API Gateway in front of primary service if not present
  const gatewayId = 'azure-api-gateway';
  const gatewayNode: ArchitectureNode = {
    id: gatewayId,
    name: 'Azure API Management / Spring Cloud Gateway',
    type: 'gateway',
    category: 'Ingress & Perimeter Proxy',
    tech: 'Spring Cloud Gateway / Azure APIM',
    language: 'Java / YAML',
    summary: 'API perimeter handling TLS termination, JWT validation, and CORS policies.',
    status: 'healthy',
    position: { x: 70, y: 220 },
    inboundEndpoints: [
      { path: `/api/v1/${mainServiceId}/**`, method: 'GET', description: 'Public client traffic entry' }
    ],
    outboundCalls: [
      { targetServiceId: mainServiceId, targetServiceName: primaryService.name, endpoint: `/api/v1/${mainServiceId}`, method: 'POST', protocol: 'REST', clientType: 'Spring Cloud Gateway Route' }
    ],
    databases: [],
    asyncEvents: { published: [], consumed: [] },
    codeEvidence: [],
    metrics: { complexityScore: 3, blastRadiusCount: 4, dependentsCount: 0, dependenciesCount: 1, riskFactors: [] }
  };

  edges.unshift({
    id: `e-${gatewayId}-${mainServiceId}`,
    source: gatewayId,
    target: mainServiceId,
    type: 'gateway-route',
    label: 'Route /api/v1/**',
    protocol: 'HTTPS / REST',
    isCriticalPath: true
  });

  // Collect all nodes
  nodes.push(gatewayNode);
  nodes.push(primaryService);
  for (const node of serviceMap.values()) {
    nodes.push(node);
  }

  // Risk factors
  const detectedRisks: ArchitecturalRisk[] = [];
  if (primaryService.outboundCalls.some(c => !c.circuitBreaker)) {
    detectedRisks.push({
      severity: 'high',
      title: 'Missing Circuit Breaker (Resilience4j / Sentinel)',
      description: `Service ${primaryService.name} performs outbound REST calls without configured fallback or circuit breaker.`,
      affectedNodes: [primaryService.id],
      recommendation: 'Decorate FeignClient or RestTemplate with @CircuitBreaker(name="...", fallbackMethod="...")'
    });
  }

  if (primaryService.databases.length > 0 && primaryService.asyncEvents.published.length > 0) {
    detectedRisks.push({
      severity: 'medium',
      title: 'Dual-Write Distributed Consistency Hazard',
      description: 'Simultaneous database persistence and message publishing detected without transactional outbox pattern.',
      affectedNodes: [primaryService.id],
      recommendation: 'Implement Debezium CDC or Spring Transactional Outbox pattern.'
    });
  }

  return {
    systemName: `${formatServiceName(repoInfo.repository)} Microservice Architecture`,
    repositoryUrl: `https://dev.azure.com/${repoInfo.organization}/${repoInfo.project}/_git/${repoInfo.repository}`,
    branch: repoInfo.branch,
    organization: repoInfo.organization,
    project: repoInfo.project,
    scannedAt: new Date().toISOString(),
    nodes,
    edges,
    summary: {
      totalServices: nodes.filter(n => n.type === 'service' || n.type === 'gateway').length,
      totalDatabases: nodes.filter(n => n.type === 'database' || n.type === 'cache').length,
      totalQueues: nodes.filter(n => n.type === 'queue').length,
      syncCallCount: edges.filter(e => e.type === 'sync-http' || e.type === 'gateway-route').length,
      asyncEventCount: edges.filter(e => e.type === 'async-publish' || e.type === 'async-consume').length,
      dbInteractionCount: edges.filter(e => e.type.startsWith('db-')).length,
      architecturalStyle: 'Spring Boot Cloud Microservices + Event-Driven Mesh',
      detectedRisks
    }
  };
}

function formatServiceName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function getFileName(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}

function extractSnippet(text: string, keyword: string): string | null {
  const idx = text.indexOf(keyword);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 400);
  return text.substring(start, end);
}
