import React from 'react';
import { 
  GitBranch, 
  Layers, 
  Flame, 
  Coffee, 
  ShieldAlert, 
  Download, 
  Sparkles,
  RefreshCw,
  Code
} from 'lucide-react';
import { ArchitectureGraph } from '../types';

interface NavbarProps {
  graph: ArchitectureGraph | null;
  activePreset: string;
  onSelectPreset: (presetId: string) => void;
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

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Repo Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
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
              Azure DevOps
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate max-w-[280px] font-mono text-[11px] text-slate-300">
              {graph?.systemName || 'Microservice Dependency Mesh'}
            </span>
            {graph?.branch && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
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
          onClick={() => onSelectPreset('fintech-core')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'fintech-core'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Core Banking (Azure)
        </button>
        <button
          onClick={() => onSelectPreset('ecommerce-mesh')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'ecommerce-mesh'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Retail Mesh (Kafka)
        </button>
        <button
          onClick={() => onSelectPreset('healthcare-telehealth')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            activePreset === 'healthcare-telehealth'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Clinical Claims
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Blast Radius Simulator Toggle */}
        <button
          onClick={onToggleBlastRadius}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
            blastRadiusMode
              ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/40 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title="Simulate service failure and visualize upstream/downstream blast radius"
        >
          <Flame className="w-3.5 h-3.5 text-rose-300" />
          <span>Blast Radius Sim</span>
          {blastRadiusMode && <span className="text-[10px] uppercase font-bold bg-rose-800 px-1 rounded">ON</span>}
        </button>

        {/* View Spring Boot Backend Code */}
        <button
          onClick={onOpenSpringBootCode}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-all"
          title="Inspect the complete Java & Spring Boot backend service codebase"
        >
          <Coffee className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Spring Boot Backend</span>
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
          className="relative px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
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
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
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
