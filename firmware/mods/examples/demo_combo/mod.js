import { Emotion } from 'face-state'
import { randomBetween } from 'stackchan-util'
import Timer from 'timer'

// 東京駅付近。緯度経度を変えれば別の地点も取れます
const LOCATION = Object.freeze({
  name: '東京',
  latitude: 35.6812,
  longitude: 139.7671,
})

const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${LOCATION.latitude}` +
  `&longitude=${LOCATION.longitude}` +
  '&current=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FTokyo' +
  '&forecast_days=1'

const GREETING = 'こんにちは。ぼくｽﾀｯｸﾁｬﾝ！'

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
  const current = body?.current
  const daily = body?.daily
  if (current == null) throw new Error('missing current weather')

  const temperature = formatTemperature(current.temperature_2m)
  const weather = describeWeather(Number(current.weather_code))
  const high = formatTemperature(daily?.temperature_2m_max?.[0])
  const low = formatTemperature(daily?.temperature_2m_min?.[0])
  const dailyWeather = describeWeather(Number(daily?.weather_code?.[0]))

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

async function say(robot, text) {
  robot.ui.showBalloon(truncate(text))
  try {
    await robot.audio.say(text)
  } finally {
    robot.ui.hideBalloon()
  }
}

async function fetchAndSpeakForecast(robot) {
  robot.ui.showBalloon('天気を調べるよ...')
  try {
    const response = await fetch(FORECAST_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = await response.json()
    const forecast = buildForecastSpeech(body)
    robot.face.setEmotion(forecast.emotion)
    await say(robot, forecast.text)
  } catch (error) {
    robot.face.setEmotion(Emotion.SAD)
    await say(robot, '天気がわからなかったよ')
    trace(`[demo_combo] forecast failed: ${error}\n`)
  }
}

export function onContextCreated(robot) {
  let lookingAround = false
  let speaking = false

  robot.motion.setTorque(true)

  async function withSpeechLock(task) {
    if (speaking) return
    speaking = true
    try {
      await task()
    } finally {
      speaking = false
    }
  }

  // A: あいさつ
  robot.input.button.a.onEvent = (event) => {
    if (!event.pressed) return
    withSpeechLock(async () => {
      robot.face.setEmotion(Emotion.HAPPY)
      await say(robot, GREETING)
    }).catch((error) => trace(`[demo_combo] speech failed: ${error}\n`))
  }

  // B: あたりを見回すモーションの ON/OFF
  robot.input.button.b.onEvent = (event) => {
    if (!event.pressed) return
    lookingAround = !lookingAround
    if (!lookingAround) robot.motion.lookAway()
    robot.ui.showBalloon(lookingAround ? '見回すよ' : '正面を向くよ')
    Timer.set(() => robot.ui.hideBalloon(), 1500)
  }

  // C: Open-Meteo から東京の天気を取得してしゃべる
  robot.input.button.c.onEvent = (event) => {
    if (!event.pressed) return
    withSpeechLock(() => fetchAndSpeakForecast(robot)).catch((error) => {
      speaking = false
      trace(`[demo_combo] forecast task failed: ${error}\n`)
    })
  }

  Timer.repeat(() => {
    if (!lookingAround) return
    const x = randomBetween(0.4, 1.0)
    const y = randomBetween(-0.4, 0.4)
    const z = randomBetween(-0.02, 0.2)
    robot.motion.lookAt([x, y, z])
  }, 5000)

  robot.ui.showBalloon('Cボタンで天気予報')
  Timer.set(() => robot.ui.hideBalloon(), 2500)
}
