# Android ARM64 validation plan

This document defines a reproducible path for a future real Chromium source-level experiment. It is a plan, not a record of a completed build.

## Host requirements

Follow the current official [Chromium Android build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md). The official instructions call for a 64-bit Linux host, substantial free disk space (at least 100 GB), Git, Python, and the Chromium `depot_tools` checkout. More than 16 GB RAM is recommended by the upstream documentation.

## Configure the build

After checking out Chromium according to the official instructions, configure a dedicated output directory:

```bash
gn gen out/AndroidArm64 --args='target_os="android" target_cpu="arm64" is_debug=true'
```

Build the public Chromium APK target:

```bash
autoninja -C out/AndroidArm64 chrome_public_apk
```

The exact prerequisites and target names can change; consult the upstream document before running these commands.

## Validation evidence to preserve

For any future source modification, record:

1. Chromium commit SHA and patch file.
2. Exact changed source paths and rationale.
3. Host OS, compiler/toolchain versions, and GN args.
4. Complete build command and exit status.
5. Relevant unit/integration test commands and output.
6. Device/emulator ABI from `adb shell getprop ro.product.cpu.abi`.
7. Installation and runtime logs, with private identifiers removed.

## Safety and scope

Keep experiments limited to transparent browser diagnostics, compatibility, and privacy behavior. Do not add fingerprint spoofing, stealth, identity rotation, anti-bot evasion, or anti-fraud bypass functionality.

## Current status

**Not yet performed:** no Chromium checkout/build, source patch, Android installation, or device validation is asserted by this repository at this stage.
