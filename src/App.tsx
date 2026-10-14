import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ScannerBar } from './components/ScannerBar';
import { NodeGraphCanvas } from './components/NodeGraphCanvas';
import { ArchitectureInspector } from './components/ArchitectureInspector';
import { BlastRadiusBanner } from './components/BlastRadiusBanner';
import { SpringBootBackendModal } from './components/SpringBootBackendModal';
import { CodePasteModal } from './components/CodePasteModal';
import { ExportModal } from './components/ExportModal';
import { RisksScorecardModal } from './components/RisksScorecardModal';
import { ArchitectureGraph, ArchitectureNode, ArchitectureEdge, BlastRadiusResult } from './types';
import { 
  FolderGit2, 
  Sparkles, 
  Server, 
  Database, 
  ArrowRight, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  GitBranch,
  Layers,
  Zap,
  Radio
} from 'lucide-react';

interface ScanningTargetInfo {
  url: string;
  subPath?: string;
  serviceName?: string;
  repo?: string;
}

export default function App() {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState('');
  const [scanningTarget, setScanningTarget] = useState<ScanningTargetInfo | null>(null);

  // Selected elements
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ArchitectureEdge | null>(null);

  // Blast radius simulation
  const [blastRadiusMode, setBlastRadiusMode] = useState(false);
  const [blastRadiusResult, setBlastRadiusResult] = useState<BlastRadiusResult | null>(null);

  // Modals
  const [isSpringBootModalOpen, setIsSpringBootModalOpen] = useState(false);
  const [isCodePasteModalOpen, setIsCodePasteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRisksModalOpen, setIsRisksModalOpen] = useState(false);

  // Reset entire dashboard session
  const handleResetSession = useCallback(() => {
    setGraph(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setBlastRadiusResult(null);
    setBlastRadiusMode(false);
    setActivePreset('');
    setError(null);
    setLoading(false);
    setScanningTarget(null);
  }, []);

  // Load preset by ID with clean session reset
  const loadPreset = useCallback(async (presetId: string) => {
    // Clear previous graph immediately
    setGraph(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setBlastRadiusResult(null);
    setBlastRadiusMode(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/presets/${presetId}`);
      if (!res.ok) throw new Error(`Failed to load preset ${presetId}`);
      const data: ArchitectureGraph = await res.json();
      setGraph(data);
      setActivePreset(presetId);
      // Select primary service node by default
      const primaryService = data.nodes.find(n => n.type === 'service');
      setSelectedNode(primaryService || data.nodes[0] || null);
      setSelectedEdge(null);
      setBlastRadiusResult(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading preset');
    } finally {
      setLoading(false);
      setScanningTarget(null);
    }
  }, []);

  // Note: No default view on startup per user requirement! Dashboard starts in clean ready state.

  // Handle ADO & GitHub URL scanning with STRICT subpath isolation and session reset
  const handleScan = async (url: string, branch: string, pat?: string) => {
    // 1. Immediately reset whole dashboard and clear earlier session!
    setGraph(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setBlastRadiusResult(null);
    setBlastRadiusMode(false);
    setActivePreset('');
    setError(null);
    setLoading(true);

    // Extract target microservice info for real-time progress feedback
    try {
      const clean = url.trim();
      const u = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const segs = u.pathname.split('/').filter(Boolean);
      let detectedSub = '';
      let repoName = segs[1] || '';

      if (segs.length >= 4 && (segs[2] === 'tree' || segs[2] === 'blob')) {
        detectedSub = segs.slice(4).join('/');
      } else if (segs.length >= 3) {
        detectedSub = segs.slice(2).join('/');
      }
      const pParam = u.searchParams.get('path');
      if (pParam) detectedSub = pParam.replace(/^\/+/, '');

      const cleanSub = detectedSub.replace(/^\/+|\/+$/g, '');
      const sName = cleanSub ? cleanSub.split('/').pop() : repoName;

      setScanningTarget({
        url: clean,
        subPath: cleanSub || undefined,
        serviceName: sName,
        repo: repoName
      });
    } catch (_) {
      setScanningTarget({ url });
    }

    try {
      const res = await fetch('/api/analyze/ado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, branch, pat })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to analyze repository');
      }
      const data: ArchitectureGraph = await res.json();
      setGraph(data);

      // Target the specific microservice node strictly
      const urlSegments = url.trim().split('/').filter(Boolean);
      const lastSeg = urlSegments[urlSegments.length - 1]?.toLowerCase();
      const targetServiceNode = data.nodes.find(n => 
        (lastSeg && (n.id.toLowerCase().includes(lastSeg) || n.name.toLowerCase().includes(lastSeg)))
      ) || data.nodes.find(n => n.type === 'service') || data.nodes[0] || null;

      setSelectedNode(targetServiceNode);
      setSelectedEdge(null);
      setBlastRadiusResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to scan repository');
    } finally {
      setLoading(false);
      setScanningTarget(null);
    }
  };

  // Handle direct code paste
  const handleAnalyzeCode = async (systemName: string, files: Array<{ path: string; content: string }>) => {
    // Reset session before parsing custom code
    setGraph(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setBlastRadiusResult(null);
    setBlastRadiusMode(false);
    setActivePreset('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analyze/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemName, files })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse code');
      }
      const data: ArchitectureGraph = await res.json();
      setGraph(data);
      setSelectedNode(data.nodes.find(n => n.type === 'service') || data.nodes[0] || null);
      setSelectedEdge(null);
      setBlastRadiusResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to parse code');
    } finally {
      setLoading(false);
    }
  };

  // Simulate outage of a node
  const handleSimulateOutage = async (nodeId: string) => {
    if (!graph) return;
    try {
      const res = await fetch('/api/blast-radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failedNodeId: nodeId, graph })
      });
      if (!res.ok) throw new Error('Failed to calculate blast radius');
      const result: BlastRadiusResult = await res.json();
      setBlastRadiusResult(result);
      setBlastRadiusMode(true);
      const failedNode = graph.nodes.find(n => n.id === nodeId);
      if (failedNode) setSelectedNode(failedNode);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Drag node position update
  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    setGraph(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n)
      };
    });
  };

  const handleSelectNodeById = (nodeId: string) => {
    if (!graph) return;
    const targetNode = graph.nodes.find(n => n.id === nodeId);
    if (targetNode) {
      setSelectedNode(targetNode);
      setSelectedEdge(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Header */}
      <Navbar
        graph={graph}
        activePreset={activePreset}
        onSelectPreset={loadPreset}
        onResetSession={handleResetSession}
        onOpenSpringBootCode={() => setIsSpringBootModalOpen(true)}
        onOpenCodePaste={() => setIsCodePasteModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenRisks={() => setIsRisksModalOpen(true)}
        blastRadiusMode={blastRadiusMode}
        onToggleBlastRadius={() => {
          if (blastRadiusMode) {
            setBlastRadiusMode(false);
            setBlastRadiusResult(null);
          } else {
            setBlastRadiusMode(true);
            const mainService = graph?.nodes.find(n => n.type === 'service');
            if (mainService) handleSimulateOutage(mainService.id);
          }
        }}
        loading={loading}
        onRefresh={() => {
          if (activePreset) {
            loadPreset(activePreset);
          } else if (graph?.repositoryUrl) {
            handleScan(graph.repositoryUrl, graph.branch || 'main');
          }
        }}
      />

      {/* ADO & GitHub Repository Scanner Bar */}
      <ScannerBar
        onScan={handleScan}
        onResetSession={handleResetSession}
        loading={loading}
        graph={graph}
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace: Interactive Canvas, Loading State, or Ready Landing */}
      <main className="flex-1 relative flex overflow-hidden">
        {loading ? (
          /* High-Tech Dynamic Scanning Progress State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-lg w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
              {/* Spinner radar */}
              <div className="w-16 h-16 mx-auto mb-4 relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                <div className="w-14 h-14 rounded-full border-2 border-t-cyan-400 border-r-blue-500 border-b-transparent border-l-transparent animate-spin" />
                <FolderGit2 className="w-6 h-6 text-cyan-400 absolute" />
              </div>

              <h2 className="text-lg font-bold text-white mb-1 flex items-center justify-center gap-2">
                <span>Reading Strictly From New Path</span>
              </h2>

              <p className="text-xs text-slate-400 mb-4">
                Earlier dashboard session cleared. Isolating targeted internal microservice folder.
              </p>

              {/* Target Path Display */}
              {scanningTarget?.subPath && (
                <div className="mb-4 p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-left">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 mb-1">
                    Target Internal Microservice
                  </div>
                  <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    {scanningTarget.subPath}
                  </div>
                  <div className="text-[11px] font-mono text-cyan-300/80 mt-1 truncate">
                    Repository: {scanningTarget.repo || 'ecommerce-microservices'}
                  </div>
                </div>
              )}

              {/* Progress Checklist */}
              <div className="space-y-2 text-left text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Previous session & cache cleared</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  <span>Isolating folder: {scanningTarget?.subPath || 'target microservice'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0 flex items-center justify-center text-[10px]">3</div>
                  <span>Parsing Spring Boot application.yml, Controllers & RestClient calls</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0 flex items-center justify-center text-[10px]">4</div>
                  <span>Generating microservice topology & blast-radius graph</span>
                </div>
              </div>
            </div>
          </div>
        ) : graph ? (
          /* Active Architecture Topology Graph Canvas */
          <NodeGraphCanvas
            graph={graph}
            selectedNodeId={selectedNode?.id || null}
            onSelectNode={(node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            selectedEdgeId={selectedEdge?.id || null}
            onSelectEdge={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
            blastRadiusResult={blastRadiusResult}
            blastRadiusMode={blastRadiusMode}
            onSimulateNodeFailure={handleSimulateOutage}
            onUpdateNodePosition={handleUpdateNodePosition}
            onScanRepository={(url) => handleScan(url, 'main')}
          />
        ) : (
          /* Ready Landing State When Dashboard is Reset / Cleared */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-center relative overflow-y-auto">
            <div className="max-w-2xl w-full my-auto">
              {/* Hero Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono mb-4">
                <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Monorepo & Multi-Module Microservice Mapper</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
                Target Any Internal Microservice Subfolder
              </h1>

              <p className="text-sm text-slate-400 mb-6 max-w-lg mx-auto">
                Paste any GitHub or Azure DevOps subfolder URL. The mapper strictly isolates that microservice, mapping its ingress routes, downstream RestClient calls, databases, and Kafka streams.
              </p>

              {/* Quick Select Microservice Cards (GitHub & Azure DevOps Migrated) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 text-left">
                {/* 1. GitHub payment-service */}
                <button
                  type="button"
                  onClick={() => handleScan('https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/payment-service', 'main')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>💳</span> Payment Service
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      GitHub
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Spring Boot 3.3, RestClient calls to Order & Auth, PostgreSQL, Kafka Profile Onboarding.
                  </p>
                  <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map payment-service</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* 2. GitHub product-service */}
                <button
                  type="button"
                  onClick={() => handleScan('https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/product-service', 'main')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>📦</span> Product Service
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      GitHub
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Spring Boot 3.3, Products & Categories REST endpoints, PostgreSQL, Keycloak OAuth2.
                  </p>
                  <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map product-service</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* 3. GitHub order-service */}
                <button
                  type="button"
                  onClick={() => handleScan('https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/order-service', 'main')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>🛒</span> Order Service
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      GitHub
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Order Processing, RestClient to Auth & Product services, PostgreSQL 16 persistence.
                  </p>
                  <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map order-service</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* 4. Azure Repos: payment-service (Azure Migrated) */}
                <button
                  type="button"
                  onClick={() => handleScan('https://dev.azure.com/ecommerce-cloud/retail-mesh/_git/ecommerce-microservices?path=%2Fpayment-service', 'main')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>💳</span> Payment Service
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                      Azure Repos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Azure-migrated payment-service: ACA container, Azure PostgreSQL Flexible, Azure Event Hubs.
                  </p>
                  <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map Azure payment-service</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* 5. Azure Repos: product-service (Azure Migrated) */}
                <button
                  type="button"
                  onClick={() => handleScan('https://dev.azure.com/ecommerce-cloud/retail-mesh/_git/ecommerce-microservices?path=%2Fproduct-service', 'main')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>📦</span> Product Service
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                      Azure Repos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Azure-migrated product-service: Azure APIM, Azure Container Apps, Azure DB for PostgreSQL.
                  </p>
                  <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map Azure product-service</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* 6. Azure DevOps Core Banking */}
                <button
                  type="button"
                  onClick={() => loadPreset('fintech-core')}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>🏦</span> Core Banking Mesh
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                      Azure DevOps
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    Azure DevOps repo, Saga Orchestration, Azure Service Bus, PostgreSQL mesh.
                  </p>
                  <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Map Banking Mesh</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              </div>

              {/* Instructions footer */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-850 text-xs text-slate-500 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Paste any URL into the search bar above to reset the session and isolate that microservice automatically.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Side Inspector Drawer */}
        <ArchitectureInspector
          node={selectedNode}
          edge={selectedEdge}
          onClose={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
          }}
          onSimulateOutage={handleSimulateOutage}
          onSelectNodeById={handleSelectNodeById}
        />

        {/* Bottom Floating Blast Radius Banner */}
        <BlastRadiusBanner
          result={blastRadiusResult}
          onClose={() => {
            setBlastRadiusResult(null);
            setBlastRadiusMode(false);
          }}
        />
      </main>

      {/* Modals */}
      <SpringBootBackendModal
        isOpen={isSpringBootModalOpen}
        onClose={() => setIsSpringBootModalOpen(false)}
      />

      <CodePasteModal
        isOpen={isCodePasteModalOpen}
        onClose={() => setIsCodePasteModalOpen(false)}
        onAnalyzeCode={handleAnalyzeCode}
        loading={loading}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        graph={graph}
      />

      <RisksScorecardModal
        isOpen={isRisksModalOpen}
        onClose={() => setIsRisksModalOpen(false)}
        graph={graph}
        onSelectNode={handleSelectNodeById}
      />
    </div>
  );
}
