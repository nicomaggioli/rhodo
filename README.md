# Rhodo

A website for independent architecture and engineering firms, with a narrated product tour showing SAM.gov discovery, AI analysis, team selection, and SF330 preparation.

Website: https://nicomaggioli.github.io/rhodo/

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

The source is in `public/`. Update those files to change the website. GitHub Pages publishes `public/` through `.github/workflows/pages.yml`. Every push to `main` validates and deploys the site. You can also run the workflow manually from the Actions tab. Only the contents of `public/` are uploaded to the website.

## Walkthrough inquiries

The contact form currently prepares an introduction locally. It does not send a message or book a meeting. Configure an approved business email in `app.js` or connect a booking service before enabling delivery.

See `ASSET_NOTES.md` for asset provenance.
