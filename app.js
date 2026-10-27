// Unsubbed Listen: reads your documents aloud with the browser's own voices. Nothing leaves the device.
const $ = (s) => document.querySelector(s);
const T = ListenText;
const synth = window.speechSynthesis;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const [reader, ta, shelf, sel, playBtn] = ['#reader', '#ta', '#shelf', '#voice', '#play'].map($);

const WELCOME = `Welcome to Listen. Press the play button, or the Space bar, and this page will be read aloud to you.
Click any sentence to start reading from there. The left and right arrow keys skip back or forward one sentence, and the square bracket keys make the voice slower or faster.
To hear your own words, press New and paste some text, or use Open to add a text file, a Word document, an e-book or a saved web page.
Listen remembers where you stopped in every document, so you can come back later and carry on.
Everything stays on this device. There is no account, no limit and no upload. Pick a voice you like in the Voice card, and enjoy.`;

const S = { docs: [], current: null, voice: '', rate: 1, localOnly: true, size: 'm', follow: true };
let pieces = [], spans = [], token = 0, playing = false, editing = false;
const counts = new WeakMap();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const doc = () => S.docs.find((d) => d.id === S.current);
const sorted = () => [...S.docs].sort((a, b) => b.added - a.added);
const firstLine = (t) => t.trim().split('\n')[0].trim().slice(0, 50);
function newDoc(title, text) {
  const d = { id: uid(), title, text, pos: 0, added: Date.now() };
  S.docs.push(d);
  S.current = d.id;
}

const kit = Unsubbed.app({
  id: 'listen',
  name: 'Unsubbed Listen',
  accept: '.txt,.md,.html,.htm,.docx,.epub,.json',
  load: (s) => Object.assign(S, s),
  state: () => S,
  exportFile: () => ({
    name: 'listen-backup.json',
    data: JSON.stringify({ app: 'unsubbed-listen', version: 1, docs: S.docs }, null, 2),
    type: 'application/json',
  }),
  importFile,
});

async function importFile(file) {
  if (/\.json$/i.test(file.name)) {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'unsubbed-listen' || !Array.isArray(data.docs)) throw new Error('not a Listen backup');
    stop(); // before docs change: stop() re-renders the Deck from the current doc
    for (const d of data.docs) {
      if (typeof d?.text !== 'string') continue;
      const clean = { id: String(d.id || uid()), title: String(d.title || 'Untitled'), text: d.text, pos: Math.max(0, d.pos | 0), added: +d.added || Date.now() };
      const i = S.docs.findIndex((x) => x.id === clean.id);
      if (i < 0) S.docs.push(clean); else S.docs[i] = clean;
    }
  } else {
    const { title, text } = await T.fileToText(file);
    // The kit toasts "Opened" right after this resolves, so ours must come later.
    if (!text.trim()) return void setTimeout(() => kit.toast(`${file.name} has no text we can read.`), 0);
    stop();
    newDoc(title, text.replace(/\r\n?/g, '\n'));
    editing = false;
  }
  render();
}

// ---- Rendering ----
function render() {
  const d = doc();
  pieces = T.splitSentences(d.text);
  d.pos = Math.min(Math.max(0, d.pos | 0), Math.max(0, pieces.length - 1));
  if (!d.text.trim()) editing = true;
  $('#doc-title').textContent = d.title;
  $('#edit').textContent = editing ? 'Done' : 'Edit';
  reader.hidden = editing;
  $('#editor').hidden = !editing;
  $('#empty-note').hidden = !!d.text.trim();
  if (editing) {
    if (ta.value !== d.text) ta.value = d.text;
    spans = [];
    reader.replaceChildren();
  } else buildReader(d.text);
  spans[d.pos]?.classList.add('now');
  renderDeck();
  renderShelf();
}

// One fragment, text only (never innerHTML), so huge or HTML-looking text stays fast and inert.
function buildReader(text) {
  const frag = document.createDocumentFragment();
  spans = [];
  let k = 0;
  for (const p of T.paragraphs(text)) {
    const el = document.createElement('p');
    let at = p.start;
    for (; k < pieces.length && pieces[k].start < p.end; k++) {
      const s = pieces[k];
      if (s.start > at) el.append(text.slice(at, s.start));
      const span = document.createElement('span');
      span.className = 's';
      span.dataset.i = k;
      span.textContent = text.slice(s.start, s.end);
      el.append(span);
      spans.push(span);
      at = s.end;
    }
    if (at < p.end) el.append(text.slice(at, p.end));
    frag.append(el);
  }
  reader.replaceChildren(frag);
}

function renderDeck() {
  const d = doc(), n = pieces.length, p = pieces[d.pos];
  $('#progress').textContent = n && p
    ? `Sentence ${d.pos + 1} of ${n} · about ${Math.ceil(T.countWords(d.text.slice(p.start)) / (170 * S.rate))} min left`
    : 'Nothing to read yet';
  playBtn.disabled = !synth || !n;
  playBtn.classList.toggle('on', playing);
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function renderRate() {
  $('#rate').textContent = S.rate.toFixed(1) + '×';
  $('#wpm').textContent = `≈ ${Math.round(170 * S.rate)} words/min`;
}

function rowMeta(d) {
  let c = counts.get(d);
  if (!c || c.text !== d.text) counts.set(d, (c = { text: d.text, n: T.splitSentences(d.text).length, min: Math.ceil(T.countWords(d.text) / 170) }));
  return `${c.min} min · ${c.n ? Math.round((d.pos / c.n) * 100) : 0}%`;
}

function renderShelf() {
  shelf.replaceChildren(...sorted().map((d) => {
    const li = document.createElement('li');
    li.dataset.id = d.id;
    const open = document.createElement('button');
    open.className = 'open';
    if (d.id === S.current) open.setAttribute('aria-current', 'true');
    const t = document.createElement('span'), m = document.createElement('span');
    t.className = 't';
    t.textContent = d.title;
    m.className = 'm';
    m.textContent = rowMeta(d);
    open.append(t, m);
    const rm = document.createElement('button');
    rm.className = 'u-btn icon rm';
    rm.setAttribute('aria-label', `Remove ${d.title}`);
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    li.append(open, rm);
    return li;
  }));
}

// ---- Position and speaking ----
function setPos(i) {
  const d = doc();
  spans[d.pos]?.classList.remove('now');
  d.pos = i;
  spans[i]?.classList.add('now');
  if (S.follow) spans[i]?.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  clearWord();
  renderDeck();
  const meta = shelf.querySelector('[aria-current] .m'); // update in place so shelf focus survives
  if (meta) meta.textContent = rowMeta(d);
  kit.store();
}

// Only cancel when something is queued; also keep the live utterance referenced so Chrome can't garbage-collect it and drop its onend.
const hush = () => (synth?.speaking || synth?.pending) && synth.cancel();
let live;
const voice = () => synth?.getVoices().find((v) => v.voiceURI === sel.value);
function utter(text) {
  const u = new SpeechSynthesisUtterance(text), v = voice();
  if (v) { u.voice = v; u.lang = v.lang; }
  u.rate = S.rate;
  return u;
}

function speak(i) {
  const t = ++token, p = pieces[i];
  hush();
  setPos(i);
  const u = (live = utter(doc().text.slice(p.start, p.end)));
  // A cancelled utterance can still fire events later; the token makes them no-ops.
  u.onboundary = (e) => { if (t === token && e.name === 'word') markWord(i, e.charIndex, e.charLength); };
  u.onend = () => { if (t === token) i + 1 < pieces.length ? speak(i + 1) : finish(); };
  u.onerror = (e) => {
    if (t !== token || e.error === 'interrupted' || e.error === 'canceled') return;
    stop();
    kit.toast("Couldn't play that voice. Try another one.");
  };
  synth.speak(u);
}

function start(i) {
  if (!synth) return;
  if (editing) { editing = false; render(); }
  if (!pieces.length) return;
  playing = true;
  speak(i ?? doc().pos);
}

function stop() {
  token++;
  playing = false;
  hush();
  clearWord();
  renderDeck();
}

function finish() {
  stop();
  setPos(0);
  kit.toast('Finished. Press play to hear it again.');
}

function move(step) {
  if (!pieces.length) return;
  const i = Math.min(Math.max(doc().pos + step, 0), pieces.length - 1);
  playing ? speak(i) : setPos(i);
}

function setRate(r) {
  S.rate = Math.min(3, Math.max(0.5, Math.round(r * 10) / 10));
  renderRate();
  if (playing) speak(doc().pos); else renderDeck();
  kit.store();
}

function markWord(i, index, length) {
  const node = spans[i]?.firstChild;
  if (!window.Highlight || !node) return;
  const w = T.wordAt(node.data, index, length), r = new Range();
  r.setStart(node, Math.min(w.start, node.length));
  r.setEnd(node, Math.min(w.end, node.length));
  CSS.highlights.set('listen-word', new Highlight(r));
}
const clearWord = () => window.Highlight && CSS.highlights.delete('listen-word');

// ---- Voices ----
function loadVoices() {
  const list = (synth?.getVoices() || []).filter((v) => !S.localOnly || v.localService);
  let names;
  try { names = new Intl.DisplayNames([navigator.language], { type: 'language' }); } catch {}
  const groups = new Map();
  for (const v of list) {
    let label = v.lang;
    try { label = names.of(v.lang) || v.lang; } catch {}
    if (!groups.has(label)) groups.set(label, Object.assign(document.createElement('optgroup'), { label }));
    groups.get(label).append(new Option(v.name + (v.localService ? '' : ' · online'), v.voiceURI));
  }
  sel.replaceChildren(...[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g));
  // Keep the saved choice; otherwise suggest a default without saving it, so a late voice list can't override the user.
  const local = list.filter((v) => v.localService), base = navigator.language.split('-')[0];
  const pick = list.find((v) => v.voiceURI === S.voice) || local.find((v) => v.lang === navigator.language)
    || local.find((v) => v.lang.startsWith(base)) || local[0] || list[0];
  if (pick) sel.value = pick.voiceURI;
  sel.disabled = $('#try').disabled = !list.length;
  $('#no-voices').hidden = !!list.length;
  $('#local-note').textContent = S.localOnly
    ? 'Your text never leaves this device.'
    : 'Online voices sound more natural, but your browser sends the text to its maker (Google, Microsoft or Apple) to speak it. Unsubbed never sees it.';
}

// ---- Events ----
playBtn.onclick = () => (playing ? stop() : start());
$('#back').onclick = () => move(-1);
$('#fwd').onclick = () => move(1);
$('#slower').onclick = () => setRate(S.rate - 0.1);
$('#faster').onclick = () => setRate(S.rate + 0.1);

reader.onclick = (e) => {
  const s = e.target.closest('.s');
  if (s) start(+s.dataset.i);
};

$('#edit').onclick = () => {
  stop();
  editing = !editing;
  render();
  if (editing) ta.focus();
};

ta.oninput = () => {
  const d = doc();
  if (d.title === 'Untitled' || d.title === firstLine(d.text)) d.title = firstLine(ta.value) || 'Untitled';
  d.text = ta.value;
  d.pos = 0;
  // shortcut: re-splits the whole text per keystroke; fine for articles, debounce if huge docs get typed in.
  pieces = T.splitSentences(d.text);
  $('#doc-title').textContent = d.title;
  renderDeck();
  renderShelf();
  kit.store();
};

$('#new').onclick = () => {
  stop();
  newDoc('Untitled', '');
  editing = true;
  render();
  ta.focus();
  kit.store();
};

shelf.onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.closest('li').dataset.id, d = S.docs.find((x) => x.id === id);
  const rm = b.classList.contains('rm');
  if (rm && !confirm(`Remove “${d.title}” from this device?`)) return;
  if (rm && id !== S.current) {
    S.docs = S.docs.filter((x) => x !== d);
    renderShelf();
    return kit.store();
  }
  stop(); // before switching: stop() re-renders the Deck from the current doc's pieces
  if (rm) {
    S.docs = S.docs.filter((x) => x !== d);
    if (!S.docs.length) newDoc('Untitled', '');
    S.current = sorted()[0].id;
  } else S.current = id;
  editing = false;
  render();
  kit.store();
};

sel.onchange = () => {
  S.voice = sel.value;
  if (playing) speak(doc().pos);
  kit.store();
};
$('#local').onchange = (e) => {
  S.localOnly = e.target.checked;
  loadVoices();
  if (playing) speak(doc().pos);
  kit.store();
};
$('#try').onclick = () => {
  stop();
  synth.speak((live = utter('Hello. This is how I sound.')));
};

$('#size').onchange = (e) => {
  reader.dataset.size = S.size = e.target.value;
  kit.store();
};
$('#follow').onchange = (e) => {
  S.follow = e.target.checked;
  kit.store();
};

document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (el.closest?.('input, textarea, select, [contenteditable]')) return;
  if (e.key === ' ') {
    if (el.closest?.('button, a')) return;
    playing ? stop() : start();
  } else if (e.key === 'ArrowLeft') move(-1);
  else if (e.key === 'ArrowRight') move(1);
  else if (e.key === '[') setRate(S.rate - 0.1);
  else if (e.key === ']') setRate(S.rate + 0.1);
  else if (e.key === 'Enter' && el === reader) start();
  else return;
  e.preventDefault();
});

// Measure the kit header so the Deck can stick right under it.
const measureBar = () => document.documentElement.style.setProperty('--bar-h', $('.u-bar').offsetHeight + 'px');
addEventListener('resize', measureBar);
addEventListener('pagehide', () => synth?.cancel()); // Chrome can keep talking after a reload

// ---- Start ----
if (!Array.isArray(S.docs)) S.docs = [];
if (!S.docs.length) newDoc('Welcome to Listen', WELCOME);
if (!doc()) S.current = sorted()[0].id;
S.rate = Math.min(3, Math.max(0.5, +S.rate || 1));
if (!['s', 'm', 'l'].includes(S.size)) S.size = 'm';
reader.dataset.size = $('#size').value = S.size;
$('#follow').checked = S.follow;
$('#local').checked = S.localOnly;
$('#no-speech').hidden = !!synth;
measureBar();
renderRate();
render();
loadVoices();
synth?.addEventListener('voiceschanged', loadVoices);
