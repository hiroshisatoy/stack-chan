# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。

## 再起動ループ対策

起動時は通信もしません。ドロワーから手動実行します。
起動直後に `版:fetch-status-1` と出れば最新です。

## 操作

| 操作 | 動作 |
| --- | --- |
| 起動 | `版:fetch-status-1` / `起動OK` を表示するだけ |
| ドロワー「診断」 | Wi-Fi 状態のみ確認 |
| ドロワー「天気」 | 取得成否を吹き出しで明示 → 成功ならしゃべる |

天気の吹き出し例:

- 成功: `取得結果:成功` / `東京:晴れ` / `気温:24度`
- 失敗: `取得結果:失敗` / `理由:Wi-Fi未接続` または `理由:HTTP/JSON`

## インストール

Gallery から入れ直してください。

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

天気データは [Open-Meteo](https://open-meteo.com/)（HTTP）を利用します。
