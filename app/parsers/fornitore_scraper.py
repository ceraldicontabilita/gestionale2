"""
Web Scraper Schede Tecniche Fornitori — Ceraldi ERP
====================================================
Estrae dati di prodotto dal sito web del fornitore tramite:
  1. Selettori CSS salvati (adattivi per ogni sito)
  2. Fallback: analisi struttura comune (schema.org, microdata, OG tags)
  3. Fallback finale: Claude API per estrazione semantica

Dati estratti per ogni URL:
  Logistici:  quantità/cartone, peso prodotto, peso cartone
  Commerciali: prezzo cartone, prezzo unitario
  Prodotto:   ingredienti, allergeni, EAN, immagini

I selettori CSS/XPath vengono salvati per fornitore+prodotto
e riutilizzati nei run successivi (self-learning).

Dipendenze: httpx, beautifulsoup4, lxml
"""

import re
import json
import httpx
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


# ── Selettori comuni per e-commerce alimentare italiani ──
SELETTORI_COMUNI = {
    "prezzo": [
        ".price", ".prezzo", "[class*=price]", "[class*=prezzo]",
        "[itemprop=price]", "meta[property='og:price:amount']",
        ".woocommerce-Price-amount", ".product-price",
    ],
    "descrizione": [
        "[itemprop=description]", ".product-description",
        ".descrizione", "#description", ".tab-content",
        "meta[property='og:description']",
    ],
    "ingredienti": [
        "[class*=ingredienti]", "[class*=ingredient]",
        "[id*=ingredienti]", "[id*=ingredient]",
        ".composition", ".ingredienti", "#ingredienti",
        "[data-tab=ingredienti]",
    ],
    "peso": [
        "[class*=weight]", "[class*=peso]",
        "[data-weight]", "[itemprop=weight]",
        ".formato", ".grammatura", ".net-weight",
    ],
    "immagini": [
        "[itemprop=image]", ".product-image img",
        ".gallery img", ".woocommerce-product-gallery img",
        "meta[property='og:image']",
    ],
    "ean": [
        "[class*=ean]", "[class*=barcode]", "[data-ean]",
        "[itemprop=gtin13]", "[class*=gtin]",
    ],
    "pezzi_cartone": [
        "[class*=pezzi]", "[class*=pieces]", "[class*=cartone]",
        "[data-pcs]", "[data-pieces-per-box]",
    ],
}

# ── Regex per estrarre numeri da testo ───────────────────
RE_PREZZO = re.compile(r"(\d+[,.]\d{2})\s*€?")
RE_PESO_G = re.compile(r"(\d+(?:[,.]\d+)?)\s*g\b", re.I)
RE_PESO_KG = re.compile(r"(\d+(?:[,.]\d+)?)\s*kg\b", re.I)
RE_PZ_CARTONE = re.compile(r"(\d+)\s*(?:pz|pezzi|pieces)\s*(?:x|per)\s*(?:cartone|box|crt)", re.I)
RE_EAN = re.compile(r"\b(\d{13})\b")


def _estrai_numero(testo: str) -> Optional[float]:
    if not testo:
        return None
    testo = testo.replace(".", "").replace(",", ".")
    m = re.search(r"\d+\.?\d*", testo)
    return float(m.group()) if m else None


def _prova_selettori(soup, lista_sel: list[str]) -> str:
    """Prova una lista di selettori CSS, ritorna il primo testo trovato."""
    for sel in lista_sel:
        try:
            if sel.startswith("meta"):
                el = soup.select_one(sel)
                if el:
                    return el.get("content", "").strip()
            else:
                el = soup.select_one(sel)
                if el:
                    return el.get_text(strip=True)
        except Exception:
            continue
    return ""


def _estrai_immagini(soup, base_url: str) -> list[str]:
    imgs = []
    for sel in SELETTORI_COMUNI["immagini"]:
        try:
            if sel.startswith("meta"):
                el = soup.select_one(sel)
                if el:
                    src = el.get("content", "")
                    if src and src not in imgs:
                        imgs.append(src)
            else:
                for el in soup.select(sel)[:5]:
                    src = el.get("src") or el.get("data-src") or el.get("data-lazy-src", "")
                    if src:
                        src = urljoin(base_url, src)
                        if src not in imgs:
                            imgs.append(src)
        except Exception:
            continue
    return imgs[:8]


def _prova_schema_org(soup) -> dict:
    """Estrae dati strutturati schema.org (JSON-LD)."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
            if isinstance(data, list):
                data = data[0]
            tipo = data.get("@type", "")
            if "Product" in tipo or "FoodProduct" in tipo:
                offerta = data.get("offers", {})
                if isinstance(offerta, list):
                    offerta = offerta[0]
                return {
                    "prezzo": float(offerta.get("price", 0) or 0),
                    "valuta": offerta.get("priceCurrency", "EUR"),
                    "descrizione": data.get("description", ""),
                    "ean": data.get("gtin13") or data.get("gtin", ""),
                    "nome": data.get("name", ""),
                    "immagine": data.get("image", ""),
                }
        except Exception:
            continue
    return {}


async def scrapa_scheda_prodotto(
    url: str,
    selettori_salvati: Optional[dict] = None,
    timeout: int = 15,
) -> dict:
    """
    Scrapa un URL del sito fornitore e ritorna i dati del prodotto.
    Usa selettori salvati se disponibili, altrimenti usa i selettori comuni.
    """
    if not HAS_BS4:
        return {"errore": "beautifulsoup4 non installato", "url": url}

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; CeraldiERP/1.0; +https://ceraldiapp.it)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    }

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers=headers
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as e:
        return {"errore": str(e), "url": url, "stato": "errore"}

    soup = BeautifulSoup(html, "lxml" if True else "html.parser")
    base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"

    risultato = {
        "url": url,
        "stato": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "dati_estratti": {},
        "selettori_usati": {},
        "fonte_dati": "scraping",
    }

    dati = risultato["dati_estratti"]

    # ── 1) Schema.org JSON-LD (fonte più affidabile) ──────
    schema = _prova_schema_org(soup)
    if schema:
        dati["prezzo_unitario"] = schema.get("prezzo", 0)
        dati["valuta"] = schema.get("valuta", "EUR")
        dati["ingredienti"] = schema.get("descrizione", "")
        dati["codice_ean"] = schema.get("ean", "")
        if schema.get("immagine"):
            dati["immagini"] = [schema["immagine"]]

    # ── 2) Selettori salvati per questo fornitore ─────────
    sel = selettori_salvati or {}

    # ── 3) Prova selettori comuni + salvati ───────────────
    for campo, sels_default in SELETTORI_COMUNI.items():
        sels = [sel.get(campo)] + sels_default if sel.get(campo) else sels_default
        testo = _prova_selettori(soup, [s for s in sels if s])
        if testo and campo not in dati:
            dati[f"_raw_{campo}"] = testo

    # ── 4) Post-processing testi raw ─────────────────────
    # Prezzo
    if not dati.get("prezzo_unitario") and dati.get("_raw_prezzo"):
        m = RE_PREZZO.search(dati["_raw_prezzo"])
        if m:
            dati["prezzo_unitario"] = float(m.group(1).replace(",", "."))

    # Ingredienti
    if not dati.get("ingredienti") and dati.get("_raw_ingredienti"):
        dati["ingredienti"] = dati["_raw_ingredienti"][:2000]

    # Peso
    raw_peso = dati.get("_raw_peso", "")
    if raw_peso:
        m_g = RE_PESO_G.search(raw_peso)
        m_kg = RE_PESO_KG.search(raw_peso)
        if m_g:
            dati["peso_prodotto_g"] = int(float(m_g.group(1).replace(",", ".")))
        elif m_kg:
            dati["peso_prodotto_g"] = int(float(m_kg.group(1).replace(",", ".")) * 1000)

    # Pezzi per cartone
    testo_completo = soup.get_text(" ")
    m_pz = RE_PZ_CARTONE.search(testo_completo)
    if m_pz:
        dati["pezzi_per_cartone"] = int(m_pz.group(1))
        dati["quantita_per_cartone"] = int(m_pz.group(1))

    # EAN
    if not dati.get("codice_ean") and dati.get("_raw_ean"):
        m_ean = RE_EAN.search(dati["_raw_ean"])
        if m_ean:
            dati["codice_ean"] = m_ean.group(1)

    # Prezzo cartone
    if dati.get("prezzo_unitario") and dati.get("quantita_per_cartone"):
        dati["prezzo_cartone"] = round(
            dati["prezzo_unitario"] * dati["quantita_per_cartone"], 2
        )

    # Immagini
    if not dati.get("immagini"):
        dati["immagini"] = _estrai_immagini(soup, base_url)

    # Rimuovi campi _raw_
    dati_puliti = {k: v for k, v in dati.items() if not k.startswith("_raw_")}
    risultato["dati_estratti"] = dati_puliti

    return risultato


async def scrapa_con_claude_fallback(
    url: str,
    html: str,
    api_key: str,
) -> dict:
    """
    Fallback: se il CSS scraping non trova i dati chiave,
    usa Claude API per estrazione semantica dall'HTML.
    """
    if not api_key:
        return {}

    # Riduci HTML solo al body visibile (max 8000 chars)
    soup = BeautifulSoup(html, "html.parser")
    testo = soup.get_text(separator=" ", strip=True)[:8000]

    prompt = f"""Stai analizzando la pagina prodotto di un fornitore alimentare.
Estrai questi dati dal testo seguente e rispondi SOLO con JSON valido:

{{
  "prezzo_unitario": null,
  "prezzo_cartone": null,
  "pezzi_per_cartone": null,
  "peso_prodotto_g": null,
  "ingredienti": "",
  "allergeni": [],
  "codice_ean": ""
}}

TESTO:
{testo}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 500,
                    "messages": [{"role": "user", "content": prompt}],
                }
            )
            text = resp.json()["content"][0]["text"]
            text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(text)
    except Exception:
        return {}
