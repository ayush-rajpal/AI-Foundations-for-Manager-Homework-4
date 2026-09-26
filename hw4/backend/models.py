"""Structured types shared by the Campus Customs agent, its tools, and the chat API."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field, computed_field, field_validator

Category = Literal["Hoodies", "Crewnecks", "T-Shirts", "Quarter-Zips", "Jackets & Fleece", "Long Sleeve"]
Size = Literal["XS", "S", "M", "L", "XL", "XXL"]
StockStatus = Literal["in_stock", "low_stock", "out_of_stock"]
SortBy = Literal["relevance", "price_low_to_high", "price_high_to_low"]
LOW_STOCK = 5  # this many or fewer left counts as "low stock"


# --- What the tools hand back to the model ------------------------------------
# Every value comes from campus_customs.db at call time. Image paths and row ids are
# left out on purpose: the model never needs them (the API adds images to product cards).


class SizeStock(BaseModel):
    """One size of one product, from the inventory table."""

    size: str = Field(description="Size code: XS, S, M, L, XL, or XXL.")
    quantity: int = Field(description="Units in stock right now. 0 means sold out.")

    @computed_field(description="in_stock, low_stock (5 or fewer left), or out_of_stock (0 left).")
    @property
    def status(self) -> StockStatus:
        if self.quantity <= 0:
            return "out_of_stock"
        return "low_stock" if self.quantity <= LOW_STOCK else "in_stock"


class ProductSummary(BaseModel):
    """A catalogue product, trimmed to what the model needs to recommend it (search_products)."""

    product_id: str = Field(description="Unique id; pass it to get_product_details / check_stock and list it in product_ids.")
    name: str = Field(description="Exact product name to show the customer.")
    category: str = Field(description="One of the store's 6 categories, e.g. Hoodies.")
    garment_type: str = Field(description="The catalogue's own garment description, e.g. 'pullover hoodie'.")
    price: float = Field(description="Price in US dollars, exactly as in the catalogue.")
    primary_color: str | None = Field(description="The garment's own color, e.g. 'navy blue'. None if the catalogue lists none.")
    secondary_colors: list[str] = Field(description="Colors of the logo, lettering, or graphics on the garment, not the garment itself.")
    description: str = Field(description="What the product looks like: color, logo, placement, details.")
    in_stock_sizes: list[str] = Field(description="Sizes with at least 1 unit in stock.")
    low_stock_sizes: list[str] = Field(description="In-stock sizes with 5 or fewer left.")
    sold_out_sizes: list[str] = Field(description="Sizes with 0 units in stock.")


class ProductDetails(ProductSummary):
    """Everything about one product, including exact stock per size (get_product_details)."""

    search_tags: list[str] = Field(description="Keywords from the catalogue, e.g. 'college rivalry'.")
    inventory: list[SizeStock] = Field(description="Quantity and status for every size, XS to XXL.")
    total_stock: int = Field(description="Units in stock across all sizes (already added up).")


class ProductSearchResult(BaseModel):
    """search_products' answer."""

    total_matches: int = Field(description="How many products matched in total.")
    returned: int = Field(description="How many are included in `products` (capped by the limit).")
    note: str = Field("", description="Warnings, e.g. more results exist or results match only some keywords.")
    products: list[ProductSummary] = Field(default_factory=list)


class StockCheck(BaseModel):
    """check_stock's answer for one product in one size, straight from the inventory table."""

    product_id: str
    name: str = Field(description="Exact product name.")
    price: float = Field(description="Price in US dollars.")
    requested_size: str = Field(description="The size as the customer said it, e.g. 'medium' or '2XL'.")
    size: str = Field(description="That size as a store size code, e.g. M or XXL.")
    available: bool = Field(description="True if at least 1 unit is in stock in this size.")
    quantity: int = Field(description="Units in stock in this size. 0 means sold out.")
    status: StockStatus
    message: str = Field(description="Plain-English summary to base the answer on, e.g. 'Size L is sold out (0 in stock).'")
    other_sizes_in_stock: list[str] = Field(description="Other sizes of this product that are in stock, to offer instead.")
    all_sizes: list[SizeStock] = Field(description="Quantity and status of every size of this product.")


class Alternative(ProductSummary):
    """A suggested replacement product, with the reason it was picked."""

    why: str = Field(description="Why it's a good alternative, e.g. 'Same style, in size M'.")


class AlternativesResult(BaseModel):
    """find_alternatives' answer: the closest in-stock products to what the customer wanted."""

    wanted: str = Field(description="What the customer asked for, in plain words.")
    exact_match_available: bool = Field(
        description="True if a product matching everything the customer asked for exists and is in stock."
    )
    relaxed: list[str] = Field(
        default_factory=list,
        description="Requirements that had to be loosened to find alternatives, e.g. 'color black'.",
    )
    note: str = ""
    alternatives: list[Alternative] = Field(default_factory=list)


class CartLine(BaseModel):
    product_id: str
    name: str
    size: str
    quantity: int
    price: float = Field(description="Price of one unit in US dollars.")
    line_total: float


class CartUpdate(BaseModel):
    """add_to_cart / view_cart result: what happened and the cart as it is now."""

    ok: bool = Field(description="True if the request succeeded (for add_to_cart: the item was added).")
    message: str = Field(description="Plain-English result to base the answer on.")
    sold_out: bool = Field(False, description="True if it failed because that size is sold out.")
    needs_login: bool = Field(False, description="True if the customer must log in to use the cart.")
    item_count: int = 0
    subtotal: float = 0.0
    items: list[CartLine] = Field(default_factory=list)


class ProductSearchFilters(BaseModel):
    """A catalogue search, with the same meaning as search_products' arguments."""

    query: str = Field("", description="Keywords, e.g. 'bulldog', 'saybrook', 'navy hoodie'. Empty to use filters only.")
    category: Category | None = None
    color: str | None = None
    min_price: float | None = Field(None, ge=0)
    max_price: float | None = Field(None, ge=0)
    in_stock_size: Size | None = None
    sort_by: SortBy = "relevance"


class PageSearch(ProductSearchFilters):
    """The agent's request to show a set of products on the website's page."""

    title: str = Field(
        min_length=1, max_length=60, description="Short heading for the page, e.g. 'T-Shirts' or 'Navy hoodies'."
    )


# --- Agent input (dependencies) and output ---------------------------------------


@dataclass
class ChatDeps:
    """Per-request context the agent can see (built by main.py from the database, never
    taken from the browser as-is): who the customer is, and where they are on the site."""

    user_id: int | None = None  # logged-in customer (needed for the cart tools)
    first_name: str | None = None  # logged-in customer, from the users table
    last_name: str | None = None
    email: str | None = None
    page: str | None = None  # plain-English description of the page they're on
    current_product: CurrentProduct | None = None  # set when they're on a product page
    # True if they opened this product page since their previous message (so it's the most
    # recently mentioned product); False if earlier messages were sent from the same page.
    page_just_opened: bool = True


class CurrentProduct(BaseModel):
    """The product whose page the customer is viewing, looked up in the catalogue."""

    product_id: str
    name: str
    category: str
    garment_type: str


class ChatReply(BaseModel):
    """The agent's structured answer (its PydanticAI output_type).

    agent.py also runs an output validator on this: every $ price in `reply` must
    come from a tool result, and every product_id must exist in the catalogue.
    """

    reply: str = Field(min_length=1, description="Your message to the customer, in Markdown.")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id of every product your reply recommends or talks about, most relevant first. "
            "Only ids returned by the tools. Empty list if the reply is not about specific products."
        ),
    )

    page_search: PageSearch | None = Field(
        None,
        description=(
            "Set this when the customer asks to browse or find a type or set of items ('what T-shirts do "
            "you have?', 'show me navy hoodies', 'anything with a bulldog?'). Use the same filters as your "
            "search_products call; the website then shows every matching product on the page. Leave null "
            "for questions about one specific product, stock or price checks, and small talk."
        ),
    )

    @field_validator("product_ids")
    @classmethod
    def _dedupe(cls, ids: list[str]) -> list[str]:
        return list(dict.fromkeys(i.strip() for i in ids if i.strip()))


# --- Chat API request/response ---------------------------------------------------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)
    # For customer messages: the product page they were on when they sent it (if any), so the
    # agent knows the order in which products came up ("the most recently mentioned product").
    viewing_product_id: str | None = Field(None, max_length=100)
    viewing_product_name: str | None = None  # filled in by the backend from the catalogue


class ChatRequest(BaseModel):
    """POST /api/chat body."""

    message: str = Field(min_length=1, max_length=2000)
    # Recent conversation, sent by the browser for guests. Logged-in customers'
    # history is loaded from the database instead.
    history: list[ChatTurn] = Field(default_factory=list, max_length=50)
    page: PageContext | None = None  # where the customer is on the site right now


class PageContext(BaseModel):
    """Where the customer is on the website when they send a message (sent by the browser).
    main.py checks it against the database before the agent sees any of it."""

    path: str = Field("/", max_length=200, description="URL path, e.g. /products/saybrook-college-crewneck.")
    product_id: str | None = Field(None, max_length=100, description="Set on a product page.")
    category: str | None = Field(None, max_length=40, description="Products page category filter.")
    search: str | None = Field(None, max_length=100, description="Products page search box text.")
    collection: str | None = Field(None, max_length=40, description="Products page collection, e.g. colleges.")
    chat_results_title: str | None = Field(None, max_length=60, description="Title of chat results on the page.")


class ProductCard(BaseModel):
    """A product as the website shows it: in chat product cards, and stored in
    chat_messages.products_json (same shape as the rows that shipped with the database)."""

    product_id: str
    name: str
    category: str
    garment_type: str
    description: str
    colors: list[str]  # original catalogue column: primary color first, then secondary
    primary_color: str | None
    secondary_colors: list[str]
    search_tags: list[str]
    image_file_path: str  # relative to data/, e.g. products/basic-hoodie-big-yale.jpg
    image_url: str  # what the browser loads, e.g. /images/products/basic-hoodie-big-yale.jpg
    price: float
    inventory: list[SizeStock]
    total_stock: int


class PageResults(BaseModel):
    """Products the website shows on its page because of a chat search."""

    title: str  # heading, e.g. "T-Shirts"
    filters: ProductSearchFilters  # the search that produced them, re-run on the database
    total: int
    products: list[ProductCard]


class ChatResponse(BaseModel):
    """POST /api/chat response."""

    reply: str  # Markdown
    products: list[ProductCard] = Field(default_factory=list)  # cards to show under the reply
    page: PageResults | None = None  # set when the website should show search results on the page
    tools_used: list[str] = Field(default_factory=list)
    cart_changed: bool = False  # the chatbot added something to the cart; the website refreshes its cart badge


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatHistoryResponse(BaseModel):
    """GET /api/chat/history response (empty for guests)."""

    messages: list[ChatHistoryMessage] = Field(default_factory=list)
