import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  GitBranch, 
  Key, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  ShieldCheck, 
  Database, 
  Radio, 
  Server, 
  Github, 
  FolderGit2,
  RotateCcw
} from 'lucide-react';
import { ArchitectureGraph } from '../types';

interface ScannerBarProps {
  onScan: (url: string, branch: string, pat?: string) => void;
  onResetSession?: () => void;
  loading: boolean;
  graph: ArchitectureGraph | null;
}

const SAMPLE_REPOS = [
  {
    name: 'GitHub: inventory-service',
    url: 'https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/inventory-service',
    tech: 'Spring Boot 3 + PostgreSQL (Zero Queues)',
    isGithub: true
  },
  {
    name: 'GitHub: payment-service',
    url: 'https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/payment-service',
    tech: 'Spring Boot 3 + PostgreSQL + Kafka',
    isGithub: true
  },
  {
    name: 'GitHub: product-service',
    url: 'https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/product-service',
    tech: 'Spring Boot 3 + PostgreSQL + Liquibase',
    isGithub: true
  },
  {
    name: 'Azure Repos: inventory-service',
    url: 'https://dev.azure.com/ecommerce-cloud/retail-mesh/_git/ecommerce-microservices?path=%2Finventory-service',
    tech: 'Azure Container Apps + PostgreSQL Flexible',
    isGithub: false
  },
  {
    name: 'Azure Repos: payment-service',
    url: 'https://dev.azure.com/ecommerce-cloud/retail-mesh/_git/ecommerce-microservices?path=%2Fpayment-service',
    tech: 'Azure Container Apps + Service Bus + PostgreSQL',
    isGithub: false
  }
];

export const ScannerBar: React.FC<ScannerBarProps> = ({
  onScan,
  onResetSession,
  loading,
  graph
}) => {
  const [url, setUrl] = useState(graph?.repositoryUrl || '');
  const [branch, setBranch] = useState(graph?.branch || 'main');
  const [pat, setPat] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync state with graph when updated
  useEffect(() => {
    if (graph?.repositoryUrl) {
      setUrl(graph.repositoryUrl);
    }
    if (graph?.branch) {
      setBranch(graph.branch);
    }
  }, [graph?.repositoryUrl, graph?.branch]);

  // Parse details in real-time from input URL to provide instant user feedback
  const parsedInfo = useMemo(() => {
    const raw = url.trim();
    if (!raw) return null;
    try {
      const urlObj = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      const host = urlObj.hostname.toLowerCase();
      const segments = urlObj.pathname.split('/').filter(Boolean);

      let owner = '';
      let repo = '';
      let detectedBranch = '';
      let subPath = '';

      if (host.includes('github.com') && segments.length >= 2) {
        owner = segments[0];
        repo = segments[1].replace(/\.git$/i, '');
        if (segments.length >= 4 && (segments[2] === 'tree' || segments[2] === 'blob')) {
          detectedBranch = segments[3];
          if (segments.length >= 5) {
            subPath = segments.slice(4).join('/');
          }
        } else if (segments.length >= 3) {
          subPath = segments.slice(2).join('/');
        }
      } else if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) {
        owner = segments[0] || '';
        repo = segments[1] || '';
        const pathParam = urlObj.searchParams.get('path');
        if (pathParam) subPath = pathParam.replace(/^\/+/, '');
        const versionParam = urlObj.searchParams.get('version');
        if (versionParam) detectedBranch = versionParam.replace(/^GB/i, '');
      }

      return {
        isGithub: host.includes('github.com'),
        isAdo: host.includes('dev.azure.com') || host.includes('visualstudio.com'),
        owner,
        repo,
        branch: detectedBranch,
        subPath
      };
    } catch (_) {
      return null;
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const effectiveBranch = parsedInfo?.branch || branch.trim() || 'main';
    onScan(url.trim(), effectiveBranch, pat.trim() || undefined);
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    // When the user inputs or changes the URL, immediately reset any previous graph
    // so previous project's queues, nodes, and architecture are instantly cleared!
    if (graph && onResetSession) {
      onResetSession();
    }
    try {
      const u = new URL(newUrl.startsWith('http') ? newUrl : `https://${newUrl}`);
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length >= 4 && (segs[2] === 'tree' || segs[2] === 'blob')) {
        setBranch(segs[3]);
      }
    } catch (_) {}
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-md relative z-20">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
        {/* URL Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {parsedInfo?.isGithub ? (
              <Github className="w-4 h-4 text-emerald-400" />
            ) : (
              <Search className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste GitHub (e.g. https://github.com/hoangtien2k3/ecommerce-microservices/tree/main/payment-service) or ADO URL"
            className="w-full pl-9 pr-32 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono transition-all"
            disabled={loading}
          />
          {/* Badge indicator inside input */}
          <div className="absolute inset-y-0 right-2 flex items-center gap-1.5 pointer-events-none">
            {parsedInfo?.subPath && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <FolderGit2 className="w-3 h-3 text-cyan-400" />
                {parsedInfo.subPath}
              </span>
            )}
            {parsedInfo?.isGithub && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                GitHub
              </span>
            )}
            {parsedInfo?.isAdo && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Azure DevOps
              </span>
            )}
          </div>
        </div>

        {/* Branch Input */}
        <div className="relative w-full md:w-36">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full pl-8 pr-2.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-all"
            disabled={loading}
            title="Git branch name (e.g. main, master, develop)"
          />
        </div>

        {/* Optional ADO / GitHub PAT for private repos */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
            showAdvanced || pat
              ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Provide Personal Access Token if repository is private"
        >
          <Key className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Token</span>
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Clear / Reset Session Button */}
        {onResetSession && (
          <button
            type="button"
            onClick={() => {
              setUrl('');
              setBranch('main');
              setPat('');
              onResetSession();
            }}
            disabled={loading}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            title="Reset dashboard, clear URL and discard current architecture"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Mapping Service...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>Map Architecture</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Target Subfolder Live Banner */}
      {parsedInfo?.subPath && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between text-xs text-cyan-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Targeted Internal Microservice: <strong className="text-white font-mono bg-cyan-900/60 px-1.5 py-0.5 rounded">{parsedInfo.subPath}</strong> in repository <span className="font-mono text-cyan-200">{parsedInfo.owner}/{parsedInfo.repo}</span> (Branch: <span className="font-mono text-cyan-200">{parsedInfo.branch || branch}</span>)
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50 hidden md:inline">
            Isolating internal folder
          </span>
        </div>
      )}

      {/* Advanced Token Drawer */}
      {showAdvanced && (
        <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex-1 w-full md:max-w-md">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Personal Access Token (for Private GitHub or Azure DevOps Repositories):
            </label>
            <div className="relative">
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="github_pat_xxxx or ado_pat_xxxx (public repos require no token)"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Public repositories are scanned directly without a token. Tokens are processed in-memory only.
            </span>
          </div>
        </div>
      )}

      {/* Quick Select Real Sample Repos */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-mono text-slate-400 font-semibold mr-1 flex items-center gap-1">
          <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" /> Samples:
        </span>
        {SAMPLE_REPOS.map((sample) => {
          const isSelected = url.trim() === sample.url;
          return (
            <button
              key={sample.url}
              type="button"
              onClick={() => {
                setUrl(sample.url);
                setBranch('main');
                if (onResetSession) onResetSession();
                onScan(sample.url, 'main');
              }}
              disabled={loading}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all flex items-center gap-1.5 active:scale-95 ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
              title={`${sample.tech} - Click to isolate and scan`}
            >
              {sample.isGithub ? (
                <Github className="w-3 h-3 text-emerald-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
              <span>{sample.name.replace(/^(GitHub|Azure Repos):\s*/i, '')}</span>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
            </button>
          );
        })}
      </div>

      {/* Topology Summary Counts (Only shown when an active architecture graph exists for the current URL) */}
      {graph && url.trim() === graph.repositoryUrl && (
        <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Architecture read directly from <strong className="text-white font-mono">{graph.repositoryUrl}</strong></span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-300 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800/80">
            <span className="flex items-center gap-1 text-blue-400">
              <Server className="w-3 h-3" />
              <strong>{graph.summary.totalServices}</strong> Services
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-amber-400">
              <Database className="w-3 h-3" />
              <strong>{graph.summary.totalDatabases}</strong> Databases
            </span>
            <span className="text-slate-600">|</span>
            <span className={`flex items-center gap-1 ${graph.summary.totalQueues > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
              <Radio className="w-3 h-3" />
              <strong>{graph.summary.totalQueues}</strong> Queues {graph.summary.totalQueues === 0 && <span className="text-[10px] text-slate-500 font-normal">(none)</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
