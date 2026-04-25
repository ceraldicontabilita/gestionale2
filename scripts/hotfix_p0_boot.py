#!/usr/bin/env python3
"""
Hotfix P0 boot/build Ceraldi ERP.

Patch minimale e conservativa: NON sovrascrive interi file e NON rimuove
feature. Corregge pattern bloccanti introdotti da commit recenti:

1. app/routers/tfr.py: import List mancante.
2. Tutto frontend/src: identificatore JS non valido fmt€ -> fmtEuro.
3. Tutto frontend/src: import errato ../lib/api -> ../api.

Uso:
    python scripts/hotfix_p0_boot.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend" / "src"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_text_file(path: Path, replacements: list[tuple[str, str]]) -> bool:
    if not path.exists():
        print(f"[SKIP] {path.relative_to(ROOT)}: file non trovato")
        return False
    text = read(path)
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text == original:
        return False
    write(path, text)
    print(f"[FIX] {path.relative_to(ROOT)}")
    return True


def iter_frontend_files():
    if not FRONTEND_SRC.exists():
        return
    for path in FRONTEND_SRC.rglob("*"):
        if path.is_file() and path.suffix in {".js", ".jsx", ".ts", ".tsx"}:
            if any(part in {"node_modules", "dist", "build"} for part in path.parts):
                continue
            yield path


def main() -> int:
    changed = False

    # Backend P0: NameError all'avvio FastAPI.
    changed |= patch_text_file(
        ROOT / "app" / "routers" / "tfr.py",
        [
            (
                "from typing import Dict, Any, Optional",
                "from typing import Dict, Any, Optional, List",
            ),
        ],
    )

    # Frontend P0: esbuild/Vite non accetta identificatori con simbolo euro.
    # Patch globale per evitare che emerga un terzo file dopo build.
    for path in iter_frontend_files() or []:
        changed |= patch_text_file(
            path,
            [
                ("function fmt€(", "function fmtEuro("),
                ("const fmt€ =", "const fmtEuro ="),
                ("let fmt€ =", "let fmtEuro ="),
                ("var fmt€ =", "var fmtEuro ="),
                ("fmt€(", "fmtEuro("),
            ],
        )

    # Frontend P0: api client reale sta in frontend/src/api.js, non lib/api.
    # Patch globale per evitare lista hardcoded incompleta.
    for path in iter_frontend_files() or []:
        changed |= patch_text_file(
            path,
            [
                ("from '../lib/api'", "from '../api'"),
                ('from "../lib/api"', 'from "../api"'),
                ("from '../../lib/api'", "from '../../api'"),
                ('from "../../lib/api"', 'from "../../api"'),
            ],
        )

    if changed:
        print("[DONE] Hotfix P0 applicati. Eseguire build/test e poi commit.")
    else:
        print("[DONE] Nessuna modifica applicata: i pattern P0 sembrano gia' corretti.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
