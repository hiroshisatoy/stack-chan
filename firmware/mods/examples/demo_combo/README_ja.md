# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。

## いま分かっていること

以前の `理由:HTTP/JSON` は「Wi-Fi はOKだが、天気データの取得/解析で失敗した」という総称です。
実際の例外（DNS / timeout / status / json など）は隠れていました。

本版では:

- `fetch` ではなく `device.network.http` で取得
- 失敗時は `詳細↓` の次の行に生エラーを表示

詳細の例:

- `done:…` … 接続/DNS/切断エラー
- `status:404` … HTTP ステータス異常
- `json:…` … 応答の JSON 解析失敗
- `timeout` … 15秒以内に終わらない
- `no-http-client` … 端末に HTTP クライアントが無い

## 操作

起動直後に `版:http-client-1` と出れば最新です。

| 操作 | 動作 |
| --- | --- |
| ドロワー「診断」 | Wi-Fi と HTTP クライアント有無 |
| ドロワー「天気」 | 取得成功/失敗を明示。成功なら発話 |

## インストール

Gallery から入れ直してください。
