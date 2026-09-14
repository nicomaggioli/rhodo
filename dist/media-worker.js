/* Deliver the original MP4 in byte ranges from small, immutable static parts. */
const manifests = new Map();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function byteRange(value, size) {
  if (!value || value.includes(",")) return { start: 0, end: size - 1, status: 200 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    end = Math.min(end, size - 1);
  }
  return start >= size || end < start ? null : { start, end, status: 206 };
}

async function getManifest(folder) {
  if (!manifests.has(folder)) {
    const promise = fetch(new URL("manifest.json", folder), { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Video manifest unavailable");
        const data = await response.json();
        let size = 0;
        if (!Array.isArray(data.parts) || !data.parts.length) throw new Error("Invalid video manifest");
        for (const part of data.parts) {
          if (!/^part-\d{3}\.bin$/.test(part.file) || !Number.isSafeInteger(part.size) || part.size <= 0)
            throw new Error("Invalid video part");
          part.offset = size;
          size += part.size;
        }
        if (size !== data.size) throw new Error("Invalid video size");
        return data;
      }).catch((error) => { manifests.delete(folder); throw error; });
    manifests.set(folder, promise);
  }
  return manifests.get(folder);
}

async function serveVideo(request, url) {
  const version = url.searchParams.get("content");
  if (!/^[a-f0-9]{16}$/.test(version || "")) return new Response("Unknown video", { status: 404 });
  const folder = new URL(`demo-stream/${version}/`, url).href;
  let manifest;
  try { manifest = await getManifest(folder); }
  catch { return new Response("Video unavailable", { status: 503 }); }
  const range = byteRange(request.headers.get("range"), manifest.size);
  const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  if (!range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${manifest.size}` } });
  headers["Content-Length"] = String(range.end - range.start + 1);
  if (range.status === 206) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${manifest.size}`;
  if (request.method === "HEAD") return new Response(null, { status: range.status, headers });
  const parts = manifest.parts.filter((part) => part.offset <= range.end && part.offset + part.size > range.start);
  let index = 0;
  const abort = new AbortController();
  const body = new ReadableStream({
    async pull(controller) {
      if (index === parts.length) { controller.close(); return; }
      const part = parts[index++];
      try {
        // Fetch complete parts: a cached 200 can satisfy later seeks too.
        const response = await fetch(new URL(part.file, folder), { credentials: "same-origin", signal: abort.signal });
        if (response.status !== 200) throw new Error("Video part unavailable");
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.length !== part.size) throw new Error("Incomplete video part");
        const start = Math.max(0, range.start - part.offset);
        const end = Math.min(part.size, range.end - part.offset + 1);
        controller.enqueue(data.subarray(start, end));
      } catch (error) { if (!abort.signal.aborted) controller.error(error); }
    },
    cancel() { abort.abort(); },
  });
  return new Response(body, { status: range.status, headers });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const target = new URL("assets/rhodo-demo.mp4", self.registration.scope);
  if (url.origin === target.origin && url.pathname === target.pathname && ["GET", "HEAD"].includes(event.request.method))
    event.respondWith(serveVideo(event.request, url));
});
