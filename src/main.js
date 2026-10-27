import './styles.css'
import { World } from './game/world.js'
import { Renderer } from './game/renderer.js'
import { Game } from './game/game.js'
import { UI } from './ui/ui.js'

const canvas = document.getElementById('scene')

function showFatal(error) {
  console.error(error)
  const start = document.getElementById('start-screen')
  if (start) start.hidden = true
  let panel = document.getElementById('fatal-error')
  if (!panel) {
    panel = document.createElement('div')
    panel.id = 'fatal-error'
    panel.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99', 'display:flex', 'align-items:center', 'justify-content:center',
      'padding:24px', 'background:#041115', 'color:#ecf8f4', 'font-family:system-ui,sans-serif', 'text-align:center'
    ].join(';')
    document.body.appendChild(panel)
  }
  panel.innerHTML = `<div style="max-width:560px">
    <div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#ff806d;margin-bottom:14px">Unable to start</div>
    <h1 style="font-family:Georgia,serif;font-weight:500;font-size:38px;line-height:1.1;margin:0 0 14px">Transit 3D could not initialise.</h1>
    <p style="font-size:14px;line-height:1.6;color:#94b4ae;margin:0 0 18px">Your browser needs WebGL 2 to render the 3D world. Try enabling hardware acceleration or opening the game in a current version of Chrome, Edge or Firefox.</p>
    <pre style="white-space:pre-wrap;text-align:left;font-size:11px;line-height:1.5;color:#7fffd4;background:#071c21;border:1px solid #173b3e;border-radius:10px;padding:12px;max-height:180px;overflow:auto">${String(error?.message || error).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
  </div>`
}

try {
  const world = new World(20260426)
  const renderer = new Renderer(canvas, world)
  const game = new Game(world, renderer)
  const ui = new UI(game, world, renderer)

  window.__TT3D = { world, renderer, game, ui, THREE: true }

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    game.toast('Graphics context lost. Reload the page to continue.', 'error')
  })

  let last = performance.now()
  let raf = 0
  const frame = now => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
    last = now
    game.update(dt)
    renderer.update(dt)
    ui.update(dt)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => cancelAnimationFrame(raf))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      last = performance.now()
    }
  })
} catch (error) {
  showFatal(error)
}
