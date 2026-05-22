import asyncio
import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from core.config import TASK_DB_PATH
from core.utils import log_info

TaskHandler = Callable[["TaskRecord"], Awaitable[Dict[str, Any]]]


@dataclass
class TaskRecord:
    id: str
    kind: str
    status: str
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    message: Optional[str]
    display_name: Optional[str]
    task_key: Optional[str]
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]


_handlers: Dict[str, TaskHandler] = {}
_worker_started = False
_db_initialized = False


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(TASK_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    global _db_initialized
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                status TEXT NOT NULL,
                task_key TEXT,
                display_name TEXT,
                payload_json TEXT NOT NULL,
                result_json TEXT,
                error TEXT,
                message TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_kind_status ON tasks(kind, status, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_kind_key ON tasks(kind, task_key)")
        if not _db_initialized:
            conn.execute(
                "UPDATE tasks SET status = 'pending', message = 'Recovered after server restart' WHERE status = 'processing'"
            )
    _db_initialized = True


def _row_to_task(row: sqlite3.Row) -> TaskRecord:
    return TaskRecord(
        id=row["id"],
        kind=row["kind"],
        status=row["status"],
        task_key=row["task_key"],
        display_name=row["display_name"],
        payload=json.loads(row["payload_json"] or "{}"),
        result=json.loads(row["result_json"]) if row["result_json"] else None,
        error=row["error"],
        message=row["message"],
        created_at=row["created_at"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
    )


def register_handler(kind: str, handler: TaskHandler) -> None:
    _handlers[kind] = handler


def create_task(
    kind: str,
    payload: Dict[str, Any],
    display_name: Optional[str] = None,
    task_id: Optional[str] = None,
    task_key: Optional[str] = None,
    replace_terminal: bool = True,
) -> TaskRecord:
    init_db()
    now = _utc_now()
    final_task_id = task_id
    task_written = False
    with connect() as conn:
        if task_key:
            existing = conn.execute(
                "SELECT * FROM tasks WHERE kind = ? AND task_key = ? ORDER BY created_at DESC LIMIT 1",
                (kind, task_key),
            ).fetchone()
            if existing and existing["status"] in {"pending", "processing"}:
                return _row_to_task(existing)
            if existing and replace_terminal:
                final_task_id = existing["id"]
                conn.execute(
                    """
                    UPDATE tasks
                    SET status = 'pending', payload_json = ?, result_json = NULL, error = NULL,
                        message = 'Queued', display_name = ?, created_at = ?, started_at = NULL,
                        completed_at = NULL
                    WHERE id = ?
                    """,
                    (json.dumps(payload, ensure_ascii=False), display_name, now, final_task_id),
                )
                task_written = True
        if final_task_id is None:
            final_task_id = str(uuid.uuid4())

        if not task_written:
            conn.execute(
                """
                INSERT OR REPLACE INTO tasks
                  (id, kind, status, task_key, display_name, payload_json, result_json, error, message,
                   created_at, started_at, completed_at)
                VALUES (?, ?, 'pending', ?, ?, ?, NULL, NULL, 'Queued', ?, NULL, NULL)
                """,
                (final_task_id, kind, task_key, display_name, json.dumps(payload, ensure_ascii=False), now),
            )
    task = get_task(final_task_id)
    if not task:
        raise RuntimeError("Failed to create task")
    return task


def get_task(task_id: str) -> Optional[TaskRecord]:
    init_db()
    with connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_task(row) if row else None


def get_task_by_key(kind: str, task_key: str) -> Optional[TaskRecord]:
    init_db()
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE kind = ? AND task_key = ? ORDER BY created_at DESC LIMIT 1",
            (kind, task_key),
        ).fetchone()
    return _row_to_task(row) if row else None


def list_tasks(kind: Optional[str] = None, limit: int = 100) -> List[TaskRecord]:
    init_db()
    with connect() as conn:
        if kind:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE kind = ? ORDER BY created_at DESC LIMIT ?",
                (kind, limit),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_task(row) for row in rows]


def get_queue_position(task_id: str) -> int:
    init_db()
    with connect() as conn:
        rows = conn.execute(
            "SELECT id FROM tasks WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
    pending_ids = [row["id"] for row in rows]
    try:
        return pending_ids.index(task_id)
    except ValueError:
        return 0


def _claim_next_task() -> Optional[TaskRecord]:
    init_db()
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE tasks SET status = 'processing', started_at = ?, message = 'Processing' WHERE id = ?",
            (_utc_now(), row["id"]),
        )
    return get_task(row["id"])


def _complete_task(task_id: str, result: Dict[str, Any], message: str = "Success") -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE tasks
            SET status = 'completed', result_json = ?, error = NULL, message = ?, completed_at = ?
            WHERE id = ?
            """,
            (json.dumps(result, ensure_ascii=False), message, _utc_now(), task_id),
        )


def _fail_task(task_id: str, error: str) -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE tasks
            SET status = 'failed', error = ?, message = ?, completed_at = ?
            WHERE id = ?
            """,
            (error, error, _utc_now(), task_id),
        )


async def worker_loop(poll_interval: float = 1.0) -> None:
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    init_db()
    log_info("SQLite task worker started.")
    while True:
        task = _claim_next_task()
        if not task:
            await asyncio.sleep(poll_interval)
            continue
        handler = _handlers.get(task.kind)
        if not handler:
            _fail_task(task.id, f"No handler registered for task kind '{task.kind}'")
            continue
        try:
            result = await handler(task)
            _complete_task(task.id, result, result.get("message", "Success"))
        except Exception as e:
            log_info(f"Task {task.id} failed: {e}")
            _fail_task(task.id, str(e))
