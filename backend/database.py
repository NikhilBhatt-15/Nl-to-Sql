"""Database engine + session management with multi-database support and schema caching."""
import os
import time
from contextlib import contextmanager
from typing import Optional, Dict, Tuple
from collections import OrderedDict
from urllib.parse import parse_qs, urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()


class SchemaCache:
    """Thread-safe schema cache with TTL and size limits."""
    
    def __init__(self, max_size: int = 10, ttl_seconds: int = 3600):
        """
        Args:
            max_size: Maximum number of cached schemas
            ttl_seconds: Time-to-live for each cache entry (default 1 hour)
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: OrderedDict[str, Tuple[str, float]] = OrderedDict()  # {url: (schema_text, timestamp)}
    
    def get(self, database_url: str) -> Optional[str]:
        """Get cached schema if exists and not expired."""
        if database_url not in self.cache:
            return None
        
        schema_text, timestamp = self.cache[database_url]
        if time.time() - timestamp > self.ttl_seconds:
            # Expired, remove it
            del self.cache[database_url]
            return None
        
        # Move to end (LRU)
        self.cache.move_to_end(database_url)
        return schema_text
    
    def set(self, database_url: str, schema_text: str):
        """Cache a schema with current timestamp."""
        # Remove oldest if at capacity
        if len(self.cache) >= self.max_size and database_url not in self.cache:
            self.cache.popitem(last=False)
        
        self.cache[database_url] = (schema_text, time.time())
        self.cache.move_to_end(database_url)
    
    def clear(self):
        """Clear all cached entries."""
        self.cache.clear()
    
    def invalidate(self, database_url: Optional[str] = None):
        """Invalidate cache for specific URL or all if None."""
        if database_url is None:
            self.clear()
        elif database_url in self.cache:
            del self.cache[database_url]


class DatabaseManager:
    """Manages database connections and caching for multiple databases."""
    
    def __init__(
        self,
        default_database_url: Optional[str] = None,
        schema_cache_max_size: int = 10,
        schema_cache_ttl_seconds: int = 3600
    ):
        """
        Args:
            default_database_url: Default database URL (from env if not provided)
            schema_cache_max_size: Maximum number of cached schemas
            schema_cache_ttl_seconds: Cache TTL in seconds
        """
        self.default_database_url = default_database_url or os.environ.get("DATABASE_URL")
        if not self.default_database_url:
            raise ValueError("No DATABASE_URL provided in env or constructor")
        
        self.engines: Dict[str, any] = {}
        self.session_makers: Dict[str, any] = {}
        self.schema_cache = SchemaCache(max_size=schema_cache_max_size, ttl_seconds=schema_cache_ttl_seconds)
        
        # Initialize default engine
        self._get_or_create_engine(self.default_database_url)
    
    def _get_or_create_engine(self, database_url: str):
        """Create and cache engine for a database URL."""
        if database_url not in self.engines:
            # Keep SSL mode configurable so public datasets/non-SSL instances work.
            connect_args = {}
            if database_url.startswith("postgresql://") or database_url.startswith("postgres://"):
                parsed = urlparse(database_url)
                has_sslmode_in_url = "sslmode" in parse_qs(parsed.query)
                env_sslmode = os.environ.get("DB_SSLMODE", "prefer")
                if not has_sslmode_in_url and env_sslmode:
                    connect_args = {"sslmode": env_sslmode}
            
            engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
            self.engines[database_url] = engine
            self.session_makers[database_url] = sessionmaker(bind=engine)
    
    def get_engine(self, database_url: Optional[str] = None):
        """Get SQLAlchemy engine for the given URL or default."""
        url = database_url or self.default_database_url
        self._get_or_create_engine(url)
        return self.engines[url]
    
    @contextmanager
    def get_session(self, database_url: Optional[str] = None):
        """Get a database session for the given URL or default."""
        url = database_url or self.default_database_url
        self._get_or_create_engine(url)
        session = self.session_makers[url]()
        try:
            yield session
        finally:
            session.close()
    
    def run_raw_query(
        self,
        sql: str,
        database_url: Optional[str] = None,
        timeout_seconds: int = 5
    ) -> list[dict]:
        """
        Execute a validated, read-only SQL query.
        
        Args:
            sql: Validated SQL query
            database_url: Target database URL (uses default if not provided)
            timeout_seconds: Query timeout in seconds
        
        Returns:
            List of result rows as dictionaries
        """
        engine = self.get_engine(database_url)
        with engine.connect() as conn:
            conn.execute(text(f"SET statement_timeout = {timeout_seconds * 1000}"))
            result = conn.execute(text(sql))
            columns = result.keys()
            return [dict(zip(columns, row)) for row in result.fetchall()]
    
    def get_cached_schema(self, database_url: Optional[str] = None) -> Optional[str]:
        """Get cached schema if available and not expired."""
        url = database_url or self.default_database_url
        return self.schema_cache.get(url)
    
    def cache_schema(self, schema_text: str, database_url: Optional[str] = None):
        """Cache a schema with TTL."""
        url = database_url or self.default_database_url
        self.schema_cache.set(url, schema_text)
    
    def invalidate_schema_cache(self, database_url: Optional[str] = None):
        """Invalidate schema cache for specific URL or all."""
        self.schema_cache.invalidate(database_url)
    
    def update_database_url(self, new_url: str):
        """Update the default database URL and recreate engine."""
        self.default_database_url = new_url
        self._get_or_create_engine(new_url)


# Global instance
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """Get or create the global database manager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


# Backward compatibility - module-level convenience functions
def get_engine(database_url: Optional[str] = None):
    """Get SQLAlchemy engine."""
    return get_db_manager().get_engine(database_url)


@contextmanager
def get_session(database_url: Optional[str] = None):
    """Get a database session."""
    with get_db_manager().get_session(database_url) as session:
        yield session


def run_raw_query(sql: str, database_url: Optional[str] = None, timeout_seconds: int = 5) -> list[dict]:
    """
    Execute a validated, read-only SQL string and return rows as dicts.
    Assumes `sql` has already passed through sql_validator.validate().
    Never call this directly with unvalidated user/LLM input.
    
    Args:
        sql: Validated SQL query
        database_url: Target database URL (uses default if not provided)
        timeout_seconds: Query timeout in seconds
    
    Returns:
        List of result rows as dictionaries
    """
    return get_db_manager().run_raw_query(sql, database_url, timeout_seconds)


def update_database_url(new_url: str):
    """Update the default database URL and recreate engine."""
    get_db_manager().update_database_url(new_url)
