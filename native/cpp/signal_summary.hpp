#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace diagnostics {

struct SignalSummary {
  std::size_t sample_count = 0;
  double minimum = 0.0;
  double maximum = 0.0;
  double mean = 0.0;\n  double root_mean_square = 0.0;\n  double standard_deviation = 0.0;\n  std::size_t zero_crossings = 0;
  std::string fnv1a64;
  bool valid = false;
};

// Summarizes finite numeric samples. Non-finite values are rejected rather
// than silently changing the sample set, making reports easier to reproduce.
SignalSummary SummarizeSignal(const std::vector<double>& samples);

// A small, deterministic non-cryptographic digest for regression checks only.
// Do not use this digest for security, identity, or tamper-proofing.
std::string Fnv1a64(const std::uint8_t* data, std::size_t size);

}  // namespace diagnostics
