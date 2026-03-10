import os
import re
import jaconv
from sudachipy import dictionary, tokenizer
from datetime import datetime
import sudachipy

# --- Sudachi Initialization ---
try:
    sudachi_dict = dictionary.Dictionary(dict="full")
    sudachi_tokenizer = sudachi_dict.create()
except Exception as e:
    print(f"WARNING: Could not load Sudachi 'full' dictionary. Falling back to default: {e}")
    sudachi_dict = dictionary.Dictionary()
    sudachi_tokenizer = sudachi_dict.create()

# Keep C as global default for alignment/transcription logic
sudachi_split_mode = sudachipy.tokenizer.Tokenizer.SplitMode.C

def log_info(message: str):
    """Prints a message to the console with a timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_script_type(char: str):
    """Identifies the script type of a single character (Kanji, Hiragana, etc.)."""
    code = ord(char)
    if (0x4e00 <= code <= 0x9faf) or code == 0x3005: return 'kanji'
    if 0x3040 <= code <= 0x309f: return 'hiragana'
    if (0x30a0 <= code <= 0x30ff) or code == 0x30fc: return 'katakana'
    return 'other'

def contains_kanji(s: str) -> bool:
    """Checks if a string contains at least one Kanji character."""
    return any(get_script_type(c) == 'kanji' for c in s)

def is_pure_kana_or_punct(s: str) -> bool:
    """Checks if a string consists only of Hiragana, Katakana, Punctuation or whitespace."""
    if not s: return False
    # Inclusive pattern covering standard Japanese punctuation
    pattern = r'^[\u3040-\u309f\u30a0-\u30ff\u30fc\u3000-\u303f\s\u0020-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e！-～？、。，]+$'
    return bool(re.match(pattern, s))

def annotate_japanese_text(text: str) -> str:
    """
    Annotates text with furigana, strictly following verify_lyrics.py logic.
    Uses SplitMode.A and prefix/suffix trimming.
    """
    if not text: return ""
    lines = text.splitlines()
    annotated_lines = []
    for line in lines:
        if not line.strip(): annotated_lines.append(line); continue
        # Must use SplitMode.A for accurate Kanji extraction per verify_lyrics.py
        tokens = sudachi_tokenizer.tokenize(line, sudachipy.tokenizer.Tokenizer.SplitMode.A)
        result = []
        for t in tokens:
            surface = t.surface()
            pos = t.part_of_speech()
            reading_form = t.reading_form()
            
            # POS and Reading logic matching verify_lyrics.py
            if pos[0] in ["补助记号", "補助記号", "空白", "记号", "記号", "助词", "助詞", "助动词", "助動詞"]:
                reading = surface
            elif reading_form:
                reading = jaconv.kata2hira(reading_form)
            else:
                reading = surface
                
            annotated_surface = surface
            # Only annotate if contains Kanji and reading is valid Kana and different from surface
            if contains_kanji(surface) and is_pure_kana_or_punct(reading) and reading != surface:
                # Trimming algorithm from verify_lyrics.py
                start = 0
                while start < len(surface) and start < len(reading) and surface[start] == reading[start]:
                    start += 1
                end_s, end_r = len(surface), len(reading)
                while end_s > start and end_r > start and surface[end_s-1] == reading[end_r-1]:
                    end_s -= 1
                    end_r -= 1
                
                if start > 0 or end_s < len(surface):
                    prefix, suffix = surface[:start], surface[end_s:]
                    mid_s, mid_r = surface[start:end_s], reading[start:end_r]
                    if mid_s and is_pure_kana_or_punct(mid_r):
                        annotated_surface = f"{prefix}{mid_s}[{mid_r}]{suffix}"
                    else:
                        annotated_surface = f"{surface}[{reading}]"
                else:
                    annotated_surface = f"{surface}[{reading}]"
            
            result.append(annotated_surface)
        annotated_lines.append("".join(result))
    return "\n".join(annotated_lines)

def parse_utaten_line_to_tokens(line_text: str) -> list:
    """
    Robust linear parser that respects bracket boundaries and Sudachi A tokenization.
    Matches verify_lyrics.py's expected output structure by locking segments followed by brackets.
    """
    if not line_text: return []
    
    # Split by brackets while keeping them in the result list
    parts = re.split(r'(\[[^\]]+\])', line_text)
    final_tokens = []
    
    for i in range(len(parts)):
        part = parts[i]
        if not part: continue
        
        if part.startswith('[') and part.endswith(']'):
            # This is a reading for the immediate previous token
            reading = part[1:-1]
            if final_tokens:
                final_tokens[-1]['reading'] = reading
        else:
            # Check if this text segment is followed by a bracket.
            # If so, treat the segment as a single "locked" surface to prevent internal splitting.
            if i + 1 < len(parts) and parts[i+1].startswith('['):
                final_tokens.append({
                    "surface": part,
                    "reading": part, # Will be replaced by bracket content in next iteration
                    "startTime": 0, "endTime": 0
                })
            else:
                # Not followed by a bracket, tokenize normally with Sudachi A for consistency
                sub_tokens = sudachi_tokenizer.tokenize(part, sudachipy.tokenizer.Tokenizer.SplitMode.A)
                for st in sub_tokens:
                    s = st.surface()
                    final_tokens.append({
                        "surface": s,
                        "reading": s,
                        "startTime": 0, "endTime": 0
                    })
    return final_tokens

def get_dir_size(path='.'):
    total_size, file_count = 0, 0
    if not os.path.exists(path): return 0, 0
    for entry in os.scandir(path):
        if entry.is_file(): total_size += entry.stat().st_size; file_count += 1
        elif entry.is_dir(): size, count = get_dir_size(entry.path); total_size += size; file_count += count
    return total_size, file_count

def get_queue_position(target_id: str, task_dict: dict) -> int:
    pending_tasks = [tid for tid, task in task_dict.items() if task.get("status") == "pending"]
    pending_tasks.sort(key=lambda tid: task_dict[tid].get("started_at", ""))
    try: return pending_tasks.index(target_id)
    except ValueError: return 0
