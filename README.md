# Noticiero AME

Noticiero personal sobre **atrofia muscular espinal (AME/SMA)**. Recopila, verifica y resume en español las novedades mundiales sobre medicamentos, ensayos clínicos, descubrimientos, rehabilitación, guías y cirugía (columna, cadera y partes blandas).

- **Dos capas de lectura:** cada noticia tiene un resumen técnico para profesionales y una versión en lenguaje simple para familias y cuidadores.
- **Transparencia:** cada noticia indica el tipo de fuente, la certeza de la evidencia (enfoque inspirado en GRADE), el estado de verificación, los conflictos de interés y los enlaces a la fuente original (DOI, PubMed y ClinicalTrials.gov).
- **Edición semanal automática:** una tarea programada de Claude Code ejecuta el protocolo de [`CLAUDE.md`](CLAUDE.md), agrega las noticias de la semana anterior, escribe sus highlights y publica.
- **Multicondición:** está pensado para incorporar otras condiciones de salud con el mismo formato (ver `CLAUDE.md`).

## Estructura

```
condiciones/ame.json        búsquedas y términos de la condición
public/                     sitio estático (Cloudflare Pages)
  index.html, estilos.css, app.js
  data/condiciones.json     categorías, tipos de fuente y condiciones activas
  data/ame/noticias.json    noticias
  data/ame/semanas.json     resúmenes semanales
scripts/validar.py          validador de datos
CLAUDE.md                   protocolo editorial
```

## Ver el sitio en tu computador

```bash
python3 -m http.server 8000 --directory public
```

Luego abre <http://localhost:8000>.

## Publicación en Cloudflare Pages

1. En Cloudflare, ve a **Workers & Pages → Create → Pages → Connect to Git** y elige este repositorio.
2. Configuración de compilación:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: `public`
3. Para mantenerlo privado, ve a **Zero Trust → Access → Applications → Add application → Self-hosted**, usa el dominio `*.pages.dev` del proyecto y crea una política *Allow* que incluya solo tu correo. Es gratis hasta 50 usuarios.

El sitio incluye `noindex` y `robots.txt` para que no aparezca en buscadores mientras sea privado.

## Aviso

Contenido informativo. No reemplaza la indicación del equipo de salud.
