import { m4, v3 } from '../vendor/twgl-full.module.js'

export function createCamera() {
  const camera = {
    mode: 1, angle: 0.5, elevation: Math.PI / 4, distance: 19,
    position: [9, 8, 12], yaw: 0, pitch: 0,
    viewProjection: m4.identity()
  }
  function direction() {
    return [Math.sin(camera.yaw) * Math.cos(camera.pitch), Math.sin(camera.pitch), -Math.cos(camera.yaw) * Math.cos(camera.pitch)]
  }
  camera.setMode = mode => {
    if (mode === 3 && camera.mode !== 3) {
      const d = v3.normalize(v3.subtract([0, 0, 0], camera.position))
      camera.yaw = Math.atan2(d[0], -d[2])
      camera.pitch = Math.asin(d[1])
    }
    camera.mode = mode
  }
  camera.reset = () => {
    camera.mode = 1
    camera.angle = 0.5
    camera.elevation = Math.PI / 4
    camera.distance = 19
  }
  camera.drag = (dx, dy) => {
    if (camera.mode === 2) {
      camera.angle -= dx * 0.006
      camera.elevation = Math.max(-1.2, Math.min(1.45, camera.elevation + dy * 0.006))
    } else if (camera.mode === 3) {
      camera.yaw += dx * 0.006
      camera.pitch = Math.max(-1.5, Math.min(1.5, camera.pitch - dy * 0.006))
    }
  }
  camera.zoom = delta => {
    camera.distance = Math.max(7, Math.min(32, camera.distance * Math.exp(delta * 0.001)))
  }
  camera.update = (dt, keys, aspect) => {
    let target = [0, 0, 0]
    if (camera.mode !== 3) {
      if (camera.mode === 1) camera.angle += dt * 0.12
      const elevation = camera.mode === 1 ? Math.PI / 4 : camera.elevation
      const horizontal = camera.distance * Math.cos(elevation)
      camera.position = [horizontal * Math.sin(camera.angle), camera.distance * Math.sin(elevation), horizontal * Math.cos(camera.angle)]
    } else {
      const forward = direction()
      const right = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)]
      let movement = [0, 0, 0]
      const along = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
      const across = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      movement = v3.add(v3.mulScalar(forward, along), v3.mulScalar(right, across))
      movement[1] += Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))
      camera.position = v3.add(camera.position, v3.mulScalar(v3.normalize(movement), dt * 5))
      target = v3.add(camera.position, forward)
    }
    // Em telas estreitas, aumenta o campo vertical para a ilha caber na largura.
    const fieldOfView = 2 * Math.atan(Math.tan(Math.PI / 8) / Math.min(1, aspect))
    const projection = m4.perspective(fieldOfView, aspect, 0.1, 400)
    const view = m4.inverse(m4.lookAt(camera.position, target, [0, 1, 0]))
    camera.viewProjection = m4.multiply(projection, view)
  }
  return camera
}
