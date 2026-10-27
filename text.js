const ListenText = (() => {
  const MAX = 220;
  const ABBR = /^(mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|no|fig)$/i;
  const BLOCK = /^(p|div|br|li|h[1-6]|tr|section|article|blockquote|pre)$/i;

  // Cut one over-long span at the last , ; : — before MAX, else the last space, else hard.
  function chunk(text, s, e, out) {
    while (e - s > MAX) {
      const head = text.slice(s, s + MAX);
      let cut = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'), head.lastIndexOf('—')) + 1;
      if (cut <= 0) cut = head.lastIndexOf(' ') + 1;
      if (cut <= 0) cut = MAX;
      push(text, s, s + cut, out);
      s += cut;
    }
    push(text, s, e, out);
  }
  function push(text, s, e, out) {
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) out.push({ start: s, end: e });
  }

  function splitSentences(text) {
    const out = [];
    let lineStart = 0;
    for (const line of text.split('\n')) {
      let s = lineStart;
      const re = /[.!?…]+["'”’)\]]*(?=\s|$)/g;
      let m;
      while ((m = re.exec(line))) {
        if (/^\.["'”’)\]]*$/.test(m[0])) {
          let w = m.index; // walk back one word only, so long lines stay linear
          while (w > 0 && !/\s/.test(line[w - 1])) w--;
          const word = line.slice(w, m.index).replace(/^["'“‘(\[]+/, '');
          if (ABBR.test(word) || /^[A-Z]$/.test(word)) continue;
        }
        chunk(text, s, lineStart + m.index + m[0].length, out);
        s = lineStart + m.index + m[0].length;
      }
      chunk(text, s, lineStart + line.length, out);
      lineStart += line.length + 1;
    }
    return out;
  }

  function paragraphs(text) {
    const out = [];
    let at = 0;
    for (const line of text.split('\n')) {
      push(text, at, at + line.length, out);
      at += line.length + 1;
    }
    return out;
  }

  function wordAt(text, index, length) {
    if (length > 0) return { start: index, end: index + length };
    const m = /\s/.exec(text.slice(index));
    return { start: index, end: m ? index + m.index : text.length };
  }

  const countWords = (text) => (text.match(/\S+/g) || []).length;

  const stripMarkdown = (text) => text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>+[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/\*\*|__|`/g, '');

  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
    let out = '';
    (function walk(n) {
      if (n.nodeType === 3) out += n.data.replace(/\s+/g, ' ');
      else if (n.nodeType === 1) {
        const b = BLOCK.test(n.localName);
        if (b) out += '\n';
        n.childNodes.forEach(walk);
        if (b) out += '\n';
      }
    })(doc.body);
    return out.replace(/[ \t]*\n\s*/g, '\n').trim();
  }

  async function readZip(buf) {
    const b = new Uint8Array(buf), v = new DataView(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip');
    const files = new Map();
    const dec = new TextDecoder();
    let p = v.getUint32(eocd + 16, true);
    for (let n = v.getUint16(eocd + 10, true); n > 0; n--) {
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true), skip = v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
      files.set(name, async () => {
        const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
        const data = b.subarray(start, start + size);
        if (method === 0) return dec.decode(data);
        if (method !== 8) throw new Error('unsupported zip method ' + method);
        return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      });
      p += 46 + nameLen + skip;
    }
    return files;
  }

  const unescapeXml = (s) => s.replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);

  async function docxToText(zip) {
    if (!zip.has('word/document.xml')) throw new Error('not a docx');
    const xml = await zip.get('word/document.xml')();
    return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((para) =>
      (para.match(/<w:t[ >][^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || []).map((t) =>
        t === '<w:tab/>' ? ' ' : t === '<w:br/>' ? '\n' : unescapeXml(t.replace(/<[^>]*>/g, ''))).join('')).join('\n');
  }

  async function epubToText(zip) {
    if (!zip.has('META-INF/container.xml')) throw new Error('not an epub');
    const container = await zip.get('META-INF/container.xml')();
    const opfPath = /full-path="([^"]+)"/.exec(container)?.[1];
    if (!zip.has(opfPath)) throw new Error('not an epub');
    const opf = await zip.get(opfPath)();
    const href = {};
    for (const tag of opf.match(/<item\s[^>]*>/g) || []) {
      const id = /\bid="([^"]*)"/.exec(tag), h = /\bhref="([^"]*)"/.exec(tag);
      if (id && h) href[id[1]] = h[1];
    }
    const parts = [];
    for (const ref of opf.match(/<itemref\s[^>]*>/g) || []) {
      const h = href[/idref="([^"]*)"/.exec(ref)?.[1]];
      const entry = h && zip.get(decodeURIComponent(new URL(h, 'http://z/' + opfPath).pathname.slice(1)));
      if (entry) parts.push(htmlToText(await entry()));
    }
    return parts.filter(Boolean).join('\n\n');
  }

  async function fileToText(file) {
    const dot = file.name.lastIndexOf('.');
    const ext = dot < 0 ? '' : file.name.slice(dot + 1).toLowerCase();
    const title = dot > 0 ? file.name.slice(0, dot) : file.name;
    let text;
    if (ext === 'txt') text = await file.text();
    else if (ext === 'md') text = stripMarkdown(await file.text());
    else if (ext === 'html' || ext === 'htm') text = htmlToText(await file.text());
    else if (ext === 'docx') text = await docxToText(await readZip(await file.arrayBuffer()));
    else if (ext === 'epub') text = await epubToText(await readZip(await file.arrayBuffer()));
    else throw new Error('unsupported file type');
    return { title, text };
  }

  return { splitSentences, paragraphs, wordAt, countWords, stripMarkdown, htmlToText, readZip, docxToText, epubToText, fileToText };
})();
if (typeof module !== 'undefined') module.exports = ListenText;
