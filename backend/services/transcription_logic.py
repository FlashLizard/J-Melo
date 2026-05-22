import json
import asyncio
import jaconv
from datetime import datetime
from pathlib import Path
from faster_whisper import WhisperModel
from core.config import resolve_backend_path
from core.utils import log_info, sudachi_tokenizer, sudachi_split_mode, is_pure_kana_or_punct

TRANSCRIPTION_SEMAPHORE = asyncio.Semaphore(1)
TRANSCRIPTION_TASKS = {}

def format_whisper_output(segments, segment_start_base=0):
    formatted_segments = []
    for segment in segments:
        segment_text = segment.text.strip()
        if not segment_text: continue
        
        char_times = []
        if hasattr(segment, 'words') and segment.words:
            for w in segment.words:
                w_text = w.word.strip()
                if not w_text: continue
                w_start, w_end = float(w.start), float(w.end)
                dur, c_count = w_end - w_start, len(w_text)
                for i in range(c_count):
                    char_times.append({"char": w_text[i], "start": w_start + (i/c_count)*dur, "end": w_start + ((i+1)/c_count)*dur})
        
        tokens = sudachi_tokenizer.tokenize(segment_text, sudachi_split_mode)
        formatted_words, current_char_idx, full_annotated_parts = [], 0, []
        
        for t in tokens:
            surface = t.surface(); raw_reading = jaconv.kata2hira(t.reading_form())
            is_pure = is_pure_kana_or_punct(surface)
            reading_for_word = surface if is_pure or raw_reading == surface else raw_reading
            
            if is_pure or raw_reading == surface: full_annotated_parts.append(surface)
            else: full_annotated_parts.append(f"{surface}[{raw_reading}]")
            
            word_start, word_end, temp_idx, chars_found = None, None, current_char_idx, 0
            while temp_idx < len(char_times) and chars_found < len(surface.strip()):
                if char_times[temp_idx]["char"].isspace() and not surface[chars_found].isspace():
                    temp_idx += 1; continue
                if word_start is None: word_start = char_times[temp_idx]["start"]
                word_end = char_times[temp_idx]["end"]; chars_found += 1; temp_idx += 1
            current_char_idx = temp_idx
            
            if word_start is None: word_start, word_end = float(segment.start), float(segment.end)
            formatted_words.append({"word": surface, "reading": reading_for_word, "start": round(word_start, 2), "end": round(word_end, 2), "score": 1.0})
            
        formatted_segments.append({
            "start": float(segment.start), 
            "end": float(segment.end), 
            "text": segment_text, 
            "annotated_text": "".join(full_annotated_parts), 
            "words": formatted_words
        })
    return {"segments": formatted_segments}

def run_transcription_blocking(audio_path: str, whisper_model: WhisperModel):
    log_info(f"Starting transcription for {audio_path}...")
    if whisper_model is None: raise RuntimeError("Whisper model not loaded")
    segments, _ = whisper_model.transcribe(audio_path, language="ja", word_timestamps=True)
    return format_whisper_output(list(segments))


def transcribe_to_cache(audio_path: str, cache_path: str, model: WhisperModel):
    resolved_audio = resolve_backend_path(audio_path)
    resolved_cache = Path(cache_path)
    if not resolved_cache.is_absolute():
        resolved_cache = resolve_backend_path(resolved_cache)
    resolved_cache.parent.mkdir(parents=True, exist_ok=True)
    result = run_transcription_blocking(str(resolved_audio), model)
    with resolved_cache.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
    return result


async def process_transcription_task(media_id: str, audio_path: str, cache_path: str, model: WhisperModel):
    try:
        async with TRANSCRIPTION_SEMAPHORE:
            TRANSCRIPTION_TASKS[media_id]["status"] = "processing"
            result = await asyncio.to_thread(lambda: transcribe_to_cache(audio_path, cache_path, model))
            TRANSCRIPTION_TASKS[media_id].update({
                "status": "completed", "completed_at": datetime.utcnow().isoformat(), "result_path": cache_path
            })
    except Exception as e:
        TRANSCRIPTION_TASKS[media_id].update({"status": "error", "error": str(e)})
        log_info(f"Transcription failed for {media_id}: {e}")
