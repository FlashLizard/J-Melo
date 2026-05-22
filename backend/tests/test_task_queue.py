import sqlite3

import pytest

from services import task_queue


@pytest.fixture()
def isolated_queue(tmp_path, monkeypatch):
    db_path = tmp_path / "tasks.db"
    monkeypatch.setattr(task_queue, "TASK_DB_PATH", db_path)
    monkeypatch.setattr(task_queue, "_db_initialized", False)
    monkeypatch.setattr(task_queue, "_worker_started", False)
    task_queue._handlers.clear()
    task_queue.init_db()
    return db_path


def test_create_task_with_key_inserts_and_deduplicates_pending(isolated_queue):
    task = task_queue.create_task("transcription", {"media_id": "abc"}, task_key="abc", display_name="Song A")
    duplicate = task_queue.create_task("transcription", {"media_id": "abc"}, task_key="abc", display_name="Song A")

    assert task.id == duplicate.id
    assert task.status == "pending"
    assert duplicate.payload["media_id"] == "abc"


def test_terminal_task_with_key_is_requeued_in_place(isolated_queue):
    original = task_queue.create_task("transcription", {"version": 1}, task_key="song-1")
    task_queue._complete_task(original.id, {"message": "done", "version": 1})

    requeued = task_queue.create_task("transcription", {"version": 2}, task_key="song-1")

    assert requeued.id == original.id
    assert requeued.status == "pending"
    assert requeued.payload["version"] == 2
    assert requeued.result is None


def test_processing_tasks_recover_to_pending_after_restart(isolated_queue, monkeypatch):
    task = task_queue.create_task("alignment", {"song_id": 1}, task_key="align-1")
    claimed = task_queue._claim_next_task()
    assert claimed and claimed.status == "processing"

    monkeypatch.setattr(task_queue, "_db_initialized", False)
    task_queue.init_db()
    recovered = task_queue.get_task(task.id)

    assert recovered is not None
    assert recovered.status == "pending"
    assert recovered.message == "Recovered after server restart"


def test_claim_and_complete_task(isolated_queue):
    task = task_queue.create_task("demo", {"answer": 42})
    claimed = task_queue._claim_next_task()

    assert claimed is not None
    assert claimed.id == task.id
    assert claimed.status == "processing"

    task_queue._complete_task(claimed.id, {"message": "ok", "answer": claimed.payload["answer"]})
    completed = task_queue.get_task(task.id)

    assert completed is not None
    assert completed.status == "completed"
    assert completed.result == {"message": "ok", "answer": 42}


def test_init_db_creates_required_indexes(isolated_queue):
    with sqlite3.connect(isolated_queue) as conn:
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(tasks)").fetchall()}

    assert "idx_tasks_kind_status" in indexes
    assert "idx_tasks_kind_key" in indexes
