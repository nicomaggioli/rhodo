# Rhodo

A website for independent architecture and engineering firms, with a narrated product tour showing SAM.gov discovery, AI analysis, team selection, and SF330 preparation.

Live preview: https://rhodo.organics-jpg.chatgpt.site

Source repository: https://github.com/nicomaggioli/rhodo

## Run locally

Serve the `public/` directory with any static web server. For example:

```sh
python3 -m http.server 8748 --directory public
```

## Validate

```sh
python3 tools/check_site.py
node --check public/app.js
```

## Website

Six static HTML pages use shared CSS and JavaScript with local images and fonts. No install or build step is required. The demo has captions, a transcript, chapter navigation, and feature closeups. The logo is the angular R selected by the founder.

The original 4K MP4 is split into immutable 4 MiB parts for hosting. `media-worker.js` delivers byte ranges to the native video player; it does not re-encode the video. Each video version has its own content hash, manifest, and part directory. Keep older part directories when updating the video so already-open pages can finish playback. JavaScript and service worker support are required for the hosted video; the transcript remains available without them.

The source is in `public/`. Update those files to change the website. Hosting configuration is stored separately from public assets.

## Walkthrough inquiries

The contact form currently prepares an introduction locally. It does not send a message or book a meeting. Configure an approved business email in `app.js` or connect a booking service before enabling delivery.

See `ASSET_NOTES.md` for asset provenance.
