"""
Pulls table/column/foreign-key structure from Postgres so it can be fed to
the LLM as context. Uses DatabaseManager's schema cache with TTL and size limits
to avoid repeated queries across multiple databases.
"""
import os
from sqlalchemy import text
from typing import Optional
from dotenv import load_dotenv

import database

load_dotenv()


def get_schema_context(database_url: Optional[str] = None, force_refresh: bool = False) -> str:
    """
    Get schema context for a database, using cache if available.
    
    Args:
        database_url: Target database URL (uses default if not provided)
        force_refresh: Force re-fetch schema from database
    
    Returns:
        Formatted schema context as string
    """
    db_manager = database.get_db_manager()
    url = database_url or db_manager.default_database_url
    
    # Check cache first unless force_refresh
    if not force_refresh:
        cached_schema = db_manager.get_cached_schema(url)
        if cached_schema is not None:
            return cached_schema
    
    # Fetch from database
    engine = db_manager.get_engine(url)
    
    with engine.connect() as conn:
        columns = conn.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)).fetchall()

        foreign_keys = conn.execute(text("""
            SELECT
                tc.table_name, kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
        """)).fetchall()

    # Group columns by table
    tables: dict[str, list[str]] = {}
    for row in columns:
        tables.setdefault(row.table_name, []).append(
            f"{row.column_name} ({row.data_type}"
            f"{', nullable' if row.is_nullable == 'YES' else ''})"
        )

    lines = []
    for table_name, cols in tables.items():
        lines.append(f"Table: {table_name}")
        lines.append(f"Columns:")
        for col in cols:
            lines.append(f"  - {col}")
        lines.append("")

    if foreign_keys:
        lines.append("\nRelationships (Foreign Keys):")
        for fk in foreign_keys:
            lines.append(
                f"  {fk.table_name}.{fk.column_name} references {fk.foreign_table_name}.{fk.foreign_column_name}"
            )

    schema_text = "\n".join(lines)
    
    # Cache the schema with TTL
    db_manager.cache_schema(schema_text, url)
    
    return schema_text


def get_schema_structured(database_url: Optional[str] = None, force_refresh: bool = False) -> dict:
    """
    Get schema in structured format for UI visualization.
    
    Args:
        database_url: Target database URL (uses default if not provided)
        force_refresh: Force re-fetch schema from database
    
    Returns:
        Dictionary with tables, columns, foreign keys, and primary keys
    """
    db_manager = database.get_db_manager()
    url = database_url or db_manager.default_database_url
    engine = db_manager.get_engine(url)
    
    with engine.connect() as conn:
        columns = conn.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable, 
                   column_default, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)).fetchall()

        foreign_keys = conn.execute(text("""
            SELECT
                tc.table_name, kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
        """)).fetchall()

        primary_keys = conn.execute(text("""
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
        """)).fetchall()

    # Build structured schema
    tables = {}
    for row in columns:
        if row.table_name not in tables:
            tables[row.table_name] = {
                "name": row.table_name,
                "columns": [],
                "primary_keys": [],
                "foreign_keys": []
            }
        
        column_info = {
            "name": row.column_name,
            "type": row.data_type,
            "nullable": row.is_nullable == 'YES',
            "default": row.column_default,
            "max_length": row.character_maximum_length
        }
        tables[row.table_name]["columns"].append(column_info)

    # Add primary keys
    for pk in primary_keys:
        if pk.table_name in tables:
            tables[pk.table_name]["primary_keys"].append(pk.column_name)

    # Add foreign keys
    for fk in foreign_keys:
        if fk.table_name in tables:
            tables[fk.table_name]["foreign_keys"].append({
                "column": fk.column_name,
                "references": {
                    "table": fk.foreign_table_name,
                    "column": fk.foreign_column_name
                }
            })

    return {
        "tables": list(tables.values()),
        "relationships": [
            {
                "from": fk.table_name,
                "to": fk.foreign_table_name,
                "fromColumn": fk.column_name,
                "toColumn": fk.foreign_column_name
            }
            for fk in foreign_keys
        ]
    }
