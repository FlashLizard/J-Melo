import re
import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException
from core.config import ADMIN_CONFIG
from core.utils import parse_utaten_line_to_tokens

async def search_utaten(q: str):
    async with httpx.AsyncClient(proxy=ADMIN_CONFIG.get("proxy")) as client:
        try:
            res = await client.get(f"https://utaten.com/search?sort=popular_sort_asc&artist_name=&title={q}", headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
            soup = BeautifulSoup(res.text, 'html.parser'); results = []
            for row in soup.select("tr"):
                t_a = row.select_one(".searchResult__title a"); a_td = row.select_one(".searchResult__artist")
                if t_a and a_td: results.append({"title": t_a.get_text(strip=True), "artist": a_td.get_text(strip=True), "url": "https://utaten.com" + t_a.get("href")})
            return results
        except Exception as e: raise HTTPException(status_code=500, detail=str(e))

async def fetch_utaten(url: str):
    async with httpx.AsyncClient(proxy=ADMIN_CONFIG.get("proxy")) as client:
        try:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
            soup = BeautifulSoup(res.text, 'html5lib'); div = soup.select_one(".hiragana")
            if not div: raise HTTPException(status_code=404)
            def process(e):
                c, f = "", ""
                for child in e.children:
                    if isinstance(child, str): c += child; f += child
                    elif child.name == "br": c += "\n"; f += "\n"
                    elif child.name in ["ruby", "span"] and ("ruby" in child.get("class", []) or child.name == "ruby"):
                        rb = child.select_one(".rb") or child; rt = child.select_one(".rt") or child.select_one("rt")
                        rb_t = "".join([i if isinstance(i, str) else i.get_text() for i in rb.children if getattr(i, 'name', None) != 'rt']) if rb.name == 'ruby' else rb.get_text()
                        rt_t = rt.get_text().strip() if rt else ""
                        c += rb_t; f += f"{rb_t}[{rt_t}]" if rt_t else rb_t
                    elif hasattr(child, 'children'): cp, fp = process(child); c += cp; f += fp
                return c, f
            _, furi_text = process(div)
            furi_clean = re.sub(r'\n{3,}', '\n\n', "\n".join([line.strip() for line in furi_text.split("\n")])).strip()
            data = []
            for l in furi_clean.split('\n'):
                if l.strip(): data.append({"text": re.sub(r'\[[^\]]+\]', '', l), "tokens": parse_utaten_line_to_tokens(l), "startTime": 0, "endTime": 0, "translation": ""})
            return {"lyrics_data": data, "furigana_text": furi_clean}
        except Exception as e: raise HTTPException(status_code=500, detail=str(e))
