# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべる、表情・TTS・モーション付きのひな形 MOD です。
API キーは不要です。Wi-Fi 接続が必要です。

## 操作

| ボタン | 動作 |
| --- | --- |
| A | あいさつ |
| B | あたりを見回すモーションの ON/OFF |
| C | 東京の天気を取得してしゃべる |

発話例:「東京の天気だよ。いまはうす曇り。気温は22度。今日の最高は26度、最低は22度。一日を通すと雨になりそう。だよ。」

## インストール

ホストファームウェアを書き込み済みの CoreS3 向け例:

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

## カスタマイズ

- **地点**: `LOCATION` の `name` / `latitude` / `longitude` を変更
- **文言**: `buildForecastSpeech()` の組み立てを変更
- **HTTPS**: Open-Meteo（Let's Encrypt）向けに `manifest.json` へ `ca176` を含めています

天気データは [Open-Meteo](https://open-meteo.com/) を利用します。
