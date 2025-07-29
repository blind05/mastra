// Unified Knowledge Graph + GraphRAG types

export type NodeID = string;
export type EdgeID = string;

export interface KGNode {
  id: NodeID;
  type: string; // e.g., 'Document', 'Person', 'Concept', etc.
  labels?: string[];
  properties?: Record<string, any>;
  embedding?: number[]; // Optional vector for semantic search
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'deprecated' | string;
  version?: number;
  parentId?: NodeID;
  childIds?: NodeID[];
}

export type SupportedEdgeType = 'semantic'; // Extendable

export interface KGEdge {
  id: EdgeID;
  source: NodeID;
  target: NodeID;
  type: string; // e.g., 'cites', 'related_to', 'parent_of', etc.
  supportedEdgeType?: SupportedEdgeType; // For compatibility with GraphRAG logic
  labels?: string[];
  properties?: Record<string, any>;
  weight?: number;
  createdAt?: string;
  updatedAt?: string;
  directed?: boolean;
}

export interface KGGraphMetadata {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  [key: string]: any;
}

export interface KGGraph {
  nodes: KGNode[];
  edges: KGEdge[];
  metadata?: KGGraphMetadata;
}

// --- Minimal Schema/Ontology Types ---

export interface KGNodeTypeDef {
  type: string;
  requiredProperties?: string[];
}

export interface KGEdgeTypeDef {
  type: string;
  requiredProperties?: string[];
  sourceTypes?: string[]; // allowed source node types
  targetTypes?: string[]; // allowed target node types
}

export interface KGSchema {
  nodeTypes: KGNodeTypeDef[];
  edgeTypes: KGEdgeTypeDef[];
}

// Utility types for graph construction/query
export interface GraphChunk {
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface RankedNode extends KGNode {
  score: number;
}

export interface KGRagOptions {
  requireEmbedding?: boolean;
  embeddingDimension?: number;
  defaultDirected?: boolean;
}
