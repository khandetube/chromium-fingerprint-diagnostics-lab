# Chromium Fingerprint Diagnostics Lab

A transparent, local-first browser diagnostics and privacy research workbench. It measures observable browser API behavior, records reproducible test metadata, compares runs, and exports evidence reports.

> **Scope:** diagnostics, compatibility testing, and privacy transparency. This project does not spoof fingerprints, rotate identities, conceal automation, or bypass anti-fraud / anti-bot controls.

## Current capabilities
- Canvas 2D rendering consistency probe (records a digest of a deterministic test image).
- Browser compatibility matrix for WebGL 1/2, WebGPU, OffscreenCanvas, Workers, WebAssembly, observers, and audio APIs (feature availability, not a browser certification).\n- Disposable-canvas WebGL context-loss and restoration test using `WEBGL_lose_context`; bounded waits and no impact on the primary probe canvas.\n- GPU rendering smoke test: shader compilation, program linking, triangle draw, pixel readback, and passive context-loss state checks.\n- WebGL 1/2 capability inventory: limits, GLSL precision, context attributes, supported extensions, and browser-exposed renderer metadata.
- Web Audio API availability and offline-render consistency probe.
- Browser/runtime environment inventory with permission-conscious feature detection.
- Timestamped local snapshots, side-by-side comparison, JSON import/export with structural validation.\n- Local JavaScript microbenchmarks for numeric, array, and serialization workloads (median latency and throughput).
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

## Benchmark interpretation\n\nThe JavaScript benchmark is a lightweight local regression signal, not a standardized cross-device score. Compare runs on the same browser/device under similar thermal, battery, and background-load conditions. The workload results are not cryptographic evidence and must not be used to identify devices.\n\n## Reproducibility notes
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


## Live demo deployment

This repository includes a GitHub Actions workflow for publishing the static dashboard with GitHub Pages. To activate it, open **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source, then push to `main` or run the deployment workflow manually. The public demo will be available at `https://khandetube.github.io/chromium-fingerprint-diagnostics-lab/` after the first successful deployment. Until the workflow completes successfully, treat that address as a target URL rather than a verified live demo.

## Current scope and limitations

- This is a browser-side diagnostic workbench plus a standalone C++17 numeric-summary utility (mean, RMS, standard deviation, zero crossings, and regression digest).
- It does **not** currently patch Chromium/Blink source or constitute a completed custom Android ARM64 Chromium build.
- FNV-1a hashes are non-cryptographic comparison checksums. They are not tamper-proof evidence, cryptographic attestations, or unique-device identifiers.
- Some browser APIs are intentionally restricted; unavailable measurements are reported rather than bypassed.
