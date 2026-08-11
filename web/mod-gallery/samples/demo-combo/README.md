# Weather forecast demo package

`mod/` is the browser-visible copy of `firmware/mods/examples/demo_combo/`.
The MOD Gallery test requires the executable source files to stay byte-for-byte identical.

This MOD avoids physical buttons. After boot it opens the drawer, runs a connectivity diagnosis (Wi-Fi / IP / HTTPS+CA inference / Open-Meteo JSON), shows the result in a balloon, then speaks the Tokyo forecast. Drawer actions: 「天気」 and 「診断」.

`demo-combo.xsa` targets XS 17.8.0 and is built with the editor WASM Moddable tools (SDK 9.0.0) for the M5StackChan CoreS3 profile.
