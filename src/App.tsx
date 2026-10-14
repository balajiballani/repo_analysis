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
          /* Clean, Pristine Landing State - No Stored Data */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-center relative overflow-y-auto">
            {/* Ambient Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            <div className="max-w-xl w-full my-auto relative z-10">
              {/* Clean Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono mb-5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Stateless Architecture Analyzer</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
                Live Repository Architecture Mapper
              </h1>

              <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                Paste any GitHub or Azure DevOps repository or microservice subfolder URL in the scanner bar above. The codebase is read live on-demand with zero stored architecture.
              </p>

              {/* 3 Step Process Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-mono text-xs font-bold mb-2.5">
                    1
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mb-1">Live Remote Fetch</div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    Fetches files directly from GitHub or Azure Repos in real time.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-xs font-bold mb-2.5">
                    2
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mb-1">Dynamic Code AST</div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    Extracts REST controllers, RestClients, DB entities, and Kafka topics.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs font-bold mb-2.5">
                    3
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mb-1">Zero Persistence</div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    Completely stateless session. New URL inputs replace old graphs instantly.
                  </div>
                </div>
              </div>

              {/* URL Example Tips */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-850 text-left text-xs font-mono space-y-1.5 text-slate-400">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                  Supported URL Formats:
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  • GitHub Root: <span className="text-cyan-400">https://github.com/org/repo</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  • GitHub Subfolder: <span className="text-cyan-400">https://github.com/org/repo/tree/main/service-name</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  • Azure Repos: <span className="text-blue-400">https://dev.azure.com/org/proj/_git/repo?path=/service-name</span>
                </div>
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
