import os
from dataclasses import dataclass

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.config import settings


@dataclass
class UserRecord:
    id: int
    email: str
    password_hash: str
    credits_remaining: int


_metadata = MetaData()
_users_table = Table(
    "users",
    _metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("email", String(320), nullable=False, unique=True),
    Column("password_hash", String(512), nullable=False),
    Column("credits_remaining", Integer, nullable=False, default=0),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
)

_auth_engine: Engine | None = None


def _get_auth_database_url() -> str:
    if settings.auth_database_url:
        return settings.auth_database_url

    path = os.path.abspath(settings.auth_db_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return f"sqlite:///{path.replace(os.sep, '/')}"


def _get_engine() -> Engine:
    global _auth_engine
    if _auth_engine is not None:
        return _auth_engine

    auth_database_url = _get_auth_database_url()
    connect_args = {"check_same_thread": False} if auth_database_url.startswith("sqlite") else {}
    _auth_engine = create_engine(auth_database_url, pool_pre_ping=True, connect_args=connect_args)
    return _auth_engine


def _row_to_user(row) -> UserRecord:
    data = row._mapping
    return UserRecord(
        id=int(data["id"]),
        email=str(data["email"]),
        password_hash=str(data["password_hash"]),
        credits_remaining=int(data["credits_remaining"]),
    )


def initialize_auth_store() -> None:
    engine = _get_engine()
    _metadata.create_all(engine)


def create_user(email: str, password_hash: str, starting_credits: int) -> UserRecord:
    engine = _get_engine()
    normalized_email = email.lower()

    with engine.begin() as conn:
        try:
            conn.execute(
                _users_table.insert().values(
                    email=normalized_email,
                    password_hash=password_hash,
                    credits_remaining=starting_credits,
                )
            )
        except IntegrityError:
            raise

        row = conn.execute(
            select(
                _users_table.c.id,
                _users_table.c.email,
                _users_table.c.password_hash,
                _users_table.c.credits_remaining,
            ).where(_users_table.c.email == normalized_email)
        ).first()

    if row is None:
        raise ValueError("Failed to create user.")

    return _row_to_user(row)


def get_user_by_email(email: str) -> UserRecord | None:
    engine = _get_engine()
    normalized_email = email.lower()

    with engine.connect() as conn:
        row = conn.execute(
            select(
                _users_table.c.id,
                _users_table.c.email,
                _users_table.c.password_hash,
                _users_table.c.credits_remaining,
            ).where(_users_table.c.email == normalized_email)
        ).first()
    if row is None:
        return None
    return _row_to_user(row)


def get_user_by_id(user_id: int) -> UserRecord | None:
    engine = _get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            select(
                _users_table.c.id,
                _users_table.c.email,
                _users_table.c.password_hash,
                _users_table.c.credits_remaining,
            ).where(_users_table.c.id == user_id)
        ).first()
    if row is None:
        return None
    return _row_to_user(row)


def consume_credits(user_id: int, amount: int) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be positive.")

    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE users
                SET credits_remaining = credits_remaining - :amount
                WHERE id = :user_id AND credits_remaining >= :amount
                RETURNING credits_remaining
                """
            ),
            {"amount": amount, "user_id": user_id},
        ).first()

        if row is not None:
            return int(row[0])

        exists = conn.execute(
            select(_users_table.c.id).where(_users_table.c.id == user_id)
        ).first()
        if exists is None:
            raise ValueError("User not found.")
        raise ValueError("Insufficient credits.")


def add_credits(user_id: int, amount: int) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be positive.")

    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                UPDATE users
                SET credits_remaining = credits_remaining + :amount
                WHERE id = :user_id
                RETURNING credits_remaining
                """
            ),
            {"amount": amount, "user_id": user_id},
        ).first()

        if row is None:
            raise ValueError("User not found.")

        return int(row[0])
