"""Password hashing and login sessions for Campus Customs.

Passwords are hashed with PBKDF2-HMAC-SHA256: a deliberately slow, standard
key-derivation function. Each password gets its own random 16-byte salt, so two
users with the same password still get different hashes. The stored format is

    pbkdf2_sha256$<iterations>$<salt>$<hex digest>

Keeping the iteration count in the string means it can be raised later
without breaking existing accounts.

The accounts that shipped with the database use an older format with no
iteration count, pbkdf2_sha256$<salt>$<hex digest>, hashed with 120,000
iterations; verify_password accepts both.
"""

import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000  # OWASP's recommended minimum for PBKDF2-HMAC-SHA256
LEGACY_ITERATIONS = 120_000  # used by the original seeded accounts
SALT_BYTES = 16

SESSION_COOKIE = "cc_session"
SESSION_DAYS = 7


def _derive(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_BYTES)
    return f"{ALGORITHM}${PBKDF2_ITERATIONS}${salt}${_derive(password, salt, PBKDF2_ITERATIONS)}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if parts[0] != ALGORITHM:
        return False
    if len(parts) == 4 and parts[1].isdigit():
        _, iterations, salt, expected = parts
    elif len(parts) == 3:
        _, salt, expected = parts
        iterations = LEGACY_ITERATIONS
    else:
        return False
    # compare_digest takes the same time whether the first or last character differs.
    return hmac.compare_digest(_derive(password, salt, int(iterations)), expected)


# --- Password rules (checked when creating an account, not at login) ----------

MIN_PASSWORD, MAX_PASSWORD = 8, 128


def password_problems(password: str) -> list[str]:
    """What a new password is missing; an empty list means it's acceptable."""
    problems = []
    if len(password) < MIN_PASSWORD:
        problems.append(f"at least {MIN_PASSWORD} characters")
    if not any(ch.isupper() for ch in password):
        problems.append("a capital letter")
    if not any(not ch.isalnum() and not ch.isspace() for ch in password):
        problems.append("a special character (like ! @ # $ %)")
    return problems


# Checked against when an email is not found, so a login attempt takes the same
# time whether or not the account exists (prevents probing for valid emails).
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def verify_dummy(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


# --- Sessions -----------------------------------------------------------------
# The browser holds a random token in an HttpOnly cookie; the database stores only
# its SHA-256, so a leaked database can't be used to hijack sessions.


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now.isoformat(),))
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (_token_hash(token), user_id, now.isoformat(), (now + timedelta(days=SESSION_DAYS)).isoformat()),
    )
    return token


def session_user_id(conn: sqlite3.Connection, token: str | None) -> int | None:
    if not token:
        return None
    row = conn.execute(
        "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
        (_token_hash(token), _now().isoformat()),
    ).fetchone()
    return row[0] if row else None


def delete_session(conn: sqlite3.Connection, token: str | None) -> None:
    if token:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
