"use client";

import { useState, useEffect } from "react";
import { askQuestion, type QueryResult, type SchemaData, getSchema } from "../lib/api";
import {
  getAuthToken,
  getStoredDatabaseUrl,
  setStoredCredits,
  setStoredDatabaseUrl,
} from "../lib/storage";

const DEFAULT_EXAMPLE_QUESTIONS = [
  "Which customers placed orders over $100 total?",
  "What's the best-selling product category?",
  "How many orders were cancelled?",
];

const MAX_QUESTION_CHARS = 500;

function formatDatabaseLabel(url: string): string {
  if (!url) return "Default Database";
  try {
    return (new URL(url).pathname || url).substring(1) || "Custom Database";
  } catch {
    return "Custom Database";
  }
}

export default function QueryChat({ customDatabaseUrl }: { customDatabaseUrl?: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [showCustomDb, setShowCustomDb] = useState(false);
  const [dbUrl, setDbUrl] = useState(customDatabaseUrl || "");
  const [exampleQuestions, setExampleQuestions] = useState(DEFAULT_EXAMPLE_QUESTIONS);
  const [token, setToken] = useState("");

  useEffect(() => {
    const storedDb = getStoredDatabaseUrl();
    setDbUrl(storedDb || customDatabaseUrl || "");
    setToken(getAuthToken());
    generateDynamicQuestions();
  }, []);

  useEffect(() => {
    const handleSessionChange = () => {
      setDbUrl(getStoredDatabaseUrl());
      setToken(getAuthToken());
    };
    window.addEventListener("appSessionChanged", handleSessionChange);
    return () => window.removeEventListener("appSessionChanged", handleSessionChange);
  }, []);

  const generateDynamicQuestions = async () => {
    try {
      const storedDb = getStoredDatabaseUrl();
      const schema: SchemaData = await getSchema(storedDb || undefined);
      const dynamicQuestions = generateQuestionsFromSchema(schema);
      setExampleQuestions(dynamicQuestions);
    } catch (err) {
      // Fall back to default questions if schema fetch fails
      console.error("Failed to fetch schema for dynamic questions:", err);
    }
  };

  const generateQuestionsFromSchema = (schema: SchemaData): string[] => {
    const questions: string[] = [];
    const tableNames = schema.tables.map(t => t.name.toLowerCase());
    
    // Generate questions based on available tables and their relationships
    if (tableNames.includes("customers") && tableNames.includes("orders")) {
      questions.push("Which customers have placed the most orders?");
      questions.push("Show me customers who haven't placed any orders");
    }
    
    if (tableNames.includes("products") && tableNames.includes("orders")) {
      questions.push("What are the top-selling products?");
      questions.push("Which products have never been ordered?");
    }
    
    if (tableNames.includes("orders")) {
      questions.push("How many orders were placed in the last month?");
      questions.push("What is the average order value?");
    }
    
    // Add generic questions based on table count
    if (schema.tables.length > 0) {
      const firstTable = schema.tables[0].name;
      questions.push(`Show me all records from ${firstTable}`);
      questions.push(`How many rows are in ${firstTable}?`);
    }
    
    // If we couldn't generate specific questions, use defaults
    return questions.length > 0 ? questions.slice(0, 6) : DEFAULT_EXAMPLE_QUESTIONS;
  };

  async function handleSubmit(q: string) {
    if (!q.trim()) return;
    if (!token) {
      setError("Please login before running queries.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await askQuestion(q, token, dbUrl || undefined);
      setResult(res);
      setStoredCredits(res.credits_remaining);
      window.dispatchEvent(new Event("appSessionChanged"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const handleCustomDbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dbUrl.trim()) {
      setStoredDatabaseUrl(dbUrl);
      window.dispatchEvent(new Event("appSessionChanged"));
      setShowCustomDb(false);
      generateDynamicQuestions();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {showCustomDb && (
        <div style={{ padding: "1rem", background: "#1a1d24", borderRadius: 8, border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem" }}>
            {dbUrl ? "Switch Database" : "Connect to Custom Database"}
          </h3>
          <form onSubmit={handleCustomDbSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", color: "#e6e6e6" }}>
                PostgreSQL Database URL
              </label>
              <input
                type="text"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="postgresql://user:password@host:port/database"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: 4,
                  border: "1px solid #333",
                  background: "#2a2d35",
                  color: "#e6e6e6",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ fontSize: "12px", color: "#ff6b6b", lineHeight: "1.4" }}>
              ⚠️ <strong>Security Warning:</strong> Only use databases with read-only permissions. Never share production database credentials. The application will execute SELECT queries only.
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1rem",
                  background: "#4f8cff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {dbUrl ? "Update" : "Connect"}
              </button>
              <button
                type="button"
                onClick={() => setShowCustomDb(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#333",
                  color: "#e6e6e6",
                  border: "1px solid #444",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#9a9a9a" }}>
          <span>Database: </span>
          <span style={{ color: "#e6e6e6", fontWeight: 500 }}>
            {formatDatabaseLabel(dbUrl)}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setShowCustomDb(!showCustomDb)}
            style={{
              padding: "0.4rem 0.75rem",
              background: dbUrl ? "#ff6b6b" : "#333",
              color: "#e6e6e6",
              border: dbUrl ? "1px solid #ff6b6b" : "1px solid #444",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {dbUrl ? "Switch Database" : "Add Custom Database"}
          </button>
          {dbUrl && (
            <button
              onClick={() => {
                setDbUrl("");
                setStoredDatabaseUrl("");
                window.dispatchEvent(new Event("appSessionChanged"));
                setResult(null);
                generateDynamicQuestions();
              }}
              style={{
                padding: "0.4rem 0.75rem",
                background: "#333",
                color: "#ff6b6b",
                border: "1px solid #444",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(question);
        }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          placeholder="e.g. Which customers spent the most?"
          style={{
            flex: 1,
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #333",
            background: "#1a1d24",
            color: "#e6e6e6",
          }}
        />
        <button
          type="submit"
          disabled={loading || !token}
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 8,
            border: "none",
            background: token ? "#4f8cff" : "#555",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Thinking..." : token ? "Ask" : "Login required"}
        </button>
      </form>

      <div style={{ fontSize: "0.78rem", color: "#9a9a9a", textAlign: "right" }}>
        {question.length}/{MAX_QUESTION_CHARS} characters
      </div>

      {!result && !loading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {exampleQuestions.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                handleSubmit(q);
              }}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 999,
                border: "1px solid #333",
                background: "transparent",
                color: "#9a9a9a",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: "#ff6b6b", padding: "0.75rem", background: "#2a1414", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#9a9a9a", paddingBottom: "0.5rem", borderBottom: "1px solid #333" }}>
            <span>Query executed on: </span>
            <span style={{ color: "#e6e6e6", fontWeight: 500 }}>
              {formatDatabaseLabel(result.database)}
            </span>
          </div>

          <p>{result.summary}</p>

          <button
            onClick={() => setShowSql(!showSql)}
            style={{ background: "none", border: "none", color: "#4f8cff", cursor: "pointer", textAlign: "left", fontSize: "0.85rem" }}
          >
            {showSql ? "Hide" : "Show"} generated SQL
          </button>
          {showSql && (
            <pre style={{ background: "#1a1d24", padding: "0.75rem", borderRadius: 8, overflowX: "auto", fontSize: "0.85rem" }}>
              {result.sql}
            </pre>
          )}

          {result.rows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {result.columns.map((col) => (
                    <th key={col} style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "0.5rem" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((col) => (
                      <td key={col} style={{ borderBottom: "1px solid #222", padding: "0.5rem" }}>
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
