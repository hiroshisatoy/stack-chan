import { Emotion } from 'face-state'
import Net from 'net'
import { randomBetween } from 'stackchan-util'
import Timer from 'timer'

// 東京駅付近。緯度経度を変えれば別の地点も取れます
const LOCATION = Object.freeze({
  name: '東京',
  latitude: 35.6812,
  longitude: 139.7671,
})

// 実機の HTTPS/TLS 診断で落ちることがあるため、天気取得は平文 HTTP を使う
const FORECAST_URL =
  'http://api.open-meteo.com/v1/forecast' +
  `?latitude=${LOCATION.latitude}` +
  `&longitude=${LOCATION.longitude}` +
  '&current=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FTokyo' +
  '&forecast_days=1'

const BOOT_DRAWER_DELAY_MS = 2500
const BOOT_FORECAST_DELAY_MS = 5000
const DIAGNOSIS_BALLOON_MS = 6000

function truncate(text, max = 48) {
  if (typeof text !== 'string') return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function formatTemperature(value) {
  if (typeof value !== 'number' || value !== value) return null
  return Math.round(value)
}

function describeWeather(code) {
  if (code === 0) return { label: '晴れ', emotion: Emotion.HAPPY }
  if (code === 1) return { label: 'ほぼ晴れ', emotion: Emotion.HAPPY }
  if (code === 2) return { label: 'うす曇り', emotion: Emotion.NEUTRAL }
  if (code === 3) return { label: '曇り', emotion: Emotion.NEUTRAL }
  if (code === 45 || code === 48) return { label: '霧', emotion: Emotion.DOUBTFUL }
  if (code >= 51 && code <= 57) return { label: '霧雨', emotion: Emotion.SAD }
  if (code >= 61 && code <= 67) return { label: '雨', emotion: Emotion.SAD }
  if (code >= 71 && code <= 77) return { label: '雪', emotion: Emotion.COLD }
  if (code >= 80 && code <= 82) return { label: 'にわか雨', emotion: Emotion.SAD }
  if (code >= 85 && code <= 86) return { label: 'にわか雪', emotion: Emotion.COLD }
  if (code >= 95 && code <= 99) return { label: '雷雨', emotion: Emotion.ANGRY }
  return { label: 'わからない天気', emotion: Emotion.DOUBTFUL }
}

function buildForecastSpeech(body) {
  const current = body && body.current
  const daily = body && body.daily
  if (current == null) throw new Error('missing current weather')

  const temperature = formatTemperature(current.temperature_2m)
  const weather = describeWeather(Number(current.weather_code))
  const high = formatTemperature(daily && daily.temperature_2m_max && daily.temperature_2m_max[0])
  const low = formatTemperature(daily && daily.temperature_2m_min && daily.temperature_2m_min[0])
  const dailyWeather = describeWeather(Number(daily && daily.weather_code && daily.weather_code[0]))

  let text = `${LOCATION.name}の天気だよ。いまは${weather.label}`
  if (temperature != null) text += `で、気温は${temperature}度`
  if (high != null && low != null) text += `。今日の最高は${high}度、最低は${low}度`
  if (dailyWeather.label !== weather.label) text += `。一日を通すと${dailyWeather.label}になりそう`
  text += 'だよ'

  return {
    text,
    emotion: weather.emotion,
  }
}

function openDrawerSafely(robot) {
  try {
    robot.ui.openDrawer()
  } catch (error) {
    trace(`[demo_combo] openDrawer failed: ${error}\n`)
  }
}

function showDiagnosisBalloon(robot, lines, holdMs = DIAGNOSIS_BALLOON_MS) {
  const text = lines.join('\n')
  trace(`[demo_combo] diagnosis\n${text}\n`)
  robot.ui.showBalloon(text)
  Timer.set(() => robot.ui.hideBalloon(), holdMs)
}

/**
 * 安全な診断: Wi-Fi と IP だけ。
 * HTTPS は一部端末でハードフォールするため診断からは外す。
 */
async function diagnoseConnectivity(robot) {
  const lines = []
  const network = robot.connectivity && robot.connectivity.network

  if (!network) {
    lines.push('1.Wi-Fi API: 無し')
    lines.push('3.HTTPS: 診断スキップ')
    return { ok: false, stage: 'network-api', lines }
  }

  robot.ui.showBalloon('診断1: Wi-Fi...')
  let ready
  try {
    ready = await network.ready
  } catch (error) {
    lines.push('1.Wi-Fi: 例外')
    lines.push(truncate(String(error), 36))
    lines.push('3.HTTPS: 診断スキップ')
    return { ok: false, stage: 'wifi-exception', lines, error }
  }

  if (ready.status !== 'connected') {
    lines.push(`1.Wi-Fi: ${ready.status}`)
    if (ready.reason) lines.push(truncate(String(ready.reason), 36))
    lines.push('3.HTTPS: 診断スキップ')
    return { ok: false, stage: 'wifi', lines, ready }
  }
  lines.push('1.Wi-Fi: OK')

  let ip = ''
  try {
    ip = Net.get('IP') || ''
  } catch (error) {
    lines.push('2.IP: 取得失敗')
    lines.push(truncate(String(error), 36))
    lines.push('3.HTTPS: 診断スキップ')
    return { ok: false, stage: 'ip', lines, error }
  }
  if (!ip) {
    lines.push('2.IP: 無し')
    lines.push('3.HTTPS: 診断スキップ')
    return { ok: false, stage: 'ip', lines }
  }
  lines.push(`2.IP: ${ip}`)
  lines.push('3.HTTPS: 診断スキップ')
  lines.push('(落ち対策で未実施)')
  return { ok: true, stage: 'ok', lines }
}

async function fetchForecastBody(robot) {
  robot.ui.showBalloon('HTTPで天気取得...')
  const response = await fetch(FORECAST_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json()
  if (!body || !body.current) throw new Error('missing current weather')
  return body
}

async function say(robot, text) {
  robot.ui.showBalloon(truncate(text))
  try {
    await robot.audio.say(text)
  } finally {
    robot.ui.hideBalloon()
  }
}

async function runDiagnosis(robot) {
  const result = await diagnoseConnectivity(robot)
  showDiagnosisBalloon(robot, result.lines)
  robot.face.setEmotion(result.ok ? Emotion.HAPPY : Emotion.SAD)
  return result
}

async function fetchAndSpeakForecast(robot) {
  robot.ui.showBalloon('天気前に接続チェック...')
  const diagnosis = await diagnoseConnectivity(robot)
  if (!diagnosis.ok) {
    robot.face.setEmotion(Emotion.SAD)
    showDiagnosisBalloon(robot, diagnosis.lines)
    return
  }

  try {
    const body = await fetchForecastBody(robot)
    const forecast = buildForecastSpeech(body)
    robot.face.setEmotion(forecast.emotion)
    await say(robot, forecast.text)
  } catch (error) {
    robot.face.setEmotion(Emotion.SAD)
    showDiagnosisBalloon(robot, ['天気取得失敗', truncate(String(error), 40), 'HTTP経路を確認'])
    trace(`[demo_combo] forecast failed: ${error}\n`)
  }
}

function lookAroundOnce(robot) {
  const motion = robot.motion
  if (motion == null || typeof motion.lookAt !== 'function') return
  const x = randomBetween(0.4, 1.0)
  const y = randomBetween(-0.4, 0.4)
  const z = randomBetween(-0.02, 0.2)
  motion.lookAt([x, y, z])
}

export function onContextCreated(robot) {
  let speaking = false

  async function withSpeechLock(task) {
    if (speaking) return
    speaking = true
    try {
      await task()
    } finally {
      speaking = false
    }
  }

  robot.drawer.addDrawerButton({
    key: 'demo-combo:forecast',
    label: '天気',
    callback(nextRobot) {
      nextRobot.ui.closeDrawer()
      withSpeechLock(() => fetchAndSpeakForecast(nextRobot)).catch((error) => {
        speaking = false
        trace(`[demo_combo] forecast task failed: ${error}\n`)
      })
    },
  })

  robot.drawer.addDrawerButton({
    key: 'demo-combo:diagnose',
    label: '診断',
    callback(nextRobot) {
      nextRobot.ui.closeDrawer()
      withSpeechLock(() => runDiagnosis(nextRobot)).catch((error) => {
        speaking = false
        trace(`[demo_combo] diagnosis task failed: ${error}\n`)
      })
    },
  })

  Timer.set(() => openDrawerSafely(robot), BOOT_DRAWER_DELAY_MS)

  Timer.set(() => {
    withSpeechLock(async () => {
      await fetchAndSpeakForecast(robot)
      Timer.set(() => openDrawerSafely(robot), 1000)
    }).catch((error) => {
      speaking = false
      trace(`[demo_combo] boot forecast failed: ${error}\n`)
    })
  }, BOOT_FORECAST_DELAY_MS)

  Timer.repeat(() => lookAroundOnce(robot), 8000)

  robot.ui.showBalloon('診断はWi-Fi/IPのみ')
  Timer.set(() => robot.ui.hideBalloon(), 2000)
}
