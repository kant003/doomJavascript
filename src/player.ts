import p5 from "p5";

import { RES, PLAYER_POS, PLAYER_ANGLE, PLAYER_SPEED,PLAYER_ROT_SPEED } from "./settings";

class Player {
  ctx: p5.p5InstanceExtensions;
  x: number = PLAYER_POS.x;
  y: number = PLAYER_POS.y;
  angle: number = PLAYER_ANGLE;
  constructor(ctx: p5.p5InstanceExtensions) {
    this.ctx = ctx;
  }

  movement() {
    const sin_a = Math.sin(this.angle);
    const cos_a = Math.cos(this.angle);
    const speed = PLAYER_SPEED * this.ctx.deltaTime;
    const speed_sin = speed * sin_a;
    const speed_cos = speed * cos_a;
    let dx = 0, dy = 0;
    console.log(this.ctx.keyCode)  
   // if (this.ctx.keyIsPressed === true) {
      if (this.ctx.keyIsDown(87)) {
        dx += speed_cos;
        dy += speed_sin;
        console.log('w')
    }
    if (this.ctx.keyIsDown(83)) {
        dx += -speed_cos;
        dy += -speed_sin;
        console.log('r')
    }
    if (this.ctx.keyIsDown(65)) {
        dx += speed_sin;
        dy += -speed_cos;
        console.log('y')
    }
    if (this.ctx.keyIsDown(68)) {
        dx += -speed_sin;
        dy += speed_cos;
        console.log('h')
      }
   // }
    this.x += dx;
    this.y += dy;

    if (this.ctx.keyIsPressed === true) {
      if (this.ctx.keyCode === this.ctx.LEFT_ARROW) {
        this.angle -= PLAYER_ROT_SPEED*this.ctx.deltaTime ;
    }
    if (this.ctx.keyCode === this.ctx.RIGHT_ARROW) {
        this.angle += PLAYER_ROT_SPEED*this.ctx.deltaTime ;
      }
    }
    //console.log(this.angle)
    this.angle %= Math.PI * 2;
    //console.log(this.x, this.y, this.angle)

  }
  draw(){
    this.ctx.fill(255,255,255)
    this.ctx.stroke(255,255,255)
    this.ctx.line(this.x*100,
        this.y*100,
        this.x*100+RES.width*Math.cos(this.angle),
        this.y*100+RES.heigth*Math.sin(this.angle) )
    // TODO
         this.ctx.circle(this.x*100,this.y*100,15)
         this.ctx.circle(this.x,this.y,40)
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