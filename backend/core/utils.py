import os
import re
import jaconv
from sudachipy import dictionary, tokenizer
from datetime import datetime

# --- Sudachi Initialization ---
try:
    sudachi_dict = dictionary.Dictionary(dict="full")
    sudachi_tokenizer = sudachi_dict.create()
except Exception as e:
    print(f"WARNING: Could not load Sudachi 'full' dictionary. Falling back to default: {e}")
    sudachi_dict = dictionary.Dictionary()
    sudachi_tokenizer = sudachi_dict.create()

sudachi_split_mode = tokenizer.Tokenizer.SplitMode.C

def log_info(message: str):
    """Prints a message to the console with a timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def is_pure_kana_or_punct(s: str) -> bool:
    """Checks if a string consists only of Hiragana, Katakana, Punctuation or whitespace."""
    pattern = r'^[\u3040-\u309f\u30a0-\u30ff\u30fc\u3000-\u303f\s\u0020-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e！-～]+$'
    return bool(re.match(pattern, s))

def get_script_type(char: str):
    """Identifies the script type of a single character."""
    code = ord(char)
    if (0x4e00 <= code <= 0x9faf) or code == 0x3005: return 'kanji'
    if 0x3040 <= code <= 0x309f: return 'hiragana'
    if (0x30a0 <= code <= 0x30ff) or code == 0x30fc: return 'katakana'
    if (0x0041 <= code <= 0x005a) or (0x0061 <= code <= 0x007a) or (0x0030 <= code <= 0x0039): return 'latin-num'
    return 'other'

def parse_utaten_line_to_tokens(line_text: str) -> list:
    """
    Advanced character-level reading reconstruction algorithm:
    1. Identify all bracketed readings and their true surfaces by looking backwards.
    2. Build a 1:1 character-to-reading map.
    3. Use Sudachi for professional tokenization.
    4. Reconstruct token readings from the map, merging Sudachi tokens that hit locked units.
    """
    if not line_text: return []

    matches = list(re.finditer(r'\[([^\]]+)\]', line_text))
    locked_units = []
    
    for m in matches:
        reading = m.group(1)
        bracket_start = m.start()
        ptr = bracket_start - 1
        if ptr < 0: continue
        
        surface = ""
        if get_script_type(line_text[ptr]) in ['hiragana', 'katakana', 'latin-num']:
            while ptr >= 0 and get_script_type(line_text[ptr]) in ['hiragana', 'katakana', 'latin-num']:
                surface = line_text[ptr] + surface
                ptr -= 1
        while ptr >= 0 and get_script_type(line_text[ptr]) == 'kanji':
            surface = line_text[ptr] + surface
            ptr -= 1
            
        if surface:
            locked_units.append({
                "raw_start": ptr + 1,
                "raw_end": m.end(),
                "surface": surface,
                "reading": reading
            })

    clean_text = ""
    char_readings = []
    i = 0
    while i < len(line_text):
        matching_unit = next((u for u in locked_units if u["raw_start"] == i), None)
        if matching_unit:
            matching_unit["clean_start"] = len(clean_text)
            for idx, s_char in enumerate(matching_unit["surface"]):
                clean_text += s_char
                char_readings.append(matching_unit["reading"] if idx == 0 else "")
            matching_unit["clean_end"] = len(clean_text)
            i = matching_unit["raw_end"]
        else:
            char = line_text[i]
            if char not in '[]':
                clean_text += char
                char_readings.append(char)
            i += 1

    r2_tokens = sudachi_tokenizer.tokenize(clean_text, sudachi_split_mode)
    
    final_tokens = []
    t_idx = 0
    while t_idx < len(r2_tokens):
        t2 = r2_tokens[t_idx]
        t2_start, t2_end = t2.begin(), t2.end()
        intersecting_lock = next((l for l in locked_units if not (l["clean_end"] <= t2_start or l["clean_start"] >= t2_end)), None)
        
        if not intersecting_lock:
            final_tokens.append({
                "surface": t2.surface(),
                "reading": "".join(char_readings[t2_start:t2_end]),
                "startTime": 0, "endTime": 0
            })
            t_idx += 1
        else:
            m_start = min(t2_start, intersecting_lock["clean_start"])
            m_end = max(t2_end, intersecting_lock["clean_end"])
            next_t_idx = t_idx + 1
            while next_t_idx < len(r2_tokens):
                nt = r2_tokens[next_t_idx]
                if nt.begin() < m_end:
                    m_end = max(m_end, nt.end())
                    next_t_idx += 1
                else: break
            
            final_tokens.append({
                "surface": clean_text[m_start:m_end],
                "reading": "".join(char_readings[m_start:m_end]),
                "startTime": 0, "endTime": 0
            })
            t_idx = next_t_idx
            
    return final_tokens

def annotate_japanese_text(text: str) -> str:
    """Annotates text with furigana for words containing Kanji."""
    if not text: return ""
    lines = text.splitlines()
    annotated_lines = []
    for line in lines:
        if not line.strip(): annotated_lines.append(line); continue
        tokens = sudachi_tokenizer.tokenize(line, sudachi_split_mode)
        result = []
        for t in tokens:
            surface = t.surface()
            if is_pure_kana_or_punct(surface): result.append(surface)
            else:
                reading = jaconv.kata2hira(t.reading_form())
                result.append(f"{surface}[{reading}]" if reading != surface else surface)
        annotated_lines.append("".join(result))
    return "\n".join(annotated_lines)

def get_dir_size(path='.'):
    total_size, file_count = 0, 0
    if not os.path.exists(path): return 0, 0
    for entry in os.scandir(path):
        if entry.is_file():
            total_size += entry.stat().st_size
            file_count += 1
        elif entry.is_dir():
            size, count = get_dir_size(entry.path)
            total_size += size
            file_count += count
    return total_size, file_count

def get_queue_position(target_id: str, task_dict: dict) -> int:
    """Calculate position in the pending queue."""
    pending_tasks = [tid for tid, task in task_dict.items() if task.get("status") == "pending"]
    pending_tasks.sort(key=lambda tid: task_dict[tid].get("started_at", ""))
    try: return pending_tasks.index(target_id)
    except ValueError: return 0
