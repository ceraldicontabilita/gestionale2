#!/usr/bin/env python3
"""
Hotfix P0 boot/build Ceraldi ERP.

Corregge solo bug bloccanti noti:
1. app/routers/tfr.py: import List mancante.
2. HRDipendenti/HRPrimaNotaSalari: identificatore JS non valido fmt€ -> fmtEuro.
3. Modali dipendenti/giustificativi: import errato ../lib/api -> ../api.

Uso:
    python scripts/hotfix_p0_boot.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_file(path: str, replacements: list[tuple[str, str]]) -> bool:
    p = ROOT / path
    if not p.exists():
        print(f"[SKIP] {path}: file non trovato")
        return False
    text = p.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text == original:
        print(f"[OK] {path}: nessuna modifica necessaria")
        return False
    p.write_text(text, encoding="utf-8")
    print(f"[FIX] {path}")
    return True


def main() -> int:
    changed = False

    changed |= patch_file(
        "app/routers/tfr.py",
        [
            (
                "from typing import Dict, Any, Optional",
                "from typing import Dict, Any, Optional, List",
            ),
        ],
    )

    # Il carattere euro non e' sicuro come identificatore JS in build Vite/esbuild.
    for path in [
        "frontend/src/pages/hr/HRDipendenti.jsx",
        "frontend/src/pages/hr/HRPrimaNotaSalari.jsx",
    ]:
        changed |= patch_file(
            path,
            [
                ("function fmt€(", "function fmtEuro("),
                ("fmt€(", "fmtEuro("),
            ],
        )

    for path in [
        "frontend/src/components/BatchGiustificativoModal.jsx",
        "frontend/src/components/ImportDipendentiModal.jsx",
    ]:
        changed |= patch_file(
            path,
            [
                ("from '../lib/api'", "from '../api'"),
                ('from "../lib/api"', 'from "../api"'),
            ],
        )

    if changed:
        print("[DONE] Hotfix P0 applicati. Eseguire build/test e poi commit.")
    else:
        print("[DONE] Nessuna modifica applicata: i file sembrano gia' corretti.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
