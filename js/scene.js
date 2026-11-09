import * as twgl from '../vendor/twgl-full.module.js'
import { assets } from './assets.js'
import { loadOBJ } from './obj.js'

const m4 = twgl.m4

export function transform(parent, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  let world = m4.translate(parent, position)
  world = m4.rotateX(world, rotation[0])
  world = m4.rotateY(world, rotation[1])
  world = m4.rotateZ(world, rotation[2])
  return m4.scale(world, scale)
}

export async function createScene(gl, warn) {
  //reutilizamos os buffers
  function mesh(arrays) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < arrays.position.length; i++) {
      min[i % 3] = Math.min(min[i % 3], arrays.position[i])
      max[i % 3] = Math.max(max[i % 3], arrays.position[i])
    }
    return { arrays, bounds: { min, max }, bufferInfo: twgl.createBufferInfoFromArrays(gl, arrays) }
  }
  const shapes = {
    cube: mesh(twgl.primitives.createCubeVertices(1)),
    sphere: mesh(twgl.primitives.createSphereVertices(1, 24, 16)),
    hemisphere: mesh(twgl.primitives.createSphereVertices(1, 64, 32, Math.PI / 2, Math.PI)),
    cylinder: mesh(twgl.primitives.createCylinderVertices(1, 1, 32, 1)),
    cone: mesh(twgl.primitives.createTruncatedConeVertices(1, 0, 1, 5, 1)),
    disc: mesh(twgl.primitives.createDiscVertices(1, 48)),
    sky: mesh(twgl.primitives.createSphereVertices(1, 48, 24)),
    rim: mesh(twgl.primitives.createTorusVertices(4.94, 0.12, 80, 12)),
    plane: mesh(twgl.primitives.createPlaneVertices(2, 2))
  }
  const white = twgl.createTexture(gl, { src: [255, 255, 255, 255] })
  async function texture(url, flipY = true) {
    if (!url) return white
    const image = new Image()
    image.src = url
    try {
      await image.decode()
      return twgl.createTexture(gl, { src: image, flipY, wrap: gl.CLAMP_TO_EDGE })
    } catch {
      warn(`Textura não carregada: ${url}. Usando cor simples.`)
      return white
    }
  }
  const models = {}
  const textures = new Map()
  for (const [name, settings] of Object.entries(assets)) {
    if (!settings.obj) continue
    try {
      if (!textures.has(settings.textura)) textures.set(settings.textura, await texture(settings.textura))
      models[name] = { mesh: mesh(await loadOBJ(settings.obj, settings)), texture: textures.get(settings.textura) }
    } catch (error) {
      warn(`${error.message}. Usando ${name} provisório.`)
    }
  }
  const grass = await texture(assets.chao.textura)
  
  const skyTexture = await texture(assets.ceu.textura, false)
  const shadowTexture = await texture(assets.sombra.textura)
  const soilTexture = await texture('assets/texturas/terra-cartoon.png', false)
  const identity = m4.identity()
  let objects = []
  function add(shape, world, color, options = {}) {
    objects.push({ mesh: shapes[shape], world, color, texture: white, shininess: 16, specular: 0.06, dog: false, ...options })
  }
  function part(shape, parent, position, scale, color, rotation, options) {
    add(shape, transform(parent, position, scale, rotation), color, options)
  }
  function model(name, parent, fallback = () => {}, dog = false) {
    if (!models[name]) return fallback()
    const settings = assets[name]
    
    add(null, m4.translate(parent, settings.deslocamento), settings.textura ? [1, 1, 1] : settings.cor,
      { ...models[name], dog, shininess: 36, specular: dog ? 0.1 : 0.035 })
  }
  function shadow(position, size) {
    part('plane', identity, [position[0], 0.027, position[2]], [size[0], 1, size[1]], [1, 1, 1], undefined,
      { texture: shadowTexture, transparent: true, unlit: true, pickable: false })
  }
  const green = [0.35, 0.54, 0.28], wood = [0.45, 0.29, 0.17]
  const cream = [0.93, 0.83, 0.63], gold = [0.77, 0.5, 0.27], dark = [0.16, 0.13, 0.11]

  part('hemisphere', identity, [0, -0.12, 0], [5, 5, 5], [1, 1, 1], undefined, { texture: soilTexture })
  part('cylinder', identity, [0, -0.08, 0], [5, 0.18, 5], [0.57, 0.69, 0.41])
  part('rim', identity, [0, -0.05, 0], [1, 0.75, 1], [0.64, 0.75, 0.48])
  part('disc', identity, [0, 0.02, 0], [5, 1, 5], [1, 1, 1], undefined, { texture: grass })

  for (const [x, z, size] of [[-3, -1.4, 1], [2.6, -2.5, 0.9], [-3.4, 1.1, 0.72]]) {
    const tree = transform(identity, [x, 0.03, z], [size, size, size])
    shadow([x, 0, z], [size * 1.25, size * 1.1])
    model('arvore', tree, () => {
      part('cylinder', tree, [0, 0.8, 0], [0.16, 1.6, 0.16], wood)
      part('sphere', tree, [0, 2.3, 0], [1.05, 1.25, 1], green)
      part('sphere', tree, [0.55, 2, 0.2], [0.6, 0.8, 0.7], [0.43, 0.6, 0.3])
    })
  }
  for (const [x, z] of [[-3.6, 2.3], [3.5, 0.1], [0.5, -3.8]]) {
    const bush = transform(identity, [x, 0.03, z])
    shadow([x, 0, z], [0.8, 0.5])
    model('arbusto', bush, () => {
      part('sphere', bush, [0, 0.32, 0], [0.65, 0.48, 0.5], green)
      part('sphere', bush, [0.45, 0.23, 0.1], [0.4, 0.32, 0.4], [0.49, 0.62, 0.31])
    })
  }
  for (const [x, z, size] of [[-3.2, 2.4, 0.8], [3.6, 1.5, 1], [3.1, 2.3, 0.6]]) {
    const rock = transform(identity, [x, 0.03, z], [size, size, size])
    model('pedra', rock, () => part('sphere', rock, [0, 0.3, 0], [0.5, 0.3, 0.4], [0.6, 0.62, 0.6]))
  }
  const house = transform(identity, [0.3, 0.03, -2.5])
  shadow([0.3, 0, -2.5], [1.35, 1.15])
  model('casinha', house, () => {
    part('cube', house, [0, 0.65, 0], [1.7, 1.3, 1.5], cream)
    part('cube', house, [-0.5, 1.52, 0], [1.25, 0.15, 1.85], [0.65, 0.32, 0.23], [0, 0, 0.55])
    part('cube', house, [0.5, 1.52, 0], [1.25, 0.15, 1.85], [0.65, 0.32, 0.23], [0, 0, -0.55])
    part('cube', house, [0, 0.45, 0.76], [0.65, 0.9, 0.02], wood)
  })
  //cerca, caminho, potinhos, cogumelos e brinquedos compartilham um OBJ
  model('jardim', m4.translation([0, 0.03, 0]))
  //folhinhas pendentes acompanham a superfície da ilha
  for (const angle of [-1.1, -0.25, 0.9, 2.3]) {
    for (let i = 0; i < 5; i++) {
      const y = -0.18 - i * 0.18
      const radius = Math.sqrt(25 - (y + 0.12) ** 2) + 0.035
      const a = angle + Math.sin(i * 1.8) * 0.018
      part('sphere', identity, [Math.sin(a) * radius, y, Math.cos(a) * radius], [0.11, 0.16, 0.045],
        i % 2 ? [0.48, 0.65, 0.44] : [0.59, 0.72, 0.48], [0, a, i % 2 ? 0.5 : -0.5])
    }
  }
  //nuvens arredondadas e céu texturizado
  for (const [x, y, z, size] of [[-6.8, -1.1, -2, 1], [6.6, -1.5, -3.2, 0.85], [-2.8, -2.5, 6.6, 0.65]]) {
    const cloud = transform(identity, [x, y, z], [size, size, size])
    for (const [dx, dy, radius] of [[-0.8, 0, 0.65], [0, 0.2, 0.92], [0.85, 0, 0.62]]) {
      part('sphere', cloud, [dx, dy, 0], [radius, radius * 0.60, radius * 0.63], [0.98, 0.98, 0.95], undefined, { specular: 0.02 })
    }
  }
  const mill = transform(identity, [2.5, 0.03, -0.7], [1, 1, 1], [0, -0.2, 0])
  shadow([2.5, 0, -0.7], [0.85, 0.75])
  model('moinhoBase', mill, () => {
    part('cylinder', mill, [0, 1.1, 0], [0.5, 2.2, 0.5], cream)
    part('cone', mill, [0, 2.5, 0], [0.65, 0.7, 0.65], [0.65, 0.32, 0.23])
  })
  const staticObjects = objects
  const poses = [
    { position: [0, 0.03, 1.4], angle: 0.25, smallPosition: [-1.45, 0.03, 2.2], smallAngle: 0.45 },
    { position: [-2.1, 0.03, 0], angle: Math.PI / 2, smallPosition: [-0.6, 0.03, -0.7], smallAngle: Math.PI / 2 },
    { position: [1.7, 0.03, 2.7], angle: -Math.PI / 3, smallPosition: [0.1, 0.03, 3.3], smallAngle: -Math.PI / 3 }
  ]
  let dogWorld = identity
  let smallDogWorld = identity

  function drawDog(world, time, id, happy, scared, growling) {
    const small = id === 'small'
    const fur = small ? [0.4, 0.43, 0.48] : gold
    const ears = small ? [0.22, 0.24, 0.28] : wood
    const collar = small ? [0.25, 0.5, 0.63] : [0.64, 0.25, 0.2]
    const dog = { dog: id, specular: 0.04 }
    part('sphere', world, [0, 0.85, 0], [0.43, 0.48, 0.72], fur, undefined, dog)
    for (const x of [-0.28, 0.28]) {
      for (const z of [-0.43, 0.43]) {
        part('sphere', world, [x, 0.3, z], [0.15, 0.3, 0.18], cream, undefined, dog)
      }
    }
    part('sphere', world, [0, 1.4, 0.52], [0.48, 0.47, 0.43], fur, undefined, dog)
    part('sphere', world, [0, 1.23, 0.88], [0.3, 0.22, 0.27], cream, undefined, dog)
    part('sphere', world, [0, 1.3, 1.08], [0.13, 0.1, 0.09], dark, undefined, dog)
    for (const x of [-0.23, 0.23]) {
      const eye = scared ? 0.095 : 0.065
      part('sphere', world, [x, 1.52, 0.86], [eye, eye, 0.045], dark, undefined, dog)
      part('sphere', world, [x * 2, 1.26, 0.45], [0.15, 0.42, 0.25], ears, [scared ? -0.7 : 0, 0, x], dog)
      if (growling) {
        part('cube', world, [x, 1.65, 0.89], [0.2, 0.045, 0.04], ears, [0, 0, Math.sign(x) * 0.4], dog)
      }
    }
    part('cube', world, [0, 1.03, 0.55], [0.65, 0.12, 0.5], collar, undefined, dog)
    const wag = scared ? 0 : Math.sin(time * (happy ? 18 : 3)) * 0.4
    const tail = transform(world, [0, 1, -0.6], [1, 1, 1], [scared ? 2.6 : 0.6, 0, wag])
    part('sphere', tail, [0, 0.32, 0], [0.1, 0.4, 0.1], fur, undefined, dog)
  }

  function update(time, poseIndex, happy, growling = false, scareTime = -1) {
    objects = [...staticObjects]
    //hierarquia: mundo -> moinho -> eixo -> pás
    const hub = transform(mill, [0, 2.05, 0.57], [1, 1, 1], [0, 0, time * 0.7])
    model('moinhoPas', hub, () => {
      part('cube', hub, [0, 0, 0], [2.5, 0.2, 0.12], cream)
      part('cube', hub, [0, 0, 0], [0.2, 2.5, 0.12], cream)
      part('sphere', hub, [0, 0, 0.12], [0.16, 0.16, 0.14], wood)
    })
    const pose = poses[poseIndex]
    const smallDogPosition = pose.smallPosition
    const scared = scareTime >= 0 && scareTime < 1.8
    const position = [...pose.position]
    let shake = 0
    if (scared) {
      const away = twgl.v3.normalize(twgl.v3.subtract(pose.position, smallDogPosition))
      const recoil = Math.sin(Math.PI * scareTime / 1.8) * 0.4
      position[0] += away[0] * recoil
      position[2] += away[2] * recoil
      position[1] += Math.sin(Math.PI * Math.min(scareTime / 0.45, 1)) * 0.35
      shake = Math.sin(scareTime * 35) * 0.07 * (1 - scareTime / 1.8)
    } else if (happy) {
      position[1] += Math.abs(Math.sin(time * 10)) * 0.12
    }
    dogWorld = transform(identity, position, [1, 1, 1], [0, pose.angle, shake])
    shadow(position, [0.68, 0.8])
    model('cachorro', dogWorld, () => drawDog(dogWorld, time, 'big', happy, scared, false), 'big')

    smallDogWorld = transform(identity, smallDogPosition, [1, 1, 1], [0, pose.smallAngle, growling ? Math.sin(time * 28) * 0.025 : 0])
    shadow(smallDogPosition, [0.48, 0.6])
    model('cachorroPequeno', smallDogWorld, () => {
      const small = m4.scale(smallDogWorld, [0.6, 0.6, 0.6])
      drawDog(small, time, 'small', false, false, growling)
    }, 'small')
    return objects
  }
  function sky(cameraPosition) {
    return { mesh: shapes.sky, world: transform(identity, cameraPosition, [120, 120, 120]), color: [1, 1, 1], texture: skyTexture, shininess: 1, specular: 0 }
  }
  return {
    update, sky,
    dogCenter: () => m4.transformPoint(dogWorld, [0, 1, 0]),
    smallDogCenter: () => m4.transformPoint(smallDogWorld, [0, 0.6, 0]),
    heartPosition: () => m4.transformPoint(dogWorld, [0, (models.cachorro ? assets.cachorro.altura : 1.9) + 0.4, 0]),
    growlPosition: () => m4.transformPoint(smallDogWorld, [0, (models.cachorroPequeno ? assets.cachorroPequeno.altura : 1.14) + 0.3, 0]),
    loadedModels: Object.keys(models)
  }
}
