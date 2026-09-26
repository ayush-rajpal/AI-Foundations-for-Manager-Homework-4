"""Append-only audit trail of the agent's activity: output/audit_trail.json.

The file is one JSON array of events, oldest first. New events are only ever added at the end
(the closing "]" is moved past them); nothing earlier is rewritten, and the file is never wiped
when the server restarts. Each customer message is one agent *run*, and every event carries its
`run_id`:

- `tool_call`:      a tool the agent called, with its arguments and result
- `tool_retry`:     a tool call that failed and was sent back to the model (e.g. an unknown product)
- `reply_rejected`: a draft reply the guardrail (`check_reply`) sent back to be fixed, and why
- `run_end`:        how the run finished: stop reason, final reply, tools used, model, tokens

Every event has `time` (UTC) and `stop_reason`: why the model stopped at that step
("tool_call" = it paused to call a tool; "stop" = it gave its answer; "length", "content_filter",
"error"; or "usage_limit" / "retries_exhausted" / "exception" when the run itself failed).

Customers are recorded by account id only (or as a guest), never by name, email, or phone.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic_ai.messages import ModelMessage, ModelResponse, RetryPromptPart, ToolCallPart, ToolReturnPart
from pydantic_core import to_jsonable_python

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
OUTPUT_TOOL = "final_result"  # the tool PydanticAI uses for the agent's structured answer
MAX_TEXT = 2000  # longest customer message / reply text kept in an event

log = logging.getLogger("campus_customs.audit")
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _time(value: datetime | None) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds") if value else _now()


def _short(text: str | None) -> str | None:
    return text if text is None or len(text) <= MAX_TEXT else text[:MAX_TEXT] + "…"


def _step_stop_reason(response: ModelResponse | None) -> str | None:
    """Why the model stopped at this step. The Responses API reports a step that asks for tools as
    "completed" ("stop"), so a step whose output is a tool call is recorded as "tool_call"."""
    if response is None:
        return None
    asked_for_tool = any(isinstance(p, ToolCallPart) and p.tool_name != OUTPUT_TOOL for p in response.parts)
    if asked_for_tool and response.finish_reason in (None, "stop"):
        return "tool_call"
    return response.finish_reason


def append_events(events: Sequence[dict[str, Any]], path: Path | None = None) -> None:
    """Add events to the end of the audit file without touching the events already in it."""
    if not events:
        return
    path = path or AUDIT_PATH
    chunk = ",\n".join(json.dumps(e, ensure_ascii=False, default=str) for e in events).encode("utf-8")
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a+b") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size == 0:
                f.write(b"[\n" + chunk + b"\n]\n")
                return
            # Find the closing "]" (followed only by whitespace) and write the new events in its place.
            tail_len = min(size, 64)
            f.seek(size - tail_len)
            tail = f.read(tail_len)
            end = tail.rstrip()
            if not end.endswith(b"]"):
                # Never repair or overwrite a damaged file; keep it as evidence and skip this write.
                log.error("Audit trail %s doesn't end with ']'; not writing %d event(s)", path, len(events))
                return
            bracket = size - tail_len + len(end) - 1
            f.seek(bracket)
            f.truncate()  # removes only the closing "]" and trailing whitespace
            before = end[:-1].rstrip()
            separator = b"\n" if before.endswith(b"[") else b",\n"
            f.write(separator + chunk + b"\n]\n")


def run_events(
    *,
    run_id: str,
    messages: Sequence[ModelMessage],
    started: datetime,
    user_id: int | None,
    page: str | None,
    customer_message: str,
    stop_reason: str | None = None,
    output: Any = None,
    error: str | None = None,
) -> list[dict[str, Any]]:
    """Turn one run's new messages (not the earlier history) into audit events."""
    events: list[dict[str, Any]] = []
    calls: dict[str, tuple[ToolCallPart, ModelResponse]] = {}
    tools_used: list[str] = []
    last_response: ModelResponse | None = None
    input_tokens = output_tokens = requests = 0

    for msg in messages:
        if isinstance(msg, ModelResponse):
            last_response = msg
            requests += 1
            input_tokens += msg.usage.input_tokens or 0
            output_tokens += msg.usage.output_tokens or 0
            for part in msg.parts:
                if isinstance(part, ToolCallPart):
                    calls[part.tool_call_id] = (part, msg)
            continue
        for part in msg.parts:
            if isinstance(part, ToolReturnPart) and part.tool_name != OUTPUT_TOOL:
                call, response = calls.get(part.tool_call_id, (None, None))
                tools_used.append(part.tool_name)
                events.append({
                    "time": _time(part.timestamp),
                    "run_id": run_id,
                    "event": "tool_call",
                    "tool": part.tool_name,
                    "args": call.args_as_dict() if call else None,
                    "result": to_jsonable_python(part.content),
                    "stop_reason": _step_stop_reason(response),
                })
            elif isinstance(part, RetryPromptPart):
                call, response = calls.get(part.tool_call_id or "", (None, None))
                rejected_reply = part.tool_name in (None, OUTPUT_TOOL)
                events.append({
                    "time": _time(part.timestamp),
                    "run_id": run_id,
                    "event": "reply_rejected" if rejected_reply else "tool_retry",
                    "tool": part.tool_name or OUTPUT_TOOL,
                    "args": call.args_as_dict() if call else None,
                    "result": part.content if isinstance(part.content, str) else to_jsonable_python(part.content),
                    "stop_reason": _step_stop_reason(response),
                })

    if stop_reason is None:
        # The model's own reason for its last step. A structured answer arrives as a call to the
        # output tool, which some providers report as "tool_call"; the run still ended with an answer.
        stop_reason = (last_response.finish_reason if last_response else None) or "stop"
        if stop_reason == "tool_call" and output is not None:
            stop_reason = "stop"

    finished = datetime.now(timezone.utc)
    events.append({
        "time": _time(finished),
        "run_id": run_id,
        "event": "run_end",
        "tool": None,
        "result": {
            "reply": _short(getattr(output, "reply", None)),
            "product_ids": getattr(output, "product_ids", None),
            "page_search": to_jsonable_python(getattr(output, "page_search", None)),
        } if output is not None else None,
        "stop_reason": stop_reason,
        "error": _short(error),
        "customer": f"user {user_id}" if user_id else "guest",
        "page": page,
        "message": _short(customer_message),
        "tools_used": list(dict.fromkeys(tools_used)),
        "tool_calls": len(tools_used),
        "replies_rejected": sum(e["event"] == "reply_rejected" for e in events),
        "model": last_response.model_name if last_response else None,
        "model_requests": requests,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "duration_ms": round((finished - started).total_seconds() * 1000),
    })
    return events


def record_run(**kwargs: Any) -> None:
    """Build and append one run's events. Never lets an audit problem break the chat."""
    try:
        append_events(run_events(**kwargs))
    except Exception:
        log.exception("Couldn't write the audit trail")
