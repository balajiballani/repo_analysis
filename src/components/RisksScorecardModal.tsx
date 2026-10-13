import React from 'react';
import { X, ShieldAlert, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { ArchitectureGraph } from '../types';

interface RisksScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  graph: ArchitectureGraph | null;
  onSelectNode: (nodeId: string) => void;
}

export const RisksScorecardModal: React.FC<RisksScorecardModalProps> = ({
  isOpen,
  onClose,
  graph,
  onSelectNode
}) => {
  if (!isOpen || !graph) return null;

  const risks = graph.summary.detectedRisks || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-sans">
                Architectural Resilience & Anti-Patterns Audit
              </h2>
              <p className="text-xs text-slate-400">
                Automated governance audit for microservice fault isolation, DB coupling & async queues
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Health Score Overview */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Architecture Health Rating</div>
              <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                <span className={risks.some(r => r.severity === 'high') ? 'text-amber-400' : 'text-emerald-400'}>
                  {risks.some(r => r.severity === 'high') ? 'Needs Hardening (Grade B)' : 'Optimal (Grade A)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg font-mono text-xs bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold">
                {risks.filter(r => r.severity === 'high').length} High
              </span>
              <span className="px-2.5 py-1 rounded-lg font-mono text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                {risks.filter(r => r.severity === 'medium').length} Medium
              </span>
              <span className="px-2.5 py-1 rounded-lg font-mono text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30 font-bold">
                {risks.filter(r => r.severity === 'low').length} Low
              </span>
            </div>
          </div>

          {/* List of Detected Risks */}
          <div className="space-y-3">
            {risks.length === 0 ? (
              <div className="p-8 text-center text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex flex-col items-center gap-2">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                <span className="font-semibold text-sm">No critical anti-patterns discovered!</span>
                <p className="text-xs text-emerald-300/80">All Spring Boot microservice boundaries, Feign clients, and databases conform to microservice best practices.</p>
              </div>
            ) : (
              risks.map((risk, idx) => (
                <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                        risk.severity === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                        risk.severity === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {risk.severity} Risk
                      </span>
                      <h3 className="font-semibold text-white text-xs">{risk.title}</h3>
                    </div>
                  </div>

                  <p className="text-slate-300 text-xs leading-relaxed">
                    {risk.description}
                  </p>

                  <div className="p-2.5 bg-blue-950/40 rounded-lg border border-blue-900/50 text-[11px] text-blue-200">
                    <strong className="text-blue-300">Remediation:</strong> {risk.recommendation}
                  </div>

                  {risk.affectedNodes.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] pt-1 border-t border-slate-850">
                      <span className="text-slate-500">Affected nodes:</span>
                      {risk.affectedNodes.map(nodeId => (
                        <button
                          key={nodeId}
                          onClick={() => {
                            onSelectNode(nodeId);
                            onClose();
                          }}
                          className="px-2 py-0.5 rounded bg-slate-850 hover:bg-slate-750 font-mono text-blue-400 hover:underline"
                        >
                          {nodeId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
