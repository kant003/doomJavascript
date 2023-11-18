import p5 from "p5";

import { RES, PLAYER_POS, PLAYER_ANGLE, PLAYER_SPEED,PLAYER_ROT_SPEED } from "./settings";
import Mapa from "./map";

const scale = 100;
class Player {
  ctx: p5.p5InstanceExtensions;
  map: Mapa;
  x: number = PLAYER_POS.x;
  y: number = PLAYER_POS.y;
  angle: number = PLAYER_ANGLE;
  constructor(ctx: p5.p5InstanceExtensions, map:Mapa) {
    this.ctx = ctx;
    this.map = map;
  }

  movement() {
    const sin_a = Math.sin(this.angle);
    const cos_a = Math.cos(this.angle);
    const speed = PLAYER_SPEED * this.ctx.deltaTime;
    const speed_sin = speed * sin_a;
    const speed_cos = speed * cos_a;
    let dx = 0, dy = 0;
      if (this.ctx.keyIsDown(87)) {
        dx += speed_cos;
        dy += speed_sin;
    }
    if (this.ctx.keyIsDown(83)) {
        dx += -speed_cos;
        dy += -speed_sin;
    }
    if (this.ctx.keyIsDown(65)) {
        dx += speed_sin;
        dy += -speed_cos;
    }
    if (this.ctx.keyIsDown(68)) {
        dx += -speed_sin;
        dy += speed_cos;
      }
   // }
    //this.x += dx;
    //this.y += dy;
   // console.log(this.x+dx,this.y+dy)
   // console.log(this.map.worldMap[this.x | 0][this.y | 0])
    this.checkWallCollision(dx,dy)
    if (this.ctx.keyIsPressed === true) {
      if (this.ctx.keyCode === this.ctx.LEFT_ARROW) {
        this.angle -= PLAYER_ROT_SPEED*this.ctx.deltaTime ;
    }
    if (this.ctx.keyCode === this.ctx.RIGHT_ARROW) {
        this.angle += PLAYER_ROT_SPEED*this.ctx.deltaTime ;
      }
    }
    this.angle %= Math.PI * 2;

  }
  checkWall(x: number,y: number){
     return !this.map.getValue(x,y) 
  }
  checkWallCollision(dx: number,dy: number){
    if(this.checkWall(Math.floor(this.x+dx),Math.floor(this.y))){
        this.x += dx
    }
    if(this.checkWall(Math.floor(this.x),Math.floor(this.y+dy))){
          this.y += dy 
    }
}
  draw(){
    this.ctx.fill(255,255,255)
    this.ctx.stroke(255,255,255)
    this.ctx.line(this.x*scale,
        this.y*scale,
        this.x*scale+RES.width*Math.cos(this.angle),
        this.y*scale+RES.heigth*Math.sin(this.angle) )
    // TODO
         this.ctx.circle(this.x*scale,this.y*scale,scale/2)
  }
  update() {
    this.movement();
  }
  pos() {
    return { x: this.x, y: this.y };
  }
  map_pos() {
    return { x: Math.floor(this.x), y: Math.floor(this.y) };
  }
}


export default Player;