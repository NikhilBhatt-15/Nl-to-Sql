import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)


class Settings:
    app_name: str = "NL-to-SQL Assistant"
    max_rows_returned: int = int(os.environ.get("MAX_ROWS_RETURNED", "100"))
    query_timeout_seconds: int = int(os.environ.get("QUERY_TIMEOUT_SECONDS", "5"))
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "https://nl-to-sql-three.vercel.app"
    ]
    auth_database_url: str = os.environ.get("AUTH_DATABASE_URL", "")
    auth_db_path: str = os.environ.get("AUTH_DB_PATH", "./data/auth.db")
    jwt_secret_key: str = os.environ.get("JWT_SECRET_KEY", "change-me-in-production")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    token_expire_minutes: int = int(os.environ.get("TOKEN_EXPIRE_MINUTES", "1440"))
    starting_credits: int = int(os.environ.get("STARTING_CREDITS", "25"))
    credits_per_query: int = int(os.environ.get("CREDITS_PER_QUERY", "1"))
    max_question_chars: int = int(os.environ.get("MAX_QUESTION_CHARS", "500"))
    max_question_words: int = int(os.environ.get("MAX_QUESTION_WORDS", "80"))
    schema_context_max_chars: int = int(os.environ.get("SCHEMA_CONTEXT_MAX_CHARS", "12000"))
    sql_generation_max_tokens: int = int(os.environ.get("SQL_GENERATION_MAX_TOKENS", "220"))
    explanation_max_tokens: int = int(os.environ.get("EXPLANATION_MAX_TOKENS", "180"))
    max_generated_sql_chars: int = int(os.environ.get("MAX_GENERATED_SQL_CHARS", "3000"))
    max_summary_chars: int = int(os.environ.get("MAX_SUMMARY_CHARS", "1200"))
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    rate_limit_per_minute_user: int = int(os.environ.get("RATE_LIMIT_PER_MINUTE_USER", "12"))
    rate_limit_per_minute_ip: int = int(os.environ.get("RATE_LIMIT_PER_MINUTE_IP", "40"))
    daily_query_limit_per_user: int = int(os.environ.get("DAILY_QUERY_LIMIT_PER_USER", "120"))
    redis_strict_mode: bool = os.environ.get("REDIS_STRICT_MODE", "true").lower() == "true"
    password_hash_iterations: int = int(os.environ.get("PASSWORD_HASH_ITERATIONS", "210000"))
    google_client_id: str = os.environ.get("GOOGLE_CLIENT_ID", "")
    password_auth_enabled: bool = os.environ.get("PASSWORD_AUTH_ENABLED", "false").lower() == "true"


settings = Settings()
