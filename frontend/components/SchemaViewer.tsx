"use client";

import { useCallback, useEffect, useState } from "react";
import { getSchema, type SchemaData, type Column, type Table } from "../lib/api";
import { getStoredDatabaseUrl, setStoredDatabaseUrl } from "../lib/storage";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface SchemaViewerProps {
  customDatabaseUrl?: string;
}

function TreeView({ schemaData }: { schemaData: SchemaData | null }) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  if (!schemaData) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#9a9a9a" }}>
        No schema data available
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "1.5rem", 
      overflow: "auto", 
      height: "100%",
      background: "#0d1117"
    }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.2rem" }}>🗄️</span>
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
          Database Schema ({schemaData.tables.length} tables)
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {schemaData.tables.map((table) => (
          <div key={table.name} style={{ background: "#1a1d24", borderRadius: "8px", border: "1px solid #333", overflow: "hidden" }}>
            <button
              onClick={() => toggleTable(table.name)}
              style={{
                width: "100%",
                padding: "1rem",
                background: "transparent",
                border: "none",
                color: "#e6e6e6",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: "1rem", color: "#9a9a9a" }}>
                {expandedTables.has(table.name) ? "▼" : "▶"}
              </span>
              <span style={{ fontSize: "1rem", color: "#4f8cff" }}>📋</span>
              <span>{table.name}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#9a9a9a" }}>
                {table.columns.length} columns
              </span>
            </button>

            {expandedTables.has(table.name) && (
              <div style={{ padding: "0 1rem 1rem 1rem" }}>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "2fr 1fr 80px 80px",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  background: "#0d1117",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#9a9a9a"
                }}>
                  <div>Column</div>
                  <div>Type</div>
                  <div>Nullable</div>
                  <div>Keys</div>
                </div>

                {table.columns.map((column) => (
                  <div
                    key={column.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 80px 80px",
                      gap: "0.5rem",
                      padding: "0.75rem 0.5rem",
                      borderBottom: "1px solid #222",
                      fontSize: "0.9rem",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ 
                      fontFamily: "monospace",
                      color: "#e6e6e6",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {column.name}
                    </div>
                    <div style={{ color: "#9a9a9a", fontSize: "0.85rem" }}>
                      {column.type}
                    </div>
                    <div style={{ 
                      fontSize: "0.8rem",
                      color: column.nullable ? "#ff6b6b" : "#4f8cff"
                    }}>
                      {column.nullable ? "YES" : "NO"}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem" }}>
                      {table.primary_keys.includes(column.name) && (
                        <span title="Primary Key" style={{ color: "#ffd700" }}>🔑</span>
                      )}
                      {table.foreign_keys.some((fk) => fk.column === column.name) && (
                        <span title="Foreign Key" style={{ color: "#4f8cff" }}>🔗</span>
                      )}
                    </div>
                  </div>
                ))}

                {table.foreign_keys.length > 0 && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#0d1117", borderRadius: "4px" }}>
                    <div style={{ fontSize: "0.85rem", color: "#9a9a9a", marginBottom: "0.5rem" }}>
                      Foreign Key Relationships:
                    </div>
                    {table.foreign_keys.map((fk, idx) => (
                      <div key={idx} style={{ fontSize: "0.85rem", color: "#e6e6e6", padding: "0.25rem 0" }}>
                        <span style={{ color: "#4f8cff" }}>{fk.column}</span>
                        <span style={{ color: "#9a9a9a" }}> → </span>
                        <span style={{ color: "#4f8cff" }}>{fk.references.table}.{fk.references.column}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchemaViewer({ customDatabaseUrl }: SchemaViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomDb, setShowCustomDb] = useState(false);
  const [dbUrl, setDbUrl] = useState("");
  const [viewMode, setViewMode] = useState<'tree' | 'diagram'>('tree');
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);

  const fetchSchema = async (url?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: SchemaData = await getSchema(url);
      setSchemaData(data);
      transformSchemaToFlow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema");
    } finally {
      setLoading(false);
    }
  };

  const transformSchemaToFlow = (data: SchemaData) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Calculate positions in a grid layout
    const tablesPerRow = 3;
    const tableWidth = 280;
    const horizontalGap = 120;
    const verticalGap = 120;

    data.tables.forEach((table, index) => {
      const row = Math.floor(index / tablesPerRow);
      const col = index % tablesPerRow;

      const columnItems = table.columns.map((col) => ({
        id: col.name,
        label: `${col.name}${table.primary_keys.includes(col.name) ? " 🔑" : ""}${
          table.foreign_keys.some((fk) => fk.column === col.name) ? " 🔗" : ""
        } (${col.type})`,
      }));

      // Calculate dynamic height based on content
      const estimatedHeight = Math.max(120, 60 + (columnItems.length * 25));

      newNodes.push({
        id: table.name,
        type: "default",
        position: {
          x: col * (tableWidth + horizontalGap),
          y: row * (estimatedHeight + verticalGap),
        },
        data: {
          label: (
            <div style={{ 
              padding: "12px", 
              width: "260px",
              boxSizing: "border-box",
              overflow: "hidden"
            }}>
              <h3 style={{ 
                margin: "0 0 10px 0", 
                fontSize: "14px", 
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {table.name}
              </h3>
              <div style={{ fontSize: "12px" }}>
                {columnItems.map((item) => (
                  <div 
                    key={item.id} 
                    style={{ 
                      padding: "4px 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: "1.4"
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          ),
        },
        style: {
          background: "#1a1d24",
          border: "1px solid #333",
          borderRadius: "8px",
          color: "#e6e6e6",
          width: "280px",
          minWidth: "280px",
          maxWidth: "280px",
          overflow: "hidden",
        },
      });
    });

    // Create edges for relationships
    data.relationships.forEach((rel, index) => {
      newEdges.push({
        id: `e${index}`,
        source: rel.from,
        target: rel.to,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#4f8cff",
        },
        style: { stroke: "#4f8cff", strokeWidth: 2 },
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        labelStyle: { 
          fill: "#9a9a9a", 
          fontSize: 10,
          fontWeight: 500
        },
        labelBgStyle: {
          fill: "#1a1d24",
          fillOpacity: 0.8,
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  useEffect(() => {
    const activeUrl = customDatabaseUrl || getStoredDatabaseUrl();
    setDbUrl(activeUrl || "");
    fetchSchema(activeUrl || undefined);
  }, [customDatabaseUrl]);

  const handleCustomDbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dbUrl.trim()) {
      setStoredDatabaseUrl(dbUrl);
      window.dispatchEvent(new Event("appSessionChanged"));
      fetchSchema(dbUrl);
      setShowCustomDb(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#9a9a9a" }}>Loading schema...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ color: "#ff6b6b", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => fetchSchema()}
          style={{
            padding: "0.5rem 1rem",
            background: "#4f8cff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      width: "100%", 
      height: "100%", 
      display: "flex", 
      flexDirection: "column"
    }}>
      <div style={{ padding: "1rem", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Database Schema</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setViewMode('tree')}
            style={{
              padding: "0.5rem 1rem",
              background: viewMode === 'tree' ? "#4f8cff" : "#333",
              color: "#e6e6e6",
              border: "1px solid #444",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Tree View
          </button>
          <button
            onClick={() => setViewMode('diagram')}
            style={{
              padding: "0.5rem 1rem",
              background: viewMode === 'diagram' ? "#4f8cff" : "#333",
              color: "#e6e6e6",
              border: "1px solid #444",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Diagram View
          </button>
          <button
            onClick={() => setShowCustomDb(!showCustomDb)}
            style={{
              padding: "0.5rem 1rem",
              background: "#333",
              color: "#e6e6e6",
              border: "1px solid #444",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {showCustomDb ? "Hide" : "Add Custom Database"}
          </button>
        </div>
      </div>

      {showCustomDb && (
        <div style={{ padding: "1rem", borderBottom: "1px solid #333", background: "#1a1d24" }}>
          <form onSubmit={handleCustomDbSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="postgresql://user:password@host:port/database"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #333",
                  background: "#2a2d35",
                  color: "#e6e6e6",
                }}
              />
              <div style={{ marginTop: "0.5rem", fontSize: "12px", color: "#ff6b6b" }}>
                ⚠️ Warning: Only use databases with read-only permissions. Never share production database credentials.
              </div>
            </div>
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                background: "#4f8cff",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Load Schema
            </button>
          </form>
        </div>
      )}

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {viewMode === 'tree' ? (
          <TreeView schemaData={schemaData} />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            style={{ 
              background: "#0d1117",
              width: "100%",
              height: "100%"
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          >
            <Background color="#333" gap={20} size={1} />
            <Controls 
              style={{ 
                background: "#1a1d24",
                border: "1px solid #333",
                color: "#e6e6e6"
              }}
            />
            <MiniMap
              nodeColor="#1a1d24"
              nodeStrokeColor="#4f8cff"
              maskColor="rgba(0, 0, 0, 0.8)"
              style={{
                background: "#1a1d24",
                border: "1px solid #333"
              }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
