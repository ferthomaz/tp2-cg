import * as twgl from '../vendor/twgl-full.module.js'

export function parseOBJ(text) {
  const vertices = [], texcoords = [], normals = []
  const arrays = { position: [], texcoord: [], normal: [] }
  function read(list, index, line) {
    const i = Number(index)
    const value = list[i < 0 ? list.length + i : i - 1]
    if (!Number.isInteger(i) || i === 0 || !value) throw new Error(`Índice inválido no OBJ, linha ${line}`)
    return value
  }
  text.split(/\r?\n/).forEach((line, number) => {
    const [type, ...values] = line.split('#')[0].trim().split(/\s+/)
    if (['v', 'vt', 'vn'].includes(type)) {
      const size = type === 'vt' ? 2 : 3
      const data = values.slice(0, size).map(Number)
      if (data.length !== size || data.some(n => !Number.isFinite(n))) throw new Error(`Coordenada inválida, linha ${number + 1}`)
      ;({ v: vertices, vt: texcoords, vn: normals })[type].push(data)
    } else if (type === 'f') {
      if (values.length < 3) throw new Error(`Face incompleta, linha ${number + 1}`)
      const face = values.map(value => {
        const [p, t, n] = value.split('/')
        return { p: read(vertices, p, number + 1), t: t ? read(texcoords, t, number + 1) : [0, 0], n: n ? read(normals, n, number + 1) : null }
      })
      for (let i = 1; i < face.length - 1; i++) {
        const triangle = [face[0], face[i], face[i + 1]]
        const a = twgl.v3.subtract(triangle[1].p, triangle[0].p)
        const b = twgl.v3.subtract(triangle[2].p, triangle[0].p)
        const normal = twgl.v3.normalize(twgl.v3.cross(a, b))
        for (const vertex of triangle) {
          arrays.position.push(...vertex.p)
          arrays.texcoord.push(...vertex.t)
          arrays.normal.push(...(vertex.n || normal))
        }
      }
    }
  })
  if (!arrays.position.length) throw new Error('O OBJ não contém faces')
  return arrays
}

export function normalizeOBJ(arrays, settings) {
  const m4 = twgl.m4
  const rotation = settings.rotacao.map(degrees => degrees * Math.PI / 180)
  let matrix = m4.rotationX(rotation[0])
  matrix = m4.rotateY(matrix, rotation[1])
  matrix = m4.rotateZ(matrix, rotation[2])
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < arrays.position.length; i += 3) {
    const p = m4.transformPoint(matrix, arrays.position.slice(i, i + 3))
    const n = m4.transformDirection(matrix, arrays.normal.slice(i, i + 3))
    for (let axis = 0; axis < 3; axis++) {
      arrays.position[i + axis] = p[axis]
      arrays.normal[i + axis] = n[axis]
      min[axis] = Math.min(min[axis], p[axis])
      max[axis] = Math.max(max[axis], p[axis])
    }
  }
  const height = max[1] - min[1]
  if (height < 0.00001) throw new Error('Modelo sem altura; confira os eixos de exportação')
  const center = [(min[0] + max[0]) / 2, settings.centralizarY ? (min[1] + max[1]) / 2 : min[1], (min[2] + max[2]) / 2]
  for (let i = 0; i < arrays.position.length; i++) {
    arrays.position[i] = (arrays.position[i] - center[i % 3]) * settings.altura / height
  }
  return arrays
}

export async function loadOBJ(url, settings) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Não foi possível abrir ${url} (${response.status})`)
  return normalizeOBJ(parseOBJ(await response.text()), settings)
}
