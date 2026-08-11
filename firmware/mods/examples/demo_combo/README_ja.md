# demo_combo

Open-Meteo から東京の天気予報を取得してしゃべるひな形 MOD です。
API キーは不要です。Wi-Fi 接続が必要です。

起動時とドロワーから、接続診断（Wi-Fi / IP / HTTPS・CA推定 / API）を行います。診断結果は吹き出し表示です。

## 操作

| 操作 | 動作 |
| --- | --- |
| 起動約2.5秒後 | ドロワーが自動で開く |
| 起動約5秒後 | 接続診断のあと、天気をしゃべる |
| ドロワー「天気」 | 診断 → 天気予報 |
| ドロワー「診断」 | 接続診断だけ（吹き出し） |

診断の見方:

1. `Wi-Fi: OK` … `connectivity.network.ready` が connected
2. `IP: ...` … `Net.get('IP')`
3. `HTTPS: 200` … Open-Meteo への fetch
4. `API: OK` … JSON の current が取れた（TLS/CA も通過した扱い）

HTTPS 失敗時に証明書っぽい文言があれば `CA不足の可能性(ca176等)` と出します。

## インストール

Gallery の「天気予報デモ」から WebSerial で入れ直すのが簡単です。

```sh
cd firmware
npm run mod:m5stackchan_cores3 -- mods/examples/demo_combo/manifest.json
```

## カスタマイズ

- **地点**: `LOCATION`
- **ドロワー表示**: `BOOT_DRAWER_DELAY_MS`
- **自動発話**: `BOOT_FORECAST_DELAY_MS`

天気データは [Open-Meteo](https://open-meteo.com/) を利用します。
