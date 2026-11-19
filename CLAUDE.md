# Protocolo editorial del Noticiero

Este archivo guía a Claude Code en cada **edición semanal automática** y en cualquier sesión de trabajo sobre el repositorio.

## Misión

Recopilar, revisar, verificar y resumir en español las novedades mundiales sobre cada condición activa (hoy: **atrofia muscular espinal (AME/SMA)**, **Charcot-Marie-Tooth (CMT)** y **distrofia muscular relacionada con LAMA2 (merosina o laminina α2)**), con dos capas de lectura:

1. una capa técnica para profesionales de la salud;
2. una capa en lenguaje simple para padres y cuidadores.

## Estructura

- `condiciones/<id>.json`: búsquedas y términos de cada condición. Solo se procesan las que tienen `"activa": true`.
- `public/data/condiciones.json`: categorías comunes, tipos de fuente y lista de condiciones que muestra el selector de la web.
- `public/`: sitio estático, publicado tal cual en Cloudflare, sin paso de compilación.
- `public/data/<id>/noticias.json`: una entrada por noticia (ver el esquema más abajo).
- `public/data/<id>/semanas.json`: un resumen de highlights por semana ISO.
- `scripts/validar.py`: validador. **Debe terminar en `OK` antes de cada commit.**

## Acceso a fuentes desde la tarea automática

Las sesiones programadas pueden no tener el conector MCP de PubMed. En ese caso, usa las API públicas con `curl` (los dominios están permitidos en el entorno):

- **PubMed (E-utilities):**
  - `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<consulta>&mindate=AAAA/MM/DD&maxdate=AAAA/MM/DD&datetype=edat&retmax=100&retmode=json`
  - Luego obtén los resúmenes con `efetch.fcgi?db=pubmed&id=<pmids>&retmode=xml`.
  - Espera al menos 0,4 s entre llamadas.
- **ClinicalTrials.gov:** `https://clinicaltrials.gov/api/v2/studies?query.cond=<busqueda.clinicaltrials_gov de la condición>&filter.advanced=AREA[LastUpdatePostDate]RANGE[AAAA-MM-DD,AAAA-MM-DD]&pageSize=50`
- **FDA y EMA:** usa `curl -A "Mozilla/5.0" <url>` sobre `www.fda.gov` o `www.ema.europa.eu`. WebFetch puede fallar en esos dominios, pero `curl` funciona.
- **Prensa general:** usa WebSearch.

## Edición semanal (paso a paso)

Repite los pasos 1 a 6 **para cada condición activa** y luego valida y publica una sola vez (paso 7). La semana a cubrir es la **semana ISO anterior completa**, de lunes a domingo. Por ejemplo, si hoy es lunes 23-11-2026, se cubre la semana 2026-W47, del 16 al 22 de noviembre.

1. **Recopilar**
   - En PubMed (herramienta MCP), ejecuta cada consulta de `condiciones/<id>.json` → `busqueda.pubmed` con `datetype: "edat"`, limitada a la semana. Obtén los metadatos y el resumen.
   - En la web (WebSearch), busca aprobaciones regulatorias (FDA, EMA, ISP, ANMAT, COFEPRIS y otras agencias), resultados de ensayos y comunicados de organizaciones de pacientes de esa semana.
2. **Filtrar**
   - Si `condiciones/<id>.json` tiene un campo `excluir`, aplícalo (por ejemplo, en LAMA2 hay muchos artículos de oncología o veterinaria que no corresponden).
   - Descarta duplicados: compara el DOI, el PMID y el `id` con `noticias.json`. Descarta también las fe de erratas, los textos fuera de tema y los estudios en que la condición es solo una mención menor. Un mismo artículo puede publicarse en dos condiciones solo si es relevante para ambas (por ejemplo, una guía de cirugía neuromuscular); en ese caso usa un `id` distinto en cada una.
   - Prioriza el impacto clínico en este orden: regulatorio > ensayos aleatorizados > guías, consensos y revisiones sistemáticas > cohortes > cirugía y reportes de caso > ciencia básica.
   - Siempre incluye lo relacionado con cirugía de **columna, cadera, pie o partes blandas** y con **rehabilitación**, aunque el nivel de evidencia sea bajo.
3. **Verificar**
   - Cada dato numérico del resumen debe provenir del resumen o del texto de la fuente primaria. **Nunca inventes cifras.**
   - Si una noticia proviene de prensa, busca la fuente primaria: el paper, el registro en ClinicalTrials.gov o el comunicado de la agencia.
     - Si no la encuentras, pero la noticia aparece en al menos 3 medios independientes, usa `verificacion.estado = "parcial"` y explícalo en `nota`.
     - Si aparece en un solo medio, no la publiques.
   - Registra los conflictos de interés que aparezcan en el resumen (financiamiento de la industria o autores empleados).
4. **Clasificar**
   - Asigna `categoria`, `tipo_fuente` y `certeza`. Para la certeza usa un enfoque inspirado en GRADE: parte de "alta" en ensayos aleatorizados y de "baja" en estudios observacionales, y baja un nivel por cada limitación seria. Usa `no_aplica` para estudios preclínicos.
5. **Resumir**
   - `resumen_tecnico`: entre 80 y 160 palabras, con el diseño, la n, la población, los resultados principales con sus cifras y el contexto clínico.
   - `resumen_familias`: entre 60 y 120 palabras, sin jerga (o explicándola) y con un tono cálido y honesto. No generes falsas expectativas: si es preclínico o tiene n muy pequeña, dilo claramente.
   - `pregunta_equipo`: una pregunta concreta que la familia pueda llevar a su equipo tratante, o `null` si no aplica.
   - Escribe en español neutro, usando "su hijo o hija".
6. **Highlights de la semana**
   - Agrega una entrada en `semanas.json` con un `titular`, un `resumen_tecnico` y un `resumen_familias` de 2 a 4 frases cada uno, y los `destacados` (ids, máximo 5).
   - Marca con `"destacado": true` las 1 a 3 noticias más relevantes.
   - Si no hubo novedades, crea igualmente la semana con el titular "Semana sin novedades relevantes" y `destacados: []`.
7. **Validar y publicar**
   - Ejecuta `python3 scripts/validar.py` y corrige los errores que aparezcan.
   - Haz un solo commit para todas las condiciones con el mensaje `Edición semanal AAAA-Www` en la rama `main` y luego push. Cloudflare Pages despliega automáticamente.

## Agregar una condición nueva

Para mantener el mismo rigor en todas las condiciones:

1. Crea `condiciones/<id>.json` copiando la estructura de `ame.json`. Define consultas de PubMed que cubran: la condición (MeSH y texto libre), las terapias en desarrollo, la cirugía relevante para esa condición y la rehabilitación.
2. Agrega la condición a `public/data/condiciones.json` con `id`, `nombre`, `sigla`, `descripcion` (una frase en lenguaje simple) y las rutas de datos.
3. Crea `public/data/<id>/noticias.json` y `semanas.json`.
4. **Carga inicial:** cubre al menos las últimas 8 a 12 semanas (en condiciones muy raras, como LAMA2, amplía la ventana hasta unos 6 meses), con el mismo proceso de verificación que la edición semanal, para que la pestaña no parta vacía.
5. Ejecuta `python3 scripts/validar.py` y revisa la web localmente (`python3 -m http.server 8000 --directory public`) antes de publicar.

## Esquema de una noticia

```json
{
  "id": "AAAA-MM-slug-corto",
  "condicion": "<id de la condición>",
  "semana": "AAAA-Www",
  "fecha_publicacion": "AAAA-MM-DD",
  "categoria": "medicamentos | estudios | descubrimientos | rehabilitacion | evidencia | cirugia",
  "titulo": "Título en español, informativo",
  "titulo_original": "Título original",
  "tipo_fuente": "regulatorio | ensayo_aleatorizado | revision_consenso | revisado_por_pares | reporte_caso | preprint | solo_prensa",
  "certeza": "alta | moderada | baja | muy_baja | no_aplica",
  "destacado": false,
  "fuente": { "nombre": "", "autores": "", "url": "", "doi": "", "pmid": "", "nct": "" },
  "resumen_tecnico": "",
  "puntos_clave": ["", ""],
  "limitaciones": "",
  "resumen_familias": "",
  "pregunta_equipo": null,
  "conflictos": null,
  "verificacion": { "estado": "verificado | parcial", "fecha": "AAAA-MM-DD", "nota": "" },
  "etiquetas": []
}
```

## Reglas

- Nunca publiques consejos médicos individuales. El sitio informa y no indica tratamientos.
- Nunca borres noticias antiguas: el archivo es histórico. Si una noticia se corrige, edítala y explica el cambio en `verificacion.nota`.
- Los preprints siempre se marcan como `preprint`.
