import os
import re

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Scrapling Service", version="1.0.0")

SCRAPLING_SECRET = os.environ.get("SCRAPLING_SECRET", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


class ScrapeRequest(BaseModel):
    url: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/scrape")
async def scrape(req: ScrapeRequest, x_internal_secret: str = Header(None)):
    if not SCRAPLING_SECRET or x_internal_secret != SCRAPLING_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing secret")

    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20, verify=False) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()

        return {"title": title, "text": text, "url": req.url}
    except Exception as e:
        return {"error": str(e), "url": req.url}
