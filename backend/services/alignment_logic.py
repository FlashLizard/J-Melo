import os
import json
import subprocess
import shutil
import sys
from pathlib import Path
from core.config import CACHE_DIR, TEMP_DATA_DIR
from core.utils import log_info
from services.media_logic import fetch_media_info, download_media

ALIGNMENT_TASKS = {}

def extract_vocals(audio_path, output_dir):
    abs_audio_path, abs_output_dir = os.path.abspath(audio_path), os.path.abspath(output_dir)
    log_info(f"Extracting vocals from {abs_audio_path}")
    try:
        subprocess.run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-o", str(abs_output_dir), str(abs_audio_path)], check=True, capture_output=True)
        vocal_path = next(Path(abs_output_dir).rglob("vocals.*"), None)
        return str(vocal_path) if vocal_path else str(abs_audio_path)
    except Exception as e:
        log_info(f"Vocal extraction error: {e}")
        return str(abs_audio_path)

def run_alignment_task(task_id, song_id, lyrics_data, align_mode, stable_whisper_model, source_url=None, local_path=None, extract_vocals_flag=True, replace_with_kana=False):
    try:
        ALIGNMENT_TASKS[task_id]["status"] = "processing"
        
        audio_path = Path(local_path) if local_path and os.path.exists(local_path) else None
        if not audio_path:
            for ext in ['mp3', 'wav']:
                p = Path(CACHE_DIR) / f"{song_id}.{ext}"
                if p.exists(): audio_path = p; break
        
        if not audio_path and source_url:
            info = fetch_media_info(source_url); mid = info.get("id")
            if mid:
                audio_path = Path(CACHE_DIR) / f"{mid}.mp3"
                if not audio_path.exists(): download_media(info, str(audio_path))
        
        if not audio_path or not audio_path.exists(): raise FileNotFoundError("Audio not found")

        temp_dir = Path(TEMP_DATA_DIR) / f"align_{task_id}"; temp_dir.mkdir(parents=True, exist_ok=True)
        vocals_path = extract_vocals(audio_path, temp_dir) if extract_vocals_flag else str(audio_path)

        input_text_parts = []; char_to_token_map = []
        for line in lyrics_data:
            line_text_for_model = ""
            for token in line.get("tokens", []):
                text_to_send = token["reading"] if replace_with_kana and token.get("reading") else token["surface"]
                clean_send = text_to_send.strip().replace(" ", "").replace("　", "")
                if not clean_send: continue
                line_text_for_model += clean_send
                for _ in range(len(clean_send)): char_to_token_map.append(token)
            input_text_parts.append(line_text_for_model); char_to_token_map.append(None)
        
        full_text_for_align = "。".join(input_text_parts) + "。"
        with open(os.path.join(TEMP_DATA_DIR, f"align_in_{task_id}.txt"), "w", encoding="utf-8") as f: f.write(full_text_for_align)

        if not stable_whisper_model: raise ImportError("Model not loaded")
        result = stable_whisper_model.align(vocals_path, full_text_for_align, language='ja')
        
        debug_output_path = os.path.join(TEMP_DATA_DIR, f"align_debug_out_{task_id}.json")
        try:
            debug_data = []
            for s in result.segments:
                cleaned_words = []
                for w in s.words:
                    word_txt = w.word.replace("。", "").strip()
                    if word_txt: cleaned_words.append({"word": word_txt, "start": w.start, "end": w.end})
                debug_data.append({"text": s.text.replace("。", "").strip(), "start": s.start, "end": s.end, "words": cleaned_words})
            with open(debug_output_path, "w", encoding="utf-8") as f: json.dump(debug_data, f, ensure_ascii=False)
        except: pass

        result_chars_times = []
        for seg in result.segments:
            for w in seg.words:
                w_text = w.word.replace("。", "").strip()
                if not w_text: continue
                dur, c_count = w.end - w.start, len(w_text)
                for i in range(c_count): result_chars_times.append({"start": w.start + (i/c_count)*dur, "end": w.start + ((i+1)/c_count)*dur})
        
        for line in lyrics_data:
            line["startTime"], line["endTime"] = 0, 0
            for token in line.get("tokens", []): token["startTime"], token["endTime"] = 0, 0

        r_ptr = 0
        for token_ref in char_to_token_map:
            if token_ref is None: continue
            if r_ptr >= len(result_chars_times): break
            c_time = result_chars_times[r_ptr]; r_ptr += 1
            if token_ref["startTime"] == 0 or c_time["start"] < token_ref["startTime"]: token_ref["startTime"] = round(c_time["start"], 2)
            token_ref["endTime"] = round(c_time["end"], 2)

        for line in lyrics_data:
            tks = [t for t in line.get("tokens", []) if t["startTime"] > 0]
            if tks: line["startTime"] = min(t["startTime"] for t in tks); line["endTime"] = max(t["endTime"] for t in tks)

        ALIGNMENT_TASKS[task_id].update({"status": "completed", "result": {"segments": lyrics_data}, "message": "Success"})
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception as e:
        log_info(f"Alignment failed: {e}")
        ALIGNMENT_TASKS[task_id].update({"status": "failed", "message": str(e)})
