import React from 'react';
import { 
  GitBranch, 
  Layers, 
  Flame, 
  Coffee, 
  ShieldAlert, 
  Download, 
  RefreshCw,
  Code,
  RotateCcw,
  FolderGit2
} from 'lucide-react';
import { ArchitectureGraph } from '../types';

interface NavbarProps {
  graph: ArchitectureGraph | null;
  activePreset: string;
  onSelectPreset: (presetId: string) => void;
  onResetSession?: () => void;
  onOpenSpringBootCode: () => void;
  onOpenCodePaste: () => void;
  onOpenExport: () => void;
  onOpenRisks: () => void;
  blastRadiusMode: boolean;
  onToggleBlastRadius: () => void;
  loading: boolean;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  graph,
  activePreset,
  onSelectPreset,
  onResetSession,
  onOpenSpringBootCode,
  onOpenCodePaste,
  onOpenExport,
  onOpenRisks,
  blastRadiusMode,
  onToggleBlastRadius,
  loading,
  onRefresh
}) => {
  const riskCount = graph?.summary?.detectedRisks?.length || 0;
  const primaryService = graph?.nodes?.find(n => n.type === 'service');

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Repo Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20 shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight font-sans">
              ADO Architecture Mapper
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Spring Boot 3.3
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Azure DevOps & GitHub
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {primaryService ? (
              <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                <FolderGit2 className="w-3 h-3 text-cyan-400" />
                Target Microservice: <strong className="text-white">{primaryService.name}</strong>
              </span>
            ) : (
              <span className="truncate max-w-[280px] font-mono text-[11px] text-slate-400">
                {graph?.systemName || 'Ready to map internal microservice folder...'}
              </span>
            )}
            {graph?.branch && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <GitBranch className="w-3 h-3 text-slate-500" />
                {graph.branch}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preset Architecture Switcher */}
      <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
        <span className="text-[11px] font-medium text-slate-400 px-2">Presets:</span>
        <button
          onClick={() => onSelectPreset('ecommerce-payment')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'ecommerce-payment'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Payment Service in ecommerce-microservices repository"
        >
          Payment Service
        </button>
        <button
          onClick={() => onSelectPreset('ecommerce-product')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'ecommerce-product'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Product Service in ecommerce-microservices repository"
        >
          Product Service
        </button>
        <button
          onClick={() => onSelectPreset('ecommerce-order')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'ecommerce-order'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Order Service in ecommerce-microservices repository"
        >
          Order Service
        </button>
        <button
          onClick={() => onSelectPreset('fintech-core')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'fintech-core'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Core Banking (ADO)
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Reset / Clear Session Button */}
        {onResetSession && (
          <button
            onClick={onResetSession}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Reset dashboard and clear earlier session"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset Session</span>
          </button>
        )}

        {/* Blast Radius Simulator Toggle */}
        <button
          onClick={onToggleBlastRadius}
          disabled={!graph}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
            blastRadiusMode
              ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/40 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title="Simulate service failure and visualize upstream/downstream blast radius"
        >
          <Flame className="w-3.5 h-3.5 text-rose-300" />
          <span className="hidden md:inline">Blast Radius</span>
          {blastRadiusMode && <span className="text-[10px] uppercase font-bold bg-rose-800 px-1 rounded">ON</span>}
        </button>

        {/* View Spring Boot Backend Code */}
        <button
          onClick={onOpenSpringBootCode}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-all"
          title="Inspect Java & Spring Boot backend service codebase"
        >
          <Coffee className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Spring Boot</span>
        </button>

        {/* Paste Code / AST Scan */}
        <button
          onClick={onOpenCodePaste}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
          title="Paste custom Spring Boot Java files or configs to scan"
        >
          <Code className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Paste Code</span>
        </button>

        {/* Risks Scorecard */}
        <button
          onClick={onOpenRisks}
          disabled={!graph}
          className="relative px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="View architectural health and detected anti-patterns"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Risks</span>
          {riskCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
              {riskCount}
            </span>
          )}
        </button>

        {/* Export Diagram */}
        <button
          onClick={onOpenExport}
          disabled={!graph}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export Mermaid.js, SVG, or Architecture Decision Record"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Refresh / Re-analyze */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
          title="Refresh architecture map"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
