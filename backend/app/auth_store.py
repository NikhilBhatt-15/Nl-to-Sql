import os
import sqlite3
from dataclasses import dataclass

from app.config import settings


@dataclass
class UserRecord:
    id: int
    email: str
    password_hash: str
    credits_remaining: int


def _db_path() -> str:
    return os.path.abspath(settings.auth_db_path)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(), timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_auth_store() -> None:
    path = _db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                credits_remaining INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def create_user(email: str, password_hash: str, starting_credits: int) -> UserRecord:
    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (email, password_hash, credits_remaining)
            VALUES (?, ?, ?)
            """,
            (email.lower(), password_hash, starting_credits),
        )
        conn.commit()
        user_id = cursor.lastrowid
        return UserRecord(
            id=user_id,
            email=email.lower(),
            password_hash=password_hash,
            credits_remaining=starting_credits,
        )


def get_user_by_email(email: str) -> UserRecord | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, email, password_hash, credits_remaining
            FROM users
            WHERE email = ?
            """,
            (email.lower(),),
        ).fetchone()
        if row is None:
            return None
        return UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            credits_remaining=row["credits_remaining"],
        )


def get_user_by_id(user_id: int) -> UserRecord | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, email, password_hash, credits_remaining
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            credits_remaining=row["credits_remaining"],
        )


def consume_credits(user_id: int, amount: int) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be positive.")

    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT credits_remaining FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            raise ValueError("User not found.")

        current = int(row["credits_remaining"])
        if current < amount:
            raise ValueError("Insufficient credits.")

        new_balance = current - amount
        conn.execute(
            "UPDATE users SET credits_remaining = ? WHERE id = ?",
            (new_balance, user_id),
        )
        conn.commit()
        return new_balance
    finally:
        conn.close()


def add_credits(user_id: int, amount: int) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be positive.")

    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT credits_remaining FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            raise ValueError("User not found.")

        current = int(row["credits_remaining"])
        new_balance = current + amount
        conn.execute(
            "UPDATE users SET credits_remaining = ? WHERE id = ?",
            (new_balance, user_id),
        )
        conn.commit()
        return new_balance
    finally:
        conn.close()
