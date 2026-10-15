export type NodeType = 'service' | 'database' | 'queue' | 'cache' | 'gateway' | 'external';
export type NodeStatus = 'healthy' | 'warning' | 'degraded';

export type ResolutionConfidence = 
  | 'AST_SEMANTIC_RESOLVED' 
  | 'AST_SYNTACTIC_MATCH' 
  | 'CONFIGURATION_GROUNDED' 
  | 'FALLBACK_HEURISTIC';

export interface InboundEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'gRPC';
  description: string;
  authRequired?: boolean;
  fileSource?: string;
  rateLimit?: string;
  resolutionConfidence?: ResolutionConfidence;
  astProvenance?: string;
}

export interface OutboundCall {
  targetServiceId: string;
  targetServiceName: string;
  endpoint: string;
  method: string;
  protocol: 'REST' | 'gRPC' | 'GraphQL' | 'SOAP';
  clientType: string;
  circuitBreaker?: boolean;
  retryPolicy?: boolean;
  timeoutMs?: number;
  fileSource?: string;
  resolutionConfidence?: ResolutionConfidence;
  astProvenance?: string;
  uncertaintyReason?: string;
}

export interface DatabaseInteraction {
  dbId: string;
  dbName: string;
  dbType: string;
  accessMode: 'read-write' | 'read-only' | 'write-only';
  tablesOrCollections: string[];
  orm: string;
  transactional?: boolean;
  fileSource?: string;
  resolutionConfidence?: ResolutionConfidence;
  astProvenance?: string;
}

export interface AsyncEventPubSub {
  published: Array<{
    topicOrQueue: string;
    brokerType: 'Kafka' | 'Azure Service Bus' | 'RabbitMQ' | 'Event Hubs' | 'SQS/SNS';
    eventSchema: string;
    payloadExample?: string;
    frequency?: string;
    fileSource?: string;
    resolutionConfidence?: ResolutionConfidence;
    astProvenance?: string;
  }>;
  consumed: Array<{
    topicOrQueue: string;
    brokerType: 'Kafka' | 'Azure Service Bus' | 'RabbitMQ' | 'Event Hubs' | 'SQS/SNS';
    consumerGroup?: string;
    handlerName?: string;
    deadLetterQueue?: string;
    fileSource?: string;
    resolutionConfidence?: ResolutionConfidence;
    astProvenance?: string;
  }>;
}

export interface CodeEvidence {
  file: string;
  type: 'controller' | 'client' | 'database' | 'messaging' | 'config' | 'ast-symbol';
  codeSnippet: string;
  description: string;
  astKind?: string;
  resolutionConfidence?: ResolutionConfidence;
  symbolName?: string;
  uncertaintyReason?: string;
}

export interface AzureCloudSpec {
  targetCompute: string;
  targetDatabase?: string;
  targetMessaging?: string;
  targetGateway?: string;
  targetIdentity?: string;
  targetMonitoring?: string;
  targetSecrets?: string;
  readinessScore: number;
  recommendedSteps: string[];
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
  azureCloud?: AzureCloudSpec;
  metrics: {
    complexityScore: number;
    blastRadiusCount: number;
    dependentsCount: number;
    dependenciesCount: number;
    riskFactors: string[];
  };
  position: { x: number; y: number };
  analysisStrategy?: ResolutionConfidence;
  astMetadata?: {
    parsedFilesCount: number;
    classesCount: number;
    methodsCount: number;
    annotationsCount: number;
    unresolvedSymbols: string[];
    uncertaintyNotes: string[];
  };
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
  cloudProvider?: 'azure' | 'github' | 'multi-cloud';
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

export interface BlastRadiusResult {
  failedNodeId: string;
  failedNodeName: string;
  directlyImpactedNodes: string[];
  cascadedImpactedNodes: string[];
  degradedNodes: string[];
  unaffectedNodes: string[];
  totalBlastRadiusPercentage: number;
  riskSummary: string;
  criticalFailurePaths: string[];
}

export interface BackendSourceFile {
  path: string;
  language: string;
  description: string;
  content: string;
}
