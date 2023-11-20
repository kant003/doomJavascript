import type p5 from 'p5'

import {
  DELTA_ANGLE,
  HALF_FOV,
  HALF_HEIGHT,
  MAX_DEPTH,
  NUM_RAYS,
  SCALE,
  SCREEN_DIST,
  TEXTURE_SIZE
} from './settings'
import type Mapa from './map'
import type Player from './player'
import type ObjectRender from './objectRenderer'

class RayCasting {
  ctx: p5.p5InstanceExtensions
  map: Mapa
  player: Player

  rayCastingResult: Array<{ depth: number, projHeight: number, texture: number, offset: number }> = []
  objects_to_render: Array<{ depth: number, wallColumn: p5.Image, wallPos: { x: number, y: number }, projHeight: number }> = []
  textures: p5.Image[]
  cont = 1

  constructor (ctx: p5.p5InstanceExtensions, map: Mapa, player: Player, objectRender: ObjectRender) {
    this.ctx = ctx
    this.map = map
    this.player = player
    this.textures = objectRender.wallTextures
  }

  horizontals (cosA: number, sinA: number): { depthHorz: number, textureHor: number, xHorz: number } {
    let textureHor: number = 0
    const { x: ox, y: oy } = this.player.pos()
    const { y: yMap } = this.player.map_pos()

    let yHorz = sinA > 0 ? yMap + 1 : yMap - 1e-6
    const dy = sinA > 0 ? 1 : -1

    let depthHorz = (yHorz - oy) / sinA
    let xHorz = ox + depthHorz * cosA

    const deltaDepth = dy / sinA
    const dx = deltaDepth * cosA

    for (let i = 0; i < MAX_DEPTH; i++) {
      const tileHorzX = Math.floor(xHorz)
      const tileHorzY = Math.floor(yHorz)
      if (this.map.getValue(tileHorzX, tileHorzY) !== null) {
        // const v = this.map?.worldMap[tileHorzX][tileHorzY]
        // textureHor = v ?? 0
        textureHor = this.map?.worldMap[tileHorzX][tileHorzY] ?? 0
        textureHor = 0
        break
      }
      xHorz += dx
      yHorz += dy
      depthHorz += deltaDepth
    }
    return { depthHorz, textureHor, xHorz }
  }

  verticals (cosA: number, sinA: number): { depthVert: number, textureVert: number, yVert: number } {
    let textureVert: number | null = 0
    const { x: ox, y: oy } = this.player.pos()
    const { x: xMap } = this.player.map_pos()

    let xVert = cosA > 0 ? xMap + 1 : xMap - 1e-6
    const dx = cosA > 0 ? 1 : -1
    let depthVert = (xVert - ox) / cosA
    let yVert = oy + depthVert * sinA

    const deltaDepth = dx / cosA
    const dy = deltaDepth * sinA

    for (let i = 0; i < MAX_DEPTH; i++) {
      const tileVertX = Math.floor(xVert)
      const tileVertY = Math.floor(yVert)
      if (this.map.getValue(tileVertX, tileVertY) !== null) {
        // const v = this.map.worldMap[tileVertX][tileVertY]
        // textureVert = v ?? 0
        textureVert = this.map.worldMap[tileVertX][tileVertY] ?? 0
        textureVert = 0
        break
      }
      xVert += dx
      yVert += dy
      depthVert += deltaDepth
    }
    return { depthVert, textureVert, yVert }
  }

  drawWalls (depth: number, ray: number, projHeight: number): void {
    const color = (255 / (1 + depth ** 5 * 0.00002)) * 3
    this.ctx.noStroke()
    this.ctx.fill(color)
    this.ctx.rect(ray * SCALE, HALF_HEIGHT - Math.floor(projHeight / 2), SCALE, projHeight)
  }

  getObjectsToRender (): void {
    this.objects_to_render = []
    // console.log('aa')
    // console.log('a', this.rayCastingResult.length)
    if (this.ctx.keyIsDown(this.ctx.LEFT_ARROW)) {
      this.cont++
    }
    this.rayCastingResult.forEach((value, ray) => {
      const { depth, projHeight, texture, offset } = value
      // console.log(ray)
      // if (ray !== this.cont) { return }
      this.ctx.text(this.cont, 100, 90)

      // console.log(value)
      // const subImagen = this.textures[texture]

      const subImagen = this.textures[texture].get(offset * (TEXTURE_SIZE - SCALE), 0, SCALE, TEXTURE_SIZE)
      // const subImagen = this.textures[texture].get(100, 0, 20, TEXTURE_SIZE)
      const wallColumn = subImagen
      // wallColumn.resize(SCALE, projHeight)
      const wallPos = { x: (ray * SCALE), y: HALF_HEIGHT - Math.floor(projHeight / 2) }
      this.objects_to_render.push({ depth, wallColumn, wallPos, projHeight })
    })
  }

  rayCast (): void {
    this.rayCastingResult = []
    let texture: number, offset: number
    // const { x: ox, y: oy } = this.player.pos()
    // const {x:xMap, y:yMap} = this.player.map_pos()
    // textureVert = 0

    let rayAngle = this.player.angle - HALF_FOV + 0.0001
    for (let ray = 0; ray < NUM_RAYS; ray++) {
      const sinA = Math.sin(rayAngle)
      const cosA = Math.cos(rayAngle)
      // horizontals
      const { depthHorz, textureHor, xHorz } = this.horizontals(cosA, sinA)

      /* if (this.ctx.keyIsDown(this.ctx.UP_ARROW)) {
        this.ctx.stroke(255, 0, 0)
        this.ctx.line(
          ox * 100,
          oy * 100,
          ox * 100 + 100 * depthHorz * cosA,
          oy * 100 + 100 * depthHorz * sinA
        )
      } */
      // verticals
      const { depthVert, textureVert, yVert } = this.verticals(cosA, sinA)

      /*  if (this.ctx.keyIsDown(this.ctx.DOWN_ARROW)) {
        this.ctx.stroke(0, 255, 0)
        this.ctx.line(
          ox * 100,
          oy * 100,
          ox * 100 + 100 * depthVert * cosA,
          oy * 100 + 100 * depthVert * sinA
        )
      } */
      // DEPTH AND TEXTURE
      let depth = 0
      if (depthVert < depthHorz) {
        depth = depthVert
        texture = textureVert
        let yVert2 = yVert
        yVert2 %= 1
        offset = cosA > 0 ? yVert2 : 1 - yVert2
        // this.ctx.stroke(255, 255, 0)
      } else {
        depth = depthHorz
        texture = textureHor
        let xHorz2 = xHorz
        xHorz2 %= 1
        offset = sinA > 0 ? 1 - xHorz2 : xHorz2
        // this.ctx.stroke(0, 255, 0)
      }
      // DRAW debug
      // this.ctx.line(ox*100, oy*100, 100*ox+100*depth*cosA, 100*oy+100*depth*sinA)

      // remove fish eye
      depth *= Math.cos(this.player.angle - rayAngle)

      // proyection
      const projHeight = SCREEN_DIST / (depth + 0.0001)

      // Draw walls
      if (this.ctx.keyIsDown(this.ctx.UP_ARROW)) {
        this.drawWalls(depth, ray, projHeight)
      }

      // Raycasting result
      this.rayCastingResult.push({ depth, projHeight, texture, offset })

      rayAngle += DELTA_ANGLE
    }
  }

  update (): void {
    this.rayCast()
    this.getObjectsToRender()
  }

  draw (): void {}
}

export default RayCasting
