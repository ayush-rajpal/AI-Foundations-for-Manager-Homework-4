"""Tools the Campus Customs agent can call. All are read-only lookups on data/campus_customs.db.

search_products       keyword search over the catalogue, with optional category / color /
                      price / in-stock-size filters
get_product_details   full details (description, price, colors) and exact stock per size
                      for one product
check_stock           is one product available in one size? quantity, status, and the
                      other sizes still in stock
find_alternatives     the closest in-stock products when something isn't available
                      (wrong color, sold-out size, nothing matches, over budget)
add_to_cart           put a product in a size into the logged-in customer's cart (shop.py)
view_cart             what's in the logged-in customer's cart

find_product_ids (not a tool) re-runs a search without the tool's 20-result limit, so the
website can show every match on the page.

The database is the only source of truth: descriptions, prices, and stock are read
at call time, so the agent never has to remember (or guess) them.
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

from pydantic_ai import ModelRetry, RunContext

import shop

from models import (
    LOW_STOCK,
    Alternative,
    AlternativesResult,
    CartLine,
    CartUpdate,
    ChatDeps,
    Category,
    ProductDetails,
    ProductSearchFilters,
    ProductSearchResult,
    ProductSummary,
    Size,
    SizeStock,
    SortBy,
    StockCheck,
)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs.db"
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
DEFAULT_LIMIT, MAX_LIMIT = 8, 20


# --- Catalogue loading ------------------------------------------------------------


def category_of(garment_type: str) -> str:
    """Group the catalogue's ~22 garment_type spellings into 6 categories (same as the website)."""
    t = garment_type.lower()
    if "quarter-zip" in t:
        return "Quarter-Zips"
    if "hood" in t:  # before full-zip: "full-zip hooded sweatshirt" is a hoodie
        return "Hoodies"
    if "jacket" in t or "full-zip" in t:
        return "Jackets & Fleece"
    if "t-shirt" in t:
        return "T-Shirts"
    if "long-sleeve" in t:
        return "Long Sleeve"
    return "Crewnecks"


def _load_catalogue() -> list[dict]:
    """Every product with its stock, read fresh so answers reflect the current database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        products = [dict(r) for r in conn.execute("SELECT * FROM catalogue ORDER BY name")]
        stock: dict[str, list[tuple[str, int]]] = {}
        for r in conn.execute("SELECT product_id, size, quantity FROM inventory"):
            stock.setdefault(r["product_id"], []).append((r["size"], r["quantity"]))
    finally:
        conn.close()

    for p in products:
        p["colors"] = json.loads(p["colors"])
        p["secondary_colors"] = json.loads(p["secondary_colors"] or "[]")
        p["search_tags"] = json.loads(p["search_tags"])
        p["category"] = category_of(p["garment_type"])
        sizes = sorted(stock.get(p["product_id"], []), key=lambda s: SIZE_ORDER.index(s[0]) if s[0] in SIZE_ORDER else 99)
        p["inventory"] = [{"size": s, "quantity": q} for s, q in sizes]
    return products


def _summary(p: dict) -> ProductSummary:
    return ProductSummary(
        product_id=p["product_id"],
        name=p["name"],
        category=p["category"],
        garment_type=p["garment_type"],
        price=p["price"],
        primary_color=p["primary_color"],
        secondary_colors=p["secondary_colors"],
        description=p["description"],
        in_stock_sizes=[s["size"] for s in p["inventory"] if s["quantity"] > 0],
        low_stock_sizes=[s["size"] for s in p["inventory"] if 0 < s["quantity"] <= LOW_STOCK],
        sold_out_sizes=[s["size"] for s in p["inventory"] if s["quantity"] == 0],
    )


# --- Keyword matching ---------------------------------------------------------------

# Rewrites applied to both the query and product text so different phrasings meet.
_PHRASES = [
    (r"handsome\s+dan", "bulldog"),  # Yale's bulldog mascot
    (r"\b(quarter|1[\s/-]?4)[\s-]*zips?\b", "quarterzip"),
    (r"\bt[\s-]?shirts?\b|\btees?\b", "tshirt"),
    (r"\bhoodies?\b|\bhooded\b|\bhoods?\b", "hoodie"),
    (r"\bcrew[\s-]?necks?\b|\bcrews\b", "crewneck"),
    (r"\bshort[\s-]?sleeved?\b", "shortsleeve"),  # so "shorts" doesn't match short-sleeve tees
    (r"\bgrey\b", "gray"),
]
_STOPWORDS = {
    "a", "an", "and", "any", "anything", "are", "do", "for", "have", "i", "in", "is", "it", "me",
    "of", "on", "or", "show", "some", "something", "the", "to", "with", "you", "your", "got",
    "want", "looking", "need", "item", "items", "yale", "campus", "customs",
}


def _normalize(text: str) -> str:
    text = text.lower()
    for pattern, replacement in _PHRASES:
        text = re.sub(pattern, replacement, text)
    return text


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", _normalize(text))
    # Light stemming: "bulldogs" -> "bulldog", "fleeces" -> "fleece".
    return {w[:-1] if len(w) > 3 and w.endswith("s") else w for w in words}


def _score(query_tokens: set[str], p: dict) -> tuple[int, int]:
    """(distinct query words matched, weighted score); name and tags count more than description."""
    fields = [
        (_tokens(p["name"]), 3),
        (_tokens(" ".join(p["search_tags"])), 2),
        (_tokens(p["primary_color"] or ""), 2),  # garment color counts more than logo colors
        (_tokens(" ".join(p["secondary_colors"])), 1),
        (_tokens(p["garment_type"] + " " + p["category"]), 2),
        (_tokens(p["description"]), 1),
    ]
    matched, score = 0, 0
    for word in query_tokens:
        hits = [weight for tokens, weight in fields if word in tokens]
        if hits:
            matched += 1
            score += sum(hits)
    return matched, score


# --- Tools --------------------------------------------------------------------------


def search_products(
    query: str = "",
    category: Category | None = None,
    color: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock_size: Size | None = None,
    sort_by: SortBy = "relevance",
    limit: int = DEFAULT_LIMIT,
) -> ProductSearchResult:
    """Search the Campus Customs catalogue.

    Args:
        query: Keywords to match against product names, tags, colors, and descriptions,
            e.g. "bulldog", "saybrook", "baseball", "navy hoodie". Leave empty to browse
            by filters alone.
        category: Only products in this category.
        color: Only products whose garment (primary) color matches, e.g. "navy", "gray", "white".
            Logo and graphic colors don't count.
        min_price: Lowest price in dollars.
        max_price: Highest price in dollars.
        in_stock_size: Only products that currently have this size in stock.
        sort_by: "relevance" (best keyword match first), or sort by price for questions like
            "what's your cheapest..." / "most expensive...".
        limit: Maximum number of products to return (1-20).
    """
    limit = max(1, min(limit, MAX_LIMIT))
    matches, notes = _find(query, category, color, min_price, max_price, in_stock_size, sort_by)
    top = [_summary(p) for p in matches[:limit]]
    if not matches:
        notes.append("No products matched. Try fewer or different keywords, or loosen the filters.")
    elif len(matches) > limit:
        notes.append(f"Showing {limit} of {len(matches)} matches; narrow the search or raise the limit to see more.")
    return ProductSearchResult(total_matches=len(matches), returned=len(top), note=" ".join(notes), products=top)


def find_product_ids(filters: ProductSearchFilters) -> list[str]:
    """Every product matching the filters, in ranked order (no limit). Used to fill the
    website's page with the agent's search results."""
    matches, _ = _find(**filters.model_dump(include=set(ProductSearchFilters.model_fields)))
    return [p["product_id"] for p in matches]


def _find(
    query: str = "",
    category: str | None = None,
    color: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock_size: str | None = None,
    sort_by: SortBy = "relevance",
) -> tuple[list[dict], list[str]]:
    """The search itself: all matching products, ranked, plus any notes for the model."""
    query_tokens = _tokens(query) - _STOPWORDS
    color_needle = _normalize(color).strip() if color else None

    candidates = []
    for p in _load_catalogue():
        if category and p["category"] != category:
            continue
        if min_price is not None and p["price"] < min_price:
            continue
        if max_price is not None and p["price"] > max_price:
            continue
        # A color filter means the garment's color, not its logo ("navy hoodies", not gray ones with navy text).
        if color_needle and color_needle not in _normalize(p["primary_color"] or ""):
            continue
        if in_stock_size and not any(s["size"] == in_stock_size and s["quantity"] > 0 for s in p["inventory"]):
            continue
        rank = _score(query_tokens, p) if query_tokens else (0, 0)
        if query_tokens and rank[0] == 0:
            continue
        candidates.append((rank, p))

    notes = []
    if query_tokens and candidates:
        # Keep only the products that match the most query words, so "navy hoodie"
        # returns navy hoodies rather than everything navy plus every hoodie.
        best = max(rank[0] for rank, _ in candidates)
        candidates = [c for c in candidates if c[0][0] == best]
        candidates.sort(key=lambda c: (-c[0][1], c[1]["price"], c[1]["name"]))
        if best < len(query_tokens):
            notes.append(
                f"No product matched all of the keywords ({', '.join(sorted(query_tokens))}); each result "
                f"matches only {best} of them, so they may not be what the customer asked for."
            )
    else:
        candidates.sort(key=lambda c: (c[1]["price"], c[1]["name"]))

    if sort_by != "relevance":
        candidates.sort(key=lambda c: c[1]["price"], reverse=sort_by == "price_high_to_low")

    return [p for _, p in candidates], notes


def _find_product(product_id: str) -> dict:
    for p in _load_catalogue():
        if p["product_id"] == product_id:
            return p
    raise ModelRetry(f"No product has product_id {product_id!r}. Use search_products to find the right id.")


def get_product_details(product_id: str) -> ProductDetails:
    """Get everything about one product from the database: description, price, colors,
    and the exact quantity in stock for every size (status in_stock / low_stock / out_of_stock).

    Use this before answering questions about a specific product's description, price,
    colors, or overall size availability.

    Args:
        product_id: The product_id from search_products, e.g. "basic-hoodie-big-yale".
    """
    p = _find_product(product_id)
    return ProductDetails(
        **_summary(p).model_dump(),
        search_tags=p["search_tags"],
        inventory=[SizeStock(**s) for s in p["inventory"]],
        total_stock=sum(s["quantity"] for s in p["inventory"]),
    )


# How customers name sizes -> the inventory table's size codes.
_SIZE_ALIASES = {
    "xs": "XS", "xsmall": "XS", "extrasmall": "XS",
    "s": "S", "sm": "S", "small": "S",
    "m": "M", "med": "M", "medium": "M",
    "l": "L", "lg": "L", "large": "L",
    "xl": "XL", "xlarge": "XL", "extralarge": "XL",
    "xxl": "XXL", "2xl": "XXL", "xxlarge": "XXL", "2xlarge": "XXL", "extraextralarge": "XXL",
}


def normalize_size(size: str) -> str | None:
    """'medium' -> 'M', '2XL' -> 'XXL', 'extra large' -> 'XL'; None if it isn't a store size."""
    return _SIZE_ALIASES.get(re.sub(r"[^a-z0-9]", "", size.lower()))


def check_stock(product_id: str, size: str) -> StockCheck:
    """Check whether one product is available in one size, straight from the inventory table.

    Use this whenever a customer asks if a size is available or in stock. The result says
    clearly whether that size is in stock, low (5 or fewer left), or sold out, and lists the
    other sizes that are still in stock.

    Args:
        product_id: The product_id from search_products, e.g. "saybrook-college-crewneck".
        size: The size the customer asked about: XS, S, M, L, XL, or XXL
            (words like "medium" or "2XL" are fine).
    """
    code = normalize_size(size)
    if code is None:
        raise ModelRetry(f"{size!r} isn't a store size. Sizes are XS, S, M, L, XL, and XXL.")
    p = _find_product(product_id)
    sizes = [SizeStock(**s) for s in p["inventory"]]
    row = next((s for s in sizes if s.size == code), SizeStock(size=code, quantity=0))
    others = [s.size for s in sizes if s.quantity > 0 and s.size != code]

    if row.status == "out_of_stock":
        message = f"Size {code} is sold out (0 in stock)."
        message += f" Sizes still in stock: {', '.join(others)}." if others else " Every size is sold out."
    elif row.status == "low_stock":
        message = f"Size {code} is in stock, but only {row.quantity} left."
    else:
        message = f"Size {code} is in stock ({row.quantity} available)."

    return StockCheck(
        product_id=p["product_id"],
        name=p["name"],
        price=p["price"],
        requested_size=size,
        size=code,
        available=row.quantity > 0,
        quantity=row.quantity,
        status=row.status,
        message=message,
        other_sizes_in_stock=others,
        all_sizes=sizes,
    )


def find_alternatives(
    product_id: str | None = None,
    query: str = "",
    category: Category | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    limit: int = 4,
) -> AlternativesResult:
    """Find the closest in-stock alternatives when what the customer wants isn't available.

    Use it whenever the answer would otherwise be "no": the product doesn't come in that
    color, the size is sold out, nothing matches the search, or nothing fits the budget.
    Describe what the customer wanted; the tool starts with products that match all of it
    and, if there aren't enough, loosens one requirement at a time (keywords, color, budget,
    then the product type, first to a similar type, e.g. hoodie -> crewneck, then size),
    so alternatives stay in the same or a similar category. It prefers the same type, a
    similar design, the nearest color, and the closest price. Each alternative says why it
    was picked and what differs from the request.

    Args:
        product_id: The product the customer asked about, if any (alternatives will be
            similar to it: same type, similar design and price). It is never suggested itself.
        query: Keywords for what they want, e.g. "bulldog", "saybrook", "shorts".
        category: The type of item they want.
        color: The garment color they want, e.g. "black".
        size: The size they need, e.g. "M" or "medium".
        max_price: Their budget in dollars.
        limit: How many alternatives to return (1-8).
    """
    limit = max(1, min(limit, 8))
    catalogue = _load_catalogue()
    base = next((p for p in catalogue if p["product_id"] == product_id), None) if product_id else None
    if product_id and base is None:
        raise ModelRetry(f"No product has product_id {product_id!r}. Use search_products to find the right id.")
    size_code = normalize_size(size) if size else None
    if size and size_code is None:
        raise ModelRetry(f"{size!r} isn't a store size. Sizes are XS, S, M, L, XL, and XXL.")

    want_category = category or (base["category"] if base else None)
    color_needle = _normalize(color).strip() if color else None
    query_tokens = _tokens(query) - _STOPWORDS
    base_tokens = (_tokens(base["name"]) - _STOPWORDS - _GENERIC_NAME_WORDS) if base else set()

    related_categories = {want_category, *_RELATED_CATEGORIES.get(want_category or "", [])}
    checks = {
        "keywords": lambda p: not query_tokens or _score(query_tokens, p)[0] == len(query_tokens),
        "color": lambda p: not color_needle or color_needle in _normalize(p["primary_color"] or ""),
        "budget": lambda p: max_price is None or p["price"] <= max_price,
        "type": lambda p: not want_category or p["category"] == want_category,
        "size": lambda p: not size_code or any(s["size"] == size_code and s["quantity"] > 0 for s in p["inventory"]),
        "related": lambda p: not want_category or p["category"] in related_categories,
    }
    in_stock = lambda p: any(s["quantity"] > 0 for s in p["inventory"])  # noqa: E731
    # The order requirements are loosened in, least important first. The product type goes
    # last: first to a related type (hoodie -> crewneck or quarter-zip), and only at the very
    # end to any type, so alternatives stay in the same or a similar category.
    asked = [k for k, used in [("keywords", query_tokens), ("color", color_needle), ("budget", max_price is not None),
                              ("type", want_category), ("size", size_code), ("related", want_category)] if used]

    # Strictest first; each later tier drops one more requirement.
    tiers: list[list[str]] = [[]]
    for requirement in asked:
        tiers.append(tiers[-1] + [requirement])

    def category_closeness(p: dict) -> int:
        if not want_category or p["category"] == want_category:
            return 0
        return 1 if p["category"] in related_categories else 2

    def color_closeness(p: dict) -> int:
        if not color_needle:
            return 0
        garment = _normalize(p["primary_color"] or "")
        if color_needle in garment:
            return 0
        near = _NEAR_COLORS.get(color_needle, [])
        return next((i + 1 for i, n in enumerate(near) if n in garment), len(near) + 1)

    def rank(p: dict) -> tuple:
        shared = len(base_tokens & _tokens(p["name"]))
        keyword = _score(query_tokens, p)[1] if query_tokens else 0
        over_budget = max(0.0, p["price"] - max_price) if max_price is not None else 0.0
        price_gap = abs(p["price"] - base["price"]) if base else 0.0
        stock = sum(s["quantity"] for s in p["inventory"])
        return (category_closeness(p), -shared, color_closeness(p), -keyword, over_budget, price_gap, -stock, p["name"])

    picked: list[tuple[dict, list[str]]] = []
    for dropped in tiers:
        keep = [checks[k] for k in asked if k not in dropped]
        seen = {p["product_id"] for p, _ in picked}
        candidates = [
            p for p in catalogue
            if in_stock(p) and all(c(p) for c in keep)
            and p["product_id"] not in seen and (not base or p["product_id"] != base["product_id"])
        ]
        for p in sorted(candidates, key=rank)[: limit - len(picked)]:
            picked.append((p, [k for k in asked if k != "related" and not checks[k](p)]))
        if len(picked) >= limit:
            break

    label = {
        "keywords": f"keywords '{query}'",
        "color": f"color {color}",
        "type": f"type {want_category}",
        "size": f"size {size_code}",
        "budget": f"budget ${max_price:.0f}" if max_price is not None else "budget",
    }

    def why(p: dict, misses: list[str]) -> str:
        parts = [p["garment_type"] + (f" in {p['primary_color']}" if p["primary_color"] else "")]
        if size_code and "size" not in misses:
            parts.append(f"size {size_code} in stock")
        if base and base_tokens & _tokens(p["name"]):
            parts.append("similar design")
        if base:
            gap = p["price"] - base["price"]
            parts.append("same price" if gap == 0 else f"${abs(gap):.0f} {'less' if gap < 0 else 'more'}")
        if misses:
            parts.append("differs: " + ", ".join(label[m] for m in misses))
        return "; ".join(parts)

    exact = bool(picked) and not picked[0][1]
    relaxed = sorted({m for _, misses in picked for m in misses}, key=asked.index)
    wanted = " ".join(
        x for x in [color, f"size {size_code}" if size_code else None, query or None,
                    want_category.lower() if want_category else None,
                    f"under ${max_price:.0f}" if max_price is not None else None] if x
    ) or "similar items"
    if base:
        wanted += f" (like {base['name']})"
    if not picked:
        note = "Nothing else is in stock."
    elif exact and not relaxed:
        note = "These match everything the customer asked for."
    elif exact:
        note = "The first ones match everything asked for; the rest differ as noted in 'why'."
    else:
        note = "Nothing in stock matches all of it; each alternative's 'why' says what differs."
    return AlternativesResult(
        wanted=wanted,
        exact_match_available=exact,
        relaxed=[label[r] for r in relaxed],
        note=note,
        alternatives=[Alternative(**_summary(p).model_dump(), why=why(p, misses)) for p, misses in picked],
    )


# Words too common in product names to signal a "similar design".
_GENERIC_NAME_WORDS = {"hoodie", "crewneck", "tshirt", "quarterzip", "t", "shirt", "left", "chest", "tri", "blend",
                       "jacket", "fleece", "sweater", "college", "logo", "sport", "yale", "crew", "zip", "1", "4"}

# Similar kinds of garment, used before falling back to any type (closest first).
_RELATED_CATEGORIES = {
    "Hoodies": ["Crewnecks", "Quarter-Zips", "Jackets & Fleece"],
    "Crewnecks": ["Hoodies", "Quarter-Zips"],
    "Quarter-Zips": ["Crewnecks", "Jackets & Fleece", "Hoodies"],
    "Jackets & Fleece": ["Quarter-Zips", "Hoodies"],
    "T-Shirts": ["Long Sleeve"],
    "Long Sleeve": ["T-Shirts", "Crewnecks"],
}

# When a color isn't available, the nearest garment colors to offer instead (best first).
_NEAR_COLORS = {
    "black": ["charcoal", "dark heather", "navy"],
    "gray": ["heather gray", "charcoal", "light gray"],
    "blue": ["navy"],
    "light blue": ["navy", "light gray"],
    "red": ["dusty coral"],
    "pink": ["dusty coral"],
    "orange": ["dusty coral"],
    "white": ["ivory", "cream", "light gray"],
    "cream": ["ivory", "white"],
    "beige": ["cream", "ivory"],
    "brown": ["cream", "charcoal"],
    "purple": ["navy"],
    "green": ["heather gray"],
    "yellow": ["cream"],
}


def sold_out_in_size(product_ids: list[str], size: str) -> list[str]:
    """Names of the given products that have 0 in stock in `size` (used to validate the agent's reply)."""
    code = normalize_size(size)
    if not code:
        return []
    by_id = {p["product_id"]: p for p in _load_catalogue()}
    return [
        by_id[pid]["name"]
        for pid in product_ids
        if pid in by_id and not any(s["size"] == code and s["quantity"] > 0 for s in by_id[pid]["inventory"])
    ]


def sold_out_everywhere(product_ids: list[str]) -> list[str]:
    """Names of the given products with 0 units in every size (used to validate the agent's reply)."""
    by_id = {p["product_id"]: p for p in _load_catalogue()}
    return [by_id[pid]["name"] for pid in product_ids if pid in by_id and not any(s["quantity"] > 0 for s in by_id[pid]["inventory"])]


def all_product_ids() -> set[str]:
    """Every product_id in the catalogue (used to validate the agent's reply)."""
    conn = sqlite3.connect(DB_PATH)
    try:
        return {row[0] for row in conn.execute("SELECT product_id FROM catalogue")}
    finally:
        conn.close()


# --- Cart tools (the only tools that change data; logged-in customers only) ------------


def _cart_update(summary: dict, ok: bool, message: str) -> CartUpdate:
    return CartUpdate(
        ok=ok,
        message=message,
        item_count=summary["item_count"],
        subtotal=summary["subtotal"],
        items=[CartLine(**{k: line[k] for k in CartLine.model_fields}) for line in summary["items"]],
    )


def add_to_cart(ctx: RunContext[ChatDeps], product_id: str, size: str, quantity: int = 1) -> CartUpdate:
    """Add a product in one size to the customer's shopping cart.

    Only use this when the customer asks to add something to their cart and you know the
    product and the size (ask for the size if they haven't said it; never guess). The cart
    is saved to their account and shown on the website's Cart page.

    Args:
        product_id: The product_id from search_products / get_product_details.
        size: XS, S, M, L, XL, or XXL (words like "medium" are fine).
        quantity: How many to add (default 1).
    """
    if not ctx.deps.user_id:
        return CartUpdate(ok=False, needs_login=True, message="The customer isn't logged in; they need to log in (or create an account) to use the cart.")
    code = normalize_size(size)
    if code is None:
        raise ModelRetry(f"{size!r} isn't a store size. Sizes are XS, S, M, L, XL, and XXL.")
    conn = sqlite3.connect(DB_PATH)
    try:
        name_row = conn.execute("SELECT name FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if not name_row:
            raise ModelRetry(f"No product has product_id {product_id!r}. Use search_products to find the right id.")
        try:
            summary = shop.add_to_cart(conn, ctx.deps.user_id, product_id, code, quantity)
        except shop.CartError as exc:
            conn.rollback()
            result = _cart_update(shop.cart_summary(conn, ctx.deps.user_id), False, f"Not added: {exc}")
            result.sold_out = "sold out" in str(exc)
            return result
        conn.commit()
        return _cart_update(summary, True, f"Added {quantity} x {name_row[0]} (size {code}) to the cart.")
    finally:
        conn.close()


def view_cart(ctx: RunContext[ChatDeps]) -> CartUpdate:
    """Show what's in the customer's shopping cart (items, sizes, quantities, prices, subtotal)."""
    if not ctx.deps.user_id:
        return CartUpdate(ok=False, needs_login=True, message="The customer isn't logged in; they need to log in to use the cart.")
    conn = sqlite3.connect(DB_PATH)
    try:
        summary = shop.cart_summary(conn, ctx.deps.user_id)
    finally:
        conn.close()
    return _cart_update(summary, True, "The cart is empty." if not summary["items"] else f"{summary['item_count']} item(s) in the cart.")
