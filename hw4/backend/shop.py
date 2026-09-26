"""Favorites and shopping cart for logged-in customers, saved in campus_customs.db.

favorites   (user_id, product_id, created_at)                one row per starred product
cart_items  (user_id, product_id, size, quantity, added_at)   one row per product + size

Used by the website's /api/favorites and /api/cart endpoints (main.py) and by the chatbot's
cart tools (agent.py), so both always see the same cart.
"""

from __future__ import annotations

import sqlite3

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
MAX_PER_LINE = 10  # most units of one product + size in a cart


class CartError(ValueError):
    """A cart change that isn't allowed (unknown product, sold-out size, too many units)."""


def ensure_tables(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS favorites (
            user_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, product_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES catalogue(product_id)
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS cart_items (
            user_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            size TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            added_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, product_id, size),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES catalogue(product_id)
        )"""
    )


# --- Favorites ------------------------------------------------------------------


def favorite_ids(conn: sqlite3.Connection, user_id: int) -> list[str]:
    rows = conn.execute("SELECT product_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    return [r[0] for r in rows]


def add_favorite(conn: sqlite3.Connection, user_id: int, product_id: str) -> None:
    if not conn.execute("SELECT 1 FROM catalogue WHERE product_id = ?", (product_id,)).fetchone():
        raise CartError("That product doesn't exist.")
    conn.execute("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)", (user_id, product_id))


def remove_favorite(conn: sqlite3.Connection, user_id: int, product_id: str) -> None:
    conn.execute("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", (user_id, product_id))


# --- Cart -----------------------------------------------------------------------


def stock_in_size(conn: sqlite3.Connection, product_id: str, size: str) -> int | None:
    """Units in stock for that size, or None if the product doesn't exist."""
    if not conn.execute("SELECT 1 FROM catalogue WHERE product_id = ?", (product_id,)).fetchone():
        return None
    row = conn.execute("SELECT quantity FROM inventory WHERE product_id = ? AND size = ?", (product_id, size)).fetchone()
    return row[0] if row else 0


def cart_lines(conn: sqlite3.Connection, user_id: int) -> list[dict]:
    """The customer's cart with current names, prices, and stock."""
    rows = conn.execute(
        """SELECT c.product_id, c.size, c.quantity, k.name, k.price, k.image_file_path, k.primary_color,
                  COALESCE(i.quantity, 0) AS in_stock
           FROM cart_items c
           JOIN catalogue k ON k.product_id = c.product_id
           LEFT JOIN inventory i ON i.product_id = c.product_id AND i.size = c.size
           WHERE c.user_id = ?
           ORDER BY c.added_at, c.product_id""",
        (user_id,),
    ).fetchall()
    return [
        {
            "product_id": r[0],
            "size": r[1],
            "quantity": r[2],
            "name": r[3],
            "price": r[4],
            "image_url": f"/images/{r[5]}",
            "primary_color": r[6],
            "in_stock": r[7],
            "line_total": round(r[4] * r[2], 2),
        }
        for r in rows
    ]


def cart_summary(conn: sqlite3.Connection, user_id: int) -> dict:
    lines = cart_lines(conn, user_id)
    return {
        "items": lines,
        "item_count": sum(line["quantity"] for line in lines),
        "subtotal": round(sum(line["line_total"] for line in lines), 2),
    }


def add_to_cart(conn: sqlite3.Connection, user_id: int, product_id: str, size: str, quantity: int = 1) -> dict:
    """Add units of one product in one size. Refuses sold-out sizes and more than is in stock."""
    if size not in SIZE_ORDER:
        raise CartError(f"{size!r} isn't a store size. Sizes are XS, S, M, L, XL, and XXL.")
    if quantity < 1:
        raise CartError("Quantity must be at least 1.")
    stock = stock_in_size(conn, product_id, size)
    if stock is None:
        raise CartError("That product doesn't exist.")
    if stock == 0:
        raise CartError(f"Size {size} is sold out.")
    row = conn.execute(
        "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?", (user_id, product_id, size)
    ).fetchone()
    new_quantity = (row[0] if row else 0) + quantity
    limit = min(stock, MAX_PER_LINE)
    if new_quantity > limit:
        already = row[0] if row else 0
        raise CartError(
            f"Only {stock} left in size {size}" + (f" and {already} already in the cart" if already else "")
            + f", so at most {max(0, limit - already)} more can be added."
        )
    conn.execute(
        """INSERT INTO cart_items (user_id, product_id, size, quantity) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, product_id, size) DO UPDATE SET quantity = excluded.quantity""",
        (user_id, product_id, size, new_quantity),
    )
    return cart_summary(conn, user_id)


def set_cart_quantity(conn: sqlite3.Connection, user_id: int, product_id: str, size: str, quantity: int) -> dict:
    """Change a line's quantity (0 removes it)."""
    if quantity <= 0:
        conn.execute("DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?", (user_id, product_id, size))
        return cart_summary(conn, user_id)
    stock = stock_in_size(conn, product_id, size) or 0
    if quantity > min(stock, MAX_PER_LINE):
        raise CartError(f"Only {stock} left in size {size}.")
    conn.execute(
        "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ? AND size = ?",
        (quantity, user_id, product_id, size),
    )
    return cart_summary(conn, user_id)
