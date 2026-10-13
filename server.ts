import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { PRESETS, PRESET_FINTECH } from './server/presets.js';
import { parseAdoUrl, fetchAdoRepositoryFiles, parseCodebaseArchitecture } from './server/adoScanner.js';
import { analyzeArchitectureWithGemini } from './server/geminiAnalyzer.js';
import { ArchitectureGraph, ArchitectureEdge, ArchitectureNode } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    backend: 'Spring Boot Microservices & Node.js Bridge',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// Get all presets list
app.get('/api/presets', (_req: Request, res: Response) => {
  const list = Object.entries(PRESETS).map(([id, g]) => ({
    id,
    name: g.systemName,
    style: g.summary.architecturalStyle,
    servicesCount: g.summary.totalServices,
    databasesCount: g.summary.totalDatabases,
    queuesCount: g.summary.totalQueues,
    repositoryUrl: g.repositoryUrl,
    branch: g.branch
  }));
  res.json(list);
});

// Get specific preset
app.get('/api/presets/:id', (req: Request, res: Response) => {
  const preset = PRESETS[req.params.id];
  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  res.json(preset);
});

// Analyze Azure DevOps Repository URL
app.post('/api/analyze/ado', async (req: Request, res: Response) => {
  try {
    const { url, pat, branch = 'main', samplePresetId } = req.body;

    if (samplePresetId && PRESETS[samplePresetId]) {
      return res.json(PRESETS[samplePresetId]);
    }

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Repository URL is required.' });
    }

    const repoInfo = parseAdoUrl(url, branch);

    // If matches known preset name, return rich preset with updated URL
    if (url.toLowerCase().includes('payment') || url.toLowerCase().includes('banking')) {
      const g = JSON.parse(JSON.stringify(PRESET_FINTECH)) as ArchitectureGraph;
      g.repositoryUrl = url;
      g.branch = branch;
      return res.json(g);
    }
    if (url.toLowerCase().includes('order') || url.toLowerCase().includes('retail') || url.toLowerCase().includes('commerce')) {
      const g = JSON.parse(JSON.stringify(PRESETS['ecommerce-mesh'])) as ArchitectureGraph;
      g.repositoryUrl = url;
      g.branch = branch;
      return res.json(g);
    }
    if (url.toLowerCase().includes('health') || url.toLowerCase().includes('claim') || url.toLowerCase().includes('clinic')) {
      const g = JSON.parse(JSON.stringify(PRESETS['healthcare-telehealth'])) as ArchitectureGraph;
      g.repositoryUrl = url;
      g.branch = branch;
      return res.json(g);
    }

    // Try fetching files from ADO if PAT is provided
    let files: Array<{ path: string; content: string }> = [];
    if (pat) {
      files = await fetchAdoRepositoryFiles({
        org: repoInfo.organization,
        project: repoInfo.project,
        repo: repoInfo.repository,
        branch: repoInfo.branch,
        pat
      });
    }

    // Try Gemini AI if API key is present
    if (process.env.GEMINI_API_KEY) {
      const geminiResult = await analyzeArchitectureWithGemini({
        repoUrl: url,
        repoName: repoInfo.repository,
        files
      });
      if (geminiResult) {
        return res.json(geminiResult);
      }
    }

    // Fallback to static Spring Boot AST parser
    const graph = parseCodebaseArchitecture(repoInfo, files);
    res.json(graph);
  } catch (err: any) {
    console.error('Error analyzing ADO repository:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze repository' });
  }
});

// Analyze direct code / files pasted by user
app.post('/api/analyze/code', async (req: Request, res: Response) => {
  try {
    const { systemName = 'Custom Spring Boot Service', files = [] } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for analysis' });
    }

    const repoInfo = {
      organization: 'custom-org',
      project: 'spring-mesh',
      repository: systemName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      branch: 'main',
      isAzureDevOps: true
    };

    if (process.env.GEMINI_API_KEY) {
      const geminiResult = await analyzeArchitectureWithGemini({
        repoUrl: `https://dev.azure.com/custom-org/spring-mesh/_git/${repoInfo.repository}`,
        repoName: systemName,
        files
      });
      if (geminiResult) {
        return res.json(geminiResult);
      }
    }

    const graph = parseCodebaseArchitecture(repoInfo, files);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to parse code' });
  }
});

// Blast Radius Calculation
app.post('/api/blast-radius', (req: Request, res: Response) => {
  const { failedNodeId, graph }: { failedNodeId: string; graph: ArchitectureGraph } = req.body;

  if (!failedNodeId || !graph || !graph.nodes) {
    return res.status(400).json({ error: 'failedNodeId and graph are required' });
  }

  const failedNode = graph.nodes.find(n => n.id === failedNodeId);
  if (!failedNode) {
    return res.status(404).json({ error: 'Node not found' });
  }

  // Calculate directly impacted: nodes that call this node
  const directlyImpacted = new Set<string>();
  const criticalPaths: string[] = [];

  for (const edge of graph.edges) {
    if (edge.target === failedNodeId) {
      directlyImpacted.add(edge.source);
      criticalPaths.push(`${edge.source} -> ${failedNodeId} [${edge.label}]`);
    }
  }

  // Calculate cascaded impacted: nodes that call directly impacted nodes
  const cascaded = new Set<string>();
  const queue = Array.from(directlyImpacted);
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.target === current && !directlyImpacted.has(edge.source) && edge.source !== failedNodeId) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          cascaded.add(edge.source);
          queue.push(edge.source);
          criticalPaths.push(`${edge.source} -> ${current} (Cascading Failure)`);
        }
      }
    }
  }

  // Degraded: nodes that consume from this node if it's a queue/database
  const degraded = new Set<string>();
  if (failedNode.type === 'queue' || failedNode.type === 'database' || failedNode.type === 'cache') {
    for (const edge of graph.edges) {
      if (edge.source === failedNodeId) {
        degraded.add(edge.target);
      }
    }
  }

  const totalImpactedCount = 1 + directlyImpacted.size + cascaded.size + degraded.size;
  const percentage = Math.round((totalImpactedCount / graph.nodes.length) * 100);

  const unaffected = graph.nodes
    .filter(n => n.id !== failedNodeId && !directlyImpacted.has(n.id) && !cascaded.has(n.id) && !degraded.has(n.id))
    .map(n => n.id);

  res.json({
    failedNodeId,
    failedNodeName: failedNode.name,
    directlyImpactedNodes: Array.from(directlyImpacted),
    cascadedImpactedNodes: Array.from(cascaded),
    degradedNodes: Array.from(degraded),
    unaffectedNodes: unaffected,
    totalBlastRadiusPercentage: percentage,
    riskSummary: percentage > 50
      ? `CRITICAL OUTAGE RISK: Failure of ${failedNode.name} impacts ${percentage}% of the system ecosystem.`
      : `Moderate blast radius: Outage affects ${totalImpactedCount} components (${percentage}% of topology).`,
    criticalFailurePaths: criticalPaths
  });
});

// View Spring Boot Java Backend source code files
app.get('/api/backend/code', (_req: Request, res: Response) => {
  try {
    const baseDir = path.resolve(__dirname, 'backend-spring-boot');
    const read = (relPath: string) => {
      const full = path.join(baseDir, relPath);
      if (fs.existsSync(full)) {
        return fs.readFileSync(full, 'utf-8');
      }
      return '';
    };

    const files = [
      {
        path: 'pom.xml',
        language: 'xml',
        description: 'Maven Project Object Model with Spring Boot 3.3.4, Spring Cloud OpenFeign, Kafka, Actuator',
        content: read('pom.xml')
      },
      {
        path: 'src/main/resources/application.yml',
        language: 'yaml',
        description: 'Spring Boot Configuration: port 8080, Azure DevOps API versions, timeout, Actuator',
        content: read('src/main/resources/application.yml')
      },
      {
        path: 'src/main/java/com/adomapper/AdoArchitectureMapperApplication.java',
        language: 'java',
        description: 'Spring Boot Main Application & CORS Configuration',
        content: read('src/main/java/com/adomapper/AdoArchitectureMapperApplication.java')
      },
      {
        path: 'src/main/java/com/adomapper/controller/ArchitectureAnalysisController.java',
        language: 'java',
        description: 'Spring Boot REST Controller handling /api/v1/architecture endpoints',
        content: read('src/main/java/com/adomapper/controller/ArchitectureAnalysisController.java')
      },
      {
        path: 'src/main/java/com/adomapper/service/SpringMicroserviceAstParserService.java',
        language: 'java',
        description: 'Java Service inspecting @RestController, @FeignClient, @Entity, @KafkaListener AST nodes',
        content: read('src/main/java/com/adomapper/service/SpringMicroserviceAstParserService.java')
      },
      {
        path: 'src/main/java/com/adomapper/dto/Dtos.java',
        language: 'java',
        description: 'Java 21 Record DTOs for Architecture Nodes, Edges, Risk Scorecards, and Blast Radius',
        content: read('src/main/java/com/adomapper/dto/Dtos.java')
      }
    ];

    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read backend code files: ' + err.message });
  }
});

// Setup Vite dev server or static dist
async function setupServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Architecture Mapper] Server running at http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
});
