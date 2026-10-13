import React from 'react';
import { Flame, AlertTriangle, ShieldCheck, X, ArrowRight, Activity } from 'lucide-react';
import { BlastRadiusResult } from '../types';

interface BlastRadiusBannerProps {
  result: BlastRadiusResult | null;
  onClose: () => void;
}

export const BlastRadiusBanner: React.FC<BlastRadiusBannerProps> = ({
  result,
  onClose
}) => {
  if (!result) return null;

  const isSevere = result.totalBlastRadiusPercentage >= 50;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4 animate-in slide-in-from-bottom duration-200">
      <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isSevere 
          ? 'bg-rose-950/90 border-rose-500/50 text-rose-100 shadow-rose-900/40'
          : 'bg-amber-950/90 border-amber-500/50 text-amber-100 shadow-amber-900/40'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSevere ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-600 text-white'
          }`}>
            <Flame className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm font-sans text-white">
                Outage Impact: {result.failedNodeName}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isSevere ? 'bg-rose-500/30 text-rose-200' : 'bg-amber-500/30 text-amber-200'
              }`}>
                {result.totalBlastRadiusPercentage}% BLAST RADIUS
              </span>
            </div>
            <p className="text-xs text-rose-200/90">
              {result.riskSummary}
            </p>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-center">
            <div className="text-[10px] text-white/60">Direct</div>
            <div className="font-bold text-white">{result.directlyImpactedNodes.length}</div>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-center">
            <div className="text-[10px] text-white/60">Cascaded</div>
            <div className="font-bold text-amber-300">{result.cascadedImpactedNodes.length}</div>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-center">
            <div className="text-[10px] text-white/60">Degraded</div>
            <div className="font-bold text-yellow-300">{result.degradedNodes.length}</div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/30 hover:bg-black/60 text-white/80 hover:text-white transition-all ml-2"
            title="Dismiss simulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
