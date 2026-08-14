#include "pch.h"
#include "LNPackerModule.h"

#include <shobjidl.h>

#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace winrt::com::liar::lnpacker {

namespace {

std::wstring Utf8ToWide(std::string const &value) {
  if (value.empty()) {
    return {};
  }
  int length = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring wide(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), &wide[0], length);
  return wide;
}

std::string DecodeBase64(std::string const &input) {
  static const std::string alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  int value = 0;
  int bits = -8;
  for (unsigned char ch : input) {
    if (ch == '=' || ch == '\r' || ch == '\n') {
      continue;
    }
    auto pos = alphabet.find(static_cast<char>(ch));
    if (pos == std::string::npos) {
      continue;
    }
    value = (value << 6) + static_cast<int>(pos);
    bits += 6;
    if (bits >= 0) {
      output.push_back(static_cast<char>((value >> bits) & 0xFF));
      bits -= 8;
    }
  }
  return output;
}

struct FileItem {
  std::wstring name;
  std::string base64;
};

std::wstring StorageFilePath(std::wstring const &key) {
  wchar_t *base = nullptr;
  size_t length = 0;
  _wdupenv_s(&base, &length, L"LOCALAPPDATA");
  std::wstring dir = base ? base : L"";
  free(base);
  if (dir.empty()) {
    return L"";
  }
  dir += L"\\LNPacker";
  CreateDirectoryW(dir.c_str(), nullptr);
  std::wstring safe = key;
  for (auto &ch : safe) {
    if (ch == L'/' || ch == L'\\' || ch == L':' || ch == L'*' || ch == L'?' || ch == L'"' || ch == L'<' || ch == L'>' || ch == L'|') {
      ch = L'_';
    }
  }
  return dir + L"\\" + safe + L".txt";
}

} // namespace

void LNPackerModule::pickFolder(ReactPromise<JSValue> const &promise) noexcept {
  std::thread([promise]() {
    winrt::init_apartment(winrt::apartment_type::single_threaded);
    std::optional<std::wstring> result;
    try {
      winrt::com_ptr<IFileDialog> dialog;
      winrt::check_hresult(CoCreateInstance(
          CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(dialog.put())));
      DWORD options = 0;
      winrt::check_hresult(dialog->GetOptions(&options));
      winrt::check_hresult(dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM));
      winrt::check_hresult(dialog->SetTitle(L"选择导出文件夹"));

      HRESULT hr = dialog->Show(GetActiveWindow());
      if (hr == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
        promise.Resolve(JSValue(nullptr));
        return;
      }
      winrt::check_hresult(hr);

      winrt::com_ptr<IShellItem> item;
      winrt::check_hresult(dialog->GetResult(item.put()));
      PWSTR rawPath = nullptr;
      winrt::check_hresult(item->GetDisplayName(SIGDN_FILESYSPATH, &rawPath));
      std::wstring path(rawPath);
      CoTaskMemFree(rawPath);
      result = std::move(path);
    } catch (...) {
    }
    winrt::uninit_apartment();
    if (result) {
      winrt::hstring wide(*result);
      promise.Resolve(JSValue(winrt::to_string(wide)));
    } else {
      promise.Resolve(JSValue(nullptr));
    }
  }).detach();
}

void LNPackerModule::writeFiles(
    JSValueArray const &files,
    std::string const &directory,
    ReactPromise<JSValue> const &promise) noexcept {
  std::vector<FileItem> items;
  for (auto const &file : files) {
    auto const *name = file.TryGetObjectProperty("name");
    auto const *data = file.TryGetObjectProperty("base64");
    if (!name || !data) {
      continue;
    }
    items.push_back({Utf8ToWide(name->AsString()), data->AsString()});
  }

  std::thread([promise, items = std::move(items), directory]() {
    try {
      std::wstring dir = Utf8ToWide(directory);
      size_t written = 0;
      for (auto const &item : items) {
        std::wstring path = dir + L"\\" + item.name;
        std::string bytes = DecodeBase64(item.base64);
        std::ofstream out(path, std::ios::binary | std::ios::trunc);
        if (!out.is_open()) {
          continue;
        }
        out.write(bytes.data(), static_cast<std::streamsize>(bytes.size()));
        out.close();
        ++written;
      }
      promise.Resolve(JSValue(static_cast<int64_t>(written)));
    } catch (...) {
      promise.Reject("write failed");
    }
  }).detach();
}

void LNPackerModule::getItem(std::string const &key, ReactPromise<JSValue> const &promise) noexcept {
  std::wstring path = StorageFilePath(Utf8ToWide(key));
  if (path.empty()) {
    promise.Resolve(JSValue(nullptr));
    return;
  }
  std::ifstream in(path, std::ios::binary);
  if (!in.is_open()) {
    promise.Resolve(JSValue(nullptr));
    return;
  }
  std::stringstream buffer;
  buffer << in.rdbuf();
  promise.Resolve(JSValue(buffer.str()));
}

void LNPackerModule::setItem(std::string const &key, std::string const &value, ReactPromise<void> const &promise) noexcept {
  std::wstring path = StorageFilePath(Utf8ToWide(key));
  if (path.empty()) {
    promise.Reject("storage path unavailable");
    return;
  }
  std::ofstream out(path, std::ios::binary | std::ios::trunc);
  if (!out.is_open()) {
    promise.Reject("storage write failed");
    return;
  }
  out.write(value.data(), static_cast<std::streamsize>(value.size()));
  out.close();
  promise.Resolve();
}

} // namespace winrt::com::liar::lnpacker
