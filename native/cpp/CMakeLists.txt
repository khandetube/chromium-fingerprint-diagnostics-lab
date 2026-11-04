cmake_minimum_required(VERSION 3.16)
project(diagnostics_signal_summary LANGUAGES CXX)

add_library(signal_summary signal_summary.cpp)
target_include_directories(signal_summary PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_features(signal_summary PUBLIC cxx_std_17)

if(MSVC)
  target_compile_options(signal_summary PRIVATE /W4 /WX)
else()
  target_compile_options(signal_summary PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
