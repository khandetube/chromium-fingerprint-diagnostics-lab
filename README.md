# Chromium Fingerprint Diagnostics Lab

A transparent, local-first browser diagnostics and privacy research workbench. It measures observable browser API behavior, records reproducible test metadata, compares runs, and exports evidence reports.

> **Scope:** diagnostics, compatibility testing, and privacy transparency. This project does not spoof fingerprints, rotate identities, conceal automation, or bypass anti-fraud / anti-bot controls.

## Current capabilities
- Canvas 2D rendering consistency probe (records a digest of a deterministic test image).
- WebGL capability and renderer metadata inspection, where the browser exposes it.
- Web Audio API availability and offline-render consistency probe.
- Browser/runtime environment inventory with permission-conscious feature detection.
- Timestamped local snapshots, side-by-side comparison, and JSON report export.
- No remote telemetry; results remain in the browser unless the user exports them.

## Run locally
No build step or third-party dependency is required.

```bash
python3 -m http.server 8080
```
Open `http://localhost:8080`.

Run the automated core tests with Node.js 20+:

```bash
npm test
```

## Reproducibility notes
Results can vary with browser version, operating system, GPU driver, power state, privacy settings, and headless/automation context. A matching digest is not proof of a unique device; a changed digest is not necessarily evidence of tampering. WebGL renderer strings may be unavailable or intentionally restricted by the browser.

For useful comparisons, record the browser version, OS, test date, and whether hardware acceleration or privacy protections are enabled. Do not use this tool to identify or track people.

## Project status
This is an independent browser-level diagnostics project. It is **not** a Chromium source fork and does not claim that Chromium/Blink has been modified or that a custom Android ARM64 Chromium build has been produced. Any future source-level Chromium work must be documented with the exact patch, build configuration, and reproducible validation evidence.

## Structure
- `index.html` — application shell
- `src/diagnostics.js` — deterministic, browser-safe probes and comparison helpers
- `src/app.js` — dashboard, snapshots, and report export
- `src/styles.css` — responsive interface
- `tests/` — Node test suite for pure core functions
- `.github/workflows/ci.yml` — automated tests

## License
MIT — see [LICENSE](LICENSE).
