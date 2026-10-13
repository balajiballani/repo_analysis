import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Server, 
  Database, 
  Radio, 
  Shield, 
  Zap, 
  Globe, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Filter, 
  Activity, 
  AlertTriangle,
  Flame,
  ArrowRight,
  Eye,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';
import { ArchitectureGraph, ArchitectureNode, ArchitectureEdge, NodeType, BlastRadiusResult } from '../types';

interface NodeGraphCanvasProps {
  graph: ArchitectureGraph;
  selectedNodeId: string | null;
  onSelectNode: (node: ArchitectureNode | null) => void;
  selectedEdgeId: string | null;
  onSelectEdge: (edge: ArchitectureEdge | null) => void;
  blastRadiusResult: BlastRadiusResult | null;
  blastRadiusMode: boolean;
  onSimulateNodeFailure: (nodeId: string) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
}

export const NodeGraphCanvas: React.FC<NodeGraphCanvasProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
  selectedEdgeId,
  onSelectEdge,
  blastRadiusResult,
  blastRadiusMode,
  onSimulateNodeFailure,
  onUpdateNodePosition
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform (pan & zoom)
  const [transform, setTransform] = useState({ x: 60, y: 40, scale: 0.9 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'database' | 'queue'>('all');

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setTransform(prev => {
      const nextScale = Math.min(Math.max(prev.scale + delta, 0.4), 2.2);
      return { ...prev, scale: nextScale };
    });
  };

  const handleResetZoom = () => {
    setTransform({ x: 60, y: 40, scale: 0.9 });
  };

  const handleFitToScreen = () => {
    if (!containerRef.current || graph.nodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xs = graph.nodes.map(n => n.position.x);
    const ys = graph.nodes.map(n => n.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + 260;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + 160;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const scaleX = (rect.width - 120) / graphWidth;
    const scaleY = (rect.height - 120) / graphHeight;
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.2);

    const x = (rect.width - graphWidth * scale) / 2 - minX * scale;
    const y = (rect.height - graphHeight * scale) / 2 - minY * scale;

    setTransform({ x, y, scale });
  };

  // Mouse pan handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    } else if (draggingNodeId) {
      const newX = (e.clientX - transform.x - dragOffset.x) / transform.scale;
      const newY = (e.clientY - transform.y - dragOffset.y) / transform.scale;
      onUpdateNodePosition(draggingNodeId, Math.round(newX), Math.round(newY));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = -e.deltaY * 0.001;
    setTransform(prev => {
      const nextScale = Math.min(Math.max(prev.scale + zoomFactor, 0.4), 2.2);
      return { ...prev, scale: nextScale };
    });
  };

  // Node drag start
  const handleNodeDragStart = (e: React.MouseEvent, node: ArchitectureNode) => {
    e.stopPropagation();
    if (blastRadiusMode) {
      onSimulateNodeFailure(node.id);
      return;
    }
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - (node.position.x * transform.scale + transform.x),
      y: e.clientY - (node.position.y * transform.scale + transform.y)
    });
    onSelectNode(node);
  };

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return graph.nodes.filter(node => {
      const matchesSearch = searchQuery === '' || 
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.tech.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.inboundEndpoints.some(ep => ep.path.toLowerCase().includes(searchQuery.toLowerCase())) ||
        node.databases.some(db => db.tablesOrCollections.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        node.asyncEvents.published.some(ev => ev.topicOrQueue.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'all' || 
        (typeFilter === 'service' && (node.type === 'service' || node.type === 'gateway')) ||
        (typeFilter === 'database' && (node.type === 'database' || node.type === 'cache')) ||
        (typeFilter === 'queue' && node.type === 'queue');

      return matchesSearch && matchesType;
    });
  }, [graph.nodes, searchQuery, typeFilter]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, ArchitectureNode>();
    graph.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [graph.nodes]);

  // Determine Blast Radius Status for a node
  const getNodeBlastStatus = useCallback((nodeId: string) => {
    if (!blastRadiusResult) return null;
    if (blastRadiusResult.failedNodeId === nodeId) return 'failed';
    if (blastRadiusResult.directlyImpactedNodes.includes(nodeId)) return 'directly-impacted';
    if (blastRadiusResult.cascadedImpactedNodes.includes(nodeId)) return 'cascaded';
    if (blastRadiusResult.degradedNodes.includes(nodeId)) return 'degraded';
    if (blastRadiusResult.unaffectedNodes.includes(nodeId)) return 'unaffected';
    return null;
  }, [blastRadiusResult]);

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative flex-1 h-full w-full bg-[#070b14] overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      {/* Background blueprint grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #3b82f6 1px, transparent 0),
            linear-gradient(to right, #1e293b 1px, transparent 1px),
            linear-gradient(to bottom, #1e293b 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 40px 40px',
          backgroundPosition: `${transform.x}px ${transform.y}px`
        }}
      />

      {/* Top Floating Control Bar (Search, Filters, Mode Banner) */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter services, endpoints, tables, topics..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-500 w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            {(['all', 'service', 'database', 'queue'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTypeFilter(filter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  typeFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {filter === 'all' ? 'All' : filter + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Blast Radius Prompt Banner */}
        {blastRadiusMode && (
          <div className="pointer-events-auto bg-rose-950/80 border border-rose-500/40 text-rose-200 px-3.5 py-1.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md animate-pulse">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Click any node on the graph to simulate outage & blast radius</span>
          </div>
        )}

        {/* Canvas Zoom & Viewport Controls */}
        <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 px-1 min-w-[36px] text-center">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitToScreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all ml-1 border-l border-slate-800 pl-2"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Graph Content Stage */}
      <div 
        className="absolute inset-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0'
        }}
      >
        {/* SVG Edges Layer */}
        <svg 
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {/* Arrow markers */}
            <marker id="arrow-sync" markerWidth="10" markerHeight="10" refX="28" refY="4" orient="auto">
              <path d="M0,0 L0,8 L9,4 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-async" markerWidth="10" markerHeight="10" refX="28" refY="4" orient="auto">
              <path d="M0,0 L0,8 L9,4 z" fill="#10b981" />
            </marker>
            <marker id="arrow-db" markerWidth="10" markerHeight="10" refX="28" refY="4" orient="auto">
              <path d="M0,0 L0,8 L9,4 z" fill="#f59e0b" />
            </marker>
            <marker id="arrow-gateway" markerWidth="10" markerHeight="10" refX="28" refY="4" orient="auto">
              <path d="M0,0 L0,8 L9,4 z" fill="#6366f1" />
            </marker>
            <marker id="arrow-failed" markerWidth="10" markerHeight="10" refX="28" refY="4" orient="auto">
              <path d="M0,0 L0,8 L9,4 z" fill="#f43f5e" />
            </marker>

            {/* Glowing filters */}
            <filter id="glow-edge-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-edge-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Connections */}
          {graph.edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const isSelected = selectedEdgeId === edge.id;
            const srcBlast = getNodeBlastStatus(src.id);
            const tgtBlast = getNodeBlastStatus(tgt.id);
            const isBlastImpacting = blastRadiusResult && (
              (tgt.id === blastRadiusResult.failedNodeId) ||
              (src.id === blastRadiusResult.failedNodeId) ||
              (srcBlast === 'directly-impacted' && tgt.id === blastRadiusResult.failedNodeId)
            );

            // Calculate start and end coordinates with node card dimensions
            const srcCenter = { x: src.position.x + 130, y: src.position.y + 70 };
            const tgtCenter = { x: tgt.position.x + 130, y: tgt.position.y + 70 };

            // Control points for smooth bezier curve
            const dx = tgtCenter.x - srcCenter.x;
            const dy = tgtCenter.y - srcCenter.y;
            const cx1 = srcCenter.x + dx * 0.45;
            const cy1 = srcCenter.y;
            const cx2 = tgtCenter.x - dx * 0.45;
            const cy2 = tgtCenter.y;

            const pathD = `M ${srcCenter.x} ${srcCenter.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgtCenter.x} ${tgtCenter.y}`;
            const midX = (srcCenter.x + tgtCenter.x) / 2;
            const midY = (srcCenter.y + tgtCenter.y) / 2 - 10;

            // Colors based on edge type
            let strokeColor = '#3b82f6'; // default sync HTTP
            let strokeDash = 'none';
            let markerId = 'arrow-sync';

            if (isBlastImpacting) {
              strokeColor = '#f43f5e';
              markerId = 'arrow-failed';
              strokeDash = '6,4';
            } else if (edge.type === 'async-publish' || edge.type === 'async-consume') {
              strokeColor = '#10b981';
              strokeDash = '8,4';
              markerId = 'arrow-async';
            } else if (edge.type.startsWith('db-')) {
              strokeColor = '#f59e0b';
              markerId = 'arrow-db';
            } else if (edge.type === 'gateway-route') {
              strokeColor = '#818cf8';
              markerId = 'arrow-gateway';
            }

            return (
              <g 
                key={edge.id} 
                className="pointer-events-auto cursor-pointer group"
                onClick={() => onSelectEdge(edge)}
              >
                {/* Wider invisible stroke for easy clicking */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />

                {/* Outer Glow Path */}
                {isSelected && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="7"
                    strokeOpacity="0.4"
                  />
                )}

                {/* Primary Edge Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : (edge.isCriticalPath ? 2.8 : 2)}
                  strokeDasharray={strokeDash}
                  strokeOpacity={isSelected ? 1 : 0.85}
                  markerEnd={`url(#${markerId})`}
                  className={edge.type.includes('async') ? 'animate-pulse' : ''}
                />

                {/* Edge Label Pill */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-65"
                    y="-12"
                    width="130"
                    height="24"
                    rx="12"
                    fill="#0f172a"
                    stroke={isSelected ? strokeColor : '#334155'}
                    strokeWidth={isSelected ? '2' : '1'}
                    className="transition-colors group-hover:stroke-blue-400 shadow-lg"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="600"
                    className="pointer-events-none group-hover:fill-white"
                  >
                    {edge.label.length > 20 ? edge.label.substring(0, 18) + '…' : edge.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {filteredNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const blastStatus = getNodeBlastStatus(node.id);
          const isFailed = blastStatus === 'failed';
          const isDirectlyImpacted = blastStatus === 'directly-impacted';
          const isCascaded = blastStatus === 'cascaded';
          const isDegraded = blastStatus === 'degraded';
          const isUnaffected = blastStatus === 'unaffected';

          // Visual styles based on node type
          let borderColor = 'border-slate-800';
          let headerBg = 'bg-slate-900';
          let icon = <Server className="w-4 h-4 text-blue-400" />;
          let typeBadge = 'Spring Boot Service';
          let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

          if (node.type === 'gateway') {
            borderColor = 'border-indigo-500/40';
            headerBg = 'bg-gradient-to-r from-indigo-950/80 to-slate-900';
            icon = <Shield className="w-4 h-4 text-indigo-400" />;
            typeBadge = 'API Gateway';
            badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
          } else if (node.type === 'database') {
            borderColor = 'border-amber-500/40';
            headerBg = 'bg-gradient-to-r from-amber-950/80 to-slate-900';
            icon = <Database className="w-4 h-4 text-amber-400" />;
            typeBadge = 'Database (SQL/NoSQL)';
            badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
          } else if (node.type === 'cache') {
            borderColor = 'border-purple-500/40';
            headerBg = 'bg-gradient-to-r from-purple-950/80 to-slate-900';
            icon = <Zap className="w-4 h-4 text-purple-400" />;
            typeBadge = 'In-Memory Cache';
            badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          } else if (node.type === 'queue') {
            borderColor = 'border-emerald-500/40';
            headerBg = 'bg-gradient-to-r from-emerald-950/80 to-slate-900';
            icon = <Radio className="w-4 h-4 text-emerald-400" />;
            typeBadge = 'Event Stream / Queue';
            badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          } else if (node.type === 'external') {
            borderColor = 'border-rose-500/40';
            headerBg = 'bg-gradient-to-r from-rose-950/80 to-slate-900';
            icon = <Globe className="w-4 h-4 text-rose-400" />;
            typeBadge = 'External 3rd Party';
            badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
          }

          // Blast Radius Overlay adjustments
          let blastRing = '';
          let opacityClass = 'opacity-100';

          if (isFailed) {
            blastRing = 'ring-4 ring-rose-500 ring-offset-2 ring-offset-slate-950 animate-bounce shadow-2xl shadow-rose-500/50';
          } else if (isDirectlyImpacted) {
            blastRing = 'ring-2 ring-rose-500 ring-offset-2 ring-offset-slate-950 shadow-xl shadow-rose-500/30';
          } else if (isCascaded) {
            blastRing = 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-950 shadow-xl shadow-amber-500/30';
          } else if (isDegraded) {
            blastRing = 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-slate-950 shadow-xl shadow-yellow-500/20';
          } else if (isUnaffected) {
            opacityClass = 'opacity-25 grayscale';
          }

          return (
            <div
              key={node.id}
              style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                width: '260px'
              }}
              onMouseDown={(e) => handleNodeDragStart(e, node)}
              className={`absolute top-0 left-0 rounded-2xl bg-slate-900/95 border backdrop-blur-xl shadow-2xl transition-shadow select-none group cursor-pointer ${borderColor} ${blastRing} ${opacityClass} ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 shadow-blue-500/30 scale-[1.02]' : 'hover:border-slate-700'
              }`}
            >
              {/* Header Bar */}
              <div className={`p-3 rounded-t-2xl border-b border-slate-800/80 flex items-center justify-between gap-2 ${headerBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate tracking-tight font-sans">
                      {node.name}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {node.tech}
                    </div>
                  </div>
                </div>

                {/* Health & Blast indicator */}
                {isFailed ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse flex items-center gap-1">
                    <Flame className="w-3 h-3" /> OUTAGE
                  </span>
                ) : isDirectlyImpacted ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    IMPACTED
                  </span>
                ) : isCascaded ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    CASCADE
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      node.status === 'healthy' ? 'bg-emerald-400 shadow-sm shadow-emerald-400' :
                      node.status === 'warning' ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-rose-400'
                    }`} />
                  </div>
                )}
              </div>

              {/* Body stats */}
              <div className="p-3 space-y-2 text-xs">
                {/* Summary snippet */}
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {node.summary}
                </p>

                {/* Metrics chips */}
                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] font-mono">
                  {node.inboundEndpoints.length > 0 && (
                    <span className="text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/60" title="Inbound REST / gRPC Endpoints">
                      {node.inboundEndpoints.length} Inbound
                    </span>
                  )}
                  {node.outboundCalls.length > 0 && (
                    <span className="text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60" title="Outbound Microservice Feign/HTTP Calls">
                      {node.outboundCalls.length} Outbound
                    </span>
                  )}
                  {node.databases.length > 0 && (
                    <span className="text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60" title="Databases / Tables Accessed">
                      {node.databases.length} DB
                    </span>
                  )}
                  {node.asyncEvents.published.length > 0 && (
                    <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60" title="Kafka / Service Bus Events">
                      {node.asyncEvents.published.length} Pub
                    </span>
                  )}
                </div>

                {/* Language / Framework Badge */}
                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <span className={`px-2 py-0.5 rounded-full font-medium border ${badgeColor}`}>
                    {typeBadge}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {node.language}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Canvas Bottom Legend */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 text-[11px] text-slate-400 shadow-xl pointer-events-auto">
        <span className="font-semibold text-slate-300">Legend:</span>
        <span className="flex items-center gap-1.5 text-blue-400">
          <span className="w-2 h-0.5 bg-blue-500 inline-block" /> HTTP / FeignClient
        </span>
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-2 h-0.5 border-t border-dashed border-emerald-500 inline-block" /> Kafka / Service Bus
        </span>
        <span className="flex items-center gap-1.5 text-amber-400">
          <span className="w-2 h-0.5 bg-amber-500 inline-block" /> Database CRUD
        </span>
        <span className="flex items-center gap-1.5 text-indigo-400">
          <span className="w-2 h-0.5 bg-indigo-500 inline-block" /> API Gateway
        </span>
      </div>

      {/* MiniMap in bottom right */}
      <div className="absolute bottom-4 right-4 z-10 hidden md:block w-36 h-24 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl pointer-events-auto p-1.5">
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Minimap</span>
          <span className="text-slate-600">{graph.nodes.length} nodes</span>
        </div>
        <div className="relative w-full h-[60px] bg-slate-900/60 rounded border border-slate-850 overflow-hidden">
          {graph.nodes.map(n => {
            // Map coordinates into 0..1 range
            const normX = Math.min(Math.max((n.position.x + 50) / 1400, 0), 1) * 100;
            const normY = Math.min(Math.max((n.position.y + 50) / 800, 0), 1) * 100;
            const isSelected = selectedNodeId === n.id;
            return (
              <div
                key={n.id}
                style={{ left: `${normX}%`, top: `${normY}%` }}
                className={`absolute w-2 h-1.5 rounded-xs transform -translate-x-1/2 -translate-y-1/2 ${
                  isSelected ? 'bg-blue-400 ring-1 ring-white' :
                  n.type === 'database' ? 'bg-amber-400' :
                  n.type === 'queue' ? 'bg-emerald-400' : 'bg-blue-600'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
