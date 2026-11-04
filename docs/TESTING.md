# Testing strategy

## Browser-level tests

1. Open the application in a current desktop browser.
2. Select **Run diagnostics**.
3. Confirm each module reports either PASS or UNAVAILABLE; unavailable APIs should not crash the app.
4. Run again and compare snapshot digests. Differences can be caused by browser updates, drivers, privacy settings, or runtime variability.
5. Export the JSON report and inspect its timestamp, environment summary, and probe results.

## Core unit tests

Requirements: Node.js 20 or later.

```bash
npm run check
npm test
```

The test suite covers stable serialization, deterministic FNV-1a output, numeric summaries, snapshot comparison states, and behavior when browser globals are absent.

## Native C++ smoke test

See [native/cpp/README.md](../native/cpp/README.md). The C++ helper has a standalone smoke-test executable; it is not automatically run by the JavaScript workflow yet.

## Interpretation

A digest is a compact regression signal, not proof of identity, uniqueness, or malicious modification. Do not infer that two runs came from the same person or device solely from matching output.
