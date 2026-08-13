"""Turns a natural-language question into SQL, and turns SQL results back
into a plain-English answer. Two separate LLM calls -- keeping them separate
makes each prompt simpler and easier to debug independently."""
import os
import re

from openai import OpenAI
from typing import Optional
from app.config import settings
from schema_introspect import get_schema_context

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
MODEL = "gpt-4o-mini"

SQL_SYSTEM_PROMPT = """You are a SQL generator for a PostgreSQL database.
Given the schema below and a user's question, output ONLY a single valid
PostgreSQL SELECT query. No explanation, no markdown code fences, no
semicolon at the end.

⚠️ CRITICAL: Use table and column names with EXACT casing from the schema below.
Do NOT capitalize or modify table/column names. Use them exactly as shown.
Always use lowercase for table/column names that appear lowercase in the schema and vice versa.

.

=== DATABASE SCHEMA ===
{schema}
=== END SCHEMA ===

USER QUESTION: {question}

Generate the SQL query (remember: use EXACT casing from schema):
SQL:"""

EXPLAIN_SYSTEM_PROMPT = """You answer questions about database query results
in plain, friendly English. Be concise -- 1-3 sentences. Don't mention SQL
or technical column names unless necessary.

QUESTION: {question}
RESULTS (as JSON rows): {results}

ANSWER:"""


def generate_sql(question: str, database_url: Optional[str] = None) -> str:
    schema = get_schema_context(database_url)
    if len(schema) > settings.schema_context_max_chars:
        schema = schema[: settings.schema_context_max_chars]
    prompt = SQL_SYSTEM_PROMPT.format(schema=schema, question=question)
    
    # Debug: print the schema context to verify table names and casing
    print(f"\n{'='*60}")
    print(f"DATABASE SCHEMA CONTEXT SENT TO LLM:")
    print(f"{'='*60}")
    print(schema)
    print(f"{'='*60}\n")
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=settings.sql_generation_max_tokens,
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return "NO_QUERY_POSSIBLE"
    
    print(f"LLM Generated SQL: {raw}\n")

    # Defensive cleanup in case the model wraps output in a code fence anyway
    raw = re.sub(r"^```sql\s*|```$", "", raw, flags=re.IGNORECASE).strip()
    if len(raw) > settings.max_generated_sql_chars:
        return "NO_QUERY_POSSIBLE"
    return raw


def explain_results(question: str, results: list[dict], database_url: Optional[str] = None) -> str:
    """
    Explain query results in plain English.
    
    Args:
        question: Original user question
        results: Query result rows
        database_url: Database URL (for context, not used currently but for consistency)
    
    Returns:
        Plain English explanation of results
    """
    if not results:
        return "No results were found for that question."
    prompt = EXPLAIN_SYSTEM_PROMPT.format(question=question, results=results[:20])
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=settings.explanation_max_tokens,
    )
    return response.choices[0].message.content.strip()
