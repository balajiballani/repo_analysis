import React, { useState } from 'react';
import { Search, GitBranch, Key, Sparkles, ChevronDown, ChevronUp, ArrowRight, ShieldCheck, Database, Radio, Server } from 'lucide-react';
import { ArchitectureGraph } from '../types';

interface ScannerBarProps {
  onScan: (url: string, branch: string, pat?: string) => void;
  loading: boolean;
  graph: ArchitectureGraph | null;
}

const SAMPLE_REPOS = [
  {
    name: 'Contoso Payment Orchestrator',
    url: 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator',
    tech: 'Spring Boot 3 + Service Bus + PostgreSQL',
    preset: 'fintech-core'
  },
  {
    name: 'Fabrikam Order Mesh Service',
    url: 'https://dev.azure.com/fabrikam-retail/omnichannel/_git/order-mesh-service',
    tech: 'Spring Boot + Kafka + Cosmos DB',
    preset: 'ecommerce-mesh'
  },
  {
    name: 'HealthTech Claims Engine',
    url: 'https://dev.azure.com/healthtech-cloud/telehealth/_git/claims-engine',
    tech: 'Spring Boot 3 + Service Bus + HIPAA PG',
    preset: 'healthcare-telehealth'
  }
];

export const ScannerBar: React.FC<ScannerBarProps> = ({
  onScan,
  loading,
  graph
}) => {
  const [url, setUrl] = useState(graph?.repositoryUrl || 'https://dev.azure.com/contoso-finance/core-banking/_git/payment-orchestrator');
  const [branch, setBranch] = useState(graph?.branch || 'release/v3.4');
  const [pat, setPat] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onScan(url.trim(), branch.trim() || 'main', pat.trim() || undefined);
  };

  const handleSelectSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setBranch('main');
    onScan(sampleUrl, 'main', undefined);
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-md relative z-20">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
        {/* URL Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4 text-blue-400" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter Azure DevOps repo URL: https://dev.azure.com/{org}/{project}/_git/{repo}"
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono transition-all"
            disabled={loading}
          />
        </div>

        {/* Branch */}
        <div className="relative w-full md:w-36">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full pl-8 pr-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-all"
            disabled={loading}
          />
        </div>

        {/* Advanced Toggle (PAT for Private ADO) */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
            showAdvanced || pat
              ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Key className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">ADO PAT</span>
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Scanning Repo...</span>
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

      {/* Advanced ADO PAT Drawer */}
      {showAdvanced && (
        <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex-1 w-full md:max-w-md">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Personal Access Token (PAT) for Private Azure DevOps Repo:
            </label>
            <div className="relative">
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ado_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Secure In-Memory query: Calls ADO REST API (<code>_apis/git/repositories/items</code>) to inspect Java Spring Boot source trees. Never saved.
            </span>
          </div>
        </div>
      )}

      {/* Quick Sample Repository Chips & Architecture Summary Stats */}
      <div className="mt-2.5 pt-2 border-t border-slate-850 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Quick ADO Repositories:</span>
          {SAMPLE_REPOS.map((sample) => (
            <button
              key={sample.name}
              type="button"
              onClick={() => handleSelectSample(sample.url)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-950/80 hover:bg-blue-900/30 text-slate-300 hover:text-blue-300 border border-slate-800 hover:border-blue-500/30 transition-all flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>{sample.name}</span>
            </button>
          ))}
        </div>

        {/* Topology Summary Counts */}
        {graph && (
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-300 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800/80">
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
            <span className="flex items-center gap-1 text-emerald-400">
              <Radio className="w-3 h-3" />
              <strong>{graph.summary.totalQueues}</strong> Queues/Events
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Style: <span className="text-indigo-300 font-medium">{graph.summary.architecturalStyle}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
