"""Campus Customs shopping agent: PydanticAI + gpt-6-luna through Portkey.

System prompt: prompts/prompt.md
Tools:         search_products, get_product_details, check_stock, find_alternatives (tools.py)
Output:        ChatReply (models.py): a Markdown reply plus the product_ids it talks about
Guardrail:     check_reply rejects replies whose prices or stock quantities didn't come from a
               tool call in this turn, or that name unknown product_ids, and sends the model back
               to look them up (see the prompt's safety rules)
Loop limits:   per customer message, at most 12 model requests, 20 tool calls, 150k tokens, and
               90 seconds; the same tool with the same arguments at most twice (LoopGuard)
Scope:         check_reply also rejects replies that read like a general-purpose chatbot (code
               blocks, long essays), so the chat stays a Campus Customs shopping assistant
Audit trail:   every run (tool calls, results, rejected replies, stop reason) is appended to
               output/audit_trail.json (audit.py)
"""

from __future__ import annotations

import asyncio
import functools
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from dotenv import load_dotenv  # noqa: E402
from openai import AsyncOpenAI  # noqa: E402
from pydantic_ai import Agent, ModelRetry, RunContext, capture_run_messages  # noqa: E402
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded  # noqa: E402
from pydantic_ai.messages import (  # noqa: E402
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIResponsesModel  # noqa: E402
from pydantic_ai.providers.openai import OpenAIProvider  # noqa: E402
from pydantic_ai.settings import ModelSettings  # noqa: E402
from pydantic_ai.toolsets import FunctionToolset, WrapperToolset  # noqa: E402
from pydantic_ai.usage import UsageLimits  # noqa: E402

import audit  # noqa: E402
from models import (  # noqa: E402
    AlternativesResult,
    CartUpdate,
    ChatDeps,
    ChatReply,
    ChatTurn,
    ProductDetails,
    ProductSearchResult,
    StockCheck,
)
from tools import (  # noqa: E402
    add_to_cart,
    all_product_ids,
    check_stock,
    find_alternatives,
    find_product_ids,
    get_product_details,
    normalize_size,
    search_products,
    sold_out_everywhere,
    sold_out_in_size,
    view_cart,
)

HERE = Path(__file__).resolve().parent
# The Portkey key lives in a .env file: Homework 4/.env or the course folder's .env.
load_dotenv(HERE.parent / ".env")
load_dotenv(HERE.parent.parent / ".env")

MODEL_NAME = "gpt-6-luna"
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1").rstrip("/")
PROMPT_PATH = HERE / "prompts" / "prompt.md"
# Loop limits: a customer message can never make the agent run forever or run up the bill.
MAX_MODEL_REQUESTS = 12  # model calls per customer message (each tool round trip is one)
MAX_TOOL_CALLS = 20  # tool calls per customer message
MAX_SAME_TOOL_CALL = 2  # the same tool with the same arguments, per customer message
MAX_TOTAL_TOKENS = 150_000  # input + output tokens per customer message
MAX_OUTPUT_TOKENS = 2_000  # longest output the model may write in one step
MODEL_TIMEOUT_S = 45  # one model request
TOOL_TIMEOUT_S = 10  # one tool call (they only query SQLite, so normally milliseconds)
RUN_TIMEOUT_S = 90  # the whole answer to one customer message
# Scope: replies stay short shopping answers, never code, essays, or homework.
MAX_REPLY_WORDS = 250
MAX_HISTORY_TURNS = 20  # earlier messages sent along as conversation context
MAX_RETRIES = 2  # chances the model gets to fix a rejected reply or a bad tool call
# Sent when the model provider's content filter blocks a message (e.g. jailbreak attempts).
FILTERED_REPLY = (
    "Sorry, I can't help with that one. I'm here for Campus Customs merch, though: "
    "ask me about hoodies, sizes, prices, or what's in stock!"
)
# Sent when a loop limit stops the agent, or it couldn't produce a valid reply.
LIMIT_REPLY = (
    "Sorry, I couldn't finish looking that up. Could you ask again a bit more simply, "
    'for example "navy hoodies in size M" or "is the Saybrook crewneck in L?"'
)
PRICE_RE = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)")
# Stock counts in a reply: "15 in stock", "2 left", "8 available", "only 3", "3 units",
# and per-size lists like "**XS:** 15" or "M (12)".
QUANTITY_RE = re.compile(
    r"\bonly\s+(\d{1,4})\b"
    r"|\b(\d{1,4})\s+(?:(?:are|is)\s+)?(?:left|in\s+stock|available|units?|pieces?)\b"
    r"|\b(?:XXL|XL|XS|S|M|L)\b\**\s*[:(]\s*\**\s*(\d{1,4})\b",
    re.IGNORECASE,
)
TOOLS = [search_products, get_product_details, check_stock, find_alternatives, add_to_cart, view_cart]


class LoopGuard(WrapperToolset[ChatDeps]):
    """Stops tool-call loops: the same tool with the same arguments may run at most
    MAX_SAME_TOOL_CALL times per customer message; after that the model is told to use the
    result it already has (and if it keeps trying, the run stops with LIMIT_REPLY)."""

    async def call_tool(self, name, tool_args, ctx, tool):
        if _same_call_count(ctx.messages, name, ctx.tool_call_id) > MAX_SAME_TOOL_CALL:
            raise ModelRetry(
                f"You already called {name} with these exact arguments {MAX_SAME_TOOL_CALL} times for this "
                "message. Don't call it again: use the result you already have, try different arguments, "
                "or answer the customer now."
            )
        return await super().call_tool(name, tool_args, ctx, tool)


def _same_call_count(messages: list[ModelMessage], name: str, tool_call_id: str | None) -> int:
    """How many times this turn called `name` with the same arguments as call `tool_call_id` (incl. it)."""
    calls = [
        part
        for msg in _current_turn(messages)
        if isinstance(msg, ModelResponse)
        for part in msg.parts
        if isinstance(part, ToolCallPart) and part.tool_name == name
    ]
    current = next((c for c in calls if c.tool_call_id == tool_call_id), None)
    if current is None:
        return 0
    args = current.args_as_dict()
    return sum(c.args_as_dict() == args for c in calls)


@functools.lru_cache(maxsize=1)
def get_agent() -> Agent[ChatDeps, ChatReply]:
    """Build the agent once, on first use (so the API can start even without a key)."""
    api_key = os.getenv("PORTKEY_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set (put it in a .env file).")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-api-key": api_key},
    )
    model = OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))

    agent = Agent(
        model,
        deps_type=ChatDeps,
        output_type=ChatReply,
        instructions=PROMPT_PATH.read_text(encoding="utf-8"),
        toolsets=[LoopGuard(FunctionToolset(TOOLS, timeout=TOOL_TIMEOUT_S))],
        retries=MAX_RETRIES,
        model_settings=ModelSettings(max_tokens=MAX_OUTPUT_TOKENS, timeout=MODEL_TIMEOUT_S),
    )

    @agent.instructions
    def customer_context(ctx: RunContext[ChatDeps]) -> str:
        """Who is chatting and where they are on the site, rebuilt for every message."""
        return _customer_context(ctx.deps)

    @agent.output_validator
    def check_reply(ctx: RunContext[ChatDeps], output: ChatReply) -> ChatReply:
        """Safety net for the prompt's accuracy rules: no made-up prices or products."""
        # Scope: this is a Campus Customs shopping chat, not a general-purpose chatbot.
        if "```" in output.reply or len(output.reply.split()) > MAX_REPLY_WORDS:
            raise ModelRetry(
                f"This chat is only for Campus Customs shopping: replies must be under {MAX_REPLY_WORDS} words "
                "and never contain code blocks. If the customer asked for something unrelated to Yale merch "
                "(code, homework, essays, stories, translations, general questions), decline in one friendly "
                "sentence and offer to help them find merch. Otherwise shorten the reply."
            )
        allowed = _prices_seen(ctx.messages)
        stated = {_to_price(m) for m in PRICE_RE.findall(output.reply)}
        if wrong := sorted(stated - allowed):
            raise ModelRetry(
                "Your reply states "
                + ", ".join(f"${p:g}" for p in wrong)
                + ", but no tool returned that price in this conversation. Look the product up and quote "
                "its exact price, or remove the price."
            )
        stated_qty = {int(next(g for g in groups if g)) for groups in QUANTITY_RE.findall(output.reply)}
        if wrong_qty := sorted(stated_qty - _quantities_seen(ctx.messages)):
            raise ModelRetry(
                "Your reply states stock quantities "
                + ", ".join(str(q) for q in wrong_qty)
                + " that no tool returned in this turn. Stock changes, so call check_stock or "
                "get_product_details now and quote those numbers, or describe availability without numbers."
            )
        if unknown := [pid for pid in output.product_ids if pid not in all_product_ids()]:
            raise ModelRetry(f"These product_ids don't exist: {unknown}. Use only ids returned by the tools.")
        reason, unavailable_ids = _unavailable(ctx.messages)
        # Never recommend something that's sold out in the customer's size. (The product
        # they asked about may still be listed when the reply is telling them it's sold out.)
        # Rule 4: never recommend a product with 0 units in stock (in any size).
        if sold_out := sold_out_everywhere([pid for pid in output.product_ids if pid not in unavailable_ids]):
            raise ModelRetry(
                f"These are completely sold out: {', '.join(sold_out)}. Don't recommend them; "
                "use find_alternatives to suggest in-stock products instead."
            )
        # A size mentioned in *this* message limits the page search (e.g. "bulldog hoodies in XXL").
        # A size from an earlier question doesn't: "what T-shirts do you have?" after asking about
        # M hoodies should show all T-shirts, matching the count in the reply.
        if output.page_search:
            asked_size = _customer_size(_current_prompt(ctx.messages))
            output.page_search.in_stock_size = asked_size  # the size in this message, or none
        if size := _customer_size(ctx.messages):
            recommended = [pid for pid in output.product_ids if pid not in unavailable_ids]
            if sold_out := sold_out_in_size(recommended, size):
                raise ModelRetry(
                    f"The customer needs size {size}, but these are sold out in {size}: {', '.join(sold_out)}. "
                    f"Don't recommend them: remove them from the reply and product_ids, or replace them "
                    f"(call find_alternatives with size='{size}')."
                )
        if reason and not [pid for pid in output.product_ids if pid not in unavailable_ids]:
            raise ModelRetry(
                f"{reason} Don't stop at no: call find_alternatives with what the customer wanted, "
                "suggest 2-4 of the alternatives in your reply (say briefly why each is a good fit), "
                "and list their ids in product_ids."
            )
        if output.page_search and not find_product_ids(output.page_search):
            raise ModelRetry(
                "page_search matches no products. Use the same filters as a search_products call that "
                "returned results, or set page_search to null."
            )
        return output

    return agent


def _customer_context(deps: ChatDeps) -> str:
    lines = ["## This conversation"]

    if deps.first_name or deps.email:
        name = " ".join(n for n in (deps.first_name, deps.last_name) if n)
        lines.append(
            f"- Customer: logged in as **{name}** (email: {deps.email}). Their chat history is saved to their "
            "account, so earlier messages in this conversation may be from previous visits."
        )
    else:
        lines.append("- Customer: a guest (not logged in). You don't know their name or email.")

    if deps.current_product:
        p = deps.current_product
        lines.append(
            f"- They are viewing the product page for **{p.name}** (product_id `{p.product_id}`, "
            f"{p.category}, {p.garment_type})."
        )
        if deps.page_just_opened:
            lines.append(
                f"- They opened this page since their previous message, so **{p.name} is the most recently "
                f"mentioned product** (Rule 1). \"This\", \"it\", \"this one\", or a color or size question "
                f"without a product name means **{p.name}**: use product_id `{p.product_id}` with "
                "get_product_details or check_stock. Only treat it as a different product if their message names one."
            )
        else:
            lines.append(
                f"- They were already on this page when they sent their previous message, so the most recently "
                f"mentioned product (Rule 1) is the last one named in the conversation, which may be a different "
                f"product than {p.name}. If no other product has been named since, it's {p.name}."
            )
    elif deps.page:
        lines.append(f"- They are on {deps.page}.")

    lines.append(f"- Today is {date.today():%A, %B %d, %Y}.")
    return "\n".join(lines)


def _to_price(text: str) -> float:
    return float(text.replace(",", ""))


def _prices_seen(messages: list[ModelMessage]) -> set[float]:
    """Prices the reply may mention: those tools returned, plus any the customer typed ("under $50")."""
    seen: set[float] = set()
    for message in messages:
        if not isinstance(message, ModelRequest):
            continue
        for part in message.parts:
            if isinstance(part, ToolReturnPart):
                if isinstance(part.content, ProductSearchResult):
                    seen.update(p.price for p in part.content.products)
                elif isinstance(part.content, (ProductDetails, StockCheck)):
                    seen.add(part.content.price)
                elif isinstance(part.content, AlternativesResult):
                    seen.update(a.price for a in part.content.alternatives)
                elif isinstance(part.content, CartUpdate):
                    seen.add(part.content.subtotal)
                    seen.update(v for line in part.content.items for v in (line.price, line.line_total))
            elif isinstance(part, UserPromptPart) and isinstance(part.content, str):
                seen.update(_to_price(m) for m in PRICE_RE.findall(part.content))
    return seen


# How customers say sizes in a message: "size S", "in M", "medium", "2XL", "extra large".
_SIZE_WORDS = r"xxs|xs|s|m|l|xl|xxl|2xl|x-?small|x-?large|xx-?large|extra[\s-]?small|extra[\s-]?large|small|medium|large"
_SIZE_PATTERNS = [
    re.compile(rf"\bsize\s+({_SIZE_WORDS})\b", re.IGNORECASE),
    re.compile(r"\b(xs|xl|xxl|2xl|x-?small|x-?large|xx-?large|extra[\s-]?small|extra[\s-]?large|small|medium|large)\b", re.IGNORECASE),
    re.compile(r"\b(?:in|an?)\s+(S|M|L)\b"),  # capital letter only: "in M", "a L"
]


def _customer_size(messages: list[ModelMessage]) -> str | None:
    """The size the customer is shopping for: the latest one they mentioned, or that the agent
    looked up for them (check_stock / find_alternatives / search_products in_stock_size)."""
    size: str | None = None
    for message in messages:
        for part in message.parts:
            found: str | None = None
            if isinstance(part, UserPromptPart) and isinstance(part.content, str):
                for pattern in _SIZE_PATTERNS:
                    if match := pattern.search(part.content):
                        found = match.group(1)
                        break
            elif part.part_kind == "tool-call" and part.tool_name in ("check_stock", "find_alternatives", "search_products", "add_to_cart"):
                args = part.args_as_dict()
                found = args.get("size") or args.get("in_stock_size")
            if found and (code := normalize_size(found)):
                size = code
    return size


def _current_turn(messages: list[ModelMessage]) -> list[ModelMessage]:
    """The messages of this turn: from the customer's latest message onwards (history excluded)."""
    for i in range(len(messages) - 1, -1, -1):
        message = messages[i]
        if isinstance(message, ModelRequest) and any(isinstance(p, UserPromptPart) for p in message.parts):
            return messages[i:]
    return messages


def _current_prompt(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Just the customer's latest message (no tool calls), to read a size they typed in it."""
    turn = _current_turn(messages)
    return turn[:1]


def _unavailable(messages: list[ModelMessage]) -> tuple[str | None, set[str]]:
    """If a tool said in this turn that what the customer wants isn't available, say what,
    plus the ids of the unavailable products (they don't count as alternatives)."""
    reason: str | None = None
    unavailable: set[str] = set()
    for message in messages:
        if not isinstance(message, ModelRequest):
            continue
        for part in message.parts:
            if not isinstance(part, ToolReturnPart):
                continue
            content = part.content
            if isinstance(content, StockCheck) and not content.available:
                reason = reason or f"check_stock says {content.name} is sold out in size {content.size}."
                unavailable.add(content.product_id)
            elif isinstance(content, ProductSearchResult) and content.total_matches == 0:
                reason = reason or "search_products found no matching products."
            elif isinstance(content, CartUpdate) and content.sold_out:
                reason = reason or "add_to_cart failed because that size is sold out."
            elif isinstance(content, AlternativesResult) and content.alternatives:
                reason = reason or "You looked up alternatives but didn't include any in product_ids."
    return reason, unavailable


def _quantities_seen(messages: list[ModelMessage]) -> set[int]:
    """Stock numbers the reply may mention: those tools returned *this turn* (history only
    holds old text, so earlier numbers must be looked up again), plus any the customer typed."""
    seen: set[int] = set()
    for message in messages:
        if not isinstance(message, ModelRequest):
            continue
        for part in message.parts:
            if isinstance(part, ToolReturnPart):
                if isinstance(part.content, ProductDetails):
                    seen.update(s.quantity for s in part.content.inventory)
                    seen.add(part.content.total_stock)
                elif isinstance(part.content, StockCheck):
                    seen.add(part.content.quantity)
                    seen.update(s.quantity for s in part.content.all_sizes)
                elif isinstance(part.content, CartUpdate):
                    seen.add(part.content.item_count)
                    seen.update(line.quantity for line in part.content.items)
                    # "Only 3 left" messages from a refused add
                    seen.update(int(n) for n in re.findall(r"\b\d{1,4}\b", part.content.message))
            elif isinstance(part, UserPromptPart) and isinstance(part.content, str):
                seen.update(int(n) for n in re.findall(r"\b\d{1,4}\b", part.content))
    return seen


def _to_model_history(history: list[ChatTurn]) -> list[ModelMessage]:
    """Turn stored chat turns into PydanticAI messages so the agent remembers the conversation."""
    messages: list[ModelMessage] = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        if turn.role == "user":
            # Mark which product page the customer was on when they wrote this, so the agent
            # can tell which product was mentioned most recently (Rule 1).
            note = f"[Sent from the product page for {turn.viewing_product_name}] " if turn.viewing_product_name else ""
            messages.append(ModelRequest(parts=[UserPromptPart(content=note + turn.content)]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages


async def run_chat(message: str, history: list[ChatTurn], deps: ChatDeps) -> tuple[ChatReply, list[str]]:
    """Answer one customer message. Returns the structured reply and the tools the agent used."""
    # Mark the page the message was sent from right next to it (like earlier messages in the
    # history), so the agent applies Rule 1 (most recently mentioned product) correctly.
    if deps.current_product:
        name = deps.current_product.name
        note = (
            f"[Sent from the product page for {name}, which the customer opened after their previous "
            f"message, so {name} is now the most recently mentioned product]"
            if deps.page_just_opened
            else f"[Sent from the product page for {name}]"
        )
        message = f"{note} {message}"
    model_history = _to_model_history(history)
    run = dict(
        run_id=uuid.uuid4().hex[:12],
        started=datetime.now(timezone.utc),
        user_id=deps.user_id,
        page=deps.page,
        customer_message=message,
    )
    limits = UsageLimits(
        request_limit=MAX_MODEL_REQUESTS,
        tool_calls_limit=MAX_TOOL_CALLS,
        total_tokens_limit=MAX_TOTAL_TOKENS,
    )
    with capture_run_messages() as run_messages:
        try:
            result = await asyncio.wait_for(
                get_agent().run(message, deps=deps, message_history=model_history, usage_limits=limits),
                timeout=RUN_TIMEOUT_S,
            )
        except Exception as exc:
            # Record what the agent did before it stopped (append-only; see audit.py).
            filtered = isinstance(exc, ModelHTTPError) and "content_filter" in str(exc.body)
            stop_reason = (
                "content_filter" if filtered
                else "usage_limit" if isinstance(exc, UsageLimitExceeded)
                else "timeout" if isinstance(exc, TimeoutError)
                else "retries_exhausted" if isinstance(exc, UnexpectedModelBehavior)
                else "exception"
            )
            # A loop limit or a reply that couldn't be fixed gets a polite answer, not an error.
            reply = (
                ChatReply(reply=FILTERED_REPLY) if filtered
                else ChatReply(reply=LIMIT_REPLY) if stop_reason != "exception"
                else None
            )
            audit.record_run(**run, messages=run_messages[len(model_history):], stop_reason=stop_reason,
                             output=reply, error=f"{type(exc).__name__}: {exc}")
            if reply is None:
                raise
            return reply, []
    audit.record_run(**run, messages=result.new_messages(), output=result.output)
    tools_used = [
        part.tool_name
        for msg in result.new_messages()
        if isinstance(msg, ModelResponse)
        for part in msg.parts
        if part.part_kind == "tool-call" and part.tool_name in {t.__name__ for t in TOOLS}
    ]
    return result.output, list(dict.fromkeys(tools_used))
