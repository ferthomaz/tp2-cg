import * as twgl from '../vendor/twgl-full.module.js'
import { createScene } from './scene.js'
import { createCamera } from './camera.js'
import { pickObject } from './picking.js'
import { createAudio } from './audio.js'

const canvas = document.querySelector('#canvas')
const message = document.querySelector('#message')
const heart = document.querySelector('#heart')
const growlEmoji = document.querySelector('#growl-emoji')
let messageTimer
function notify(text, permanent = false) {
  clearTimeout(messageTimer)
  message.textContent = text
  if (!permanent) messageTimer = setTimeout(() => { message.textContent = '' }, 5000)
}

async function loadShader(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Não foi possível carregar ${url} (${response.status})`)
  return response.text()
}

async function main() {
  const gl = canvas.getContext('webgl2', { antialias: true })
  if (!gl) throw new Error('WebGL 2 não está disponível. Tente um navegador atualizado com aceleração gráfica.')
  const [vs, fs] = await Promise.all([
    loadShader('shaders/vertex.glsl'),
    loadShader('shaders/fragment.glsl')
  ])
  const programInfo = twgl.createProgramInfo(gl, [vs, fs])
  if (!programInfo) throw new Error('Não foi possível compilar os shaders. Consulte o console.')
  const warnings = []
  const scene = await createScene(gl, text => { warnings.push(text); console.warn(text) })
  if (warnings.length) notify(warnings.join(' '), true)
  else notify('Bem-vindo! Clique no feijão para fazer carinho.')

  const camera = createCamera()
  const sound = createAudio(notify)
  const keys = new Set()
  const state = { pose: 0, lighting: true, fog: false, happyUntil: 0, growlUntil: 0, scaredAt: -Infinity }
  let time = 0, previousTime = 0, objects = []
  let pointer = null
  const help = document.querySelector('#help')

  function cameraUI() {
    document.querySelectorAll('[data-camera]').forEach(button => {
      button.setAttribute('aria-pressed', Number(button.dataset.camera) === camera.mode)
    })
    help.textContent = {
      1: 'Passeio automático · roda do mouse: aproximar · clique no cachorro: carinho',
      2: 'Arraste para orbitar · roda do mouse: aproximar · clique no cachorro: carinho',
      3: 'WASD: voar · arraste o mouse para se mover · Q/E: descer/subir · R: voltar para configuração inicial'
    }[camera.mode]
  }
  function setCamera(mode) {
    camera.setMode(mode)
    keys.clear()
    cameraUI()
  }
  function toggle(button, enabled, on, off) {
    button.setAttribute('aria-pressed', enabled)
    button.textContent = enabled ? on : off
  }
  const actions = {
    KeyP() {
      state.pose = (state.pose + 1) % 3
      state.happyUntil = 0
      notify(`Posição ${state.pose + 1} de 3 dos dois cachorros`)
    },
    KeyL() {
      state.lighting = !state.lighting
      toggle(document.querySelector('#light'), state.lighting, 'L · Luz ligada', 'L · Luz desligada')
    },
    KeyN() {
      state.fog = !state.fog
      toggle(document.querySelector('#fog'), state.fog, 'N · Neblina ligada', 'N · Neblina desligada')
    },
    async KeyM() {
      const button = document.querySelector('#sound')
      if (button.disabled) return
      button.disabled = true
      const enabled = await sound.toggle()
      toggle(button, enabled, 'M · Silenciar', 'M · Ativar som')
      button.disabled = false
    },
    KeyR() { camera.reset(); keys.clear(); cameraUI() },
    Digit1() { setCamera(1) }, Digit2() { setCamera(2) }, Digit3() { setCamera(3) }
  }
  for (const [id, key] of Object.entries({ pose: 'KeyP', light: 'KeyL', fog: 'KeyN', sound: 'KeyM', reset: 'KeyR' })) {
    document.querySelector(`#${id}`).addEventListener('click', actions[key])
  }
  document.querySelectorAll('[data-camera]').forEach(button => {
    button.addEventListener('click', () => setCamera(Number(button.dataset.camera)))
  })
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
    if (actions[event.code] || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) {
      event.preventDefault()
      keys.add(event.code)
      if (!event.repeat && actions[event.code]) actions[event.code]()
    }
  })
  window.addEventListener('keyup', event => keys.delete(event.code))
  window.addEventListener('blur', () => { keys.clear(); pointer = null })
  document.addEventListener('visibilitychange', () => {
    keys.clear()
    previousTime = 0
    if (document.hidden) sound.pause()
    else sound.resume()
  })
  canvas.addEventListener('wheel', event => {
    event.preventDefault()
    if (camera.mode !== 3) camera.zoom(event.deltaY)
  }, { passive: false })
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    canvas.focus()
    canvas.setPointerCapture(event.pointerId)
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 }
  })
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
    pointer.moved += Math.abs(dx) + Math.abs(dy)
    camera.drag(dx, dy)
    pointer.x = event.clientX
    pointer.y = event.clientY
  })
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return
    if (pointer.moved < 6) {
      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width * 2 - 1
      const y = 1 - (event.clientY - rect.top) / rect.height * 2
      const hit = pickObject(x, y, camera, objects)
      if (hit?.dog === 'small') {
        state.happyUntil = 0
        state.growlUntil = time + 0.8
        state.scaredAt = time
        sound.growl()
        notify('Grrr! O Pingo rosnou e o Feijão se assustou!')
      } else if (hit?.dog === 'big' && time - state.scaredAt >= 1.8) {
        state.happyUntil = time + 1.6
        sound.pet()
        notify('Ele adorou o carinho!')
      }
    }
    pointer = null
  })
  canvas.addEventListener('pointercancel', () => { pointer = null })
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    notify('A conexão com a GPU foi interrompida. Recarregue a página para continuar.', true)
  })
  cameraUI()
  gl.enable(gl.DEPTH_TEST)
  gl.clearColor(0.79, 0.87, 0.84, 1)

  function draw(object, sky = false) {
    const world = object.world
    twgl.setBuffersAndAttributes(gl, programInfo, object.mesh.bufferInfo)
    twgl.setUniforms(programInfo, {
      u_world: world,
      u_worldViewProjection: twgl.m4.multiply(camera.viewProjection, world),
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(world)),
      u_color: object.color,
      u_texture: object.texture,
      u_shininess: object.shininess,
      u_specular: object.specular,
      u_sky: sky,
      u_unlit: !!object.unlit
    })
    twgl.drawBufferInfo(gl, object.mesh.bufferInfo)
  }
  function showReaction(element, position, visible, emoji) {
    element.hidden = true
    if (!visible) return
    const p = twgl.m4.transformPoint(camera.viewProjection, position)
    if (p[2] > -1 && p[2] < 1) {
      element.hidden = false
      element.textContent = emoji
      element.style.left = `${(p[0] * 0.5 + 0.5) * canvas.clientWidth}px`
      element.style.top = `${(-p[1] * 0.5 + 0.5) * canvas.clientHeight}px`
    }
  }
  function render(milliseconds) {
    if (gl.isContextLost()) return
    const seconds = milliseconds * 0.001
    const dt = previousTime ? Math.min(seconds - previousTime, 0.05) : 0
    previousTime = seconds
    time += dt
    twgl.resizeCanvasToDisplaySize(canvas, Math.min(window.devicePixelRatio || 1, 2))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    camera.update(dt, keys, canvas.width / canvas.height)
    const happy = time < state.happyUntil
    const growling = time < state.growlUntil
    const scared = time - state.scaredAt < 1.8
    objects = scene.update(time, state.pose, happy, growling, scared ? time - state.scaredAt : -1)

    gl.useProgram(programInfo.program)
    twgl.setUniforms(programInfo, {
      u_cameraPosition: camera.position,
      u_lightDirection: [-0.5, 1, 0.7],
      u_lighting: state.lighting,
      u_fog: state.fog,
      u_fogColor: [0.79, 0.87, 0.84]
    })
    // O céu acompanha só a posição da câmera. Não ocupa o depth buffer.
    gl.depthMask(false)
    draw(scene.sky(camera.position), true)
    gl.depthMask(true)
    for (const object of objects) if (!object.transparent) draw(object)
    // Sombras suaves são planos com PNG transparente. Não escrevem profundidade.
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.depthMask(false)
    for (const object of objects) if (object.transparent) draw(object)
    gl.depthMask(true)
    gl.disable(gl.BLEND)

    showReaction(heart, scene.heartPosition(), happy || scared, scared ? '😨' : '♥')
    showReaction(growlEmoji, scene.growlPosition(), growling, '😠')
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

main().catch(error => {
  console.error(error)
  notify(error.message, true)
})
