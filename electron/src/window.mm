#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>
#include <napi.h>

// Override that returns the rect unchanged — bypasses macOS work-area constraint
static NSRect unconstrainedRect(id self, SEL _cmd, NSRect frameRect, NSScreen* screen) {
    return frameRect;
}

Napi::Value PlaceInNotch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected: buffer, width, height").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    NSView* view = *reinterpret_cast<NSView**>(buf.Data());
    if (!view) return env.Undefined();

    NSWindow* window = [view window];
    if (!window) return env.Undefined();

    double targetW = info[1].As<Napi::Number>().DoubleValue();
    double targetH = info[2].As<Napi::Number>().DoubleValue();

    // ── ISA swizzle: create a per-window subclass that removes frame constraints ──
    NSString* subclassName = [NSString stringWithFormat:@"EvaNotchWindow_%p", (void*)window];
    Class subclass = objc_lookUpClass([subclassName UTF8String]);

    if (!subclass) {
        subclass = objc_allocateClassPair([window class], [subclassName UTF8String], 0);
        // Copy the type encoding from the original method so the override is ABI-compatible
        Method original = class_getInstanceMethod([window class], @selector(constrainFrameRect:toScreen:));
        class_addMethod(subclass,
            @selector(constrainFrameRect:toScreen:),
            (IMP)unconstrainedRect,
            method_getTypeEncoding(original));
        objc_registerClassPair(subclass);
    }

    // Hot-swap the window's class — affects only this instance
    object_setClass(window, subclass);

    // ── Position flush in the notch (AppKit: y=0 is bottom-left) ──
    NSScreen* screen = [[NSScreen screens] firstObject];
    NSRect f = [screen frame];
    double x = f.origin.x + round((f.size.width - targetW) / 2.0);
    double y = f.origin.y + f.size.height - targetH; // top of screen

    [window setLevel:NSStatusWindowLevel];
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
    exports.Set(Napi::String::New(env, "placeInNotch"), Napi::Function::New(env, PlaceInNotch));
    return exports;
}

NODE_API_MODULE(window_native, Init)
