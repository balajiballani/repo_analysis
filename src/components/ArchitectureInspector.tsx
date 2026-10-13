import React, { useState } from 'react';
import { 
  X, 
  Server, 
  Database, 
  Radio, 
  Shield, 
  Zap, 
  Globe, 
  ArrowRight, 
  ArrowLeft, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Copy, 
  Check, 
  FileCode, 
  Layers, 
  ExternalLink,
  Table,
  Activity,
  Cpu
} from 'lucide-react';
import { ArchitectureNode, ArchitectureEdge, InboundEndpoint, OutboundCall, DatabaseInteraction } from '../types';

interface ArchitectureInspectorProps {
  node: ArchitectureNode | null;
  edge: ArchitectureEdge | null;
  onClose: () => void;
  onSimulateOutage: (nodeId: string) => void;
  onSelectNodeById: (nodeId: string) => void;
}

export const ArchitectureInspector: React.FC<ArchitectureInspectorProps> = ({
  node,
  edge,
  onClose,
  onSimulateOutage,
  onSelectNodeById
}) => {
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'database' | 'async' | 'code' | 'risks'>('inbound');
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  if (!node && !edge) return null;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // If Edge is selected, show edge inspector
  if (edge && !node) {
    return (
      <aside className="w-full sm:w-[420px] lg:w-[460px] border-l border-slate-800 bg-slate-900/98 backdrop-blur-2xl h-full flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white font-sans">Connection Inspection</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-2">
            <div className="text-[11px] font-mono text-slate-400">Interaction Protocol</div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {edge.protocol}
            </div>
            <div className="text-xs text-blue-300 font-mono bg-blue-950/60 p-2 rounded-lg border border-blue-900/60">
              {edge.label}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => onSelectNodeById(edge.source)}
              className="p-3 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 cursor-pointer transition-all"
            >
              <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                <ArrowLeft className="w-3 h-3 text-blue-400" /> Source Component
              </div>
              <div className="font-semibold text-white truncate font-mono text-xs">{edge.source}</div>
            </div>
            <div 
              onClick={() => onSelectNodeById(edge.target)}
              className="p-3 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 cursor-pointer transition-all"
            >
              <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                Target Component <ArrowRight className="w-3 h-3 text-blue-400" />
              </div>
              <div className="font-semibold text-white truncate font-mono text-xs">{edge.target}</div>
            </div>
          </div>

          {edge.details && (
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[11px] font-medium text-slate-300">Architectural Context</div>
              <p className="text-slate-400 text-[11px] leading-relaxed">{edge.details}</p>
            </div>
          )}

          {edge.isCriticalPath && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Critical synchronous transaction path: Failure cascades immediately.</span>
            </div>
          )}
        </div>
      </aside>
    );
  }

  if (!node) return null;

  return (
    <aside className="w-full sm:w-[460px] lg:w-[500px] border-l border-slate-800 bg-slate-900/98 backdrop-blur-2xl h-full flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Node Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
            {node.type === 'service' ? <Server className="w-5 h-5 text-blue-400" /> :
             node.type === 'database' ? <Database className="w-5 h-5 text-amber-400" /> :
             node.type === 'queue' ? <Radio className="w-5 h-5 text-emerald-400" /> :
             node.type === 'cache' ? <Zap className="w-5 h-5 text-purple-400" /> :
             node.type === 'gateway' ? <Shield className="w-5 h-5 text-indigo-400" /> :
             <Globe className="w-5 h-5 text-rose-400" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate font-sans tracking-tight">
              {node.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
              <span className="text-blue-400">{node.tech}</span>
              <span>•</span>
              <span>{node.language}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onSimulateOutage(node.id)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all text-xs font-semibold flex items-center gap-1"
            title="Simulate outage of this service"
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulate Outage</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-2 overflow-x-auto no-scrollbar text-xs">
        {[
          { id: 'inbound', label: `Inbound (${node.inboundEndpoints.length})` },
          { id: 'outbound', label: `Outbound (${node.outboundCalls.length})` },
          { id: 'database', label: `Database (${node.databases.length})` },
          { id: 'async', label: `Events (${node.asyncEvents.published.length + node.asyncEvents.consumed.length})` },
          { id: 'code', label: `Code AST (${node.codeEvidence.length})` },
          { id: 'risks', label: `Risks (${node.metrics.riskFactors.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2.5 font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
        {/* TAB 1: INBOUND ENDPOINTS */}
        {activeTab === 'inbound' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Inbound API Endpoints & Routes</span>
              <span className="text-slate-500 font-mono">{node.inboundEndpoints.length} routes</span>
            </div>

            {node.inboundEndpoints.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-850">
                No direct inbound REST endpoints mapped for this node.
              </div>
            ) : (
              node.inboundEndpoints.map((ep, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        ep.method === 'GET' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                        ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                        ep.method === 'PUT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-white text-xs truncate">
                        {ep.path}
                      </span>
                    </div>

                    {ep.authRequired && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shrink-0">
                        <Key className="w-2.5 h-2.5" /> Auth
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {ep.description}
                  </p>

                  {ep.fileSource && (
                    <div className="text-[10px] font-mono text-slate-500 truncate pt-1 border-t border-slate-850">
                      Mapped in: {ep.fileSource}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: OUTBOUND CALLS */}
        {activeTab === 'outbound' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Outbound Calls to Other Microservices</span>
              <span className="text-slate-500 font-mono">{node.outboundCalls.length} calls</span>
            </div>

            {node.outboundCalls.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-850">
                This service has no outbound synchronous microservice dependencies.
              </div>
            ) : (
              node.outboundCalls.map((call, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span 
                      onClick={() => onSelectNodeById(call.targetServiceId)}
                      className="font-semibold text-blue-400 hover:underline cursor-pointer flex items-center gap-1 text-xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                      {call.targetServiceName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {call.clientType}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 flex items-center justify-between">
                    <span>{call.method} {call.endpoint}</span>
                    <span className="text-[10px] text-slate-500">{call.protocol}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      call.circuitBreaker 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {call.circuitBreaker ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                      {call.circuitBreaker ? 'Circuit Breaker Active' : 'Missing Circuit Breaker!'}
                    </span>

                    {call.timeoutMs && (
                      <span className="text-slate-500 font-mono">
                        Timeout: {call.timeoutMs}ms
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: DATABASE INTERACTIONS */}
        {activeTab === 'database' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Database Access & Schema Mappings</span>
              <span className="text-slate-500 font-mono">{node.databases.length} datastores</span>
            </div>

            {node.databases.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-850">
                No direct database interactions discovered for this node.
              </div>
            ) : (
              node.databases.map((db, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5 text-xs">
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      {db.dbName}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {db.accessMode}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    ORM / Access Layer: <span className="text-slate-200 font-mono">{db.orm}</span>
                  </div>

                  <div>
                    <div className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <Table className="w-3 h-3 text-slate-500" /> Tables / Collections:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {db.tablesOrCollections.map((tbl, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 rounded bg-slate-850 border border-slate-750 font-mono text-[11px] text-slate-200">
                          {tbl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {db.transactional && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Managed under Spring @Transactional boundary
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: ASYNC EVENTS */}
        {activeTab === 'async' && (
          <div className="space-y-4">
            {/* Published Events */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                <Radio className="w-3.5 h-3.5" /> Published Events & Topics
              </div>
              {node.asyncEvents.published.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950 rounded-lg">
                  No outbound event publishing detected.
                </div>
              ) : (
                node.asyncEvents.published.map((pub, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 text-xs font-semibold">{pub.topicOrQueue}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-900/60">
                        {pub.brokerType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Schema: <code className="text-indigo-300">{pub.eventSchema}</code>
                    </div>
                    {pub.frequency && (
                      <div className="text-[10px] text-slate-500">
                        Observed frequency: {pub.frequency}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Consumed Events */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 text-cyan-400">
                <Radio className="w-3.5 h-3.5" /> Consumed Subscriptions & Listeners
              </div>
              {node.asyncEvents.consumed.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950 rounded-lg">
                  No inbound event listener subscriptions detected.
                </div>
              ) : (
                node.asyncEvents.consumed.map((sub, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-cyan-300 text-xs font-semibold">{sub.topicOrQueue}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-900/60">
                        {sub.brokerType}
                      </span>
                    </div>
                    {sub.consumerGroup && (
                      <div className="text-[11px] text-slate-400">
                        Group: <span className="font-mono text-slate-200">{sub.consumerGroup}</span>
                      </div>
                    )}
                    {sub.handlerName && (
                      <div className="text-[11px] text-slate-400">
                        Listener Method: <code className="text-amber-300">{sub.handlerName}()</code>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CODE EVIDENCE */}
        {activeTab === 'code' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Source Code Evidence in Repository</span>
              <span className="text-slate-500 font-mono">{node.codeEvidence.length} snippets</span>
            </div>

            {node.codeEvidence.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-850">
                No code snippets mapped. Paste source code in the toolbar to see live AST extractions.
              </div>
            ) : (
              node.codeEvidence.map((ev, idx) => (
                <div key={idx} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden space-y-1">
                  <div className="p-2.5 bg-slate-900/90 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-mono text-xs text-slate-200 truncate">{ev.file}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(ev.codeSnippet, idx)}
                      className="p-1 rounded text-slate-400 hover:text-white transition-all flex items-center gap-1 text-[10px]"
                    >
                      {copiedCodeIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCodeIdx === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 italic">
                    {ev.description}
                  </div>
                  <pre className="p-3 bg-black/50 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-56">
                    <code>{ev.codeSnippet}</code>
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 6: RISKS & RESILIENCE */}
        {activeTab === 'risks' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase">Service Risk Metrics</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <div className="text-[10px] text-slate-500">Complexity Score</div>
                  <div className="text-base font-bold text-white font-mono">{node.metrics.complexityScore} / 10</div>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg">
                  <div className="text-[10px] text-slate-500">Blast Radius Impact</div>
                  <div className="text-base font-bold text-rose-400 font-mono">{node.metrics.blastRadiusCount} Services</div>
                </div>
              </div>
            </div>

            {node.metrics.riskFactors.length === 0 ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No severe architectural risks flagged for this component.</span>
              </div>
            ) : (
              node.metrics.riskFactors.map((risk, idx) => (
                <div key={idx} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-200">Architectural Warning</div>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">{risk}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {node.repoUrl && (
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate">ADO: {node.repoUrl}</span>
          <a
            href={node.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 ml-2"
          >
            <span>Open in ADO</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </aside>
  );
};
