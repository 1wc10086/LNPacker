#pragma once

#include "pch.h"

#include <NativeModules.h>

using namespace winrt::Microsoft::ReactNative;

namespace winrt::com::liar::lnpacker {

REACT_MODULE(LNPackerModule, L"LNPackerModule")
struct LNPackerModule {
  // Opens the system folder picker. Resolves with the selected folder path or null when cancelled.
  REACT_METHOD(pickFolder)
  void pickFolder(ReactPromise<JSValue> const &promise) noexcept;

  // Writes a list of { name, base64 } files into the given directory.
  // Resolves with the number of files written.
  REACT_METHOD(writeFiles)
  void writeFiles(JSValueArray const &files, std::string const &directory, ReactPromise<JSValue> const &promise) noexcept;

  // Reads a persisted string value or resolves with null when missing.
  REACT_METHOD(getItem)
  void getItem(std::string const &key, ReactPromise<JSValue> const &promise) noexcept;

  // Persists a string value.
  REACT_METHOD(setItem)
  void setItem(std::string const &key, std::string const &value, ReactPromise<void> const &promise) noexcept;
};

} // namespace winrt::com::liar::lnpacker
