#!/usr/bin/env python3
"""Valida los datos del noticiero antes de publicar.

Uso: python3 scripts/validar.py
Sale con código 1 si encuentra errores.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "public" / "data"

CAMPOS = [
    "id", "condicion", "semana", "fecha_publicacion", "categoria", "titulo",
    "tipo_fuente", "certeza", "destacado", "fuente", "resumen_tecnico",
    "puntos_clave", "limitaciones", "resumen_familias", "verificacion",
]
errores: list[str] = []


def err(msg: str) -> None:
    errores.append(msg)


def semana_iso(fecha: str) -> str:
    d = dt.date.fromisoformat(fecha)
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def main() -> int:
    config = json.loads((DATA / "condiciones.json").read_text(encoding="utf-8"))
    cats = {c["id"] for c in config["categorias"]}
    tipos = set(config["tipos_fuente"])
    certezas = set(config["certeza"])

    for cond in config["condiciones"]:
        ruta_n = DATA.parent / cond["noticias"]
        ruta_s = DATA.parent / cond["semanas"]
        noticias = json.loads(ruta_n.read_text(encoding="utf-8"))
        semanas = json.loads(ruta_s.read_text(encoding="utf-8"))

        ids, dois, pmids = set(), {}, {}
        for i, n in enumerate(noticias):
            ref = n.get("id", f"#{i}")
            for c in CAMPOS:
                if c not in n or n[c] in ("", None, []):
                    err(f"[{ref}] falta el campo '{c}'")
            if ref in ids:
                err(f"[{ref}] id duplicado")
            ids.add(ref)
            if n.get("condicion") != cond["id"]:
                err(f"[{ref}] condicion '{n.get('condicion')}' ≠ '{cond['id']}'")
            if n.get("categoria") not in cats:
                err(f"[{ref}] categoría desconocida '{n.get('categoria')}'")
            if n.get("tipo_fuente") not in tipos:
                err(f"[{ref}] tipo_fuente desconocido '{n.get('tipo_fuente')}'")
            if n.get("certeza") not in certezas:
                err(f"[{ref}] certeza desconocida '{n.get('certeza')}'")
            if not re.fullmatch(r"\d{4}-W\d{2}", n.get("semana", "")):
                err(f"[{ref}] semana con formato inválido")
            try:
                dt.date.fromisoformat(n.get("fecha_publicacion", ""))
            except ValueError:
                err(f"[{ref}] fecha_publicacion inválida (use AAAA-MM-DD)")
            fuente = n.get("fuente") or {}
            if not (fuente.get("url") or fuente.get("doi")):
                err(f"[{ref}] la fuente necesita url o doi")
            for clave, vistos in (("doi", dois), ("pmid", pmids)):
                v = (fuente.get(clave) or "").lower()
                if v:
                    if v in vistos:
                        err(f"[{ref}] {clave} duplicado con [{vistos[v]}]")
                    vistos[v] = ref
            ver = n.get("verificacion") or {}
            if ver.get("estado") not in ("verificado", "parcial"):
                err(f"[{ref}] verificacion.estado debe ser 'verificado' o 'parcial'")
            if n.get("tipo_fuente") == "solo_prensa" and ver.get("estado") == "verificado":
                err(f"[{ref}] 'solo_prensa' no puede marcarse como verificado")

        for s in semanas:
            ref = s.get("semana", "?")
            for c in ("semana", "desde", "hasta", "titular", "resumen_tecnico", "resumen_familias", "destacados"):
                if not s.get(c):
                    err(f"[semana {ref}] falta '{c}'")
            if s.get("desde") and semana_iso(s["desde"]) != ref:
                err(f"[semana {ref}] 'desde' {s['desde']} no corresponde a esa semana ISO")
            for d in s.get("destacados", []):
                if d not in ids:
                    err(f"[semana {ref}] destacado inexistente '{d}'")
        if len({s.get("semana") for s in semanas}) != len(semanas):
            err(f"[{cond['id']}] semanas duplicadas")

        print(f"{cond['sigla']}: {len(noticias)} noticias, {len(semanas)} semanas")

    if errores:
        print("\n".join(["", "ERRORES:"] + [f"  - {e}" for e in errores]))
        return 1
    print("OK: datos válidos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
