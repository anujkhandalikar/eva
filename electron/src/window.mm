#import <Cocoa/Cocoa.h>
#include <napi.h>

// Takes the NSView* handle from Electron's getNativeWindowHandle(),
// sets the window level above the menu bar, and positions it flush
// at the top of the screen using AppKit (bottom-left) coordinates.
Napi::Value MoveToNotch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected: buffer, width, height").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    NSView* view = *reinterpret_cast<NSView**>(buf.Data());
    if (!view) return env.Undefined();

    NSWindow* window = [view window];
    if (!window) return env.Undefined();

    double targetW = (info.Length() > 1 && info[1].IsNumber())
        ? info[1].As<Napi::Number>().DoubleValue() : window.frame.size.width;
    double targetH = (info.Length() > 2 && info[2].IsNumber())
        ? info[2].As<Napi::Number>().DoubleValue() : window.frame.size.height;

    // firstObject = primary screen (the one with the menu bar / notch)
    NSScreen* screen = [[NSScreen screens] firstObject];
    NSRect screenFrame = [screen frame]; // AppKit: origin bottom-left, may be non-zero

    // Account for screen origin (non-zero on secondary displays)
    double x = screenFrame.origin.x + round((screenFrame.size.width - targetW) / 2.0);
    double y = screenFrame.origin.y + screenFrame.size.height - targetH; // flush at top

    // Level above menu bar (NSMainMenuWindowLevel = 24, NSScreenSaverWindowLevel = 1000)
    [window setLevel:NSScreenSaverWindowLevel + 1];
    [window setCollectionBehavior:
        NSWindowCollectionBehaviorCanJoinAllSpaces  |
        NSWindowCollectionBehaviorFullScreenAuxiliary |
        NSWindowCollectionBehaviorStationary        |
        NSWindowCollectionBehaviorIgnoresCycle
    ];
    [window setHasShadow:NO];
    [window setOpaque:NO];
    [window setBackgroundColor:[NSColor clearColor]];
    [window setFrame:NSMakeRect(x, y, targetW, targetH) display:YES animate:NO];

    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "moveToNotch"), Napi::Function::New(env, MoveToNotch));
    return exports;
}

NODE_API_MODULE(window_native, Init)
