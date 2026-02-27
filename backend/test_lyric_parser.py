import re

def katakana_to_hiragana(text):
    res = ""
    for c in text:
        if 0x30A1 <= ord(c) <= 0x30F6:
            res += chr(ord(c) - 0x60)
        else:
            res += c
    return res

def get_script_type(char):
    code = ord(char)
    if 0x3040 <= code <= 0x309F: return 'hiragana'
    if 0x30A0 <= code <= 0x30FF: return 'katakana'
    # Include Kanji and iteration marks like 々 (0x3005)
    if (0x4E00 <= code <= 0x9FAF) or code == 0x3005: return 'kanji'
    if char.isspace(): return 'space'
    if ('a' <= char <= 'z' or 'A' <= char <= 'Z' or '0' <= char <= '9' or 
        0xFF01 <= code <= 0xFF5E):
        return 'alphanumeric'
    return 'punctuation'

def split_mixed_text(text):
    res = []
    current_type = None
    current_chunk = ""
    
    for char in text:
        char_type = get_script_type(char)
        if char_type == 'space':
            if current_chunk:
                res.append({'surface': current_chunk, 'reading': katakana_to_hiragana(current_chunk)})
                current_chunk = ""
            current_type = None
            continue
        
        if current_type is not None and char_type != current_type and current_chunk:
            res.append({'surface': current_chunk, 'reading': katakana_to_hiragana(current_chunk)})
            current_chunk = char
            current_type = char_type
        else:
            current_chunk += char
            current_type = char_type
            
    if current_chunk:
        res.append({'surface': current_chunk, 'reading': katakana_to_hiragana(current_chunk)})
    return res

def parse_line(line):
    tokens = []
    pattern = r'([^\s\[\]]+)\[([^\[\]]+)\]'
    parts = re.split(pattern, line)
    
    for i in range(0, len(parts), 3):
        plain_text = parts[i]
        
        if plain_text:
            tokens.extend(split_mixed_text(plain_text))

        if i + 1 < len(parts) and i + 2 < len(parts):
            surface = parts[i+1]
            reading = parts[i+2]
            
            idx = len(surface) - 1
            # Find where the kanji block that the reading belongs to starts
            while idx >= 0:
                if get_script_type(surface[idx]) in ['hiragana', 'katakana', 'punctuation']:
                    break
                idx -= 1
                
            if idx == len(surface) - 1:
                tokens.append({'surface': surface, 'reading': reading})
            elif idx == -1:
                tokens.append({'surface': surface, 'reading': reading})
            else:
                prefix = surface[:idx+1]
                target_kanji = surface[idx+1:]
                tokens.extend(split_mixed_text(prefix))
                tokens.append({'surface': target_kanji, 'reading': reading})
            
    return tokens

test_line = "もう抱[だ]き締[し]めなくて易々[いい]んだよ"
print(f"Testing line: {test_line}")
tokens = parse_line(test_line)
for t in tokens:
    print(t)
