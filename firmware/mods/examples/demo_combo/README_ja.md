# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。
API キーは不要です。Wi-Fi 接続が必要です。

実機で HTTPS/TLS 診断が落ちることがあるため、診断は Wi-Fi / IP のみです。
天気取得は平文 HTTP（`http://api.open-meteo.com`）を使います。

## 操作

| 操作 | 動作 |
| --- | --- |
| 起動約2.5秒後 | ドロワーが自動で開く |
| 起動約5秒後 | Wi-Fi/IP 診断のあと、HTTP で天気をしゃべる |
| ドロワー「天気」 | 診断 → 天気予報 |
| ドロワー「診断」 | Wi-Fi/IP 診断だけ（吹き出し） |

診断の見方（先頭行が重要）:

1. `HTTPS診断:スキップ` … TLS診断は端末落ち防止のため未実施
2. `1.Wi-Fi:OK` … `connectivity.network.ready` が connected
3. `2.IP:...` … `Net.get('IP')`

診断結果は約4.5秒間、吹き出しに残します。

## インストール

Gallery の「天気予報デモ」から WebSerial で入れ直してください。

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

天気データは [Open-Meteo](https://open-meteo.com/) を利用します。
