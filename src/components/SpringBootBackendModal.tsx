import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coffee, 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  Layers, 
  CheckCircle2, 
  FolderGit2,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { BackendSourceFile } from '../types';

interface SpringBootBackendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpringBootBackendModal: React.FC<SpringBootBackendModalProps> = ({
  isOpen,
  onClose
}) => {
  const [files, setFiles] = useState<BackendSourceFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/backend/code')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setFiles(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load Spring Boot backend files:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentFile = files[activeFileIdx];

  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.path.split('/').pop() || 'file';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-sans">
                  Java & Spring Boot 3.3 Backend Service
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Production Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Full-stack Java Spring Boot architecture scanner, AST heuristics engine & REST APIs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: File list on left, Code editor on right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* File sidebar */}
          <div className="w-full md:w-80 bg-slate-950/70 border-r border-slate-800 p-3 overflow-y-auto space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
              <span>backend-spring-boot /</span>
            </div>

            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading files...</div>
            ) : (
              files.map((file, idx) => {
                const isActive = activeFileIdx === idx;
                const fileName = file.path.split('/').pop() || file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => setActiveFileIdx(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col gap-0.5 border ${
                      isActive
                        ? 'bg-blue-600/15 border-blue-500/40 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span className="font-mono text-xs font-medium truncate">{fileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate pl-5">
                      {file.description}
                    </span>
                  </button>
                );
              })
            )}

            {/* Maven build instructions */}
            <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-850 space-y-2 text-[11px]">
              <div className="font-semibold text-amber-300 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" />
                <span>Maven Run Command:</span>
              </div>
              <pre className="p-2 bg-black/60 rounded text-[10px] font-mono text-emerald-400 overflow-x-auto">
                ./mvnw spring-boot:run
              </pre>
              <div className="text-[10px] text-slate-400">
                Port: <code>8080</code> | Java 21 LTS | Spring Cloud OpenFeign
              </div>
            </div>
          </div>

          {/* Code viewer */}
          <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
            {currentFile && (
              <div className="p-2.5 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="text-slate-200">{currentFile.path}</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase text-[10px]">
                  {currentFile.language}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs leading-relaxed text-slate-300">
              {currentFile ? (
                <pre className="selection:bg-blue-600 selection:text-white">
                  <code>{currentFile.content}</code>
                </pre>
              ) : (
                <div className="text-slate-500 text-center py-20">Select a file to view</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
