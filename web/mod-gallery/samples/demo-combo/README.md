# Weather forecast demo package

`mod/` is the browser-visible copy of `firmware/mods/examples/demo_combo/`.
The MOD Gallery test requires the executable source files to stay byte-for-byte identical.

Diagnosis checks Wi-Fi and IP only. HTTPS probing is skipped because it can crash some devices.
Forecast fetch uses plain HTTP against Open-Meteo.

`demo-combo.xsa` targets XS 17.8.0 and is built with the editor WASM Moddable tools (SDK 9.0.0) for the M5StackChan CoreS3 profile.
