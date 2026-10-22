import { assets } from './assets.js'

export function createAudio(warn) {
  const ambient = new Audio(assets.som.ambiente)
  const pet = new Audio(assets.som.carinho)
  ambient.loop = true
  ambient.volume = 0.35
  pet.volume = 0.4
  let enabled = false
  ambient.addEventListener('error', () => warn('Não foi possível carregar o som ambiente. Confira js/assets.js.'))
  pet.addEventListener('error', () => warn('Não foi possível carregar o som de carinho. Confira js/assets.js.'))
  return {
    async toggle() {
      if (enabled) {
        ambient.pause()
        pet.pause()
        enabled = false
      } else {
        try { await ambient.play(); enabled = true }
        catch { warn('O som não iniciou. Confira o arquivo e tente ativá-lo novamente.') }
      }
      return enabled
    },
    pet() {
      if (!enabled) return
      pet.currentTime = 0
      pet.play().catch(() => warn('Não foi possível tocar o som de carinho.'))
    },
    pause() { ambient.pause(); pet.pause() },
    resume() { if (enabled) ambient.play().catch(() => {}) }
  }
}
