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

export default function App() {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState('fintech-core');

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

  // Load initial preset
  const loadPreset = useCallback(async (presetId: string) => {
    setLoading(true);
    setError(null);
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
    }
  }, []);

  useEffect(() => {
    loadPreset('fintech-core');
  }, [loadPreset]);

  // Handle ADO URL scanning
  const handleScan = async (url: string, branch: string, pat?: string) => {
    setLoading(true);
    setError(null);
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
      const primaryService = data.nodes.find(n => n.type === 'service');
      setSelectedNode(primaryService || data.nodes[0] || null);
      setSelectedEdge(null);
      setBlastRadiusResult(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle direct code paste
  const handleAnalyzeCode = async (systemName: string, files: Array<{ path: string; content: string }>) => {
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
      setError(err.message);
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
        onRefresh={() => loadPreset(activePreset)}
      />

      {/* ADO Repository Scanner Bar */}
      <ScannerBar
        onScan={handleScan}
        loading={loading}
        graph={graph}
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace: Interactive Canvas + Detail Drawer */}
      <main className="flex-1 relative flex overflow-hidden">
        {graph ? (
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
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            {loading ? 'Initializing Microservice Graph...' : 'No repository architecture loaded'}
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
