import { Emotion } from 'face-state'
import Timer from 'timer'

// 東京駅付近
const LOCATION = Object.freeze({
  name: '東京',
  latitude: 35.6812,
  longitude: 139.7671,
})

// TLSを避けて平文HTTPのみ
const FORECAST_URL =
  'http://api.open-meteo.com/v1/forecast' +
  `?latitude=${LOCATION.latitude}` +
  `&longitude=${LOCATION.longitude}` +
  '&current=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FTokyo' +
  '&forecast_days=1'

const BUILD_ID = 'fetch-status-1'
const BALLOON_MS = 5000
const RESULT_HOLD_MS = 4000

function truncate(text, max = 40) {
  if (typeof text !== 'string') return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function wait(ms) {
  return new Promise((resolve) => Timer.set(resolve, ms))
}

function formatTemperature(value) {
  if (typeof value !== 'number' || value !== value) return null
  return Math.round(value)
}

function describeWeather(code) {
  if (code === 0 || code === 1) return { label: '晴れ', emotion: Emotion.HAPPY }
  if (code === 2 || code === 3) return { label: '曇り', emotion: Emotion.NEUTRAL }
  if (code >= 51 && code <= 67) return { label: '雨', emotion: Emotion.SAD }
  if (code >= 71 && code <= 77) return { label: '雪', emotion: Emotion.SAD }
  if (code >= 80 && code <= 82) return { label: 'にわか雨', emotion: Emotion.SAD }
  if (code >= 95) return { label: '雷雨', emotion: Emotion.ANGRY }
  return { label: 'わからない天気', emotion: Emotion.NEUTRAL }
}

function buildForecastSpeech(body) {
  const current = body && body.current
  if (!current) throw new Error('no current')
  const temperature = formatTemperature(current.temperature_2m)
  const weather = describeWeather(Number(current.weather_code))
  let text = `${LOCATION.name}は${weather.label}`
  if (temperature != null) text += `、${temperature}度`
  text += 'だよ'
  return { text, emotion: weather.emotion }
}

function showLines(robot, lines, ms = BALLOON_MS) {
  const text = lines.join('\n')
  trace(`[demo_combo] ${text}\n`)
  try {
    robot.ui.showBalloon(text)
    Timer.set(() => {
      try {
        robot.ui.hideBalloon()
      } catch (_) {}
    }, ms)
  } catch (error) {
    trace(`[demo_combo] balloon failed: ${error}\n`)
  }
}

async function checkWifi(robot) {
  const network = robot.connectivity && robot.connectivity.network
  if (!network) return { ok: false, line: 'Wi-Fi:非対応' }
  try {
    const ready = await network.ready
    if (ready.status !== 'connected') {
      return { ok: false, line: `Wi-Fi:${ready.status}` }
    }
    return { ok: true, line: 'Wi-Fi:OK' }
  } catch (error) {
    return { ok: false, line: `Wi-Fi:例外 ${truncate(String(error), 24)}` }
  }
}

async function fetchForecast() {
  const response = await fetch(FORECAST_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json()
  if (!body || !body.current) throw new Error('bad json')
  return body
}

async function say(robot, text) {
  try {
    robot.ui.showBalloon(truncate(text))
    await robot.audio.say(text)
  } finally {
    try {
      robot.ui.hideBalloon()
    } catch (_) {}
  }
}

async function runDiagnosis(robot) {
  // Net/HTTPS/自動通信は使わない（起動ループ対策）
  const wifi = await checkWifi(robot)
  showLines(robot, [`版:${BUILD_ID}`, '暗号化検査:しない', wifi.line])
  try {
    robot.face.setEmotion(wifi.ok ? Emotion.HAPPY : Emotion.SAD)
  } catch (_) {}
  await wait(3500)
}

async function runForecast(robot) {
  const wifi = await checkWifi(robot)
  if (!wifi.ok) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    showLines(robot, ['取得結果:失敗', '理由:Wi-Fi未接続', wifi.line], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    return
  }

  showLines(robot, ['取得中...', wifi.line], 2500)
  await wait(800)

  try {
    const body = await fetchForecast()
    const forecast = buildForecastSpeech(body)
    const temperature = formatTemperature(body.current.temperature_2m)
    const weather = describeWeather(Number(body.current.weather_code))

    // 成否を先に明示してからしゃべる
    showLines(
      robot,
      [
        '取得結果:成功',
        `${LOCATION.name}:${weather.label}`,
        temperature != null ? `気温:${temperature}度` : '気温:不明',
      ],
      RESULT_HOLD_MS,
    )
    try {
      robot.face.setEmotion(Emotion.HAPPY)
    } catch (_) {}
    await wait(RESULT_HOLD_MS)

    try {
      robot.face.setEmotion(forecast.emotion)
    } catch (_) {}
    await say(robot, forecast.text)

    showLines(robot, ['取得結果:成功', '発話まで完了'], 2500)
    await wait(2000)
  } catch (error) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    showLines(robot, ['取得結果:失敗', '理由:HTTP/JSON', truncate(String(error), 28)], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    trace(`[demo_combo] forecast failed: ${error}\n`)
  }
}

export function onContextCreated(robot) {
  // 起動時はネットワークもドロワー自動オープンもしない（再起動ループ対策）
  let busy = false

  async function runExclusive(task) {
    if (busy) return
    busy = true
    try {
      await task()
    } catch (error) {
      trace(`[demo_combo] task failed: ${error}\n`)
    } finally {
      busy = false
    }
  }

  try {
    robot.drawer.addDrawerButton({
      key: 'demo-combo:forecast',
      label: '天気',
      callback(nextRobot) {
        try {
          nextRobot.ui.closeDrawer()
        } catch (_) {}
        void runExclusive(() => runForecast(nextRobot))
      },
    })
    robot.drawer.addDrawerButton({
      key: 'demo-combo:diagnose',
      label: '診断',
      callback(nextRobot) {
        try {
          nextRobot.ui.closeDrawer()
        } catch (_) {}
        void runExclusive(() => runDiagnosis(nextRobot))
      },
    })
  } catch (error) {
    trace(`[demo_combo] drawer failed: ${error}\n`)
  }

  showLines(robot, [`版:${BUILD_ID}`, '起動OK', '手動で天気へ'], 3000)
}
