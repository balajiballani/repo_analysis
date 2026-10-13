export type NodeType = 'service' | 'database' | 'queue' | 'cache' | 'gateway' | 'external';
export type NodeStatus = 'healthy' | 'warning' | 'degraded';

export interface InboundEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'gRPC';
  description: string;
  authRequired?: boolean;
  fileSource?: string;
  rateLimit?: string;
}

export interface OutboundCall {
  targetServiceId: string;
  targetServiceName: string;
  endpoint: string;
  method: string;
  protocol: 'REST' | 'gRPC' | 'GraphQL' | 'SOAP';
  clientType: string; // e.g., "RestTemplate", "WebClient", "FeignClient", "HttpClient", "gRPC Stub", "Axios"
  circuitBreaker?: boolean;
  retryPolicy?: boolean;
  timeoutMs?: number;
  fileSource?: string;
}

export interface DatabaseInteraction {
  dbId: string;
  dbName: string;
  dbType: string; // e.g. "PostgreSQL", "Azure Cosmos DB", "Redis", "MySQL", "MongoDB"
  accessMode: 'read-write' | 'read-only' | 'write-only';
  tablesOrCollections: string[];
  orm: string; // e.g. "Spring Data JPA / Hibernate", "Entity Framework Core", "Dapper", "TypeORM"
  transactional?: boolean;
  fileSource?: string;
}

export interface AsyncEventPubSub {
  published: Array<{
    topicOrQueue: string;
    brokerType: 'Kafka' | 'Azure Service Bus' | 'RabbitMQ' | 'Event Hubs' | 'SQS/SNS';
    eventSchema: string;
    payloadExample?: string;
    frequency?: string;
    fileSource?: string;
  }>;
  consumed: Array<{
    topicOrQueue: string;
    brokerType: 'Kafka' | 'Azure Service Bus' | 'RabbitMQ' | 'Event Hubs' | 'SQS/SNS';
    consumerGroup?: string;
    handlerName?: string;
    deadLetterQueue?: string;
    fileSource?: string;
  }>;
}

export interface CodeEvidence {
  file: string;
  type: 'controller' | 'client' | 'database' | 'messaging' | 'config';
  codeSnippet: string;
  description: string;
}

export interface ArchitectureNode {
  id: string;
  name: string;
  type: NodeType;
  category: string;
  tech: string;
  language: string;
  summary: string;
  repoUrl?: string;
  repoPath?: string;
  status: NodeStatus;
  inboundEndpoints: InboundEndpoint[];
  outboundCalls: OutboundCall[];
  databases: DatabaseInteraction[];
  asyncEvents: AsyncEventPubSub;
  codeEvidence: CodeEvidence[];
  metrics: {
    complexityScore: number;
    blastRadiusCount: number;
    dependentsCount: number;
    dependenciesCount: number;
    riskFactors: string[];
  };
  position: { x: number; y: number };
}

export type EdgeType = 
  | 'sync-http' 
  | 'sync-grpc' 
  | 'db-readwrite' 
  | 'db-read' 
  | 'db-write' 
  | 'async-publish' 
  | 'async-consume' 
  | 'gateway-route';

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label: string;
  protocol: string;
  details?: string;
  evidence?: string;
  isCriticalPath?: boolean;
}

export interface ArchitecturalRisk {
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedNodes: string[];
  recommendation: string;
}

export interface ArchitectureGraph {
  systemName: string;
  repositoryUrl: string;
  branch: string;
  organization?: string;
  project?: string;
  scannedAt: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  summary: {
    totalServices: number;
    totalDatabases: number;
    totalQueues: number;
    syncCallCount: number;
    asyncEventCount: number;
    dbInteractionCount: number;
    architecturalStyle: string;
    detectedRisks: ArchitecturalRisk[];
  };
}

export interface AnalyzeAdoRequest {
  url: string;
  pat?: string;
  branch?: string;
  samplePresetId?: string;
}

export interface DirectCodeScanRequest {
  systemName?: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}
