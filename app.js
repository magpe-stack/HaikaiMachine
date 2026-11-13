/* Haikai Machine — app.js
 * Vanilla JS, apenas APIs nativas do navegador (Chrome):
 * Geolocation, Clipboard, Web Share, Fullscreen, localStorage, Service Worker,
 * window.print, beforeinstallprompt, Intl.DateTimeFormat, <dialog>, Popover.
 */
(() => {
'use strict';

/* =====================================================================
 * Constantes e utilitários
 * ===================================================================== */
const URL_HOME = 'https://magpe-stack.github.io/HaikaiMachine/';
const URL_REPO = 'https://github.com/magpe-stack/HaikaiMachine';
const URL_README = 'https://github.com/magpe-stack/HaikaiMachine/blob/main/README.md';
const CHAVE_DADOS = 'haikaiMachine.dados.v1';
const CHAVE_TEMA = 'haikaiMachine.tema';
const LIMITE_NOME = 50;
const LIMITE_VERSO = 40;
const METRICA = [5, 7, 5];
const SVG_NS = 'http://www.w3.org/2000/svg';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    n.append(k.nodeType ? k : document.createTextNode(k));
  }
  return n;
}

function icon(nome, cls = 'icon') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', '#i-' + nome);
  s.append(u);
  return s;
}

function btn(rotulo, ic, onclick, cls = 'btn', extra = {}) {
  return el('button', { type: 'button', class: cls, onclick, ...extra }, ic && icon(ic), el('span', { text: rotulo }));
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'medium' });
const fmt = (iso) => fmtDataHora.format(new Date(iso));
const porData = (a, b) => a.dataHora.localeCompare(b.dataHora);

/* =====================================================================
 * Toast (popover = camada superior, aparece inclusive sobre <dialog>)
 * ===================================================================== */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  try { if (t.showPopover && !t.matches(':popover-open')) t.showPopover(); } catch (e) { /* já aberto */ }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { try { t.hidePopover(); } catch (e) { /* ignore */ } }, 4500);
}

/* =====================================================================
 * Armazenamento (localStorage)
 * ===================================================================== */
let dados = { acervos: [] };

const dataValida = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

function sanitizarLocal(l) {
  if (!l || typeof l !== 'object') return null;
  if (l.status === 'ok' && Number.isFinite(l.lat) && Number.isFinite(l.lon)) {
    return {
      status: 'ok', lat: l.lat, lon: l.lon,
      precisao: Number.isFinite(l.precisao) ? l.precisao : null,
      endereco: typeof l.endereco === 'string' ? l.endereco.slice(0, 500) : null
    };
  }
  return { status: String(l.status || 'indisponivel').slice(0, 30), mensagem: String(l.mensagem || '').slice(0, 200) };
}

function sanitizarHaikai(h) {
  if (!h || !Array.isArray(h.versos) || h.versos.length !== 3) return null;
  const dh = dataValida(h.dataHora);
  if (!dh) return null;
  return { id: String(h.id || uid()), versos: h.versos.map((v) => String(v ?? '').slice(0, 200)), dataHora: dh, local: sanitizarLocal(h.local) };
}

function sanitizarAcervos(lista) {
  if (!Array.isArray(lista)) throw new Error('Formato inválido: a lista "acervos" não foi encontrada.');
  return lista.map((a) => {
    if (!a || typeof a !== 'object') return null;
    return {
      id: String(a.id || uid()),
      nome: String(a.nome || '').trim().slice(0, LIMITE_NOME) || 'Acervo sem nome',
      criadoEm: dataValida(a.criadoEm) || new Date().toISOString(),
      inicio: dataValida(a.inicio),
      fim: dataValida(a.fim),
      haikais: (Array.isArray(a.haikais) ? a.haikais : []).map(sanitizarHaikai).filter(Boolean)
    };
  }).filter(Boolean);
}

function carregar() {
  let raw = null;
  try {
    raw = localStorage.getItem(CHAVE_DADOS);
    if (raw) dados = { acervos: sanitizarAcervos(JSON.parse(raw).acervos) };
  } catch (e) {
    console.error('Dados locais ilegíveis:', e);
    try { if (raw) localStorage.setItem(CHAVE_DADOS + '.corrompido', raw); } catch (e2) { /* ignore */ }
    dados = { acervos: [] };
  }
}

function salvar() {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify({ versao: 1, acervos: dados.acervos }));
    return true;
  } catch (e) {
    console.error(e);
    toast('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.');
    return false;
  }
}

/* =====================================================================
 * Tema e tela cheia
 * ===================================================================== */
const temaAtual = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

function aplicarTema(t, persistir = true) {
  document.documentElement.setAttribute('data-theme', t);
  if (persistir) { try { localStorage.setItem(CHAVE_TEMA, t); } catch (e) { /* ignore */ } }
  $('meta[name="theme-color"]').setAttribute('content', t === 'dark' ? '#201528' : '#8253A2');
  $('#tema-use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  $('#btn-tema').setAttribute('aria-label', t === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
}

function iniciarCabecalho() {
  aplicarTema(temaAtual(), false);
  $('#btn-tema').addEventListener('click', () => aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark'));

  const bFs = $('#btn-fs');
  if (!document.fullscreenEnabled) bFs.hidden = true;
  bFs.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) { toast('A tela cheia não está disponível neste dispositivo.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    $('#fs-use').setAttribute('href', on ? '#i-minimize' : '#i-maximize');
    bFs.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Entrar em tela cheia');
  });
}

/* =====================================================================
 * Drawer (menu lateral)
 * ===================================================================== */
const drawer = $('#drawer');
const scrim = $('#scrim');
const btnMenu = $('#btn-menu');

function focaveisDrawer() { return $$('a[href], button:not([disabled])', drawer); }

function abrirMenu() {
  drawer.inert = false;
  drawer.classList.add('open');
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('show'));
  btnMenu.setAttribute('aria-expanded', 'true');
  btnMenu.setAttribute('aria-label', 'Fechar menu');
  $('#conteudo').inert = true;
  $('.footer').inert = true;
  const f = focaveisDrawer();
  (f[1] || f[0]).focus();
}

function fecharMenu(devolverFoco = true) {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  scrim.classList.remove('show');
  btnMenu.setAttribute('aria-expanded', 'false');
  btnMenu.setAttribute('aria-label', 'Abrir menu');
  $('#conteudo').inert = false;
  $('.footer').inert = false;
  if (devolverFoco) btnMenu.focus();
  drawer.inert = true;
  setTimeout(() => { if (!drawer.classList.contains('open')) scrim.hidden = true; }, 260);
}

function iniciarDrawer() {
  btnMenu.addEventListener('click', () => (drawer.classList.contains('open') ? fecharMenu() : abrirMenu()));
  $('#btn-drawer-close').addEventListener('click', () => fecharMenu());
  scrim.addEventListener('click', () => fecharMenu());

  drawer.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    const acao = item.dataset.action;
    fecharMenu(!!acao ? false : false);
    if (acao === 'novo') abrirNovoAcervo();
    else if (acao === 'backup') exportarBackup();
    else if (acao === 'importar') $('#file-import').click();
    else if (acao === 'instalar') instalarApp();
  });

  document.addEventListener('keydown', (e) => {
    if (!drawer.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); fecharMenu(); return; }
    if (e.key === 'Tab') {
      const f = focaveisDrawer();
      if (!f.length) return;
      const primeiro = f[0];
      const ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });
}

/* =====================================================================
 * Contagem de sílabas poéticas (escanção em português) — aproximação
 * ===================================================================== */
// <silabas>
const VOGAIS = 'aeiouáàâãäéèêíìîóòôõöúùûü';
const FORTES = 'aeoáàâãéêóôõ';
const isV = (c) => !!c && VOGAIS.includes(c);

function tokensDoVerso(verso) {
  return verso.toLowerCase().normalize('NFC').replace(/['’]/g, '')
    .split(/[^a-záàâãäéèêíìîóòôõöúùûüçñ]+/).filter(Boolean);
}

function juntaVogais(p, c) {
  if ((p === 'ã' && (c === 'o' || c === 'e')) || (p === 'õ' && c === 'e')) return true; // ão, ãe, õe
  if ('íú'.includes(c) || 'íú'.includes(p)) return false;                                 // hiato com i/u acentuado
  if (FORTES.includes(p) && FORTES.includes(c)) return false;                              // hiato forte+forte
  return true;                                                                             // ditongo/tritongo
}

function separarGrupo(g) {
  const r = [g[0]];
  for (let k = 1; k < g.length; k++) {
    if (juntaVogais(g[k - 1], g[k])) r[r.length - 1] += g[k];
    else r.push(g[k]);
  }
  return r;
}

function partesDaPalavra(p) {
  const out = [];
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    const n = p[i + 1];
    if (isV(c)) {
      let j = i;
      while (j < p.length && isV(p[j])) j++;
      for (const nuc of separarGrupo(p.slice(i, j))) out.push({ v: true, s: nuc });
      i = j;
    } else if (n === 'h' && (c === 'c' || c === 'l' || c === 'n')) {
      out.push({ v: false, s: c + n }); i += 2;
    } else if ((c === 'q' || c === 'g') && n === 'u' && /[eéêií]/.test(p[i + 2] || '')) {
      out.push({ v: false, s: c + n }); i += 2;
    } else {
      out.push({ v: false, s: c }); i += 1;
    }
  }
  return out;
}

function silabasDaPalavra(p) {
  if (p === 'ao' || p === 'aos') return [p];
  const partes = partesDaPalavra(p);
  const idx = partes.map((x, i) => (x.v ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return [p];
  const sil = idx.map((vi) => ({ pre: '', nuc: partes[vi].s, pos: '' }));
  sil[0].pre = partes.slice(0, idx[0]).map((x) => x.s).join('');
  for (let n = 0; n < idx.length - 1; n++) {
    const cons = partes.slice(idx[n] + 1, idx[n + 1]);
    if (!cons.length) continue;
    let k = 1;
    if (cons.length >= 2) {
      const u1 = cons[cons.length - 2].s;
      const u2 = cons[cons.length - 1].s;
      if (u1.length === 1 && ((u2 === 'l' && 'bcfgpt'.includes(u1)) || (u2 === 'r' && 'bcdfgptv'.includes(u1)))) k = 2;
    }
    sil[n].pos = cons.slice(0, cons.length - k).map((x) => x.s).join('');
    sil[n + 1].pre = cons.slice(cons.length - k).map((x) => x.s).join('');
  }
  sil[sil.length - 1].pos = partes.slice(idx[idx.length - 1] + 1).map((x) => x.s).join('');
  return sil.map((s) => s.pre + s.nuc + s.pos);
}

function indiceTonica(sil, palavra) {
  const n = sil.length;
  if (n === 1) return 0;
  for (let i = 0; i < n; i++) if (/[áàâéêíóôú]/.test(sil[i])) return i;
  for (let i = 0; i < n; i++) if (/[ãõ]/.test(sil[i])) return i;
  // ditongo crescente final sem acento (va-zio, ma-ria): a tônica é o i/u, dentro da última sílaba
  if (/[^aeiouáàâãäéèêíìîóòôõöúùûü][iu][aeo]s?$/.test(palavra)) return n - 1;
  if (/(a|e|o|as|es|os|am|em|ens)$/.test(palavra)) return n - 2;
  return n - 1;
}

function contarSilabasPoeticas(verso) {
  const ws = tokensDoVerso(verso);
  if (!ws.length) return 0;
  const info = ws.map((w) => { const s = silabasDaPalavra(w); return { w, n: s.length, t: indiceTonica(s, w) }; });
  let total = info.reduce((a, x) => a + x.n, 0);
  for (let i = 0; i < info.length - 1; i++) {            // sinalefa: vogal final + vogal inicial
    const termina = 'aeiou'.includes(info[i].w.slice(-1));
    const inicia = isV(info[i + 1].w[0]) || (info[i + 1].w[0] === 'h' && isV(info[i + 1].w[1]));
    if (termina && inicia) total -= 1;
  }
  const ult = info[info.length - 1];
  total -= (ult.n - 1 - ult.t);                          // conta só até a última sílaba tônica
  return Math.max(total, 0);
}
// </silabas>

/* =====================================================================
 * Geolocalização
 * ===================================================================== */
function obterLocalizacao() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ status: 'indisponivel', mensagem: 'Geolocalização não suportada neste navegador.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        status: 'ok', lat: p.coords.latitude, lon: p.coords.longitude,
        precisao: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null, endereco: null
      }),
      (e) => {
        const mapa = {
          1: ['negado', 'Permissão de localização negada.'],
          2: ['indisponivel', 'Posição indisponível no momento.'],
          3: ['timeout', 'Tempo esgotado ao obter a localização.']
        };
        const [status, mensagem] = mapa[e.code] || ['erro', e.message || 'Erro desconhecido.'];
        resolve({ status, mensagem });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function enderecoReverso(lat, lon) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=pt-BR&lat=${lat}&lon=${lon}`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.display_name === 'string' ? j.display_name.slice(0, 500) : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const mapsUrl = (l) => `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}`;

function textoLocal(l) {
  if (!l) return 'Localização não registrada';
  if (l.status === 'ok') {
    let t = `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}`;
    if (l.precisao != null) t += ` (±${Math.round(l.precisao)} m)`;
    return l.endereco ? `${l.endereco} — ${t}` : t;
  }
  return `Localização indisponível: ${l.mensagem || l.status}`;
}

/* =====================================================================
 * Textos para copiar / compartilhar / imprimir
 * ===================================================================== */
function blocoHaikai(h) {
  let t = `${h.versos.join('\n')}\n— ${fmt(h.dataHora)}\n  ${textoLocal(h.local)}`;
  if (h.local && h.local.status === 'ok') t += `\n  ${mapsUrl(h.local)}`;
  return t;
}
const textoHaikai = (a, h) => `${blocoHaikai(h)}\n\nAcervo: ${a.nome} · Haikai Machine`;

function textoAcervo(a) {
  const cab = [`Haikai Machine — ${a.nome}`, `Início do passeio: ${a.inicio ? fmt(a.inicio) : 'não iniciado'}`];
  if (a.fim) cab.push(`Fim do passeio: ${fmt(a.fim)}`);
  const hs = [...a.haikais].sort(porData);
  return `${cab.join('\n')}\n\n${hs.map((h, i) => `#${i + 1}\n${blocoHaikai(h)}`).join('\n\n')}\n\n${URL_HOME}`;
}

async function copiar(texto, msg = 'Copiado para a área de transferência.') {
  try {
    await navigator.clipboard.writeText(texto);
    toast(msg);
  } catch (e) {
    const ta = el('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;opacity:0' });
    ta.value = texto;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    toast(ok ? msg : 'Não foi possível copiar. Use a opção Compartilhar para obter o texto.');
  }
}

async function compartilhar(titulo, texto) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const d = $('#dlg-share');
  $('#share-texto').value = texto;
  $('#share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(texto);
  $('#share-mail').href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(texto)}`;
  d.showModal();
}

function imprimirNos(nos) {
  const area = $('#print-area');
  area.replaceChildren(...nos);
  const limpar = () => { area.replaceChildren(); window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
  window.print();
}

function nosImpressaoHaikai(a, h, numero) {
  const loc = el('p', { class: 'p-meta', text: textoLocal(h.local) });
  return el('article', { class: 'p-haikai' },
    el('p', { class: 'p-meta', text: numero ? `Haikai ${numero}` : '' }),
    el('div', { class: 'p-versos' }, h.versos.map((v) => el('span', { text: v }))),
    el('p', { class: 'p-meta', text: fmt(h.dataHora) }), loc);
}

function imprimirHaikai(a, h, numero) {
  imprimirNos([
    el('h1', { text: 'Haikai Machine' }),
    el('h2', { text: a.nome }),
    el('p', { class: 'p-meta', text: `Início do passeio: ${a.inicio ? fmt(a.inicio) : 'não iniciado'}` }),
    nosImpressaoHaikai(a, h, numero),
    el('p', { class: 'p-rodape', text: URL_HOME })
  ]);
}

function imprimirAcervo(a) {
  const hs = [...a.haikais].sort(porData);
  imprimirNos([
    el('h1', { text: 'Haikai Machine' }),
    el('h2', { text: a.nome }),
    el('p', { class: 'p-meta', text: `Início do passeio: ${a.inicio ? fmt(a.inicio) : 'não iniciado'}` }),
    a.fim && el('p', { class: 'p-meta', text: `Fim do passeio: ${fmt(a.fim)}` }),
    el('p', { class: 'p-meta', text: `${hs.length} ${hs.length === 1 ? 'haikai' : 'haikais'}` }),
    ...hs.map((h, i) => nosImpressaoHaikai(a, h, i + 1)),
    el('p', { class: 'p-rodape', text: URL_HOME })
  ].filter(Boolean));
}

/* =====================================================================
 * Diálogos auxiliares
 * ===================================================================== */
function confirmar(titulo, msg, rotuloOk = 'Confirmar') {
  return new Promise((resolve) => {
    const d = $('#dlg-confirm');
    $('#confirm-titulo').textContent = titulo;
    $('#confirm-msg').textContent = msg;
    $('#confirm-ok').textContent = rotuloOk;
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

/* ---- Novo acervo ---- */
function abrirNovoAcervo() {
  const d = $('#dlg-novo');
  const inp = $('#novo-nome');
  inp.value = '';
  $('#novo-contador').textContent = `0/${LIMITE_NOME}`;
  $('#novo-erro').textContent = '';
  d.showModal();
  inp.focus();
}

function iniciarDialogoNovo() {
  const d = $('#dlg-novo');
  const inp = $('#novo-nome');
  inp.addEventListener('input', () => {
    $('#novo-contador').textContent = `${inp.value.length}/${LIMITE_NOME}`;
    $('#novo-erro').textContent = '';
  });
  $('#novo-cancelar').addEventListener('click', () => d.close());
  $('#form-novo').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = inp.value.trim().slice(0, LIMITE_NOME);
    if (!nome) { $('#novo-erro').textContent = 'Informe um nome para o acervo.'; inp.focus(); return; }
    const a = { id: uid(), nome, criadoEm: new Date().toISOString(), inicio: null, fim: null, haikais: [] };
    dados.acervos.push(a);
    if (!salvar()) { dados.acervos.pop(); return; }
    d.close();
    location.hash = '#/acervo/' + encodeURIComponent(a.id);
    toast('Acervo criado. Toque em Iniciar quando começar o passeio.');
  });
}

/* ---- Haikalizar ---- */
let acervoCaptura = null;
let salvando = false;

function atualizarHints() {
  let total = 0;
  $$('.verso-input').forEach((inp, i) => {
    const n = contarSilabasPoeticas(inp.value);
    const meta = METRICA[i];
    total += n;
    $('#cont-' + i).textContent = `${inp.value.length}/${LIMITE_VERSO}`;
    const hint = $('#hint-' + i);
    hint.className = 'hint' + (inp.value.trim() && n === meta ? ' ok' : '');
    if (!inp.value.trim()) hint.textContent = `Meta: ${meta} sílabas poéticas`;
    else if (n === meta) hint.textContent = `✓ ${n} sílabas poéticas (meta ${meta})`;
    else if (n < meta) hint.textContent = `${n} sílabas poéticas — faltam ${meta - n} (meta ${meta})`;
    else hint.textContent = `${n} sílabas poéticas — sobram ${n - meta} (meta ${meta})`;
  });
  $('#total-silabas').textContent = `Total: ${total} de 17 sílabas poéticas. A contagem é uma estimativa e não bloqueia o registro.`;
}

function abrirHaikalizar(a) {
  acervoCaptura = a;
  $('#haikai-acervo').textContent = `Acervo: ${a.nome}`;
  $$('.verso-input').forEach((i) => { i.value = ''; i.disabled = false; });
  $('#haikai-erro').textContent = '';
  $('#haikai-status').textContent = '';
  $('#haikai-salvar').disabled = false;
  $('#haikai-cancelar').disabled = false;
  atualizarHints();
  $('#dlg-haikai').showModal();
  $('#verso-0').focus();
}

function ocupado(on, msg = '') {
  salvando = on;
  $$('.verso-input').forEach((i) => { i.disabled = on; });
  $('#haikai-salvar').disabled = on;
  $('#haikai-cancelar').disabled = on;
  $('#haikai-status').textContent = msg;
}

function iniciarDialogoHaikai() {
  const d = $('#dlg-haikai');
  $$('.verso-input').forEach((i) => i.addEventListener('input', atualizarHints));
  $('#haikai-cancelar').addEventListener('click', () => d.close());
  d.addEventListener('cancel', (e) => { if (salvando) e.preventDefault(); });

  $('#form-haikai').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando || !acervoCaptura) return;
    const inputs = $$('.verso-input');
    const versos = inputs.map((i) => i.value.trim());
    const vazio = versos.findIndex((v) => !v);
    if (vazio >= 0) {
      $('#haikai-erro').textContent = 'Preencha os três versos para revelar o haikai.';
      inputs[vazio].focus();
      return;
    }
    $('#haikai-erro').textContent = '';
    const dataHora = new Date().toISOString();          // stamp exato do instante da captura
    ocupado(true, 'Obtendo localização…');
    const local = await obterLocalizacao();
    const a = acervoCaptura;
    const h = { id: uid(), versos, dataHora, local };
    a.haikais.push(h);
    a.haikais.sort(porData);
    if (!salvar()) {
      a.haikais = a.haikais.filter((x) => x.id !== h.id);
      ocupado(false);
      return;
    }
    ocupado(false);
    d.close();
    if (local.status === 'ok') toast('Haikai revelado com data, hora e localização.');
    else toast(`Haikai revelado. ${local.mensagem}`);
    atualizar();

    if (local.status === 'ok') {                         // endereço por referência, em segundo plano
      enderecoReverso(local.lat, local.lon).then((end) => {
        if (!end) return;
        h.local.endereco = end;
        if (salvar() && !document.querySelector('dialog[open]')) atualizar();
      });
    }
  });
}

/* =====================================================================
 * Backup / Importação
 * ===================================================================== */
function exportarBackup() {
  const payload = {
    app: 'Haikai Machine',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    configuracoes: { tema: temaAtual() },
    acervos: dados.acervos
  };
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const nome = `haikai-machine-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const nH = dados.acervos.reduce((s, x) => s + x.haikais.length, 0);
  toast(`Backup gerado: ${dados.acervos.length} acervo(s), ${nH} haikai(s).`);
}

let importacaoPendente = null;

function iniciarImportacao() {
  const input = $('#file-import');
  input.addEventListener('change', async () => {
    const arq = input.files && input.files[0];
    input.value = '';
    if (!arq) return;
    try {
      const j = JSON.parse(await arq.text());
      const acervos = sanitizarAcervos(j.acervos);
      const tema = j.configuracoes && (j.configuracoes.tema === 'dark' || j.configuracoes.tema === 'light') ? j.configuracoes.tema : null;
      importacaoPendente = { acervos, tema };
      const nH = acervos.reduce((s, x) => s + x.haikais.length, 0);
      $('#import-resumo').textContent = `O arquivo "${arq.name}" contém ${acervos.length} acervo(s) e ${nH} haikai(s).`;
      const d = $('#dlg-import');
      d.returnValue = '';
      d.addEventListener('close', aplicarImportacao, { once: true });
      d.showModal();
    } catch (e) {
      console.error(e);
      toast('Arquivo inválido: não é um backup do Haikai Machine.');
    }
  });
}

function aplicarImportacao() {
  const modo = $('#dlg-import').returnValue;
  const imp = importacaoPendente;
  importacaoPendente = null;
  if (!imp || (modo !== 'mesclar' && modo !== 'substituir')) return;
  const anterior = dados.acervos;
  if (modo === 'substituir') {
    dados.acervos = imp.acervos;
  } else {
    const mapa = new Map(dados.acervos.map((a) => [a.id, a]));
    for (const novo of imp.acervos) {
      const existente = mapa.get(novo.id);
      if (!existente) { dados.acervos.push(novo); mapa.set(novo.id, novo); continue; }
      const ids = new Set(existente.haikais.map((h) => h.id));
      novo.haikais.forEach((h) => { if (!ids.has(h.id)) existente.haikais.push(h); });
      existente.haikais.sort(porData);
    }
  }
  if (!salvar()) { dados.acervos = anterior; return; }
  if (imp.tema) aplicarTema(imp.tema);
  toast(modo === 'substituir' ? 'Backup restaurado (dados substituídos).' : 'Backup mesclado com seus dados.');
  if (location.hash && location.hash !== '#/') location.hash = '#/acervos'; else atualizar();
}

/* =====================================================================
 * Instalação do PWA
 * ===================================================================== */
let promptInstalacao = window.__bip || null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalacao = e; });
window.addEventListener('appinstalled', () => { promptInstalacao = null; toast('Haikai Machine instalado!'); });

async function instalarApp() {
  if (matchMedia('(display-mode: standalone)').matches) { toast('O app já está instalado e em uso.'); return; }
  if (!promptInstalacao) {
    const ua = navigator.userAgent;
    let msg;
    if (!window.isSecureContext) msg = 'Instalação indisponível: a página não está em um contexto seguro (HTTPS).';
    else if (/iPhone|iPad|iPod/.test(ua)) msg = 'No iPhone/iPad, use o Safari: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
    else if (/; wv\)|FBAN|FBAV|Instagram|Line\//.test(ua)) msg = 'Este navegador embutido não instala apps. Abra o endereço diretamente no Chrome.';
    else if (!/Chrome\//.test(ua)) msg = 'Abra o endereço no Google Chrome para instalar o app.';
    else msg = 'O Chrome ainda não liberou a instalação. Se o app já estiver instalado, abra-o pelo ícone. Senão, use o menu ⋮ do Chrome > "Instalar app" ou "Adicionar à tela inicial", ou recarregue a página uma vez e tente de novo.';
    toast(msg);
    return;
  }
  promptInstalacao.prompt();
  const { outcome } = await promptInstalacao.userChoice;
  promptInstalacao = null;
  toast(outcome === 'accepted' ? 'Instalando o app…' : 'Instalação cancelada.');
}

/* =====================================================================
 * Teoria (carrega teoria-haikai.json dinamicamente)
 * ===================================================================== */
let teoriaCache = null;
async function carregarTeoria() {
  if (teoriaCache) return teoriaCache;
  const r = await fetch('teoria-haikai.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || !Array.isArray(j.pastas)) throw new Error('JSON de teoria inválido');
  teoriaCache = j;
  return j;
}

function erroTeoria(onRetry) {
  return el('div', { class: 'card', role: 'alert' },
    el('p', { text: 'Não foi possível carregar o arquivo teoria-haikai.json. Verifique a conexão e tente novamente.' }),
    btn('Tentar novamente', null, onRetry, 'btn primary'));
}

/* =====================================================================
 * Views
 * ===================================================================== */
function statusAcervo(a) {
  if (!a.inicio) return 'Ainda não iniciado';
  if (!a.fim) return `Em andamento desde ${fmt(a.inicio)}`;
  return `Finalizado em ${fmt(a.fim)}`;
}

function cartaoAcervo(a, rotulo) {
  const n = a.haikais.length;
  return el('a', { class: 'card card-link', href: '#/acervo/' + encodeURIComponent(a.id) },
    rotulo && el('span', { class: 'rotulo', text: rotulo }),
    el('h3', { text: a.nome }),
    el('p', { class: 'meta-linha', text: statusAcervo(a) }),
    el('p', { class: 'meta-linha', text: `${n} ${n === 1 ? 'haikai' : 'haikais'}` }));
}

function viewHome() {
  const ativo = dados.acervos.find((a) => a.inicio && !a.fim);
  const recentes = [...dados.acervos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 3);
  const content = el('div', { class: 'stack' },
    el('section', { class: 'hero' },
      el('img', { class: 'hero-logo', src: 'icon-192.png', alt: '', width: '96', height: '96' }),
      el('h1', { tabindex: '-1', text: 'Haikai Machine' }),
      el('p', { class: 'lead', text: 'A máquina fotográfica de texto.' }),
      el('p', { text: 'Quem tira foto fotografa. Quem faz haikai haikaliza. Saia de casa, observe, e registre o instante com data, hora e lugar.' }),
      el('div', { class: 'row' },
        btn('Novo Acervo', 'plus', abrirNovoAcervo, 'btn primary'),
        btn('Meus Acervos', 'folder', () => { location.hash = '#/acervos'; }))),
    ativo && cartaoAcervo(ativo, 'Passeio em andamento'),
    recentes.length > 0 && el('section', {},
      el('h2', { text: 'Acervos recentes' }),
      el('div', { class: 'lista' }, recentes.map((a) => cartaoAcervo(a)))));
  return { title: 'Início', content };
}

function viewAcervos() {
  const lista = [...dados.acervos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const content = el('div', { class: 'stack' },
    el('div', { class: 'row' },
      el('h1', { tabindex: '-1', text: 'Meus Acervos' }),
      btn('Novo Acervo', 'plus', abrirNovoAcervo, 'btn primary pequeno')),
    lista.length
      ? el('div', { class: 'lista' }, lista.map((a) => cartaoAcervo(a)))
      : el('div', { class: 'card vazio' },
          el('p', { text: 'Você ainda não tem acervos. Crie o primeiro para começar a haikalizar.' }),
          btn('Novo Acervo', 'plus', abrirNovoAcervo, 'btn primary')));
  return { title: 'Meus Acervos', content };
}

function cartaoHaikai(a, h, numero) {
  const l = h.local;
  const localNo = (l && l.status === 'ok')
    ? el('span', {},
        l.endereco ? `${l.endereco} · ` : '',
        el('a', { href: mapsUrl(l), target: '_blank', rel: 'noopener noreferrer', text: `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}` }),
        l.precisao != null ? ` (±${Math.round(l.precisao)} m)` : '')
    : el('span', { text: textoLocal(l) });

  const rot = `haikai ${numero}`;
  return el('article', { class: 'card haikai' },
    el('span', { class: 'rotulo', text: `Haikai ${numero}` }),
    el('p', { class: 'versos' }, h.versos.map((v) => el('span', { text: v }))),
    el('ul', { class: 'meta-lista' },
      el('li', {}, icon('clock'), el('time', { datetime: h.dataHora, text: fmt(h.dataHora) })),
      el('li', {}, icon('pin'), localNo)),
    el('div', { class: 'acoes-haikai' },
      btn('Copiar', 'copy', () => copiar(textoHaikai(a, h), 'Haikai copiado.'), 'btn pequeno', { 'aria-label': `Copiar ${rot}` }),
      btn('Compartilhar', 'share', () => compartilhar(`Haikai — ${a.nome}`, textoHaikai(a, h)), 'btn pequeno', { 'aria-label': `Compartilhar ${rot}` }),
      btn('Imprimir', 'print', () => imprimirHaikai(a, h, numero), 'btn pequeno', { 'aria-label': `Imprimir ${rot}` }),
      btn('Excluir', 'trash', async () => {
        if (await confirmar('Excluir haikai', `Excluir o ${rot} deste acervo? Esta ação não pode ser desfeita.`, 'Excluir')) {
          a.haikais = a.haikais.filter((x) => x.id !== h.id);
          if (salvar()) { toast('Haikai excluído.'); atualizar(); }
        }
      }, 'btn pequeno', { 'aria-label': `Excluir ${rot}` })));
}

function viewAcervo(vivo, id) {
  const a = dados.acervos.find((x) => x.id === id);
  if (!a) return viewNaoEncontrada();
  const hs = [...a.haikais].sort(porData);

  let controles;
  if (!a.inicio) {
    controles = el('div', { class: 'stack' },
      el('p', { text: 'Quando estiver pronto para sair, toque em Iniciar. O app registrará a data e a hora de início do passeio.' }),
      btn('Iniciar', 'play', () => {
        a.inicio = new Date().toISOString();
        if (salvar()) { toast('Passeio iniciado. Boa caminhada!'); atualizar(); } else a.inicio = null;
      }, 'btn primary btn-shutter'));
  } else if (!a.fim) {
    controles = el('div', { class: 'stack' },
      btn('Haikalizar', 'camera', () => abrirHaikalizar(a), 'btn primary btn-shutter'),
      el('div', { class: 'row' },
        btn('Finalizar passeio', 'stop', async () => {
          if (await confirmar('Finalizar passeio', 'Registrar o fim do passeio agora? Você poderá retomá-lo depois.', 'Finalizar')) {
            a.fim = new Date().toISOString();
            if (salvar()) { toast('Passeio finalizado.'); atualizar(); } else a.fim = null;
          }
        }, 'btn pequeno')));
  } else {
    controles = el('div', { class: 'row' },
      btn('Retomar passeio', 'play', () => {
        const antigo = a.fim;
        a.fim = null;
        if (salvar()) { toast('Passeio retomado.'); atualizar(); } else a.fim = antigo;
      }, 'btn primary'));
  }

  const content = el('div', { class: 'stack' },
    el('a', { class: 'voltar', href: '#/acervos' }, icon('arrow-left'), 'Meus Acervos'),
    el('section', { class: 'cabecalho-acervo' },
      el('h1', { tabindex: '-1', text: a.nome }),
      el('p', { class: 'stamp' }, icon('clock'),
        a.inicio ? el('span', {}, 'Início: ', el('time', { datetime: a.inicio, text: fmt(a.inicio) })) : el('span', { text: 'Passeio ainda não iniciado' })),
      a.fim && el('p', { class: 'stamp' }, icon('stop'), el('span', {}, 'Fim: ', el('time', { datetime: a.fim, text: fmt(a.fim) })))),
    controles,
    hs.length > 0 && el('section', { 'aria-label': 'Ações do acervo' },
      el('h2', { text: 'Acervo completo' }),
      el('div', { class: 'acoes-acervo' },
        btn('Copiar todos', 'copy', () => copiar(textoAcervo(a), 'Acervo copiado.'), 'btn pequeno'),
        btn('Compartilhar acervo', 'share', () => compartilhar(`Acervo — ${a.nome}`, textoAcervo(a)), 'btn pequeno'),
        btn('Imprimir acervo', 'print', () => imprimirAcervo(a), 'btn pequeno'))),
    el('section', {},
      el('h2', { text: `Haikais (${hs.length})` }),
      hs.length
        ? el('div', { class: 'lista' }, hs.map((h, i) => cartaoHaikai(a, h, i + 1)))
        : el('p', { class: 'muted', text: a.inicio ? 'Nenhum haikai ainda. Ao avistar uma cena, toque em Haikalizar.' : 'Os haikais capturados aparecerão aqui em ordem cronológica.' })),
    el('div', { class: 'row' },
      btn('Excluir acervo', 'trash', async () => {
        if (await confirmar('Excluir acervo', `Excluir "${a.nome}" e todos os seus ${a.haikais.length} haikai(s)? Esta ação não pode ser desfeita. Considere fazer um Backup Geral antes.`, 'Excluir acervo')) {
          dados.acervos = dados.acervos.filter((x) => x.id !== a.id);
          if (salvar()) { toast('Acervo excluído.'); location.hash = '#/acervos'; }
        }
      }, 'btn pequeno')));
  return { title: a.nome, content };
}

function viewTeoria(vivo) {
  const area = el('div', { class: 'lista', 'aria-busy': 'true' }, el('p', { class: 'muted', text: 'Carregando teoria…' }));
  const content = el('div', { class: 'stack' },
    el('h1', { tabindex: '-1', text: 'Teoria' }),
    el('p', { class: 'muted', text: 'Escolha uma pasta para estudar.' }),
    area);

  const carregar_ = () => carregarTeoria().then((j) => {
    if (!vivo()) return;
    area.removeAttribute('aria-busy');
    area.replaceChildren(...j.pastas.map((p) =>
      el('a', { class: 'card card-link card-folder', href: '#/teoria/' + encodeURIComponent(p.id) },
        icon('folder'),
        el('div', {}, el('h2', { text: p.titulo }), el('p', { class: 'meta-linha', text: p.resumo })))));
  }).catch((e) => {
    console.error(e);
    if (!vivo()) return;
    area.removeAttribute('aria-busy');
    area.replaceChildren(erroTeoria(() => { area.replaceChildren(el('p', { class: 'muted', text: 'Carregando teoria…' })); carregar_(); }));
  });
  carregar_();
  return { title: 'Teoria', content };
}

function viewPasta(vivo, id) {
  const corpo = el('div', { class: 'stack', 'aria-busy': 'true' }, el('p', { class: 'muted', text: 'Carregando…' }));
  const content = el('div', { class: 'stack' },
    el('a', { class: 'voltar', href: '#/teoria' }, icon('arrow-left'), 'Teoria'),
    el('h1', { tabindex: '-1', text: 'Teoria' }),
    corpo);
  const h1 = $('h1', content);

  const carregar_ = () => carregarTeoria().then((j) => {
    if (!vivo()) return;
    const i = j.pastas.findIndex((p) => p.id === id);
    if (i < 0) { h1.textContent = 'Pasta não encontrada'; corpo.removeAttribute('aria-busy'); corpo.replaceChildren(el('p', { text: 'Esta pasta não existe no arquivo de teoria.' })); return; }
    const p = j.pastas[i];
    document.title = `${p.titulo} · Haikai Machine`;
    h1.textContent = p.titulo;
    corpo.removeAttribute('aria-busy');
    const paragrafos = String(p.conteudo).split(/\n{2,}/).map((t) => el('p', { text: t }));
    const exemplos = Array.isArray(p.exemplos) ? p.exemplos : [];
    const ant = j.pastas[i - 1];
    const prox = j.pastas[i + 1];
    corpo.replaceChildren(
      el('p', { class: 'lead', text: p.resumo }),
      el('section', { class: 'teoria-texto' }, el('h2', { text: 'Texto teórico' }), paragrafos),
      exemplos.length > 0 && el('section', {},
        el('h2', { text: 'Exemplos comentados' }),
        exemplos.map((ex) => el('figure', { class: 'exemplo card' },
          el('p', { class: 'versos' }, (ex.versos || []).map((v) => el('span', { text: v }))),
          el('figcaption', { text: ex.comentario || '' })))),
      el('nav', { class: 'nav-pastas', 'aria-label': 'Navegar entre pastas' },
        ant ? el('a', { class: 'btn pequeno', href: '#/teoria/' + encodeURIComponent(ant.id) }, icon('arrow-left'), el('span', { text: 'Anterior' })) : el('span'),
        prox ? el('a', { class: 'btn pequeno', href: '#/teoria/' + encodeURIComponent(prox.id) }, el('span', { text: 'Próxima' }), icon('arrow-right')) : el('span')));
  }).catch((e) => {
    console.error(e);
    if (!vivo()) return;
    corpo.removeAttribute('aria-busy');
    corpo.replaceChildren(erroTeoria(() => { corpo.replaceChildren(el('p', { class: 'muted', text: 'Carregando…' })); carregar_(); }));
  });
  carregar_();
  return { title: 'Teoria', content };
}

function viewSobre() {
  const content = el('div', { class: 'stack teoria-texto' },
    el('h1', { tabindex: '-1', text: 'Sobre o Haikai Machine' }),
    el('p', { text: 'O Haikai Machine é uma máquina fotográfica de texto. Assim como quem tira foto fotografa, quem faz haikai haikaliza: o app existe para você registrar, em poucas palavras, situações, cenas e instantes efêmeros que observa ao sair de casa, em viagens, passeios, deslocamentos para o trabalho ou caminhadas.' }),
    el('h2', { text: 'A origem do nome' }),
    el('p', { text: 'Uma câmera captura a luz de um instante; o haikai captura a cena com palavras. Por isso o aplicativo funciona como uma câmera: você começa um Acervo (o rolo de filme do passeio), toca em Iniciar, e a cada cena que chama sua atenção toca em Haikalizar para "revelar" três versos. Cada registro recebe automaticamente a data e a hora exatas e a localização do lugar onde aconteceu, como a etiqueta de uma fotografia.' }),
    el('h2', { text: 'Filosofia' }),
    el('p', { text: 'Observar com atenção, escrever pouco e deixar a imagem falar por si. Sem pressa, sem excesso de explicação. A contagem de sílabas 5-7-5 é uma companheira de treino, não uma regra que bloqueia a escrita.' }),
    el('h2', { text: 'Privacidade' }),
    el('p', { text: 'Seus acervos ficam salvos apenas neste navegador, no seu dispositivo. Nada é enviado a servidores do app. A localização só é pedida no momento em que você revela um haikai. Para consultar um endereço de referência, as coordenadas são enviadas ao serviço público OpenStreetMap Nominatim; se isso falhar, o registro mantém apenas as coordenadas.' }),
    el('p', {}, el('a', { href: URL_REPO, target: '_blank', rel: 'noopener noreferrer', text: 'Código-fonte no GitHub' })));
  return { title: 'Sobre', content };
}

function viewAjuda() {
  const content = el('div', { class: 'stack teoria-texto' },
    el('h1', { tabindex: '-1', text: 'Ajuda' }),
    el('h2', { text: 'Como haikalizar' }),
    el('ol', { class: 'passos' },
      el('li', { text: 'Toque em Novo Acervo e dê um nome ao passeio (até 50 caracteres).' }),
      el('li', { text: 'Na tela do acervo, toque em Iniciar. A data e a hora de início ficam registradas.' }),
      el('li', { text: 'Ao avistar uma cena, toque em Haikalizar e escreva três versos curtos (até 40 caracteres cada). O contador mostra as sílabas poéticas 5-7-5 sem bloquear a escrita.' }),
      el('li', { text: 'Toque em Revelar haikai. O app anexa data, hora e localização. Autorize a localização quando o navegador pedir.' }),
      el('li', { text: 'Use Copiar, Compartilhar e Imprimir em cada haikai ou no acervo completo.' })),
    el('h2', { text: 'Dicas' }),
    el('ul', { class: 'passos' },
      el('li', { text: 'Se a localização for negada, o haikai é salvo mesmo assim, com o aviso. Você pode liberar a permissão no ícone de cadeado ao lado do endereço do site.' }),
      el('li', { text: 'Faça um Backup Geral de vez em quando: os dados vivem só neste navegador e podem ser perdidos se você limpar os dados do site.' }),
      el('li', { text: 'Instale o app pelo menu (Instalar App) para usá-lo em tela cheia e offline.' })),
    el('p', {}, el('a', { href: URL_README, target: '_blank', rel: 'noopener noreferrer', text: 'Ver a ajuda completa (README no GitHub)' })));
  return { title: 'Ajuda', content };
}

function viewNaoEncontrada() {
  return {
    title: 'Página não encontrada',
    content: el('div', { class: 'card vazio' },
      el('h1', { tabindex: '-1', text: 'Não encontrado' }),
      el('p', { text: 'Este acervo ou página não existe (talvez tenha sido excluído).' }),
      btn('Ir para o início', 'home', () => { location.hash = '#/'; }, 'btn primary'))
  };
}

/* =====================================================================
 * Roteador por hash
 * ===================================================================== */
const rotas = [
  [/^#?\/?$/, viewHome],
  [/^#\/acervos$/, viewAcervos],
  [/^#\/acervo\/([^/]+)$/, viewAcervo],
  [/^#\/teoria$/, viewTeoria],
  [/^#\/teoria\/([^/]+)$/, viewPasta],
  [/^#\/sobre$/, viewSobre],
  [/^#\/ajuda$/, viewAjuda]
];
let tokenRota = 0;

function rotear({ foco = true, manterRolagem = false } = {}) {
  const token = ++tokenRota;
  const vivo = () => token === tokenRota;
  const hash = location.hash || '#/';
  let view = viewNaoEncontrada;
  let args = [];
  for (const [re, fn] of rotas) {
    const m = hash.match(re);
    if (m) { view = fn; args = m.slice(1).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } }); break; }
  }
  const y = window.scrollY;
  let r;
  try { r = view(vivo, ...args); }
  catch (e) { console.error(e); r = { title: 'Erro', content: el('div', { class: 'card' }, el('h1', { tabindex: '-1', text: 'Algo deu errado' }), el('p', { text: 'Não foi possível exibir esta tela.' })) }; }
  // views sem parâmetro "vivo" na assinatura (viewHome etc.) ignoram o primeiro argumento extra
  const main = $('#conteudo');
  main.replaceChildren(r.content);
  document.title = `${r.title} · Haikai Machine`;
  window.scrollTo(0, manterRolagem ? y : 0);
  if (foco) { const h1 = $('h1', main); if (h1) h1.focus({ preventScroll: true }); }
  $$('.menu-item[href^="#"]', drawer).forEach((a) => {
    const alvo = a.getAttribute('href');
    const atual = alvo === '#/' ? (hash === '#/' || hash === '#' || hash === '') : hash === alvo || (alvo !== '#/' && hash.startsWith(alvo + '/'));
    if (atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
const atualizar = () => rotear({ foco: false, manterRolagem: true });

/* =====================================================================
 * Inicialização
 * ===================================================================== */
function iniciar() {
  carregar();
  iniciarCabecalho();
  iniciarDrawer();
  iniciarDialogoNovo();
  iniciarDialogoHaikai();
  iniciarImportacao();

  $('#share-fechar').addEventListener('click', () => $('#dlg-share').close());
  $('#share-copiar').addEventListener('click', () => copiar($('#share-texto').value));

  window.addEventListener('hashchange', () => { fecharMenu(false); rotear(); });
  rotear({ foco: false });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker não registrado:', e));
    });
  }
}

// Views sem "vivo" recebem-no como primeiro argumento: ajusta assinaturas simples.
const _viewHome = viewHome, _viewAcervos = viewAcervos, _viewSobre = viewSobre, _viewAjuda = viewAjuda;
rotas[0][1] = () => _viewHome();
rotas[1][1] = () => _viewAcervos();
rotas[5][1] = () => _viewSobre();
rotas[6][1] = () => _viewAjuda();

iniciar();
})();
