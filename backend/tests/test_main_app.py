import importlib
import sys


def test_create_app_can_skip_model_loading(monkeypatch):
    monkeypatch.setenv("J_MELO_SKIP_MODELS", "1")
    sys.modules.pop("main", None)

    main = importlib.import_module("main")

    assert main._should_load_model("load_transcription_model") is False
    assert main._should_load_model("load_alignment_model") is False
    assert main.app.title == "J-Melo Backend"
    assert any(route.path == "/api/tasks/{task_id}" for route in main.app.routes)
