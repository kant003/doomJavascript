import './style.css'
import p5 from 'p5'
import { RES, FPS, MOUSE_BORDER_LEFT, MOUSE_BORDER_RIGHT, HALF_HEIGHT, HALF_WIDTH, MOUSE_SENSIBILITY, MOUSE_MAX_REL } from './settings'
import Mapa from './map'
import Player from './player'
import RayCasting from './raycasting'
import ObjectRenderer from './objectRenderer'

const _app = new p5((p5Instance: p5.p5InstanceExtensions) => {
  const p = p5Instance as unknown as p5

  // const x = 100
  // const y = 100
  let map: Mapa
  let player: Player
  let rayCasting: RayCasting
  let objectRenderer: ObjectRenderer

  p.setup = function setup () {
    p.createCanvas(RES.width, RES.heigth)
    p.frameRate(FPS)
    newGame()
    objectRenderer.scale()
  }

  p.draw = function draw () {
    p.background(0)
    p.fill(205)
    // p.rect(x, y, 50, 50);

    objectRenderer.draw(rayCasting.objects_to_render)

    player.update()
    rayCasting.update()

    player.draw()
    map.drawMap()
    p.text(`FPS: ${this.getTargetFrameRate()}`, 10, 10)

    // objectRenderer.drawObject()
  }

  const newGame = (): void => {
    map = new Mapa(p)
    player = new Player(p, map)
    rayCasting = new RayCasting(p, map, player, objectRenderer)
    // objectRenderer = new ObjectRenderer(p, map)
  }

  p.preload = function preload () {
    objectRenderer = new ObjectRenderer(p, map)
    objectRenderer.loadAllTextures()
    // this.loadImage('textures/1.png');
  }

  p.keyPressed = function keyPressed () {
    console.log(p.keyCode)
    /* if (p.keyCode === p.RIGHT_ARROW) {
      player.rigth()
    } */
    // return false
  }
  p.mouseMoved = function mouseMoved () {
    const mx = p.mouseX
    if (mx < MOUSE_BORDER_LEFT || mx > MOUSE_BORDER_RIGHT) {
      p.mouseX = HALF_WIDTH
      p.mouseX = HALF_HEIGHT
    }
    // let rel = p.pmouseX
    const rel = Math.max(-MOUSE_MAX_REL, Math.min(MOUSE_MAX_REL, p.mouseX - p.pmouseX))

    player.angle += rel * MOUSE_SENSIBILITY * p.deltaTime
  }
}, document.getElementById('app')!)
