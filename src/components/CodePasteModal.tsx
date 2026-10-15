import React, { useState } from 'react';
import { X, Code, Sparkles, FileCode, Check } from 'lucide-react';

interface CodePasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeCode: (systemName: string, files: Array<{ path: string; content: string }>) => void;
  loading: boolean;
}

const DEFAULT_JAVA_SNIPPET = `@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @PostMapping("/checkout")
    public ResponseEntity<OrderDto> checkout(@RequestBody CheckoutRequest request) {
        OrderEntity order = orderRepository.save(new OrderEntity(request));
        return ResponseEntity.ok(OrderDto.from(order));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getOrder(@PathVariable UUID id) {
        return orderRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}

@Entity
@Table(name = "orders_tbl")
class OrderEntity {
    @Id private UUID id;
    private BigDecimal amount;
    private String status;
}`;

export const CodePasteModal: React.FC<CodePasteModalProps> = ({
  isOpen,
  onClose,
  onAnalyzeCode,
  loading
}) => {
  const [systemName, setSystemName] = useState('Order Microservice');
  const [fileName, setFileName] = useState('OrderController.java');
  const [content, setContent] = useState(DEFAULT_JAVA_SNIPPET);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAnalyzeCode(systemName, [{ path: fileName, content }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Code className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-sans">
                Paste Spring Boot Code or Application Config
              </h2>
              <p className="text-xs text-slate-400">
                Directly parse @RestController, @FeignClient, @Entity, & @KafkaListener AST nodes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Microservice / System Name
              </label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Order Orchestrator Service"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Virtual File Path
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="OrderController.java"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-slate-300">
                Spring Boot Java Code / YAML Config
              </label>
              <button
                type="button"
                onClick={() => setContent(DEFAULT_JAVA_SNIPPET)}
                className="text-[10px] text-blue-400 hover:underline"
              >
                Reset to Sample Snippet
              </button>
            </div>
            <textarea
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 selection:bg-blue-600"
              placeholder="Paste Java Spring Boot source code here..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>{loading ? 'Analyzing AST...' : 'Generate Architecture Diagram'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
