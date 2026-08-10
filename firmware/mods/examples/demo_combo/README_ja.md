# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。
API キーは不要です。Wi-Fi 接続が必要です。

物理ボタンや右上メニューが使いづらい機種向けに、起動後にドロワーを自動で開きます。

## 操作

| 操作 | 動作 |
| --- | --- |
| 起動約2.5秒後 | ドロワーが自動で開く |
| 起動約5秒後 | 東京の天気を取得してしゃべる |
| ドロワー「天気」 | もう一度天気予報をしゃべる |

通常、顔をタップ → 4秒以内に右上メニュー、でもドロワーを開けます。
開かない場合はこの自動オープンを使ってください。

## インストール

Gallery の「天気予報デモ」から WebSerial で入れ直すのが簡単です。

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

## カスタマイズ

- **地点**: `LOCATION` の `name` / `latitude` / `longitude` を変更
- **ドロワー表示**: `BOOT_DRAWER_DELAY_MS`
- **自動発話**: `BOOT_FORECAST_DELAY_MS`

天気データは [Open-Meteo](https://open-meteo.com/) を利用します。
