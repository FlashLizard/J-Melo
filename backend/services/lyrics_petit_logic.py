import asyncio
import base64
import xml.etree.ElementTree as ET
import re
import traceback
import httpx
import numpy as np
import io
import html  # 新增：用于处理网页元数据中的 HTML 转义符
import jaconv
from sudachipy import dictionary, tokenizer
from fastapi import HTTPException
from core.utils import log_info
from services.network import async_client, normalize_non_empty_query

PETIT_LYRICS_API_URL = 'https://on.petitlyrics.com/api/GetPetitLyricsData.php'
PETIT_LYRICS_INDEX_CONCURRENCY = 5

REQUEST_BODY_BASE = {
    'sdkVer': '1.3.4',
    'userId': '642bbdc6-128a-4b67-a10b-bc09191b0cfe',
    'appName': 'HF Player',
    'pkgName': 'com.onkyo.jp.musicplayer',
    'clientAppId': 'on354007',
    'logFlag': '0',
    'verCode': '212',
    'verName': '2.7.0',
    'terminalType': '0'
}

REQUEST_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 5.1.1; LM-G820UM Build/LMY48Z)'
}


def _validate_lyrics_id(lyrics_id: str) -> str:
    normalized = (lyrics_id or "").strip()
    if not normalized.isdigit():
        raise HTTPException(status_code=400, detail="PetitLyrics lyrics_id must be numeric")
    return normalized

# --- Sudachi Initialization ---
try:
    sudachi_dict = dictionary.Dictionary(dict="full")
    sudachi_tokenizer = sudachi_dict.create()
except Exception as e:
    print(f"Fallback to default dict: {e}")
    sudachi_dict = dictionary.Dictionary()
    sudachi_tokenizer = sudachi_dict.create()

def get_script_type(char: str):
    code = ord(char)
    if (0x4e00 <= code <= 0x9faf) or code == 0x3005: return 'kanji'
    if 0x3040 <= code <= 0x309f: return 'hiragana'
    if (0x30a0 <= code <= 0x30ff) or code == 0x30fc: return 'katakana'
    return 'other'

def contains_kanji(s: str) -> bool:
    return any(get_script_type(c) == 'kanji' for c in s)

def is_pure_kana_or_punct(s: str) -> bool:
    if not s: return False
    pattern = r'^[\u3040-\u309f\u30a0-\u30ff\u30fc\u3000-\u303f\s\u0020-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e！-～]+$'
    return bool(re.match(pattern, s))

def ms_to_seconds(ms):
    return round(int(ms) / 1000.0, 2)

def _node_text(node: ET.Element, child_name: str) -> str:
    child = node.find(child_name)
    return child.text.strip() if child is not None and child.text else ""

def _duration_ms_to_seconds(raw_duration: str) -> float | None:
    if not raw_duration:
        return None
    try:
        duration_ms = int(raw_duration)
    except (TypeError, ValueError):
        return None
    if duration_ms <= 0:
        return None
    return round(duration_ms / 1000.0, 2)

def lsy_decoder(lsy_base64_lyric, lyrics_text_base64):
    """Decodes PetitLyrics Type 2 (LSY) format into timestamps and text lines."""
    try:
        lyric_unsynced = base64.b64decode(lyrics_text_base64).decode("UTF-8")
        clean_lines =[l.strip() for l in lyric_unsynced.splitlines() if l.strip() and not re.match(r'^\[[a-z]+:', l.strip())]
        lyric_line_reader = iter(clean_lines)
        
        lyrics_encrypted = base64.b64decode(lsy_base64_lyric)
        protection_id = np.uint16(int.from_bytes(lyrics_encrypted[0x1a:0x1a+2], byteorder='little', signed=False))
        protection_key_switch_flag = bool(lyrics_encrypted[0x19])
        protection_key = protection_id

        if protection_key_switch_flag:
            A, B, C, D, E, F, G, H =[np.uint16(x) for x in[0x3, 0xc, 0x30, 0xc0, 0x300, 0xc00, 0x3000, 0xc000]]
            protection_key = (protection_key & A) | (protection_key & B) << 2 | (protection_key & C) >> 2 | \
                             (protection_key & D) << 2 | (protection_key & E) >> 2 | (protection_key & F) << 2 | \
                             (protection_key & G) >> 2 | (protection_key & H)

        line_count = int.from_bytes(lyrics_encrypted[0x38:0x38+4], byteorder='little', signed=False)
        elapsed_time_cs = 0
        results =[]

        for line_idx in range(line_count):
            time_begin_byteindex = line_idx * 2 + 0xcc
            if time_begin_byteindex + 2 > len(lyrics_encrypted): break
            time_raw = int.from_bytes(lyrics_encrypted[time_begin_byteindex:time_begin_byteindex+2], byteorder='little', signed=False)
            time_cs = int(time_raw) ^ int(protection_key)
            
            time_cs = (time_cs % 65536) + 65536 * (elapsed_time_cs // 65536)
            if time_cs < elapsed_time_cs:
                time_cs += 65536
            
            elapsed_time_cs = time_cs
            seconds = ms_to_seconds(10 * time_cs)
            
            try:
                line_text = next(lyric_line_reader)
                results.append({"startTime": seconds, "text": line_text})
            except StopIteration:
                break
        
        for i in range(len(results)):
            if i < len(results) - 1:
                results[i]["endTime"] = results[i+1]["startTime"]
            else:
                results[i]["endTime"] = results[i]["startTime"] + 5.0
                
        return results
    except Exception:
        log_info(f"LSY Decoder Error: {traceback.format_exc()}")
        return[]

# --- 完美并发版的 API 拉取助手 ---
async def _fetch_from_api(client: httpx.AsyncClient, title: str, artist: str, lyrics_type: str, max_items: int = 15):
    """并发拉取 API 的多个 index，突破官方一次只返回 1 条的限制，消除 404 及返回数量缺失问题"""
    body = REQUEST_BODY_BASE.copy()
    body.update({
        'key_title': title,
        'key_artist': artist,
        'index': '0',
        'lyricsType': lyrics_type
    })
    
    try:
        resp = await client.post(PETIT_LYRICS_API_URL, data=body, headers=REQUEST_HEADERS, timeout=15.0)
        if resp.status_code != 200: return[]
            
        root = ET.fromstring(resp.text)
        songs_node = root.find('songs')
        if songs_node is None: return[]
            
        songs = songs_node.findall('song')
        if not songs: return[]
        
        matched_node = songs_node.find('matchedCount')
        try:
            matched_count = int(matched_node.text) if matched_node is not None and matched_node.text else 1
        except ValueError:
            matched_count = len(songs)
        
        results = list(songs)
        
        if len(results) < matched_count and len(results) < max_items:
            fetch_limit = min(matched_count, max_items)
            
            semaphore = asyncio.Semaphore(PETIT_LYRICS_INDEX_CONCURRENCY)

            async def fetch_single_index(idx: int):
                req_body = REQUEST_BODY_BASE.copy()
                req_body.update({
                    'key_title': title,
                    'key_artist': artist,
                    'index': str(idx),
                    'lyricsType': lyrics_type
                })
                try:
                    async with semaphore:
                        r = await client.post(PETIT_LYRICS_API_URL, data=req_body, headers=REQUEST_HEADERS, timeout=15.0)
                    if r.status_code == 200:
                        r_root = ET.fromstring(r.text)
                        s_node = r_root.find('songs')
                        if s_node is not None:
                            return s_node.findall('song')
                except Exception:
                    pass
                return[]

            tasks =[fetch_single_index(i) for i in range(1, fetch_limit)]
            if tasks:
                extra_results = await asyncio.gather(*tasks)
                for res_list in extra_results:
                    if res_list:
                        results.extend(res_list)
                        
        return results
    except Exception as e:
        log_info(f"API fetch error: {str(e)}")
        return[]

async def search_petitlyrics(title: str, artist: str = ""):
    title = normalize_non_empty_query(title)
    artist = (artist or "").strip()[:200]
    async with async_client(timeout_seconds=20.0) as client:
        try:
            songs = await _fetch_from_api(client, title, artist, '1', max_items=15)
            results =[]
            seen_ids = set()
            
            for song in songs:
                lid_node = song.find('lyricsId')
                if lid_node is None or not lid_node.text: continue
                
                lid = lid_node.text
                if lid in seen_ids: continue
                seen_ids.add(lid)
                
                avail_node = song.find('availableLyricsType')
                avail_types = avail_node.text if avail_node is not None and avail_node.text else "1"
                
                duration_seconds = _duration_ms_to_seconds(_node_text(song, 'duration'))
                
                results.append({
                    'lyricsId': lid,
                    'title': _node_text(song, 'title'),
                    'artist': _node_text(song, 'artist'),
                    'album': _node_text(song, 'album'),
                    'duration': duration_seconds,
                    'lyricsType': 'word' if '3' in avail_types else ('sentence' if '2' in avail_types else 'none')
                })
                
            return results
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=500, detail=str(e))

async def fetch_petitlyrics_data(lyrics_id: str):
    lyrics_id = _validate_lyrics_id(lyrics_id)
    async with async_client(timeout_seconds=20.0) as client:
        try:
            # 1. Get Metadata
            web_url = f"https://petitlyrics.com/lyrics/{lyrics_id}"
            web_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
            }
            
            web_resp = None
            for attempt in range(3):
                try:
                    web_resp = await client.get(web_url, headers=web_headers, timeout=20.0)
                    if web_resp.status_code == 200: break
                except httpx.RequestError as e:
                    if attempt == 2: raise HTTPException(status_code=504, detail=f"Timeout fetching HTML: {str(e)}")
            
            if not web_resp or web_resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Lyric page not found")
            
            # 【核心修复 1】: 提取 Metadata 时进行 html.unescape() 还原真实字符串
            title, artist = "", ""
            og_match = re.search(r'<meta property="og:title" content="(.*?)">', web_resp.text)
            if og_match:
                content = html.unescape(og_match.group(1).strip())
                if " / " in content:
                    title, artist = content.rsplit(" / ", 1)
                else:
                    title = content
            else:
                title_match = re.search(r'<title>\s*(.*?)(?:\s*/\s*(.*?))?\s*｜', web_resp.text)
                if title_match:
                    title = html.unescape(title_match.group(1).strip())
                    artist = html.unescape(title_match.group(2).strip()) if title_match.group(2) else ""
            
            if not title: raise HTTPException(status_code=500, detail="Failed to parse metadata from page")

            # 2. Fetch Timing and Text 
            target_song = None
            target_type = 0
            
            songs_3 = await _fetch_from_api(client, title, artist, '3', max_items=30)
            target_song = next((s for s in songs_3 if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)
            
            if target_song is not None:
                target_type = 3
            else:
                songs_2 = await _fetch_from_api(client, title, artist, '2', max_items=30)
                target_song = next((s for s in songs_2 if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)
                if target_song is not None:
                    target_type = 2

            # 【核心修复 2】: 究极容错降级。如果带 artist 找不到，很可能是网页的 artist 名字和 API 数据库内部对不上，去掉 artist 再狂扫一遍！
            if target_song is None and artist:
                log_info(f"Fallback: Searching without artist for title '{title}'...")
                songs_3_fallback = await _fetch_from_api(client, title, "", '3', max_items=30)
                target_song = next((s for s in songs_3_fallback if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)
                if target_song is not None:
                    target_type = 3
                else:
                    songs_2_fallback = await _fetch_from_api(client, title, "", '2', max_items=30)
                    target_song = next((s for s in songs_2_fallback if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)
                    if target_song is not None:
                        target_type = 2

            if target_song is None:
                raise HTTPException(status_code=404, detail="Lyric data not found after API search")

            lyrics_data_node = target_song.find('lyricsData')
            lyrics_base64 = lyrics_data_node.text if lyrics_data_node is not None else ""
            if not lyrics_base64:
                raise HTTPException(status_code=404, detail="Empty encrypted lyrics data")

            txt_base64 = ""
            if target_type == 2:
                songs_1 = await _fetch_from_api(client, title, artist, '1', max_items=30)
                ts1 = next((s for s in songs_1 if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)
                
                # 同样的无 artist 降级搜索应用给 txt 获取
                if ts1 is None and artist:
                    songs_1_fb = await _fetch_from_api(client, title, "", '1', max_items=30)
                    ts1 = next((s for s in songs_1_fb if s.find('lyricsId') is not None and s.find('lyricsId').text == str(lyrics_id)), None)

                if ts1 is not None:
                    t1_node = ts1.find('lyricsData')
                    txt_base64 = t1_node.text if t1_node is not None else ""

            # --- 全新时间提取层 ---
            raw_lines =[]
            if target_type == 3: # WSY
                xml_data = base64.b64decode(lyrics_base64).decode("UTF-8")
                tree = ET.fromstring(xml_data)
                for line_node in tree.findall('line'):
                    words = line_node.findall('word')
                    if not words: continue
                    line_start = ms_to_seconds(words[0].find('starttime').text)
                    line_end = ms_to_seconds(words[-1].find('endtime').text)
                    
                    char_times =[]
                    for w in words:
                        w_text = w.find('wordstring').text or ""
                        w_start = ms_to_seconds(w.find('starttime').text)
                        w_end = ms_to_seconds(w.find('endtime').text)
                        w_len = len(w_text)
                        if w_len == 0: continue
                        
                        for i, char in enumerate(w_text):
                            c_start = w_start + (w_end - w_start) * (i / w_len)
                            c_end = w_start + (w_end - w_start) * ((i + 1) / w_len)
                            char_times.append({"char": char, "start": c_start, "end": c_end})
                            
                    text = "".join(c["char"] for c in char_times)
                    raw_lines.append({"startTime": line_start, "endTime": line_end, "text": text, "char_times": char_times})
                    
            elif target_type == 2 and txt_base64: # LSY
                lsy_results = lsy_decoder(lyrics_base64, txt_base64)
                for line in lsy_results:
                    raw_text = line["text"]
                    line_start = line["startTime"]
                    line_end = line["endTime"]
                    
                    char_times =[]
                    text_len = len(raw_text)
                    for i, char in enumerate(raw_text):
                        c_start = line_start + (line_end - line_start) * (i / text_len) if text_len > 0 else line_start
                        c_end = line_start + (line_end - line_start) * ((i + 1) / text_len) if text_len > 0 else line_end
                        char_times.append({"char": char, "start": c_start, "end": c_end})
                        
                    raw_lines.append({"startTime": line_start, "endTime": line_end, "text": raw_text, "char_times": char_times})

            if not raw_lines: raise HTTPException(status_code=500, detail="Generated raw_lines is empty")

            # 3. 基于精确字时间轴处理注音和重打包分词
            processed_lyrics =[]
            for line in raw_lines:
                char_times = line["char_times"]
                raw_text = line["text"]
                
                if not raw_text:
                    processed_lyrics.append({"startTime": line["startTime"], "endTime": line["endTime"], "text": "", "translation": "", "tokens":[]})
                    continue
                    
                tokens_out =[]
                sudachi_tokens = sudachi_tokenizer.tokenize(raw_text, tokenizer.Tokenizer.SplitMode.A)
                char_idx = 0
                
                for t in sudachi_tokens:
                    surface = t.surface()
                    pos = t.part_of_speech()
                    reading_form = t.reading_form()
                    
                    if pos[0] in["补助记号", "補助記号", "空白", "记号", "記号"]:
                        reading = surface
                    elif reading_form:
                        reading = jaconv.kata2hira(reading_form)
                    else:
                        reading = surface
                        
                    token_len = len(surface)
                    
                    if char_idx < len(char_times):
                        start_time = char_times[char_idx]['start']
                        end_idx = char_idx + token_len - 1
                        if end_idx < len(char_times):
                            end_time = char_times[end_idx]['end']
                        else:
                            end_time = char_times[-1]['end']
                            
                        if contains_kanji(surface) and is_pure_kana_or_punct(reading) and reading != surface:
                            start = 0
                            while start < len(surface) and start < len(reading) and surface[start] == reading[start]:
                                start += 1
                            end_s, end_r = len(surface), len(reading)
                            while end_s > start and end_r > start and surface[end_s-1] == reading[end_r-1]:
                                end_s -= 1
                                end_r -= 1
                                
                            if start > 0 or end_s < len(surface):
                                prefix = surface[:start]
                                mid_s = surface[start:end_s]
                                suffix = surface[end_s:]
                                mid_r = reading[start:end_r]
                                
                                current_idx = char_idx
                                if prefix:
                                    p_start = char_times[current_idx]['start']
                                    p_end = char_times[current_idx + len(prefix) - 1]['end']
                                    tokens_out.append({"surface": prefix, "reading": "", "startTime": round(p_start, 2), "endTime": round(p_end, 2)})
                                    current_idx += len(prefix)
                                    
                                if mid_s:
                                    m_start = char_times[current_idx]['start']
                                    m_end = char_times[current_idx + len(mid_s) - 1]['end']
                                    tokens_out.append({"surface": mid_s, "reading": mid_r if is_pure_kana_or_punct(mid_r) else "", "startTime": round(m_start, 2), "endTime": round(m_end, 2)})
                                    current_idx += len(mid_s)
                                    
                                if suffix:
                                    s_start = char_times[current_idx]['start']
                                    s_end = char_times[current_idx + len(suffix) - 1]['end']
                                    tokens_out.append({"surface": suffix, "reading": "", "startTime": round(s_start, 2), "endTime": round(s_end, 2)})
                            else:
                                tokens_out.append({"surface": surface, "reading": reading, "startTime": round(start_time, 2), "endTime": round(end_time, 2)})
                        else:
                            tokens_out.append({"surface": surface, "reading": reading if contains_kanji(surface) else "", "startTime": round(start_time, 2), "endTime": round(end_time, 2)})
                    
                    char_idx += token_len
                    
                processed_lyrics.append({
                    "startTime": line["startTime"], "endTime": line["endTime"],
                    "text": line["text"], "translation": "", "tokens": tokens_out
                })
                
            return processed_lyrics
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            log_info(f"PetitLyrics Fetch Error: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))
