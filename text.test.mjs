import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
const T = createRequire(import.meta.url)('./text.js');

const pieces = (s) => T.splitSentences(s).map((p) => s.slice(p.start, p.end));

assert.deepEqual(pieces('Dr. Smith arrived. He sat down.'), ['Dr. Smith arrived.', 'He sat down.']);
assert.equal(pieces('J. R. Smith wrote it. Then he left!').length, 2);
assert.equal(pieces('Wait… what? Yes.').length, 3);
assert.deepEqual(pieces('He said "Go." Then left.'), ['He said "Go."', 'Then left.']);
assert.deepEqual(pieces('Line one\nLine two'), ['Line one', 'Line two']);
assert.deepEqual(pieces('   \n\t '), []);

const long = 'word, '.repeat(100).trim().replace(/,$/, '.'); // 600-ish chars, one sentence
const ps = T.splitSentences(long);
assert.ok(ps.length >= 3);
let prev = 0, covered = '';
for (const p of ps) {
  assert.ok(p.end - p.start <= 220 && p.end > p.start && p.start >= prev);
  covered += long.slice(p.start, p.end).replace(/\s/g, '');
  prev = p.end;
}
assert.equal(covered, long.replace(/\s/g, ''));

assert.deepEqual(T.wordAt('hello brave world', 6), { start: 6, end: 11 });
assert.deepEqual(T.wordAt('hello brave world', 6, 3), { start: 6, end: 9 });
assert.equal(T.countWords(' a bb\nccc '), 3);
assert.deepEqual(T.paragraphs('ab\n\n  cd \n'), [{ start: 0, end: 2 }, { start: 6, end: 8 }]);
assert.equal(T.stripMarkdown('# Title\n- **bold** item\n> quote `code`'), 'Title\nbold item\nquote code');

// Build a tiny ZIP by hand: one stored entry, one deflated entry.
function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content, method] of entries) {
    const raw = Buffer.from(content), nm = Buffer.from(name);
    const data = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nm, data); centrals.push(ch, nm);
    offset += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const b = Buffer.concat([...locals, cd, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

const xml = '<w:document><w:body><w:p><w:r><w:t>First para</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Second</w:t><w:tab/><w:t>part</w:t></w:r></w:p></w:body></w:document>';
const zip = await T.readZip(makeZip([['word/document.xml', xml, 8], ['a.txt', 'héllo', 0]]));
assert.equal(await zip.get('a.txt')(), 'héllo');
assert.equal(await T.docxToText(zip), 'First para\nSecond part');
await assert.rejects(T.readZip(new ArrayBuffer(10)), /not a zip/);

await assert.rejects(T.docxToText(await T.readZip(makeZip([['a.txt', 'x', 0]]))), /not a docx/);
await assert.rejects(T.epubToText(await T.readZip(makeZip([['a.txt', 'x', 0]]))), /not an epub/);
assert.equal(pieces('"Dr. Smith left. (J. R. Smith too.)').length, 2);

for (const s of ['Word one. '.repeat(30000), 'Dr. '.repeat(75000)]) {
  const t0 = Date.now();
  T.splitSentences(s);
  assert.ok(Date.now() - t0 < 1000, 'splitSentences too slow');
}

assert.deepEqual(await T.fileToText(new File(['# Hi\n- **x**'], 'note.md')), { title: 'note', text: 'Hi\nx' });
assert.deepEqual(await T.fileToText(new File(['plain'], 'a.b.txt')), { title: 'a.b', text: 'plain' });
await assert.rejects(T.fileToText(new File(['x'], 'txt')), /unsupported/);

console.log('all text tests passed');
