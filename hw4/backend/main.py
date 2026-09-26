"""Campus Customs backend: product catalogue, product images, customer accounts, and the chatbot.

Run from this folder, with auto-reload (see dev.py):
    C:\\venvs\\hw4\\Scripts\\python.exe dev.py
or without auto-reload:
    C:\\venvs\\hw4\\Scripts\\python.exe -m uvicorn main:app --port 8000
"""

import json
import logging
import re
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import phonenumbers
from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import shop
from catalogue_fixes import fix_catalogue
from agent import MAX_HISTORY_TURNS, run_chat
from models import (
    ChatDeps,
    ChatHistoryMessage,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    ChatTurn,
    CurrentProduct,
    PageContext,
    PageResults,
    ProductCard,
    ProductSearchFilters,
)
from tools import category_of, find_product_ids

log = logging.getLogger("campus_customs")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "campus_customs.db"
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]


def ensure_schema() -> None:
    """Add what accounts need on top of the original database (safe to run repeatedly)."""
    with get_db() as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "phone" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN phone TEXT")  # E.164, e.g. +12035551234
        if "phone_country" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN phone_country TEXT")  # ISO code, e.g. US
        conn.execute(
            """CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )"""
        )
        chat_columns = {row["name"] for row in conn.execute("PRAGMA table_info(chat_messages)")}
        if "page_product_id" not in chat_columns:
            # Product page the customer was on when they sent a message (Update 3, Rule 1).
            conn.execute("ALTER TABLE chat_messages ADD COLUMN page_product_id TEXT")
        # Returning customers' chat history is loaded by user, newest last.
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (user_id, id)")
        shop.ensure_tables(conn)  # favorites and cart_items
        fix_catalogue(conn)  # before split_colors, which then splits the corrected colors
        split_colors(conn)


def split_colors(conn: sqlite3.Connection) -> None:
    """catalogue.colors lists the garment's color first, then logo/graphic colors.
    Store them separately: primary_color (TEXT) and secondary_colors (JSON list).
    The original colors column is kept unchanged."""
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(catalogue)")}
    if "primary_color" not in columns:
        conn.execute("ALTER TABLE catalogue ADD COLUMN primary_color TEXT")  # e.g. "navy blue"
    if "secondary_colors" not in columns:
        conn.execute("ALTER TABLE catalogue ADD COLUMN secondary_colors TEXT")  # e.g. '["white"]'
    rows = conn.execute("SELECT product_id, colors FROM catalogue WHERE secondary_colors IS NULL").fetchall()
    for row in rows:
        colors = json.loads(row["colors"] or "[]")
        conn.execute(
            "UPDATE catalogue SET primary_color = ?, secondary_colors = ? WHERE product_id = ?",
            (colors[0] if colors else None, json.dumps(colors[1:]), row["product_id"]),
        )
    standardize_colors(conn)


# One name per color: the catalogue mixes "navy" and "navy blue" for the same color.
COLOR_NAMES = {"navy": "navy blue"}


def standardize_colors(conn: sqlite3.Connection) -> None:
    """Rename color variants (COLOR_NAMES) in colors, primary_color, and secondary_colors."""
    fix = lambda color: COLOR_NAMES.get(color, color)  # noqa: E731
    rows = conn.execute("SELECT product_id, colors, primary_color, secondary_colors FROM catalogue").fetchall()
    for row in rows:
        colors = [fix(c) for c in json.loads(row["colors"] or "[]")]
        secondary = [fix(c) for c in json.loads(row["secondary_colors"] or "[]")]
        primary = fix(row["primary_color"]) if row["primary_color"] else None
        if (json.dumps(colors), primary, json.dumps(secondary)) != (row["colors"], row["primary_color"], row["secondary_colors"]):
            conn.execute(
                "UPDATE catalogue SET colors = ?, primary_color = ?, secondary_colors = ? WHERE product_id = ?",
                (json.dumps(colors), primary, json.dumps(secondary), row["product_id"]),
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_schema()
    yield


app = FastAPI(title="Campus Customs API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Product photos: catalogue.image_file_path is relative to data/, so
# "products/foo.jpg" is served at /images/products/foo.jpg. Only the products/
# folder is mounted so the database file itself is never downloadable.
app.mount("/images/products", StaticFiles(directory=DATA_DIR / "products"), name="images")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def product_from_row(row: sqlite3.Row) -> dict:
    """Turn a catalogue row into JSON-friendly data (parses the JSON list columns)."""
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "primary_color": row["primary_color"],  # the garment's own color
        "secondary_colors": json.loads(row["secondary_colors"] or "[]"),  # logo / graphic colors
        "search_tags": json.loads(row["search_tags"]),
        "image_file_path": row["image_file_path"],
        "image_url": f"/images/{row['image_file_path']}",
        "price": row["price"],
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/products")
def list_products() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        stock = dict(
            conn.execute("SELECT product_id, SUM(quantity) FROM inventory GROUP BY product_id").fetchall()
        )
        in_stock_sizes: dict[str, list[str]] = {}
        for r in conn.execute("SELECT product_id, size FROM inventory WHERE quantity > 0"):
            in_stock_sizes.setdefault(r["product_id"], []).append(r["size"])
    return [
        {
            **product_from_row(r),
            "total_stock": stock.get(r["product_id"], 0),
            # Sizes with at least 1 unit, so the search bar can handle "in medium" / "size XL".
            "in_stock_sizes": sorted(in_stock_sizes.get(r["product_id"], []), key=SIZE_ORDER.index),
        }
        for r in rows
    ]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_db() as conn:
        product = load_product(conn, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def load_product(conn: sqlite3.Connection, product_id: str) -> dict | None:
    """One product with its stock per size, or None if the id doesn't exist."""
    row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
    if row is None:
        return None
    inventory = conn.execute("SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)).fetchall()
    sizes = sorted(
        ({"size": r["size"], "quantity": r["quantity"]} for r in inventory),
        key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER),
    )
    product = product_from_row(row)
    product["inventory"] = sizes
    product["total_stock"] = sum(s["quantity"] for s in sizes)
    return product


# --- Accounts -----------------------------------------------------------------

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_NAME = 50


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    phone: str | None = None
    phone_country: str | None = "US"


class LoginRequest(BaseModel):
    email: str
    password: str


def public_user(row: sqlite3.Row) -> dict:
    """User fields that are safe to send to the browser (never the password hash)."""
    return {
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "phone_country": row["phone_country"],
    }


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        token,
        max_age=auth.SESSION_DAYS * 24 * 60 * 60,
        httponly=True,  # page JavaScript can't read it
        samesite="lax",
        # secure=True once the site is served over HTTPS
    )


def normalize_phone(phone: str | None, country: str | None) -> tuple[str | None, str | None]:
    """Validate an optional phone number and return it in E.164 form with its country."""
    if not phone or not phone.strip():
        return None, None
    country = (country or "US").upper()
    try:
        parsed = phonenumbers.parse(phone, country)
    except phonenumbers.NumberParseException:
        raise HTTPException(422, "Please enter a valid phone number.")
    if not phonenumbers.is_valid_number(parsed):
        raise HTTPException(422, "That phone number doesn't look valid for the selected country.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164), country


# Hashing is intentionally slow, so these are plain `def` routes: FastAPI runs them
# in a worker thread instead of blocking the server.


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, response: Response) -> dict:
    first, last = body.first_name.strip(), body.last_name.strip()
    email = body.email.strip().lower()
    if not first or not last:
        raise HTTPException(422, "First and last name are required.")
    if len(first) > MAX_NAME or len(last) > MAX_NAME:
        raise HTTPException(422, f"Names must be {MAX_NAME} characters or fewer.")
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Please enter a valid email address.")
    if len(body.password) > auth.MAX_PASSWORD:
        raise HTTPException(422, f"Password must be {auth.MAX_PASSWORD} characters or fewer.")
    if problems := auth.password_problems(body.password):
        raise HTTPException(422, "Password needs " + ", ".join(problems) + ".")
    phone, phone_country = normalize_phone(body.phone, body.phone_country)

    with get_db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists. Try logging in.")
        cur = conn.execute(
            """INSERT INTO users (name, email, password_hash, first_name, last_name, phone, phone_country)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (f"{first} {last}", email, auth.hash_password(body.password), first, last, phone, phone_country),
        )
        token = auth.create_session(conn, cur.lastrowid)
        user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

    set_session_cookie(response, token)
    return {"user": public_user(user)}


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response) -> dict:
    email = body.email.strip().lower()
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
        if user is None:
            auth.verify_dummy(body.password)
            ok = False
        else:
            ok = auth.verify_password(body.password, user["password_hash"])
        if not ok:
            # Same message either way, so the form doesn't reveal which emails have accounts.
            raise HTTPException(401, "Incorrect email or password.")
        token = auth.create_session(conn, user["id"])

    set_session_cookie(response, token)
    return {"user": public_user(user)}


@app.post("/api/auth/logout")
def logout(response: Response, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        auth.delete_session(conn, cc_session)
    response.delete_cookie(auth.SESSION_COOKIE)
    return {"ok": True}


def current_user(conn: sqlite3.Connection, token: str | None) -> sqlite3.Row | None:
    """The user who owns this session cookie, or None for guests / expired sessions."""
    user_id = auth.session_user_id(conn, token)
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None


@app.get("/api/auth/me")
def me(cc_session: str | None = Cookie(default=None)) -> dict:
    """The logged-in user, or null. Lets the site stay logged in across page reloads."""
    with get_db() as conn:
        user = current_user(conn, cc_session)
    return {"user": public_user(user) if user else None}


# --- Chatbot ------------------------------------------------------------------
# Logged-in customers' conversations are saved in chat_messages, so the assistant
# remembers them across visits. Guests' conversations live only in the browser,
# which sends recent turns along with each message.

MAX_PRODUCTS_PER_REPLY = 8
CHAT_ERROR = "Sorry, I'm having trouble answering right now. Please try again in a moment."


def products_for_ids(
    conn: sqlite3.Connection, product_ids: list[str], limit: int | None = MAX_PRODUCTS_PER_REPLY
) -> list[ProductCard]:
    """Current catalogue records for the given ids (unknown ids are dropped, duplicates removed)."""
    products = []
    for pid in dict.fromkeys(product_ids):
        if (product := load_product(conn, pid)) is not None:
            products.append(ProductCard(**product, category=category_of(product["garment_type"])))
        if limit is not None and len(products) == limit:
            break
    return products


def stored_product_ids(products_json: str | None) -> list[str]:
    try:
        return [p["product_id"] for p in json.loads(products_json or "[]") if isinstance(p, dict) and "product_id" in p]
    except (json.JSONDecodeError, TypeError):
        return []


PAGE_NAMES = {
    "/": "the Home page",
    "/products": "the Products page",
    "/about": "the About Us page",
    "/login": "the Log in page",
    "/create-account": "the Create account page",
}
VALID_CATEGORIES = {"Hoodies", "Crewnecks", "T-Shirts", "Quarter-Zips", "Jackets & Fleece", "Long Sleeve"}
VALID_COLLECTIONS = {"colleges": "Residential Colleges", "sports": "Varsity Sports", "family": "The Yale Family", "schools": "Graduate Schools"}


def _quoted(text: str, limit: int = 60) -> str:
    """Browser-supplied text, trimmed and quoted so the agent treats it as data, not instructions."""
    clean = " ".join(re.sub(r"[^\w\s&'.,-]", " ", text).split())[:limit]
    return f'"{clean}"'


def describe_page(conn: sqlite3.Connection, page: PageContext | None) -> tuple[str | None, CurrentProduct | None]:
    """Turn the browser's page context into a description for the agent, trusting only what
    checks out against the database (a product page must be a real product)."""
    if page is None:
        return None, None

    if page.product_id and (product := load_product(conn, page.product_id)):
        current = CurrentProduct(
            product_id=product["product_id"],
            name=product["name"],
            category=category_of(product["garment_type"]),
            garment_type=product["garment_type"],
        )
        return f"the product page for {current.name}", current

    if page.path.startswith("/products") and page.chat_results_title:
        return f"the Products page, showing the chat results {_quoted(page.chat_results_title)}", None
    if page.path.startswith("/products"):
        filters = []
        if page.category in VALID_CATEGORIES:
            filters.append(f"category {page.category}")
        if page.collection in VALID_COLLECTIONS:
            filters.append(f"collection {VALID_COLLECTIONS[page.collection]}")
        if page.search:
            filters.append(f"search {_quoted(page.search)}")
        return "the Products page" + (f", filtered to {', '.join(filters)}" if filters else " (all products)"), None

    return PAGE_NAMES.get(page.path, "the Campus Customs website"), None


@app.post("/api/chat")
async def chat(body: ChatRequest, cc_session: str | None = Cookie(default=None)) -> ChatResponse:
    """Pass a customer's message to the agent and return its reply plus the products it mentions."""
    message = body.message.strip()
    if not message:
        raise HTTPException(422, "Please type a message.")

    with get_db() as conn:
        user = current_user(conn, cc_session)
        if user:
            rows = conn.execute(
                "SELECT role, content, page_product_id FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                (user["id"], MAX_HISTORY_TURNS),
            ).fetchall()
            history = [
                ChatTurn(role=r["role"], content=r["content"], viewing_product_id=r["page_product_id"])
                for r in reversed(rows)
            ]
        else:
            history = body.history
        # Product names for the pages customers were on, looked up in the catalogue (never
        # taken from the browser), so the agent sees "[Sent from the product page for …]".
        names = dict(conn.execute("SELECT product_id, name FROM catalogue").fetchall())
        for turn in history:
            turn.viewing_product_name = names.get(turn.viewing_product_id) if turn.role == "user" else None
        page, current_product = describe_page(conn, body.page)

    # Rule 1 (most recently mentioned product): did the customer open this product page since
    # their previous message? If their previous message came from the same page, whatever the
    # conversation named after it is more recent than the page.
    previous_user_turn = next((t for t in reversed(history) if t.role == "user"), None)
    page_just_opened = bool(current_product) and (
        previous_user_turn is None or previous_user_turn.viewing_product_id != current_product.product_id
    )

    deps = ChatDeps(
        user_id=user["id"] if user else None,
        first_name=user["first_name"] if user else None,
        last_name=user["last_name"] if user else None,
        email=user["email"] if user else None,
        page=page,
        current_product=current_product,
        page_just_opened=page_just_opened,
    )
    try:
        reply, tools_used = await run_chat(message, history, deps)
        cart_changed = bool(user) and "add_to_cart" in tools_used  # guests have no cart
    except Exception:
        log.exception("Chat agent failed")
        raise HTTPException(502, CHAT_ERROR)

    with get_db() as conn:
        products = products_for_ids(conn, reply.product_ids)
        page = None
        if reply.page_search:
            # The agent says which search to show; re-run it on the database (no result
            # limit) so the page lists every match with current prices and stock.
            filters = ProductSearchFilters(**reply.page_search.model_dump(exclude={"title"}))
            matches = products_for_ids(conn, find_product_ids(filters), limit=None)
            if matches:
                page = PageResults(title=reply.page_search.title, filters=filters, total=len(matches), products=matches)
        if user:
            conn.execute(
                "INSERT INTO chat_messages (user_id, role, content, products_json, page_product_id) "
                "VALUES (?, 'user', ?, NULL, ?)",
                (user["id"], message, current_product.product_id if current_product else None),
            )
            conn.execute(
                "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
                (user["id"], reply.reply, json.dumps([p.model_dump() for p in products])),
            )

    return ChatResponse(reply=reply.reply, products=products, page=page, tools_used=tools_used, cart_changed=cart_changed)


@app.get("/api/chat/history")
def chat_history(cc_session: str | None = Cookie(default=None)) -> ChatHistoryResponse:
    """The logged-in customer's saved conversation (empty for guests), with up-to-date product info."""
    with get_db() as conn:
        user = current_user(conn, cc_session)
        if not user:
            return ChatHistoryResponse()
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages WHERE user_id = ? ORDER BY id",
            (user["id"],),
        ).fetchall()
        messages = [
            ChatHistoryMessage(
                role=r["role"],
                content=r["content"],
                products=products_for_ids(conn, stored_product_ids(r["products_json"])),
                created_at=r["created_at"],
            )
            for r in rows
        ]
    return ChatHistoryResponse(messages=messages)


# --- Favorites and cart (logged-in customers; saved to their account) ----------

class CartAdd(BaseModel):
    product_id: str
    size: str
    quantity: int = 1


class CartQuantity(BaseModel):
    quantity: int


def require_user(conn: sqlite3.Connection, token: str | None) -> sqlite3.Row:
    user = current_user(conn, token)
    if not user:
        raise HTTPException(401, "Please log in to use favorites and the cart.")
    return user


@app.get("/api/favorites")
def get_favorites(cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        ids = shop.favorite_ids(conn, user["id"])
        return {"product_ids": ids, "products": products_for_ids(conn, ids, limit=None)}


@app.post("/api/favorites/{product_id}")
def add_favorite(product_id: str, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        try:
            shop.add_favorite(conn, user["id"], product_id)
        except shop.CartError as exc:
            raise HTTPException(404, str(exc))
        return {"product_ids": shop.favorite_ids(conn, user["id"])}


@app.delete("/api/favorites/{product_id}")
def remove_favorite(product_id: str, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        shop.remove_favorite(conn, user["id"], product_id)
        return {"product_ids": shop.favorite_ids(conn, user["id"])}


@app.get("/api/cart")
def get_cart(cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        return shop.cart_summary(conn, user["id"])


@app.post("/api/cart")
def add_to_cart(body: CartAdd, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        try:
            return shop.add_to_cart(conn, user["id"], body.product_id, body.size.upper(), body.quantity)
        except shop.CartError as exc:
            raise HTTPException(422, str(exc))


@app.patch("/api/cart/{product_id}/{size}")
def update_cart(product_id: str, size: str, body: CartQuantity, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        try:
            return shop.set_cart_quantity(conn, user["id"], product_id, size.upper(), body.quantity)
        except shop.CartError as exc:
            raise HTTPException(422, str(exc))


@app.delete("/api/cart/{product_id}/{size}")
def remove_from_cart(product_id: str, size: str, cc_session: str | None = Cookie(default=None)) -> dict:
    with get_db() as conn:
        user = require_user(conn, cc_session)
        return shop.set_cart_quantity(conn, user["id"], product_id, size.upper(), 0)
