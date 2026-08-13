"""
Safety layer for LLM-generated SQL. This is the part worth spending real
time on -- an LLM producing SQL that runs unchecked against a real database
is a genuine risk, not a hypothetical one.

Rules enforced:
  1. Only SELECT statements are allowed (blocks DROP/DELETE/UPDATE/ALTER/INSERT/TRUNCATE)
  2. Only one statement per request (blocks statement-stacking via semicolons)
  3. EXPLAIN is run first to catch malformed queries before touching real data
  4. A row limit is injected if the query doesn't already have one
  5. A statement timeout is enforced at the database connection level (see database.py)
"""
import re
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import text
import database

FORBIDDEN_KEYWORDS = {
    "insert", "update", "delete", "drop", "alter", "truncate",
    "create", "grant", "revoke", "copy", "vacuum", "call",
}


@dataclass
class ValidationResult:
    is_valid: bool
    sql: str = ""
    error: str | None = None


def validate(raw_sql: str, max_rows: int = 100, database_url: Optional[str] = None) -> ValidationResult:
    """
    Validate LLM-generated SQL.
    
    Args:
        raw_sql: Raw SQL query to validate
        max_rows: Maximum rows to return (adds LIMIT if not present)
        database_url: Target database URL (uses default if not provided)
    
    Returns:
        ValidationResult with is_valid, sql, and error
    """
    sql = raw_sql.strip().rstrip(";")

    # Reject empty or suspiciously short output
    if not sql:
        return ValidationResult(is_valid=False, error="Empty query generated.")

    # Reject multiple statements (e.g. "SELECT ...; DROP TABLE ...")
    if ";" in sql:
        return ValidationResult(
            is_valid=False, error="Multiple statements are not allowed."
        )

    # Must start with SELECT (allowing leading whitespace/comments already stripped)
    if not re.match(r"^\s*select\b", sql, re.IGNORECASE):
        return ValidationResult(
            is_valid=False, error="Only SELECT queries are permitted."
        )

    # Block forbidden keywords anywhere in the query (covers subqueries/CTEs)
    lowered = sql.lower()
    for keyword in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{keyword}\b", lowered):
            return ValidationResult(
                is_valid=False,
                error=f"Query contains a disallowed operation: '{keyword}'.",
            )

    # Inject a row limit if none is present, so a bad query can't return
    # millions of rows and hang the API response
    if not re.search(r"\blimit\b", lowered):
        sql = f"{sql} LIMIT {max_rows}"

    # Dry-run with EXPLAIN to catch syntax errors / bad column references
    # before executing against real data
    try:
        db_manager = database.get_db_manager()
        engine = db_manager.get_engine(database_url)
        with engine.connect() as conn:
            conn.execute(text(f"EXPLAIN {sql}"))
    except Exception as e:
        error_msg = str(e)
        
        # If it's an undefined table error, fetch available tables to help debug
        if "undefined" in error_msg.lower() and "table" in error_msg.lower():
            try:
                db_manager = database.get_db_manager()
                engine = db_manager.get_engine(database_url)
                with engine.connect() as conn:
                    result = conn.execute(text("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_schema = 'public'
                        ORDER BY table_name
                    """))
                    available_tables = [row[0] for row in result.fetchall()]
                    error_msg += f"\n\nAvailable tables in this database: {', '.join(available_tables)}"
            except:
                pass  # If we can't fetch tables, just show original error
        
        return ValidationResult(
            is_valid=False, error=f"Query failed validation (EXPLAIN): {error_msg}"
        )

    return ValidationResult(is_valid=True, sql=sql)
