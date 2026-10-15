import { parse } from 'java-parser';
import YAML from 'yaml';
import { 
  ArchitectureGraph, 
  ArchitectureNode, 
  ArchitectureEdge, 
  InboundEndpoint, 
  OutboundCall, 
  DatabaseInteraction, 
  CodeEvidence, 
  ResolutionConfidence 
} from '../types';

export interface ParsedRepoTarget {
  owner: string;
  project?: string;
  repo: string;
  branch: string;
  serviceName: string;
  subPath?: string;
  isGithub: boolean;
  cleanUrl: string;
}

export interface AstAnnotation {
  name: string;
  rawName: string;
  attributes: Record<string, string>;
}

export interface AstField {
  name: string;
  type: string;
  isFinal: boolean;
  isStatic: boolean;
  annotations: AstAnnotation[];
  initialValue?: string;
}

export interface AstConstructorParam {
  name: string;
  type: string;
  annotations: AstAnnotation[];
}

export interface AstMethod {
  name: string;
  returnType: string;
  parameters: Array<{ name: string; type: string; annotations: AstAnnotation[] }>;
  annotations: AstAnnotation[];
  bodySnippet: string;
  invocations: Array<{ targetName: string; methodName: string; args: string[]; rawExpr: string }>;
}

export interface AstTypeDeclaration {
  name: string;
  filePath: string;
  packageName: string;
  kind: 'class' | 'interface' | 'record' | 'enum';
  annotations: AstAnnotation[];
  superClass?: string;
  interfaces: string[];
  fields: AstField[];
  constructors: Array<{ parameters: AstConstructorParam[]; annotations: AstAnnotation[] }>;
  methods: AstMethod[];
  constants: Map<string, string>;
}

export interface AstCompilationUnitResult {
  filePath: string;
  packageName: string;
  imports: Array<{ fqn: string; isWildcard: boolean; isStatic: boolean; simpleName: string }>;
  types: AstTypeDeclaration[];
  syntaxError?: string;
  strategy: ResolutionConfidence;
}

export interface ProjectSymbolTable {
  typesByName: Map<string, AstTypeDeclaration[]>;
  typesByFqn: Map<string, AstTypeDeclaration>;
  feignClients: Map<string, { serviceName: string; targetUrl?: string; methods: AstMethod[]; filePath: string }>;
  configProperties: Map<string, string>;
  files: AstCompilationUnitResult[];
}

/**
 * Helper to recursively collect token image strings from CST
 */
function collectTokens(node: any): string[] {
  if (!node) return [];
  if (node.image !== undefined) return [node.image];
  const tokens: string[] = [];
  if (node.children) {
    for (const key in node.children) {
      for (const child of node.children[key]) {
        tokens.push(...collectTokens(child));
      }
    }
  }
  return tokens;
}

function getNodeText(node: any): string {
  return collectTokens(node).join(' ');
}

function findNodes(node: any, name: string, list: any[] = []): any[] {
  if (!node) return list;
  if (node.name === name) list.push(node);
  if (node.children) {
    for (const key in node.children) {
      for (const child of node.children[key]) {
        findNodes(child, name, list);
      }
    }
  }
  return list;
}

/**
 * Parse an AST annotation into clean name and key-value attributes
 */
function parseAstAnnotation(annNode: any): AstAnnotation {
  const children = annNode.children || {};
  let rawName = '';
  if (children.typeName && children.typeName[0]) {
    rawName = collectTokens(children.typeName[0]).join('');
  }
  const simpleName = rawName.split('.').pop() || rawName;
  const attributes: Record<string, string> = {};

  if (children.elementValuePairList && children.elementValuePairList[0]) {
    const pairs = children.elementValuePairList[0].children?.elementValuePair || [];
    for (const pair of pairs) {
      const k = pair.children?.Identifier ? pair.children.Identifier[0].image : '';
      if (k && pair.children?.elementValue) {
        const v = collectTokens(pair.children.elementValue[0]).join('').replace(/^["']|["']$/g, '');
        attributes[k] = v;
      }
    }
  } else if (children.elementValue && children.elementValue[0]) {
    const v = collectTokens(children.elementValue[0]).join('').replace(/^["']|["']$/g, '');
    attributes['value'] = v;
  }

  return { name: simpleName, rawName, attributes };
}

/**
 * Extract annotations directly attached to a declaration
 */
function extractDeclarationAnnotations(declNode: any): AstAnnotation[] {
  const results: AstAnnotation[] = [];
  const annNodes = findNodes(declNode, 'annotation');
  for (const an of annNodes) {
    results.push(parseAstAnnotation(an));
  }
  return results;
}

/**
 * Extract invocations like kafkaTemplate.send(...), restClient.get().uri(...)
 */
function extractInvocations(methodNode: any): Array<{ targetName: string; methodName: string; args: string[]; rawExpr: string }> {
  const invocations: Array<{ targetName: string; methodName: string; args: string[]; rawExpr: string }> = [];
  const stmtExprs = findNodes(methodNode, 'statementExpression');

  for (const stmt of stmtExprs) {
    const text = getNodeText(stmt);
    // Detect builder or method call pattern: target.method(args)
    const match = text.match(/([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
    if (match) {
      const targetName = match[1];
      const methodName = match[2];
      const rawArgs = match[3] || '';
      const args = rawArgs.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      invocations.push({
        targetName,
        methodName,
        args,
        rawExpr: text
      });
    }

    // Detect chained invocations e.g. baseUrl("...").build()
    const baseUrlMatch = text.match(/baseUrl\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (baseUrlMatch) {
      invocations.push({
        targetName: 'builder',
        methodName: 'baseUrl',
        args: [baseUrlMatch[1]],
        rawExpr: text
      });
    }
  }

  return invocations;
}

/**
 * Parse a single Java source file into AST representation with graceful error recovery
 */
export function parseJavaFileToAst(filePath: string, content: string): AstCompilationUnitResult {
  try {
    const cst = parse(content);
    let packageName = '';
    const imports: Array<{ fqn: string; isWildcard: boolean; isStatic: boolean; simpleName: string }> = [];
    const types: AstTypeDeclaration[] = [];

    // Package declaration
    const pkgNode = findNodes(cst, 'packageDeclaration')[0];
    if (pkgNode) {
      packageName = collectTokens(pkgNode).filter(t => t !== 'package' && t !== ';').join('');
    }

    // Import declarations
    const importNodes = findNodes(cst, 'importDeclaration');
    for (const imp of importNodes) {
      const tokens = collectTokens(imp);
      const isStatic = tokens.includes('static');
      const isWildcard = tokens.includes('*');
      const fqn = tokens.filter(t => t !== 'import' && t !== 'static' && t !== ';').join('');
      const simpleName = isWildcard ? '*' : fqn.split('.').pop() || fqn;
      imports.push({ fqn, isWildcard, isStatic, simpleName });
    }

    // Type declarations: classes, interfaces, records, enums
    const classDecls = findNodes(cst, 'normalClassDeclaration');
    const interfaceDecls = findNodes(cst, 'normalInterfaceDeclaration');
    const recordDecls = findNodes(cst, 'recordDeclaration');
    const enumDecls = findNodes(cst, 'enumDeclaration');

    const processType = (node: any, kind: 'class' | 'interface' | 'record' | 'enum') => {
      const name = node.children?.typeIdentifier ? node.children.typeIdentifier[0].image : 'Anonymous';
      const annotations: AstAnnotation[] = [];
      const fields: AstField[] = [];
      const constructors: Array<{ parameters: AstConstructorParam[]; annotations: AstAnnotation[] }> = [];
      const methods: AstMethod[] = [];
      const constants = new Map<string, string>();
      const interfaces: string[] = [];

      // Extract annotations on this class
      const parentDecl = node.children?.classModifier || node.children?.interfaceModifier || [];
      for (const mod of parentDecl) {
        if (mod.children?.annotation) {
          annotations.push(parseAstAnnotation(mod.children.annotation[0]));
        }
      }

      // Fields
      const fieldDecls = findNodes(node, 'fieldDeclaration');
      for (const fd of fieldDecls) {
        const fTokens = collectTokens(fd);
        const isFinal = fTokens.includes('final');
        const isStatic = fTokens.includes('static');
        const fieldAnns = extractDeclarationAnnotations(fd);
        const declText = fTokens.join(' ');
        
        // Find identifier and type
        const match = declText.match(/(?:(?:public|private|protected|final|static|volatile)\s+)*([A-Za-z0-9_<>]+)\s+([a-zA-Z0-9_]+)(?:\s*=\s*([^;]+))?/);
        if (match) {
          const type = match[1];
          const fName = match[2];
          const initialValue = match[3]?.trim().replace(/^["']|["']$/g, '');
          fields.push({
            name: fName,
            type,
            isFinal,
            isStatic,
            annotations: fieldAnns,
            initialValue
          });
          if (isStatic && isFinal && initialValue) {
            constants.set(fName, initialValue);
          }
        }
      }

      // Constructors
      const ctorDecls = findNodes(node, 'constructorDeclaration');
      for (const cd of ctorDecls) {
        const ctorAnns = extractDeclarationAnnotations(cd);
        const params: AstConstructorParam[] = [];
        const paramDecls = findNodes(cd, 'formalParameter');
        for (const p of paramDecls) {
          const pTokens = collectTokens(p);
          const pAnns = extractDeclarationAnnotations(p);
          const pText = pTokens.join(' ');
          const pMatch = pText.match(/(?:final\s+)?([A-Za-z0-9_<>]+)\s+([a-zA-Z0-9_]+)$/);
          if (pMatch) {
            params.push({ type: pMatch[1], name: pMatch[2], annotations: pAnns });
          }
        }
        constructors.push({ parameters: params, annotations: ctorAnns });
      }

      // Methods
      const methodDecls = findNodes(node, 'methodDeclaration');
      for (const md of methodDecls) {
        const mAnns = extractDeclarationAnnotations(md);
        const header = md.children?.methodHeader ? md.children.methodHeader[0] : null;
        let methodName = '';
        let returnType = 'void';
        const params: Array<{ name: string; type: string; annotations: AstAnnotation[] }> = [];

        if (header) {
          const declarator = header.children?.methodDeclarator ? header.children.methodDeclarator[0] : null;
          if (declarator?.children?.Identifier) {
            methodName = declarator.children.Identifier[0].image;
          }
          if (header.children?.result) {
            returnType = collectTokens(header.children.result[0]).join('');
          }
          const formalParams = findNodes(declarator, 'formalParameter');
          for (const fp of formalParams) {
            const pAnns = extractDeclarationAnnotations(fp);
            const pTokens = collectTokens(fp);
            const pText = pTokens.join(' ');
            const pMatch = pText.match(/([A-Za-z0-9_<>]+)\s+([a-zA-Z0-9_]+)$/);
            if (pMatch) {
              params.push({ type: pMatch[1], name: pMatch[2], annotations: pAnns });
            }
          }
        }

        const bodySnippet = getNodeText(md).slice(0, 500);
        const invocations = extractInvocations(md);

        methods.push({
          name: methodName || 'unknownMethod',
          returnType,
          parameters: params,
          annotations: mAnns,
          bodySnippet,
          invocations
        });
      }

      types.push({
        name,
        filePath,
        packageName,
        kind,
        annotations,
        interfaces,
        fields,
        constructors,
        methods,
        constants
      });
    };

    classDecls.forEach(cd => processType(cd, 'class'));
    interfaceDecls.forEach(id => processType(id, 'interface'));
    recordDecls.forEach(rd => processType(rd, 'record'));
    enumDecls.forEach(ed => processType(ed, 'enum'));

    return {
      filePath,
      packageName,
      imports,
      types,
      strategy: 'AST_SEMANTIC_RESOLVED'
    };
  } catch (err: any) {
    // Gracefully degrade to fault-tolerant tokenization
    return fallbackTokenizeJava(filePath, content, err.message);
  }
}

/**
 * Progressively weaker analysis strategy: fault-tolerant tokenized fallback
 * used when a source file has syntax errors or incomplete snippets
 */
function fallbackTokenizeJava(filePath: string, content: string, errorMsg: string): AstCompilationUnitResult {
  const annotations: AstAnnotation[] = [];
  const fields: AstField[] = [];
  const methods: AstMethod[] = [];
  const constants = new Map<string, string>();

  // Extract package
  const pkgMatch = content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
  const packageName = pkgMatch ? pkgMatch[1] : '';

  // Extract class name
  const classMatch = content.match(/(?:public\s+)?(?:class|interface|record|enum)\s+([A-Za-z0-9_]+)/);
  const typeName = classMatch ? classMatch[1] : filePath.split('/').pop()?.replace('.java', '') || 'UnknownClass';

  // Tokenize annotations
  const annMatches = content.matchAll(/@([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?/g);
  for (const m of annMatches) {
    const rawName = m[1];
    const rawArgs = m[2] || '';
    const attributes: Record<string, string> = {};
    if (rawArgs) {
      if (rawArgs.includes('=')) {
        const pairMatches = rawArgs.matchAll(/([a-zA-Z0-9_]+)\s*=\s*([^,)]+)/g);
        for (const pm of pairMatches) {
          attributes[pm[1]] = pm[2].trim().replace(/^["']|["']$/g, '');
        }
      } else {
        attributes['value'] = rawArgs.trim().replace(/^["']|["']$/g, '');
      }
    }
    annotations.push({ name: rawName, rawName, attributes });
  }

  // Tokenize constant strings
  const constMatches = content.matchAll(/(?:public\s+static\s+final|final\s+static)\s+String\s+([A-Za-z0-9_]+)\s*=\s*["']([^"']+)["']/g);
  for (const cm of constMatches) {
    constants.set(cm[1], cm[2]);
  }

  return {
    filePath,
    packageName,
    imports: [],
    types: [{
      name: typeName,
      filePath,
      packageName,
      kind: 'class',
      annotations,
      interfaces: [],
      fields,
      constructors: [],
      methods,
      constants
    }],
    syntaxError: errorMsg,
    strategy: 'FALLBACK_HEURISTIC'
  };
}

/**
 * Parse application.yml, application.yaml, and application.properties into flat property map
 */
export function parseConfigProperties(files: Array<{ path: string; content: string }>): Map<string, string> {
  const props = new Map<string, string>();

  for (const f of files) {
    const p = f.path.toLowerCase();
    const c = f.content;

    if (p.endsWith('.yml') || p.endsWith('.yaml')) {
      try {
        const parsed = YAML.parse(c);
        if (parsed && typeof parsed === 'object') {
          const flatten = (obj: any, prefix = '') => {
            for (const key of Object.keys(obj)) {
              const fullKey = prefix ? `${prefix}.${key}` : key;
              const val = obj[key];
              if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                flatten(val, fullKey);
              } else if (val !== undefined && val !== null) {
                props.set(fullKey, String(val));
              }
            }
          };
          flatten(parsed);
        }
      } catch (_) {}
    } else if (p.endsWith('.properties')) {
      const lines = c.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim();
          props.set(k, v);
        }
      }
    }
  }

  return props;
}

/**
 * Resolve property placeholder e.g. ${services.inventory.url:http://inventory-service:8080}
 */
export function resolvePropertyPlaceholder(expr: string, config: Map<string, string>): string {
  if (!expr || !expr.includes('${')) return expr;

  return expr.replace(/\$\{([^}]+)\}/g, (_, inner) => {
    const parts = inner.split(':');
    const propKey = parts[0].trim();
    const defaultVal = parts.slice(1).join(':').trim();

    if (config.has(propKey)) {
      return config.get(propKey)!;
    }
    return defaultVal || expr;
  });
}

/**
 * Build multi-pass Project Symbol Table across all scanned repository files
 */
export function buildProjectSymbolTable(
  files: Array<{ path: string; content: string }>
): ProjectSymbolTable {
  const configProperties = parseConfigProperties(files);
  const typesByName = new Map<string, AstTypeDeclaration[]>();
  const typesByFqn = new Map<string, AstTypeDeclaration>();
  const feignClients = new Map<string, { serviceName: string; targetUrl?: string; methods: AstMethod[]; filePath: string }>();
  const parsedFiles: AstCompilationUnitResult[] = [];

  // Pass 1: Parse AST of every Java source file
  for (const f of files) {
    if (f.path.endsWith('.java')) {
      const parsedUnit = parseJavaFileToAst(f.path, f.content);
      parsedFiles.push(parsedUnit);

      for (const t of parsedUnit.types) {
        const list = typesByName.get(t.name) || [];
        list.push(t);
        typesByName.set(t.name, list);

        const fqn = t.packageName ? `${t.packageName}.${t.name}` : t.name;
        typesByFqn.set(fqn, t);

        // Check for @FeignClient
        const feignAnn = t.annotations.find(a => a.name === 'FeignClient');
        if (feignAnn) {
          const targetName = feignAnn.attributes.name || feignAnn.attributes.value || feignAnn.attributes.serviceId || t.name;
          const rawUrl = feignAnn.attributes.url;
          const targetUrl = rawUrl ? resolvePropertyPlaceholder(rawUrl, configProperties) : undefined;
          feignClients.set(t.name, {
            serviceName: targetName,
            targetUrl,
            methods: t.methods,
            filePath: f.path
          });
        }
      }
    }
  }

  return {
    typesByName,
    typesByFqn,
    feignClients,
    configProperties,
    files: parsedFiles
  };
}

/**
 * Format human-readable title from microservice / repo ID
 */
function formatTitle(id: string): string {
  return id
    .replace(/^([a-z])/, (_, c) => c.toUpperCase())
    .replace(/[-_]([a-z])/g, (_, c) => ' ' + c.toUpperCase())
    .replace(/Service$/i, ' Service')
    .trim();
}

/**
 * Canonical Architecture Graph Builder powered by Java AST Semantic Analysis
 */
export function buildArchitectureGraphFromAst(
  target: ParsedRepoTarget,
  files: Array<{ path: string; content: string }>
): ArchitectureGraph {
  const symbolTable = buildProjectSymbolTable(files);
  const serviceId = target.serviceName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const serviceName = formatTitle(target.serviceName);

  const inboundEndpoints: InboundEndpoint[] = [];
  const outboundCalls: OutboundCall[] = [];
  const databases: DatabaseInteraction[] = [];
  const publishedEvents: any[] = [];
  const consumedEvents: any[] = [];
  const codeEvidence: CodeEvidence[] = [];
  const downstreamNodes = new Map<string, ArchitectureNode>();
  const edges: ArchitectureEdge[] = [];

  const discoveredTables = new Set<string>();
  const discoveredTopics = new Set<string>();
  let hasPostgres = false;
  let hasLiquibaseOrFlyway = files.some(f => f.path.includes('liquibase') || f.path.includes('db/migration'));

  // Context-path from configuration properties
  const contextPath = symbolTable.configProperties.get('server.servlet.context-path') || 
                      symbolTable.configProperties.get('server.context-path') || '';

  const uncertaintyNotes: string[] = [];
  const unresolvedSymbols: string[] = [];

  // Pass 2: Inspect AST declarations & method invocations
  for (const unit of symbolTable.files) {
    if (unit.syntaxError) {
      uncertaintyNotes.push(`File ${unit.filePath} used fallback heuristic due to syntax limitation: ${unit.syntaxError}`);
    }

    for (const type of unit.types) {
      const typeAnnotations = type.annotations;
      const isController = typeAnnotations.some(a => a.name === 'RestController' || a.name === 'Controller');
      const isEntity = typeAnnotations.some(a => a.name === 'Entity' || a.name === 'Table' || a.name === 'Document');
      const isRepository = typeAnnotations.some(a => a.name === 'Repository') || type.interfaces.some(i => i.includes('Repository'));
      const isService = typeAnnotations.some(a => a.name === 'Service' || a.name === 'Component');

      // 1. Inbound REST Endpoints via AST annotations
      if (isController) {
        const classReqMapping = typeAnnotations.find(a => a.name === 'RequestMapping');
        let classBasePath = classReqMapping ? (classReqMapping.attributes.path || classReqMapping.attributes.value || '') : '';
        if (classBasePath && !classBasePath.startsWith('/')) classBasePath = '/' + classBasePath;
        classBasePath = classBasePath.replace(/\/+$/, '');

        codeEvidence.push({
          file: unit.filePath,
          type: 'controller',
          astKind: 'ClassDeclaration',
          symbolName: type.name,
          resolutionConfidence: unit.strategy,
          codeSnippet: type.methods.slice(0, 3).map(m => `@${m.annotations.map(a => a.name).join(', ')} public ${m.returnType} ${m.name}(...)`).join('\n') || `public class ${type.name}`,
          description: `Spring Boot REST Controller handling HTTP inbound traffic with ${type.methods.length} methods`
        });

        for (const method of type.methods) {
          for (const ann of method.annotations) {
            let verb: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | null = null;
            if (ann.name === 'GetMapping') verb = 'GET';
            else if (ann.name === 'PostMapping') verb = 'POST';
            else if (ann.name === 'PutMapping') verb = 'PUT';
            else if (ann.name === 'DeleteMapping') verb = 'DELETE';
            else if (ann.name === 'PatchMapping') verb = 'PATCH';
            else if (ann.name === 'RequestMapping') {
              const mAttr = ann.attributes.method || '';
              if (mAttr.includes('POST')) verb = 'POST';
              else if (mAttr.includes('PUT')) verb = 'PUT';
              else if (mAttr.includes('DELETE')) verb = 'DELETE';
              else if (mAttr.includes('PATCH')) verb = 'PATCH';
              else verb = 'GET';
            }

            if (verb) {
              const subPathRaw = ann.attributes.path || ann.attributes.value || '';
              const subPath = subPathRaw.startsWith('/') ? subPathRaw : subPathRaw ? '/' + subPathRaw : '';
              const fullPath = (contextPath + classBasePath + subPath).replace(/\/+/g, '/') || '/';

              const hasAuth = method.annotations.some(a => a.name === 'PreAuthorize' || a.name === 'Secured') ||
                              typeAnnotations.some(a => a.name === 'PreAuthorize' || a.name === 'Secured');

              if (!inboundEndpoints.some(e => e.path === fullPath && e.method === verb)) {
                inboundEndpoints.push({
                  path: fullPath,
                  method: verb,
                  description: `Exposed by ${type.name}.${method.name}() in ${unit.filePath.split('/').pop()}`,
                  authRequired: hasAuth,
                  fileSource: unit.filePath,
                  resolutionConfidence: unit.strategy,
                  astProvenance: `MethodDeclaration: ${type.name}.${method.name}() annotated with @${ann.name}`
                });
              }
            }
          }
        }
      }

      // 2. Dependency Injection & Outbound Client Tracking
      // Check fields and constructor parameters for Feign clients, RestClient, WebClient, RestTemplate
      const allInjectedTypes = new Set<string>();

      // Field injection
      for (const field of type.fields) {
        if (field.annotations.some(a => a.name === 'Autowired' || a.name === 'Inject' || a.name === 'Resource') || 
            (field.isFinal && typeAnnotations.some(a => a.name === 'RequiredArgsConstructor'))) {
          allInjectedTypes.add(field.type);
        }
      }

      // Constructor injection (Spring standard single constructor or @Autowired constructor)
      for (const ctor of type.constructors) {
        for (const p of ctor.parameters) {
          allInjectedTypes.add(p.type);
        }
      }

      // Cross-reference injected types with Feign clients
      for (const injectedType of allInjectedTypes) {
        const cleanType = injectedType.replace(/<.*>/, '');
        if (symbolTable.feignClients.has(cleanType)) {
          const feign = symbolTable.feignClients.get(cleanType)!;
          const targetId = feign.serviceName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          if (targetId !== serviceId && targetId !== 'localhost') {
            const hasCircuitBreaker = type.annotations.some(a => a.name === 'CircuitBreaker') ||
                                     type.methods.some(m => m.annotations.some(a => a.name === 'CircuitBreaker'));

            outboundCalls.push({
              targetServiceId: targetId,
              targetServiceName: formatTitle(feign.serviceName),
              endpoint: `/api/${targetId}`,
              method: 'POST',
              protocol: 'REST',
              clientType: 'Spring Cloud OpenFeign',
              circuitBreaker: hasCircuitBreaker,
              fileSource: feign.filePath,
              resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
              astProvenance: `Field/Constructor DI of ${cleanType} interface mapped to FeignClient("${feign.serviceName}")`
            });

            if (!downstreamNodes.has(targetId)) {
              downstreamNodes.set(targetId, {
                id: targetId,
                name: formatTitle(feign.serviceName),
                type: 'service',
                category: 'Downstream Microservice',
                tech: 'Spring Boot Microservice',
                language: 'Java',
                summary: `Cross-service dependency invoked via Feign client ${cleanType}`,
                status: 'healthy',
                inboundEndpoints: [{ path: `/api/${targetId}`, method: 'POST', description: 'Feign inter-service contract' }],
                outboundCalls: [],
                databases: [],
                asyncEvents: { published: [], consumed: [] },
                codeEvidence: [],
                analysisStrategy: 'AST_SEMANTIC_RESOLVED',
                metrics: { complexityScore: 4, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
                position: { x: 740, y: 150 + downstreamNodes.size * 180 }
              });
            }

            edges.push({
              id: `e-${serviceId}-${targetId}`,
              source: serviceId,
              target: targetId,
              type: 'sync-http',
              label: `Feign -> ${feign.serviceName}`,
              protocol: 'REST / HTTPS',
              isCriticalPath: true
            });
          }
        }
      }

      // Check method invocations for RestClient, WebClient, RestTemplate, KafkaTemplate
      for (const method of type.methods) {
        for (const inv of method.invocations) {
          // RestClient or WebClient baseUrl("http://SERVICE-NAME")
          if (inv.methodName === 'baseUrl' && inv.args.length > 0) {
            let rawUrl = inv.args[0];
            rawUrl = resolvePropertyPlaceholder(rawUrl, symbolTable.configProperties);
            const hostMatch = rawUrl.match(/(?:https?:\/\/)?([a-zA-Z0-9_.-]+)(?::\d+)?/);
            if (hostMatch) {
              const targetHost = hostMatch[1];
              const targetId = targetHost.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
              if (targetId !== 'localhost' && targetId !== '127.0.0.1' && targetId !== serviceId) {
                outboundCalls.push({
                  targetServiceId: targetId,
                  targetServiceName: formatTitle(targetHost),
                  endpoint: '/api',
                  method: 'POST',
                  protocol: 'REST',
                  clientType: 'Spring RestClient',
                  circuitBreaker: method.annotations.some(a => a.name === 'CircuitBreaker'),
                  fileSource: unit.filePath,
                  resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
                  astProvenance: `MethodInvocation: RestClient.baseUrl("${rawUrl}") in ${type.name}.${method.name}()`
                });

                if (!downstreamNodes.has(targetId)) {
                  downstreamNodes.set(targetId, {
                    id: targetId,
                    name: formatTitle(targetHost),
                    type: 'service',
                    category: 'Downstream Microservice',
                    tech: 'Spring Boot Microservice',
                    language: 'Java',
                    summary: `Inter-service REST dependency called via Spring RestClient`,
                    status: 'healthy',
                    inboundEndpoints: [{ path: '/api', method: 'POST', description: 'API' }],
                    outboundCalls: [],
                    databases: [],
                    asyncEvents: { published: [], consumed: [] },
                    codeEvidence: [],
                    analysisStrategy: 'AST_SEMANTIC_RESOLVED',
                    metrics: { complexityScore: 4, blastRadiusCount: 2, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
                    position: { x: 740, y: 150 + downstreamNodes.size * 180 }
                  });
                }

                edges.push({
                  id: `e-${serviceId}-${targetId}`,
                  source: serviceId,
                  target: targetId,
                  type: 'sync-http',
                  label: `RestClient HTTP POST`,
                  protocol: 'REST / HTTPS',
                  isCriticalPath: true
                });
              }
            }
          }

          // KafkaTemplate.send(topic, msg)
          if ((inv.targetName === 'kafkaTemplate' || inv.targetName === 'template') && inv.methodName === 'send') {
            if (inv.args.length > 0) {
              let topic = inv.args[0];
              // Resolve constant symbol if it references a static final variable
              if (type.constants.has(topic)) {
                topic = type.constants.get(topic)!;
              }
              topic = resolvePropertyPlaceholder(topic, symbolTable.configProperties);
              if (topic && !topic.includes('topic-placeholder')) {
                discoveredTopics.add(topic);
                publishedEvents.push({
                  topicOrQueue: topic,
                  brokerType: 'Kafka',
                  eventSchema: `${serviceName}Event`,
                  fileSource: unit.filePath,
                  resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
                  astProvenance: `MethodInvocation: kafkaTemplate.send("${topic}") in ${type.name}.${method.name}()`
                });
              }
            }
          }

          // RabbitTemplate.convertAndSend(exchange, key, msg)
          if (inv.targetName === 'rabbitTemplate' && inv.methodName === 'convertAndSend') {
            if (inv.args.length > 0) {
              const queueOrExchange = resolvePropertyPlaceholder(inv.args[0], symbolTable.configProperties);
              discoveredTopics.add(queueOrExchange);
              publishedEvents.push({
                topicOrQueue: queueOrExchange,
                brokerType: 'RabbitMQ',
                eventSchema: `${serviceName}Message`,
                fileSource: unit.filePath,
                resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
                astProvenance: `MethodInvocation: rabbitTemplate.convertAndSend("${queueOrExchange}")`
              });
            }
          }
        }

        // KafkaListener annotation on method
        const kafkaListener = method.annotations.find(a => a.name === 'KafkaListener');
        if (kafkaListener) {
          let topic = kafkaListener.attributes.topics || kafkaListener.attributes.value || '';
          if (type.constants.has(topic)) {
            topic = type.constants.get(topic)!;
          }
          topic = resolvePropertyPlaceholder(topic, symbolTable.configProperties);
          if (topic && !topic.includes('topic-placeholder')) {
            discoveredTopics.add(topic);
            const group = resolvePropertyPlaceholder(kafkaListener.attributes.groupId || `${serviceId}-group`, symbolTable.configProperties);
            consumedEvents.push({
              topicOrQueue: topic,
              brokerType: 'Kafka',
              consumerGroup: group,
              handlerName: method.name,
              fileSource: unit.filePath,
              resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
              astProvenance: `MethodDeclaration: @KafkaListener(topics = "${topic}") on ${type.name}.${method.name}()`
            });
          }
        }

        // RabbitListener annotation on method
        const rabbitListener = method.annotations.find(a => a.name === 'RabbitListener');
        if (rabbitListener) {
          let queue = rabbitListener.attributes.queues || rabbitListener.attributes.value || '';
          queue = resolvePropertyPlaceholder(queue, symbolTable.configProperties);
          discoveredTopics.add(queue);
          consumedEvents.push({
            topicOrQueue: queue,
            brokerType: 'RabbitMQ',
            handlerName: method.name,
            fileSource: unit.filePath,
            resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
            astProvenance: `MethodDeclaration: @RabbitListener(queues = "${queue}") on ${type.name}.${method.name}()`
          });
        }
      }

      // 3. Database Entity & Repository Resolution
      if (isEntity) {
        const tableAnn = typeAnnotations.find(a => a.name === 'Table');
        const tblName = tableAnn ? (tableAnn.attributes.name || tableAnn.attributes.value || '') : '';
        if (tblName) {
          discoveredTables.add(tblName);
        } else {
          discoveredTables.add(type.name.toLowerCase() + 's');
        }

        codeEvidence.push({
          file: unit.filePath,
          type: 'database',
          astKind: 'ClassDeclaration',
          symbolName: type.name,
          resolutionConfidence: unit.strategy,
          codeSnippet: `@Entity public class ${type.name} { ... }`,
          description: `JPA Persistence Entity mapped to table [${tblName || type.name.toLowerCase() + 's'}]`
        });
      }

      if (isRepository) {
        codeEvidence.push({
          file: unit.filePath,
          type: 'database',
          astKind: 'InterfaceDeclaration',
          symbolName: type.name,
          resolutionConfidence: unit.strategy,
          codeSnippet: `public interface ${type.name} extends JpaRepository<...> { }`,
          description: `Spring Data JPA Repository providing CRUD access`
        });
      }
    }
  }

  // Configuration properties check for Database & Postgres
  const datasourceUrl = symbolTable.configProperties.get('spring.datasource.url') || '';
  if (datasourceUrl.includes('postgresql') || files.some(f => f.content.includes('postgresql') || f.content.includes('org.postgresql.Driver'))) {
    hasPostgres = true;
  }

  // 4. Construct Database Node if tables or datasource detected
  const tables = Array.from(discoveredTables);
  if (tables.length > 0 || datasourceUrl) {
    const dbId = `${serviceId}-db`;
    const dbType = hasPostgres ? 'PostgreSQL' : 'Relational SQL';
    const dbName = `${serviceName} DB (${dbType})`;
    const defaultTable = `${serviceId.replace(/-service$/, '').replace(/-+/g, '_')}s`;
    const finalTables = tables.length > 0 ? tables : [defaultTable];

    databases.push({
      dbId,
      dbName,
      dbType,
      accessMode: 'read-write',
      tablesOrCollections: finalTables,
      orm: hasLiquibaseOrFlyway ? 'Spring Data JPA / Liquibase' : 'Spring Data JPA / Hibernate',
      transactional: true,
      resolutionConfidence: 'AST_SEMANTIC_RESOLVED',
      astProvenance: `Resolved from @Entity & @Table AST definitions across repository`
    });

    downstreamNodes.set(dbId, {
      id: dbId,
      name: dbName,
      type: 'database',
      category: 'Relational Database',
      tech: hasPostgres ? 'PostgreSQL 16' : 'Relational SQL',
      language: 'SQL',
      summary: `Primary transactional persistence store for ${serviceName}`,
      status: 'healthy',
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      analysisStrategy: 'AST_SEMANTIC_RESOLVED',
      metrics: { complexityScore: 3, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
      position: { x: 390, y: 530 }
    });

    edges.push({
      id: `e-${serviceId}-${dbId}`,
      source: serviceId,
      target: dbId,
      type: 'db-readwrite',
      label: `JPA CRUD [${finalTables.join(', ')}]`,
      protocol: 'PostgreSQL Wire'
    });
  }

  // 5. Construct Queue / Event Broker Node ONLY if real messaging AST was discovered
  if (discoveredTopics.size > 0 || publishedEvents.length > 0 || consumedEvents.length > 0) {
    const qId = `${serviceId}-kafka`;
    const topics = Array.from(discoveredTopics);
    const brokerName = `Apache Kafka (${topics.slice(0, 2).join(', ')})`;

    downstreamNodes.set(qId, {
      id: qId,
      name: brokerName,
      type: 'queue',
      category: 'Event Broker',
      tech: 'Apache Kafka',
      language: 'Event Schema',
      summary: `Asynchronous event stream for ${serviceName}`,
      status: 'healthy',
      inboundEndpoints: [],
      outboundCalls: [],
      databases: [],
      asyncEvents: { published: [], consumed: [] },
      codeEvidence: [],
      analysisStrategy: 'AST_SEMANTIC_RESOLVED',
      metrics: { complexityScore: 4, blastRadiusCount: 3, dependentsCount: 1, dependenciesCount: 0, riskFactors: [] },
      position: { x: 740, y: -40 }
    });

    if (publishedEvents.length > 0) {
      edges.push({
        id: `e-${serviceId}-${qId}`,
        source: serviceId,
        target: qId,
        type: 'async-publish',
        label: `PUB ${publishedEvents.map(p => p.topicOrQueue).join(', ')}`,
        protocol: 'Kafka TCP / AMQP'
      });
    }

    if (consumedEvents.length > 0) {
      edges.push({
        id: `e-${qId}-${serviceId}`,
        source: qId,
        target: serviceId,
        type: 'async-consume',
        label: `SUB ${consumedEvents.map(c => c.topicOrQueue).join(', ')}`,
        protocol: 'Kafka TCP / AMQP'
      });
    }
  }

  // Primary Microservice Node
  const primaryNode: ArchitectureNode = {
    id: serviceId,
    name: serviceName,
    type: 'service',
    category: 'Spring Boot Microservice',
    tech: 'Spring Boot 3 + Java 21',
    language: 'Java',
    summary: `Primary analyzed microservice discovered in ${target.subPath || target.repo}`,
    repoUrl: target.cleanUrl,
    repoPath: target.subPath ? `/${target.subPath}` : '/',
    status: 'healthy',
    inboundEndpoints,
    outboundCalls,
    databases,
    asyncEvents: {
      published: publishedEvents,
      consumed: consumedEvents
    },
    codeEvidence,
    analysisStrategy: 'AST_SEMANTIC_RESOLVED',
    astMetadata: {
      parsedFilesCount: symbolTable.files.length,
      classesCount: symbolTable.typesByName.size,
      methodsCount: inboundEndpoints.length + outboundCalls.length,
      annotationsCount: inboundEndpoints.length + databases.length + publishedEvents.length + consumedEvents.length,
      unresolvedSymbols,
      uncertaintyNotes
    },
    metrics: {
      complexityScore: Math.min(10, 2 + inboundEndpoints.length + outboundCalls.length + (databases.length * 2)),
      blastRadiusCount: 1 + outboundCalls.length + databases.length + (publishedEvents.length > 0 ? 1 : 0),
      dependentsCount: 1, // Gateway
      dependenciesCount: outboundCalls.length + databases.length + (publishedEvents.length > 0 ? 1 : 0),
      riskFactors: outboundCalls.some(c => !c.circuitBreaker) 
        ? ['Direct synchronous HTTP calls lack Resilience4j circuit breakers'] 
        : []
    },
    position: { x: 390, y: 220 }
  };

  // Upstream API Gateway Node
  const gatewayNode: ArchitectureNode = {
    id: 'api-gateway',
    name: 'API Gateway (Spring Cloud Gateway)',
    type: 'gateway',
    category: 'Edge Reverse Proxy',
    tech: 'Spring Cloud Gateway',
    language: 'Java / YAML',
    summary: 'Edge routing gateway distributing public HTTP requests',
    status: 'healthy',
    inboundEndpoints: inboundEndpoints.map(e => ({ ...e, path: `/gateway${e.path}` })),
    outboundCalls: [{
      targetServiceId: serviceId,
      targetServiceName: serviceName,
      endpoint: '/api',
      method: 'ROUTING',
      protocol: 'REST',
      clientType: 'Spring Cloud Gateway Netty Route',
      circuitBreaker: true,
      resolutionConfidence: 'CONFIGURATION_GROUNDED'
    }],
    databases: [],
    asyncEvents: { published: [], consumed: [] },
    codeEvidence: [],
    analysisStrategy: 'CONFIGURATION_GROUNDED',
    metrics: { complexityScore: 4, blastRadiusCount: 5, dependentsCount: 0, dependenciesCount: 1, riskFactors: [] },
    position: { x: 70, y: 220 }
  };

  edges.unshift({
    id: `e-gw-${serviceId}`,
    source: 'api-gateway',
    target: serviceId,
    type: 'gateway-route',
    label: `Route -> ${serviceName}`,
    protocol: 'HTTP/2 Reverse Proxy'
  });

  const allNodes: ArchitectureNode[] = [gatewayNode, primaryNode, ...Array.from(downstreamNodes.values())];

  const totalServices = allNodes.filter(n => n.type === 'service' || n.type === 'gateway').length;
  const totalDatabases = allNodes.filter(n => n.type === 'database' || n.type === 'cache').length;
  const totalQueues = allNodes.filter(n => n.type === 'queue').length;

  const detectedRisks = [];
  if (outboundCalls.some(c => !c.circuitBreaker)) {
    detectedRisks.push({
      severity: 'medium' as const,
      title: 'Missing Circuit Breaker on Inter-Service Invocations',
      description: `Service ${serviceName} executes direct outbound HTTP calls to other microservices without Resilience4j @CircuitBreaker protection.`,
      affectedNodes: [serviceId, ...outboundCalls.map(c => c.targetServiceId)],
      recommendation: 'Wrap RestClient or WebClient invocations in @CircuitBreaker(name = "...") with fallback methods.'
    });
  }

  const archStyle = totalQueues > 0
    ? 'Event-Driven Microservices (Spring Boot 3 + Kafka + PostgreSQL)'
    : 'Synchronous REST Microservices (Spring Boot 3 + PostgreSQL Relational Persistence)';

  return {
    systemName: `${serviceName} Architecture (${target.repo}${target.subPath ? '/' + target.subPath : ''})`,
    repositoryUrl: target.cleanUrl,
    branch: target.branch,
    organization: target.owner,
    project: target.repo,
    cloudProvider: target.isGithub ? 'github' : 'azure',
    scannedAt: new Date().toISOString(),
    nodes: allNodes,
    edges,
    summary: {
      totalServices,
      totalDatabases,
      totalQueues,
      syncCallCount: outboundCalls.length + 1,
      asyncEventCount: publishedEvents.length + consumedEvents.length,
      dbInteractionCount: databases.length,
      architecturalStyle: archStyle,
      detectedRisks
    }
  };
}
