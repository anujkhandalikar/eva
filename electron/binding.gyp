{
  "targets": [{
    "target_name": "window_native",
    "sources": ["src/window.mm"],
    "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
    "libraries": ["-framework Cocoa"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "xcode_settings": {
      "OTHER_CPLUSPLUSFLAGS": ["-ObjC++"],
      "MACOSX_DEPLOYMENT_TARGET": "12.0",
      "CLANG_CXX_LIBRARY": "libc++"
    }
  }]
}
