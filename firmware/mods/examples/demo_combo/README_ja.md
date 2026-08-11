# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。

通常の天気取得は安定のため HTTP（`device.network.http`）です。
HTTPS は手動試験ボタンで確認できます（`device.network.https`。fetch は使いません）。

## 操作

起動直後に `版:https-test-1` と出れば最新です。

| 操作 | 動作 |
| --- | --- |
| ドロワー「天気」 | HTTP で天気取得 → 成功なら発話 |
| ドロワー「HTTPS試験」 | HTTPS で同じ API を試し、成否を吹き出し表示 |
| ドロワー「診断」 | Wi-Fi / HTTP・HTTPS クライアント有無 |

HTTPS の結果例:

- 成功: `HTTPS結果:成功` / `東京:…` / `気温:…度`
- 失敗: `HTTPS結果:失敗` / `詳細↓` / `done:…` など

## インストール

Gallery から入れ直してください。
