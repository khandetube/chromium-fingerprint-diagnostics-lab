# Native C++ signal summary

This directory contains a portable C++17 helper for summarizing numeric samples, intended for diagnostic and regression-test pipelines.

## Build and run smoke test

From the repository root:

```bash
cmake -S native/cpp -B build/native
cmake --build build/native --config Release
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  native/cpp/signal_summary.cpp native/cpp/signal_summary_test.cpp \
  -o /tmp/signal_summary_test
/tmp/signal_summary_test
```

The test executable uses assertions and returns zero when checks pass. Run it in a real compiler environment before describing the native component as validated.

## Important limitations

- FNV-1a is a non-cryptographic regression digest, not a security primitive.
- This module does not read device identifiers or access browser internals.
- It is a standalone utility; it is not integrated into Chromium/Blink and does not prove a Chromium Android build.
