import { GoogleGenAI, Type } from '@google/genai';
import { ArchitectureGraph, ArchitectureNode, ArchitectureEdge } from './types.js';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeArchitectureWithGemini(params: {
  repoUrl: string;
  repoName: string;
  files: Array<{ path: string; content: string }>;
  detectedInfo?: string;
}): Promise<ArchitectureGraph | null> {
  const ai = getAiClient();
  if (!ai) {
    return null;
  }

  const fileSnippets = params.files
    .slice(0, 15)
    .map(f => `--- File: ${f.path} ---\n${f.content.slice(0, 2000)}`)
    .join('\n\n');

  const prompt = `You are a Principal Cloud & Microservices Enterprise Architect analyzing an Azure DevOps (ADO) repository.
Repository URL: ${params.repoUrl}
Repository Name: ${params.repoName}

Analyze the provided repository files and extract a complete microservice dependency architecture graph:
1. Microservices / API Gateways / Background workers
2. Where each service makes outbound calls to other microservices (HTTP REST, gRPC, Feign, WebClient, HttpClient, Axios)
3. Inbound API endpoints exposed by each service
4. Database interactions (PostgreSQL, Azure SQL, Cosmos DB, MongoDB, Redis, MySQL) with tables and ORM
5. Asynchronous event interactions (Kafka topics, Azure Service Bus queues/topics, RabbitMQ, Event Hubs) - both published and consumed events
6. Code evidence snippets (file paths, controller/client/messaging snippets)
7. Architectural risks (e.g. cascading failures, shared database anti-pattern, missing circuit breakers, circular dependencies)

Files to analyze:
${fileSnippets || 'No direct files provided, infer typical Azure DevOps enterprise microservice topology for this repository domain.'}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You extract microservice dependency maps from Azure DevOps codebases. Return valid JSON adhering to the provided schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            systemName: { type: Type.STRING },
            architecturalStyle: { type: Type.STRING },
            summary: {
              type: Type.OBJECT,
              properties: {
                totalServices: { type: Type.INTEGER },
                totalDatabases: { type: Type.INTEGER },
                totalQueues: { type: Type.INTEGER },
                syncCallCount: { type: Type.INTEGER },
                asyncEventCount: { type: Type.INTEGER },
                dbInteractionCount: { type: Type.INTEGER },
                architecturalStyle: { type: Type.STRING },
                detectedRisks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      severity: { type: Type.STRING },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      affectedNodes: { type: Type.ARRAY, items: { type: Type.STRING } },
                      recommendation: { type: Type.STRING }
                    },
                    required: ['severity', 'title', 'description', 'affectedNodes', 'recommendation']
                  }
                }
              },
              required: ['totalServices', 'totalDatabases', 'totalQueues', 'syncCallCount', 'asyncEventCount', 'dbInteractionCount', 'architecturalStyle', 'detectedRisks']
            },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  category: { type: Type.STRING },
                  tech: { type: Type.STRING },
                  language: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  status: { type: Type.STRING },
                  inboundEndpoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        path: { type: Type.STRING },
                        method: { type: Type.STRING },
                        description: { type: Type.STRING },
                        authRequired: { type: Type.BOOLEAN }
                      },
                      required: ['path', 'method', 'description']
                    }
                  },
                  outboundCalls: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        targetServiceId: { type: Type.STRING },
                        targetServiceName: { type: Type.STRING },
                        endpoint: { type: Type.STRING },
                        method: { type: Type.STRING },
                        protocol: { type: Type.STRING },
                        clientType: { type: Type.STRING },
                        circuitBreaker: { type: Type.BOOLEAN }
                      },
                      required: ['targetServiceId', 'targetServiceName', 'endpoint', 'method', 'protocol', 'clientType']
                    }
                  },
                  databases: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        dbId: { type: Type.STRING },
                        dbName: { type: Type.STRING },
                        dbType: { type: Type.STRING },
                        accessMode: { type: Type.STRING },
                        tablesOrCollections: { type: Type.ARRAY, items: { type: Type.STRING } },
                        orm: { type: Type.STRING }
                      },
                      required: ['dbId', 'dbName', 'dbType', 'accessMode', 'tablesOrCollections', 'orm']
                    }
                  },
                  asyncEvents: {
                    type: Type.OBJECT,
                    properties: {
                      published: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            topicOrQueue: { type: Type.STRING },
                            brokerType: { type: Type.STRING },
                            eventSchema: { type: Type.STRING }
                          },
                          required: ['topicOrQueue', 'brokerType', 'eventSchema']
                        }
                      },
                      consumed: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            topicOrQueue: { type: Type.STRING },
                            brokerType: { type: Type.STRING },
                            handlerName: { type: Type.STRING }
                          },
                          required: ['topicOrQueue', 'brokerType']
                        }
                      }
                    },
                    required: ['published', 'consumed']
                  },
                  codeEvidence: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        file: { type: Type.STRING },
                        type: { type: Type.STRING },
                        codeSnippet: { type: Type.STRING },
                        description: { type: Type.STRING }
                      },
                      required: ['file', 'type', 'codeSnippet', 'description']
                    }
                  },
                  metrics: {
                    type: Type.OBJECT,
                    properties: {
                      complexityScore: { type: Type.NUMBER },
                      blastRadiusCount: { type: Type.NUMBER },
                      dependentsCount: { type: Type.NUMBER },
                      dependenciesCount: { type: Type.NUMBER },
                      riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['complexityScore', 'blastRadiusCount', 'dependentsCount', 'dependenciesCount', 'riskFactors']
                  }
                },
                required: ['id', 'name', 'type', 'category', 'tech', 'language', 'summary', 'status', 'inboundEndpoints', 'outboundCalls', 'databases', 'asyncEvents', 'codeEvidence', 'metrics']
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  type: { type: Type.STRING },
                  label: { type: Type.STRING },
                  protocol: { type: Type.STRING },
                  details: { type: Type.STRING },
                  isCriticalPath: { type: Type.BOOLEAN }
                },
                required: ['id', 'source', 'target', 'type', 'label', 'protocol']
              }
            }
          },
          required: ['systemName', 'summary', 'nodes', 'edges']
        }
      }
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text);

    // Compute automatic nice layout coordinates for nodes
    const positionedNodes = parsed.nodes.map((node: any, idx: number) => {
      // Columns based on type
      let col = 1;
      if (node.type === 'gateway') col = 0;
      else if (node.type === 'service') col = 1;
      else if (node.type === 'queue') col = 2;
      else if (node.type === 'database' || node.type === 'cache') col = 2;
      else if (node.type === 'external') col = 3;

      const row = idx % 4;
      return {
        ...node,
        status: node.status || 'healthy',
        position: {
          x: 80 + col * 340,
          y: 70 + row * 190 + (col % 2 === 1 ? 40 : 0)
        }
      };
    });

    return {
      systemName: parsed.systemName || `${params.repoName} Microservice Mesh`,
      repositoryUrl: params.repoUrl,
      branch: 'main',
      scannedAt: new Date().toISOString(),
      summary: parsed.summary,
      nodes: positionedNodes,
      edges: parsed.edges
    };
  } catch (err) {
    console.error('Gemini architecture analysis error:', err);
    return null;
  }
}
