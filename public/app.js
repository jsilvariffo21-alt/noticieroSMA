(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const estado = {
    vista: leer('vista') || 'tecnico',
    categoria: '',
    tipoFuente: '',
    texto: '',
    soloDestacados: false,
    semanaIdx: 0,
  };
  let config, noticias = [], semanas = [];

  function leer(k) { try { return localStorage.getItem('noticiero.' + k); } catch { return null; } }
  function guardar(k, v) { try { localStorage.setItem('noticiero.' + k, v); } catch { /* sin almacenamiento */ } }

  const fmtFecha = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  async function iniciar() {
    config = await (await fetch('data/condiciones.json')).json();
    const params = new URLSearchParams(location.search);
    const cond = config.condiciones.find((c) => c.id === params.get('c')) || config.condiciones[0];
    $('#sigla').textContent = cond.sigla;
    $('#nombre-condicion').textContent = cond.nombre;
    document.title = `Noticiero ${cond.sigla}`;

    [noticias, semanas] = await Promise.all([
      fetch(cond.noticias).then((r) => r.json()),
      fetch(cond.semanas).then((r) => r.json()),
    ]);
    noticias.sort((a, b) => b.fecha_publicacion.localeCompare(a.fecha_publicacion));
    semanas.sort((a, b) => b.semana.localeCompare(a.semana));

    const ult = noticias.map((n) => n.verificacion?.fecha).filter(Boolean).sort().pop();
    if (ult) $('#actualizado').textContent = `Última revisión: ${fmtFecha(ult)}`;

    construirFiltros();
    enlazarEventos();
    aplicarVista();
    pintarSemana();
    pintarFeed();
  }

  function construirFiltros() {
    const chips = $('#chips-categoria');
    const todas = [{ id: '', nombre: 'Todas', icono: '' }, ...config.categorias];
    for (const c of todas) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.cat = c.id;
      b.textContent = `${c.icono ? c.icono + ' ' : ''}${c.nombre}`;
      b.setAttribute('aria-pressed', String(c.id === estado.categoria));
      chips.append(b);
    }
    const sel = $('#tipo-fuente');
    for (const [id, t] of Object.entries(config.tipos_fuente)) {
      const o = document.createElement('option');
      o.value = id; o.textContent = t.nombre;
      sel.append(o);
    }
  }

  function enlazarEventos() {
    $('#chips-categoria').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      estado.categoria = b.dataset.cat;
      document.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      pintarFeed();
    });
    $('#buscar').addEventListener('input', (e) => { estado.texto = normalizar(e.target.value); pintarFeed(); });
    $('#tipo-fuente').addEventListener('change', (e) => { estado.tipoFuente = e.target.value; pintarFeed(); });
    $('#solo-destacados').addEventListener('change', (e) => { estado.soloDestacados = e.target.checked; pintarFeed(); });
    document.querySelectorAll('.vista button').forEach((b) => b.addEventListener('click', () => {
      estado.vista = b.dataset.vista; guardar('vista', estado.vista); aplicarVista(); pintarSemana(); pintarFeed();
    }));
    $('#semana-ant').addEventListener('click', () => { estado.semanaIdx++; pintarSemana(); });
    $('#semana-sig').addEventListener('click', () => { estado.semanaIdx--; pintarSemana(); });
  }

  function aplicarVista() {
    document.querySelectorAll('.vista button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === estado.vista)));
  }

  function pintarSemana() {
    const s = semanas[estado.semanaIdx];
    if (!s) { $('.semana').hidden = true; return; }
    $('#semana-rango').textContent = `${fmtFecha(s.desde)} – ${fmtFecha(s.hasta)}`;
    $('#semana-titulo').textContent = s.titular;
    $('#semana-texto').textContent = estado.vista === 'familias' ? s.resumen_familias : s.resumen_tecnico;
    const ul = $('#semana-destacados'); ul.replaceChildren();
    for (const id of s.destacados || []) {
      const n = noticias.find((x) => x.id === id); if (!n) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${n.id}`; a.textContent = n.titulo;
      a.addEventListener('click', () => {
        // Asegura que la tarjeta sea visible aunque haya filtros activos.
        estado.categoria = ''; estado.texto = ''; estado.tipoFuente = ''; estado.soloDestacados = false;
        $('#buscar').value = ''; $('#tipo-fuente').value = ''; $('#solo-destacados').checked = false;
        document.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === '')));
        pintarFeed();
      });
      li.append(a); ul.append(li);
    }
    $('#semana-ant').disabled = estado.semanaIdx >= semanas.length - 1;
    $('#semana-sig').disabled = estado.semanaIdx <= 0;
  }

  function coincide(n) {
    if (estado.categoria && n.categoria !== estado.categoria) return false;
    if (estado.tipoFuente && n.tipo_fuente !== estado.tipoFuente) return false;
    if (estado.soloDestacados && !n.destacado) return false;
    if (estado.texto) {
      const pajar = normalizar([n.titulo, n.titulo_original, n.resumen_tecnico, n.resumen_familias, (n.etiquetas || []).join(' ')].join(' '));
      if (!estado.texto.split(/\s+/).every((t) => pajar.includes(t))) return false;
    }
    return true;
  }

  function pintarFeed() {
    const feed = $('#feed'); feed.replaceChildren();
    const lista = noticias.filter(coincide);
    $('#contador').textContent = `${lista.length} de ${noticias.length} noticias`;
    if (!lista.length) {
      const p = document.createElement('p'); p.className = 'vacio'; p.textContent = 'No hay noticias con estos filtros.';
      feed.append(p); return;
    }
    const tpl = $('#tpl-tarjeta');
    const cats = Object.fromEntries(config.categorias.map((c) => [c.id, c]));
    for (const n of lista) {
      const el = tpl.content.firstElementChild.cloneNode(true);
      el.id = n.id;
      const c = cats[n.categoria];
      el.querySelector('.cat').textContent = c ? `${c.icono} ${c.nombre}` : n.categoria;
      const t = el.querySelector('time'); t.dateTime = n.fecha_publicacion; t.textContent = fmtFecha(n.fecha_publicacion);
      el.querySelector('.destacado-badge').hidden = !n.destacado;
      el.querySelector('.tarjeta-titulo').textContent = n.titulo;
      el.querySelector('.tarjeta-original').textContent = n.titulo_original || '';

      const tf = el.querySelector('.fuente-tipo');
      tf.dataset.v = n.tipo_fuente; tf.textContent = config.tipos_fuente[n.tipo_fuente]?.nombre || n.tipo_fuente;
      const ce = el.querySelector('.certeza');
      ce.dataset.v = n.certeza; ce.textContent = `Certeza: ${config.certeza[n.certeza] || n.certeza}`;
      if (n.certeza === 'no_aplica') ce.textContent = 'Preclínico';
      const ve = el.querySelector('.verif');
      ve.dataset.v = n.verificacion?.estado;
      ve.textContent = n.verificacion?.estado === 'verificado' ? '✓ Verificado en la fuente' : '◐ Verificación parcial';

      const familias = estado.vista === 'familias';
      el.querySelector('.resumen').textContent = familias ? n.resumen_familias : n.resumen_tecnico;
      const pq = el.querySelector('.pregunta');
      if (familias && n.pregunta_equipo) { pq.hidden = false; pq.textContent = `💬 Para conversar con su equipo: ${n.pregunta_equipo}`; }

      const ul = el.querySelector('.puntos');
      for (const p of n.puntos_clave || []) { const li = document.createElement('li'); li.textContent = p; ul.append(li); }
      el.querySelector('.limitaciones').textContent = n.limitaciones || '—';
      if (n.conflictos) { el.querySelector('.conflictos-bloque').hidden = false; el.querySelector('.conflictos').textContent = n.conflictos; }
      el.querySelector('.verif-nota').textContent = n.verificacion?.nota || '—';
      el.querySelector('.fuente-nombre').textContent = [n.fuente.nombre, n.fuente.autores].filter(Boolean).join(' · ');
      const en = el.querySelector('.enlaces');
      const links = [];
      if (n.fuente.url) links.push(['Fuente original', n.fuente.url]);
      if (n.fuente.doi && !String(n.fuente.url).includes(n.fuente.doi)) links.push(['DOI', `https://doi.org/${n.fuente.doi}`]);
      if (n.fuente.pmid) links.push(['PubMed', `https://pubmed.ncbi.nlm.nih.gov/${n.fuente.pmid}/`]);
      if (n.fuente.nct) links.push(['ClinicalTrials.gov', `https://clinicaltrials.gov/study/${n.fuente.nct}`]);
      for (const [txt, href] of links) {
        const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = txt + ' ↗';
        en.append(a);
      }
      feed.append(el);
    }
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  iniciar().catch((err) => {
    $('#feed').innerHTML = '<p class="vacio">No se pudieron cargar las noticias.</p>';
    console.error(err);
  });
})();
