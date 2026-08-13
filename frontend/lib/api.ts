const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  credits_remaining: number;
  email: string;
};

export type CurrentUserResponse = {
  user_id: number;
  email: string;
  credits_remaining: number;
};

export type Column = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  max_length: number | null;
};

export type Table = {
  name: string;
  columns: Column[];
  primary_keys: string[];
  foreign_keys: Array<{
    column: string;
    references: { table: string; column: string };
  }>;
};

export type SchemaData = {
  tables: Table[];
  relationships: Array<{
    from: string;
    to: string;
    fromColumn: string;
    toColumn: string;
  }>;
};

export type QueryResult = {
  database: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  summary: string;
  credits_remaining: number;
};

export async function askQuestion(question: string, token: string, databaseUrl?: string): Promise<QueryResult> {
  const res = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      question,
      database_url: databaseUrl || null
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getSchema(databaseUrl?: string): Promise<SchemaData> {
  const url = new URL(`${API_URL}/schema/structured`);
  if (databaseUrl) {
    url.searchParams.append('database_url', databaseUrl);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch schema (${res.status})`);
  }

  return res.json();
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getCurrentUser(token: string): Promise<CurrentUserResponse> {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}
