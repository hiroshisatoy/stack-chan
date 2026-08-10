# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。
API キーは不要です。Wi-Fi 接続が必要です。

物理ボタンの無い M5Stack 版ｽﾀｯｸﾁｬﾝ向けに、起動後の自動発話とドロワー操作で動きます。

## 操作

| 操作 | 動作 |
| --- | --- |
| 起動約4秒後 | 東京の天気を取得してしゃべる |
| ドロワー「天気」 | もう一度天気予報をしゃべる |

## インストール

Gallery の「天気予報デモ」から WebSerial で入れ直すのが簡単です。

ホストを CLI で入れる場合の CoreS3 例:

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

クラシック M5Stack 向けは、接続中の host プロファイルに合わせて Gallery から書き込むか、`npm run mod` の対象機種スクリプトを使ってください。

## カスタマイズ

- **地点**: `LOCATION` の `name` / `latitude` / `longitude` を変更
- **起動タイミング**: `BOOT_FORECAST_DELAY_MS` を変更
- **文言**: `buildForecastSpeech()` の組み立てを変更

天気データは [Open-Meteo](https://open-meteo.com/) を利用します。
