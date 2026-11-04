#include "signal_summary.hpp"

#include <cassert>
#include <cmath>
#include <limits>
#include <vector>

int main() {
  const auto summary = diagnostics::SummarizeSignal({-1.0, 0.0, 1.0, 2.0});
  assert(summary.valid);
  assert(summary.sample_count == 4);
  assert(summary.minimum == -1.0);
  assert(summary.maximum == 2.0);
  assert(std::abs(summary.mean - 0.5) < 1e-12);
  assert(summary.fnv1a64.size() == 16);

  const auto empty = diagnostics::SummarizeSignal({});
  assert(!empty.valid);
  assert(empty.sample_count == 0);

  const auto invalid = diagnostics::SummarizeSignal(
      {1.0, std::numeric_limits<double>::quiet_NaN()});
  assert(!invalid.valid);
  return 0;
}
