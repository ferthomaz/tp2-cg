import { m4, v3 } from '../vendor/twgl-full.module.js'


export function intersectTriangle(origin, direction, a, b, c) {
  const edge1 = v3.subtract(b, a), edge2 = v3.subtract(c, a)
  const p = v3.cross(direction, edge2)
  const determinant = v3.dot(edge1, p)
  if (Math.abs(determinant) < 0.000001) return Infinity
  const t = v3.subtract(origin, a)
  const u = v3.dot(t, p) / determinant
  if (u < 0 || u > 1) return Infinity
  const q = v3.cross(t, edge1)
  const v = v3.dot(direction, q) / determinant
  if (v < 0 || u + v > 1) return Infinity
  const distance = v3.dot(edge2, q) / determinant
  return distance > 0 ? distance : Infinity
}

export function pickObject(x, y, camera, objects) {
  //x e y são coordenadas normalizadas da tela, entre -1 e 1
  const inverse = m4.inverse(camera.viewProjection)
  const origin = m4.transformPoint(inverse, [x, y, -1])
  const far = m4.transformPoint(inverse, [x, y, 1])
  const direction = v3.normalize(v3.subtract(far, origin))
  let closest = Infinity, hit = null
  for (const object of objects) {
    if (object.pickable === false) continue
    const local = m4.inverse(object.world)
    const localOrigin = m4.transformPoint(local, origin)
    //não normalizei aqui pra distância continuar comparável entre objetos
    const localDirection = m4.transformDirection(local, direction)
    //descarta pela caixa do modelo antes de testar seus triângulos detalhados
    if (object.mesh.bounds) {
      let near = 0, far = closest
      const { min, max } = object.mesh.bounds
      //pequena margem p evitar descartar cliques exatamente nas bordas por arredondamento
      const margin = 0.00001
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(localDirection[axis]) < 0.0000001) {
          if (localOrigin[axis] < min[axis] - margin || localOrigin[axis] > max[axis] + margin) far = -1
        } else {
          const a = (min[axis] - margin - localOrigin[axis]) / localDirection[axis]
          const b = (max[axis] + margin - localOrigin[axis]) / localDirection[axis]
          near = Math.max(near, Math.min(a, b))
          far = Math.min(far, Math.max(a, b))
        }
      }
      if (near > far) continue
    }
    const { position, indices } = object.mesh.arrays
    const count = indices ? indices.length : position.length / 3
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map(offset => {
        const index = (indices ? indices[i + offset] : i + offset) * 3
        return position.slice(index, index + 3)
      })
      const distance = intersectTriangle(localOrigin, localDirection, ...triangle)
      if (distance < closest) { closest = distance; hit = object }
    }
  }
  //considera os objetos da frente para não fazer carinho através do chão
  return hit
}
