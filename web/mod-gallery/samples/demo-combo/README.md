# Weather forecast demo package

`mod/` is the browser-visible copy of `firmware/mods/examples/demo_combo/`.
The MOD Gallery test requires the executable source files to stay byte-for-byte identical.

This MOD avoids physical buttons. It opens the drawer automatically after boot, speaks the Tokyo forecast, and keeps a 「天気」 drawer action for retries.

`demo-combo.xsa` targets XS 17.8.0 and is built with the editor WASM Moddable tools (SDK 9.0.0) for the M5StackChan CoreS3 profile.
