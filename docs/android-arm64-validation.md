# Android ARM64 validation protocol

This protocol defines a reproducible device-side validation run. It does **not** claim that a physical Android device has already been tested.

## 1. Device and browser inventory

Record the following before running diagnostics:

- Device model and manufacturer
- Android version and build number
- ABI from `adb shell getprop ro.product.cpu.abi` (expect `arm64-v8a` for the target)
- Browser name, version, and package name
- Chrome/Chromium version from `chrome://version` where available
- Date/time, display resolution, and whether battery saver is enabled

Useful ADB commands:

```sh
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abi
```

Do not include serial numbers, account identifiers, or other personal device identifiers in a public report.

## 2. Run the browser diagnostics

1. Open the hosted dashboard in the target Android browser.
2. Wait for the page to finish loading.
3. Run the full diagnostics suite.
4. Export the resulting JSON snapshot.
5. Repeat three times after a fresh page load. Keep each run separate; do not average away failures.

Hosted dashboard: https://khandetube.github.io/chromium-fingerprint-diagnostics-lab/

## 3. Required checks

For each run, record the reported availability and result for:

- Canvas 2D
- WebGL 1 and WebGL 2
- GPU shader compile/link, draw, and pixel readback
- WebGL context-loss/restoration extension support
- WebGPU availability
- OffscreenCanvas, WebAssembly, Workers, SharedArrayBuffer
- ResizeObserver and IntersectionObserver
- AudioContext / OfflineAudioContext
- JavaScript benchmark workloads

A feature reported as unavailable is not automatically a defect. Record browser version, device conditions, and the module's reason field.

## 4. Result interpretation

- Compare repeated runs on the same device before comparing different devices.
- Treat benchmark values as relative observations, not hardware performance scores.
- Renderer strings and API availability are browser-exposed metadata and can be masked or restricted by the browser.
- A successful WebGL smoke test proves only that the tested rendering path worked in that session.
- Context restoration can be marked unsupported when the browser does not expose `WEBGL_lose_context`; do not interpret that as a GPU failure.

## 5. Evidence package

Attach the exported JSON snapshots and a short text manifest containing the inventory from section 1. Remove identifying device serials and personal data first.

Suggested filename pattern:

`android-arm64_<device-alias>_<browser>_<version>_run-01.json`

## 6. Completion criteria

A device validation is complete only when:

- ABI is confirmed as `arm64-v8a`;
- Android and browser versions are recorded;
- three independent snapshots are exported;
- unavailable features and errors are reviewed;
- the evidence package is retained with the test date.

Until those steps are executed on physical hardware, status must remain **protocol prepared — device execution pending**.
