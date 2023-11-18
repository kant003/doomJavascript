import './style.css'
import  p5  from 'p5'
import {RES, FPS} from './settings'
import Mapa from './map'
import  Player  from './player'
import  RayCasting  from './raycasting'

const _app = new p5((p5Instance:p5.p5InstanceExtensions) => {
  const p = p5Instance as unknown as p5;

  const x = 100;
  const y = 100;
  let map: Mapa
  let player: Player
  let rayCasting: RayCasting

  p.setup = function setup() {
    p.createCanvas(RES.width, RES.heigth);
    p.frameRate(FPS);
    newGame()
  };

 
  

  p.draw = function draw() {
    p.background(0);
    p.fill(205);
    //p.rect(x, y, 50, 50);
    
    player.update()
    rayCasting.update()

    //player.draw()
    //map.drawMap()
    p.text(`FPS: ${this.getTargetFrameRate()}`, 10, 10)

    
  };

  const newGame = ()=>{
    map = new Mapa(p)
    player = new Player(p, map)
    rayCasting = new RayCasting(p, map, player)
  } 
}, document.getElementById('app')!);