import type p5 from 'p5'

import { SCALE, TEXTURE_SIZE, RES } from './settings'
import type Mapa from './map'
import { type ObjectToRenderType } from './raycasting'

class ObjectRenderer {
  wallTextures: p5.Image[]
  ctx: p5.p5InstanceExtensions
  map: Mapa
  // rayTracing: RayCasting
  constructor (ctx: p5.p5InstanceExtensions, map: Mapa/*, rayTracing: RayCasting */) {
    this.ctx = ctx
    this.map = map
    this.wallTextures = []
  //  this.rayTracing = rayTracing
  }

  draw (objectToRender: ObjectToRenderType[] = []): void {
    this.renderGameObjects(objectToRender)
  }

  renderGameObjects (objectToRender: ObjectToRenderType[] = []): void {
    // const listObjects = this.rayTracing.objects_to_render
    const listObjects = objectToRender
    listObjects.forEach(object => {
      const { wallColumn: image, wallPos: pos, projHeight } = object
      // console.log(object)
      this.ctx.image(image, pos.x, pos.y, SCALE, projHeight < RES.heigth ? projHeight : RES.heigth)
      // this.ctx.image(image, pos.x, pos.y)
    })
  }

  getTexture (path: string, width: number = TEXTURE_SIZE, height: number = TEXTURE_SIZE): p5.Image {
    const texture = this.ctx.loadImage(path)
    // texture.resize(255, 0);
    return texture
  }

  loadAllTextures (): void {
    this.wallTextures.push(this.getTexture('textures/1.png'))
    this.wallTextures.push(this.getTexture('textures/2.png'))
    this.wallTextures.push(this.getTexture('textures/3.png'))
    this.wallTextures.push(this.getTexture('textures/4.png'))
    this.wallTextures.push(this.getTexture('textures/5.png'))
  }

  scale (): void {
    this.wallTextures?.forEach(img => {
      img.resize(TEXTURE_SIZE, TEXTURE_SIZE)
    })
    // this.img?.resize(255, 0);
  }

  /* drawObject (): void {
    // this.img?.resize(255, 0);
    this.ctx.image(this.wallTextures[0], 0, 0)
  } */
}

export default ObjectRenderer
