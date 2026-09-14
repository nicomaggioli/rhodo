const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.join(__dirname, '../public');
const folder = path.join(root, 'assets/demo-stream/22f2ac7ed6b50f6c');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
const original = Buffer.concat(manifest.parts.map(p => fs.readFileSync(path.join(folder, p.file))));
const context = {
  URL, Request, Response, ReadableStream, Uint8Array, AbortController,
  self: { addEventListener() {}, registration: { scope: 'https://rhodo.test/' } },
  fetch: async url => new Response(fs.readFileSync(path.join(root, new URL(url).pathname)), { status: 200 }),
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'media-worker.js'), 'utf8'), context);
const url = new URL('https://rhodo.test/assets/rhodo-demo.mp4?content=22f2ac7ed6b50f6c');
async function response(range, method = 'GET') {
  return context.serveVideo(new Request(url, { method, headers: range ? { Range: range } : {} }), url);
}

test('all immutable parts reconstruct the approved MP4 exactly', () => {
  assert.equal(original.length, manifest.size);
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'), manifest.sha256);
  for (const part of manifest.parts) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder, part.file))).digest('hex'), part.sha256);
    assert.ok(part.size <= 4 * 1024 * 1024);
  }
});

for (const [label, range, start, end] of [
  ['first bytes', 'bytes=0-1', 0, 1],
  ['part boundary', 'bytes=4194290-4194350', 4194290, 4194350],
  ['open ended', `bytes=${manifest.size - 123}-`, manifest.size - 123, manifest.size - 1],
  ['suffix', 'bytes=-100', manifest.size - 100, manifest.size - 1],
  ['oversized end', `bytes=${manifest.size - 10}-${manifest.size + 100}`, manifest.size - 10, manifest.size - 1],
]) test(label + ' returns exact native byte range', async () => {
  const r = await response(range);
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), `bytes ${start}-${end}/${manifest.size}`);
  assert.equal(r.headers.get('content-length'), String(end - start + 1));
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), original.subarray(start, end + 1));
});

test('unsatisfiable ranges return 416 and total size', async () => {
  const r = await response(`bytes=${manifest.size}-`);
  assert.equal(r.status, 416);
  assert.equal(r.headers.get('content-range'), `bytes */${manifest.size}`);
});

test('HEAD supplies metadata without a body', async () => {
  const r = await response(null, 'HEAD');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-length'), String(manifest.size));
  assert.equal((await r.arrayBuffer()).byteLength, 0);
});

test('full GET streams a byte-identical video', async () => {
  const r = await response(null);
  assert.equal(r.status, 200);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'), manifest.sha256);
});

test('unsupported multi-range falls back to the complete representation', async () => {
  const r = await response('bytes=0-1,50-60');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-length'), String(manifest.size));
  await r.body.cancel();
});
