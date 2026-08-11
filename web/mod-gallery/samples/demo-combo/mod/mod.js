import { Emotion } from 'face-state'
import TextDecoder from 'text/decoder'
import Timer from 'timer'

// 東京駅付近
const LOCATION = Object.freeze({
  name: '東京',
  latitude: 35.6812,
  longitude: 139.7671,
})

const FORECAST_HOST = 'api.open-meteo.com'
const FORECAST_HTTP_PORT = 80
const FORECAST_HTTPS_PORT = 443
const FORECAST_PATH =
  `/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
  '&current=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FTokyo&forecast_days=1'

const BUILD_ID = 'https-test-1'
const BALLOON_MS = 5000
const RESULT_HOLD_MS = 4500
const HTTP_TIMEOUT_MS = 15000

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

/**
 * fetch ではなく host の HTTP/HTTPS クライアントを使う。
 * protocol: 'http' | 'https'
 */
function networkGetJson(protocol, host, path, port, timeoutMs = HTTP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const networkRoot = globalThis.device && device.network
    const network = networkRoot && networkRoot[protocol]
    if (!network || !network.io) {
      reject(new Error(`no-${protocol}-client`))
      return
    }

    let settled = false
    let statusCode = 0
    let body = ''
    const decoder = new TextDecoder()
    let client

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      try {
        Timer.clear(timeout)
      } catch (_) {}
      try {
        client.close()
      } catch (_) {}
      fn(value)
    }

    const timeout = Timer.set(() => finish(reject, new Error('timeout')), timeoutMs)

    try {
      client = new network.io({
        ...network,
        host,
        port,
      })
    } catch (error) {
      finish(reject, new Error(`client:${truncate(String(error), 24)}`))
      return
    }

    client.request({
      path,
      headers: new Map([
        ['accept', 'application/json'],
        ['connection', 'close'],
      ]),
      onHeaders(status) {
        statusCode = status
      },
      onReadable(count) {
        try {
          body += decoder.decode(this.read(count))
        } catch (error) {
          finish(reject, new Error(`read:${truncate(String(error), 20)}`))
        }
      },
      onDone(error) {
        if (error) {
          finish(reject, new Error(`done:${truncate(String(error), 24)}`))
          return
        }
        if (statusCode < 200 || statusCode >= 300) {
          finish(reject, new Error(`status:${statusCode}`))
          return
        }
        try {
          const json = JSON.parse(body)
          if (!json || !json.current) {
            finish(reject, new Error('json:no-current'))
            return
          }
          finish(resolve, json)
        } catch (_parseError) {
          finish(reject, new Error(`json:${truncate(body, 18)}`))
        }
      },
    })
  })
}

function httpGetJson(host, path, port = FORECAST_HTTP_PORT, timeoutMs = HTTP_TIMEOUT_MS) {
  return networkGetJson('http', host, path, port, timeoutMs)
}

function httpsGetJson(host, path, port = FORECAST_HTTPS_PORT, timeoutMs = HTTP_TIMEOUT_MS) {
  return networkGetJson('https', host, path, port, timeoutMs)
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
  const wifi = await checkWifi(robot)
  const httpOk = Boolean(globalThis.device && device.network && device.network.http && device.network.http.io)
  const httpsOk = Boolean(globalThis.device && device.network && device.network.https && device.network.https.io)
  showLines(robot, [
    `版:${BUILD_ID}`,
    wifi.line,
    httpOk ? 'HTTP:あり' : 'HTTP:無し',
    httpsOk ? 'HTTPS:あり' : 'HTTPS:無し',
  ])
  try {
    robot.face.setEmotion(wifi.ok && httpOk ? Emotion.HAPPY : Emotion.SAD)
  } catch (_) {}
  await wait(3500)
}

async function runHttpsTest(robot) {
  const wifi = await checkWifi(robot)
  if (!wifi.ok) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    showLines(robot, ['HTTPS結果:失敗', '理由:Wi-Fi', wifi.line], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    return
  }

  showLines(robot, ['HTTPS試験中...', wifi.line], 2500)
  await wait(500)

  try {
    const body = await httpsGetJson(FORECAST_HOST, FORECAST_PATH, FORECAST_HTTPS_PORT)
    const temperature = formatTemperature(body.current.temperature_2m)
    const weather = describeWeather(Number(body.current.weather_code))
    showLines(
      robot,
      [
        'HTTPS結果:成功',
        `${LOCATION.name}:${weather.label}`,
        temperature != null ? `気温:${temperature}度` : '気温:不明',
      ],
      RESULT_HOLD_MS,
    )
    try {
      robot.face.setEmotion(Emotion.HAPPY)
    } catch (_) {}
    await wait(RESULT_HOLD_MS)
  } catch (error) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    const detail = truncate(String(error && error.message ? error.message : error), 32)
    showLines(robot, ['HTTPS結果:失敗', '詳細↓', detail], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    trace(`[demo_combo] https test failed: ${error}\n`)
  }
}

async function runForecast(robot) {
  const wifi = await checkWifi(robot)
  if (!wifi.ok) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    showLines(robot, ['取得結果:失敗', '理由:Wi-Fi', wifi.line], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    return
  }

  showLines(robot, ['取得中(HTTP)...', wifi.line], 2500)
  await wait(500)

  try {
    const body = await httpGetJson(FORECAST_HOST, FORECAST_PATH, FORECAST_HTTP_PORT)
    const forecast = buildForecastSpeech(body)
    const temperature = formatTemperature(body.current.temperature_2m)
    const weather = describeWeather(Number(body.current.weather_code))

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
    const detail = truncate(String(error && error.message ? error.message : error), 32)
    showLines(robot, ['取得結果:失敗', '詳細↓', detail], RESULT_HOLD_MS)
    await wait(RESULT_HOLD_MS)
    trace(`[demo_combo] forecast failed: ${error}\n`)
  }
}

export function onContextCreated(robot) {
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
      key: 'demo-combo:https',
      label: 'HTTPS試験',
      callback(nextRobot) {
        try {
          nextRobot.ui.closeDrawer()
        } catch (_) {}
        void runExclusive(() => runHttpsTest(nextRobot))
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
