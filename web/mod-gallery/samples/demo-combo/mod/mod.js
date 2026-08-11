import { Emotion } from 'face-state'
import { randomBetween } from 'stackchan-util'
import TextDecoder from 'text/decoder'
import Timer from 'timer'

// 長久手市役所付近
const LOCATION = Object.freeze({
  name: '長久手',
  reading: 'ながくて',
  latitude: 35.18411,
  longitude: 137.04872,
})

const FORECAST_HOST = 'api.open-meteo.com'
const FORECAST_HTTPS_PORT = 443
const FORECAST_PATH =
  `/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
  '&current=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FTokyo&forecast_days=1'

const BUILD_ID = 'kana-balloon-1'
const BALLOON_MS = 4000
const RESULT_HOLD_MS = 3500
const HTTP_TIMEOUT_MS = 15000
const LOOK_AROUND_MS = 5000
const FIRST_FETCH_DELAY_MS = 8000
const FETCH_INTERVAL_MS = 2 * 60 * 60 * 1000
const MOTION_STEP_SEC = 0.35
const MOTION_STEP_MS = 320
const AFTER_SPEECH_HOLD_MS = 1200

const DIGIT_YOMI = Object.freeze([
  'ぜろ',
  'いち',
  'に',
  'さん',
  'よん',
  'ご',
  'ろく',
  'なな',
  'はち',
  'きゅう',
])

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

function numberToYomi(value) {
  let n = Math.round(Number(value))
  if (n !== n) return ''
  if (n < 0) return `まいなす${numberToYomi(-n)}`
  if (n < 10) return DIGIT_YOMI[n]
  if (n === 10) return 'じゅう'
  if (n < 20) return `じゅう${DIGIT_YOMI[n % 10]}`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    const head = tens === 1 ? 'じゅう' : `${DIGIT_YOMI[tens]}じゅう`
    return ones === 0 ? head : `${head}${DIGIT_YOMI[ones]}`
  }
  if (n === 100) return 'ひゃく'
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    let head = 'ひゃく'
    if (hundreds === 3) head = 'さんびゃく'
    else if (hundreds === 6) head = 'ろっぴゃく'
    else if (hundreds === 8) head = 'はっぴゃく'
    else if (hundreds !== 1) head = `${DIGIT_YOMI[hundreds]}ひゃく`
    return rest === 0 ? head : `${head}${numberToYomi(rest)}`
  }
  return String(n)
}

function describeWeather(code) {
  if (code === 0 || code === 1) {
    return { label: '晴れ', reading: 'はれ', emotion: Emotion.HAPPY, motion: 'nod' }
  }
  if (code === 2 || code === 3) {
    return { label: '曇り', reading: 'くもり', emotion: Emotion.NEUTRAL, motion: 'lookAround' }
  }
  if (code >= 51 && code <= 67) {
    return { label: '雨', reading: 'あめ', emotion: Emotion.SAD, motion: 'lookDown' }
  }
  if (code >= 71 && code <= 77) {
    return { label: '雪', reading: 'ゆき', emotion: Emotion.SAD, motion: 'lookDown' }
  }
  if (code >= 80 && code <= 82) {
    return { label: 'にわか雨', reading: 'にわかあめ', emotion: Emotion.SAD, motion: 'lookDown' }
  }
  if (code >= 95) {
    return { label: '雷雨', reading: 'らいう', emotion: Emotion.ANGRY, motion: 'shake' }
  }
  return {
    label: 'わからない天気',
    reading: 'わからないてんき',
    emotion: Emotion.NEUTRAL,
    motion: 'nod',
  }
}

function buildForecastSpeech(body) {
  const current = body && body.current
  if (!current) throw new Error('no current')
  const temperature = formatTemperature(current.temperature_2m)
  const weather = describeWeather(Number(current.weather_code))

  let display = `${LOCATION.name}は${weather.label}`
  let spoken = `${LOCATION.reading}は、${weather.reading}`
  if (temperature != null) {
    display += `、${temperature}度`
    spoken += `。${numberToYomi(temperature)}ど`
  }
  display += 'だよ'
  spoken += 'だよ'

  return {
    display,
    spoken,
    emotion: weather.emotion,
    motion: weather.motion,
    label: weather.label,
    temperature,
  }
}

function showStatus(robot, lines, ms = BALLOON_MS) {
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

function httpsGetJson(host, path, port = FORECAST_HTTPS_PORT, timeoutMs = HTTP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const networkRoot = globalThis.device && device.network
    const network = networkRoot && networkRoot.https
    if (!network || !network.io) {
      reject(new Error('no-https-client'))
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

async function safeTorque(robot, on) {
  try {
    await robot.motion.setTorque(on)
  } catch (error) {
    trace(`[demo_combo] torque failed: ${error}\n`)
  }
}

async function safePose(robot, rotation, time = MOTION_STEP_SEC) {
  try {
    await robot.motion.setPose({ rotation }, time)
  } catch (error) {
    trace(`[demo_combo] pose failed: ${error}\n`)
  }
}

async function faceFront(robot) {
  try {
    robot.motion.lookAway()
  } catch (_) {}
  await safeTorque(robot, true)
  await safePose(robot, { y: 0, p: 0, r: 0 })
}

async function nod(robot) {
  await safeTorque(robot, true)
  await safePose(robot, { y: 0, p: 0.14, r: 0 })
  await wait(MOTION_STEP_MS)
  await safePose(robot, { y: 0, p: 0, r: 0 })
}

async function shakeHead(robot) {
  await safeTorque(robot, true)
  await safePose(robot, { y: 0.16, p: 0, r: 0 }, 0.28)
  await wait(MOTION_STEP_MS)
  await safePose(robot, { y: -0.16, p: 0, r: 0 }, 0.28)
  await wait(MOTION_STEP_MS)
  await safePose(robot, { y: 0, p: 0, r: 0 }, 0.28)
}

async function lookDown(robot) {
  await safeTorque(robot, true)
  await safePose(robot, { y: 0, p: 0.18, r: 0 })
  await wait(MOTION_STEP_MS)
}

async function glanceAround(robot) {
  await safeTorque(robot, true)
  await safePose(robot, { y: 0.12, p: 0.04, r: 0 }, 0.3)
  await wait(MOTION_STEP_MS)
  await safePose(robot, { y: -0.12, p: 0.02, r: 0 }, 0.3)
  await wait(MOTION_STEP_MS)
  await safePose(robot, { y: 0, p: 0, r: 0 }, 0.3)
}

async function playMotion(robot, kind) {
  if (kind === 'shake') {
    await shakeHead(robot)
    return
  }
  if (kind === 'lookDown') {
    await lookDown(robot)
    return
  }
  if (kind === 'lookAround') {
    await glanceAround(robot)
    return
  }
  await nod(robot)
}

/**
 * 吹き出し: 読みやすい表示文（漢字可）
 * 声: stackchan-voice 向けひらがな
 */
async function sayDual(robot, display, spoken) {
  const balloon = truncate(display, 48)
  try {
    robot.ui.showBalloon(balloon)
    await robot.audio.say(spoken)
    await wait(AFTER_SPEECH_HOLD_MS)
  } finally {
    try {
      robot.ui.hideBalloon()
    } catch (_) {}
  }
}

async function actAndSay(robot, display, spoken, motion = 'nod') {
  await faceFront(robot)
  await playMotion(robot, motion)
  await sayDual(robot, display, spoken)
}

function lookAroundIdle(robot) {
  try {
    const x = randomBetween(0.4, 1.0)
    const y = randomBetween(-0.4, 0.4)
    const z = randomBetween(-0.02, 0.2)
    robot.motion.lookAt([x, y, z])
  } catch (error) {
    trace(`[demo_combo] lookAround failed: ${error}\n`)
  }
}

async function runDiagnosis(robot) {
  const wifi = await checkWifi(robot)
  const httpsOk = Boolean(globalThis.device && device.network && device.network.https && device.network.https.io)
  showStatus(robot, [
    `版:${BUILD_ID}`,
    wifi.line,
    httpsOk ? 'HTTPS:あり' : 'HTTPS:無し',
    '場所:長久手',
    '間隔:2時間',
  ])
  try {
    robot.face.setEmotion(wifi.ok && httpsOk ? Emotion.HAPPY : Emotion.SAD)
  } catch (_) {}
  await wait(3500)
}

async function runForecast(robot) {
  await faceFront(robot)
  await actAndSay(
    robot,
    `${LOCATION.name}の天気をみてくるね`,
    `${LOCATION.reading}のてんきを、みてくるね`,
    'nod',
  )

  const wifi = await checkWifi(robot)
  if (!wifi.ok) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    showStatus(robot, ['取得結果:失敗', '理由:Wi-Fi', wifi.line], RESULT_HOLD_MS)
    await actAndSay(
      robot,
      'ネットにつながっていないみたい',
      'ねっとに、つながっていないみたい',
      'shake',
    )
    return
  }

  showStatus(robot, ['取得中...', wifi.line], 2500)
  await actAndSay(robot, 'ちょっと待ってね', 'ちょっと、まってね', 'lookAround')

  try {
    const body = await httpsGetJson(FORECAST_HOST, FORECAST_PATH, FORECAST_HTTPS_PORT)
    const forecast = buildForecastSpeech(body)

    showStatus(
      robot,
      [
        '取得結果:成功',
        `${LOCATION.name}:${forecast.label}`,
        forecast.temperature != null ? `気温:${forecast.temperature}度` : '気温:不明',
      ],
      2200,
    )
    try {
      robot.face.setEmotion(forecast.emotion)
    } catch (_) {}
    await wait(600)
    await actAndSay(robot, forecast.display, forecast.spoken, forecast.motion)
  } catch (error) {
    try {
      robot.face.setEmotion(Emotion.SAD)
    } catch (_) {}
    const detail = truncate(String(error && error.message ? error.message : error), 32)
    showStatus(robot, ['取得結果:失敗', '詳細↓', detail], RESULT_HOLD_MS)
    await actAndSay(robot, '天気がとれなかったよ', 'てんきが、とれなかったよ', 'shake')
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

  showStatus(robot, [`版:${BUILD_ID}`, 'ふきだし+ひらがな'], 2500)

  void runExclusive(async () => {
    await actAndSay(
      robot,
      '長久手の天気をお知らせするよ',
      'ながくてのてんきを、おしらせするよ',
      'nod',
    )
  })

  Timer.set(
    () => {
      void runExclusive(() => runForecast(robot))
    },
    FIRST_FETCH_DELAY_MS,
    FETCH_INTERVAL_MS,
  )

  Timer.repeat(() => {
    if (busy) return
    lookAroundIdle(robot)
  }, LOOK_AROUND_MS)
}
