#include "signal_summary.hpp"

#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>

namespace diagnostics {

std::string Fnv1a64(const std::uint8_t* data, std::size_t size) {
  std::uint64_t hash = UINT64_C(14695981039346656037);
  for (std::size_t i = 0; i < size; ++i) {
    hash ^= static_cast<std::uint64_t>(data[i]);
    hash *= UINT64_C(1099511628211);
  }
  std::ostringstream out;
  out << std::hex << std::setfill('0') << std::setw(16) << hash;
  return out.str();
}

SignalSummary SummarizeSignal(const std::vector<double>& samples) {
  SignalSummary result;
  result.sample_count = samples.size();
  if (samples.empty()) return result;

  double minimum = std::numeric_limits<double>::infinity();
  double maximum = -std::numeric_limits<double>::infinity();
  long double sum = 0.0L;\n  long double sum_squares = 0.0L;
  std::ostringstream canonical;
  canonical << std::setprecision(std::numeric_limits<double>::max_digits10);

  for (std::size_t i = 0; i < samples.size(); ++i) {
    const double value = samples[i];
    if (!std::isfinite(value)) return result;
    if (i != 0) canonical << ',';
    canonical << value;
    minimum = value < minimum ? value : minimum;
    maximum = value > maximum ? value : maximum;
    sum += static_cast<long double>(value);\n    sum_squares += static_cast<long double>(value) * value;\n    if (i > 0 && ((samples[i - 1] < 0.0 && value >= 0.0) || (samples[i - 1] >= 0.0 && value < 0.0))) ++result.zero_crossings;
  }

  const std::string bytes = canonical.str();
  result.minimum = minimum;
  result.maximum = maximum;
  result.mean = static_cast<double>(sum / samples.size());\n  result.root_mean_square = std::sqrt(static_cast<double>(sum_squares / samples.size()));\n  long double squared_deviation = 0.0L;\n  for (double value : samples) { const long double delta = static_cast<long double>(value) - result.mean; squared_deviation += delta * delta; }\n  result.standard_deviation = std::sqrt(static_cast<double>(squared_deviation / samples.size()));
  result.fnv1a64 = Fnv1a64(
      reinterpret_cast<const std::uint8_t*>(bytes.data()), bytes.size());
  result.valid = true;
  return result;
}

}  // namespace diagnostics
