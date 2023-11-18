

import p5 from "p5";

import { DELTA_ANGLE, HALF_FOV, HALF_HEIGHT, MAX_DEPTH, NUM_RAYS, SCALE, SCREEN_DIST } from "./settings";
import Mapa from "./map";
import Player from "./player";


class RayCasting{
    ctx: p5.p5InstanceExtensions;
    map: Mapa;
    player: Player

    constructor(ctx: p5.p5InstanceExtensions, map:Mapa, player:Player) {
        this.ctx = ctx;
        this.map = map;
        this.player = player
    }

    horizontals(rayAngle: number, cosA: number, sinA: number){
        const {x:ox,y:oy} = this.player.pos()
        const {x:xMap, y:yMap} = this.player.map_pos()

        let yHorz = sinA >0 ? yMap+1 : yMap - 1e-6
            const dy = sinA >0 ? 1: -1

            let depthHorz = (yHorz - oy) / sinA
            let xHorz = ox + depthHorz * cosA

            const deltaDepth = dy / sinA
            const dx= deltaDepth * cosA

            for(let i=0;i<MAX_DEPTH;i++){
                const tileHorzX  = Math.floor(xHorz)
                const tileHorzY  = Math.floor(yHorz)
                if(this.map.getValue(tileHorzX, tileHorzY) ) break
                xHorz += dx
                yHorz += dy
                depthHorz += deltaDepth
            }
            return depthHorz    
    }

    verticals(rayAngle: number, cosA: number, sinA: number){
        const {x:ox,y:oy} = this.player.pos()
        const {x:xMap, y:yMap} = this.player.map_pos()


        let xVert = cosA >0 ? xMap+1 : xMap - 1e-6
        const dx = cosA >0 ? 1: -1
        let depthVert = (xVert - ox) / cosA
        let yVert = oy + depthVert * sinA
       
        
        const deltaDepth = dx / cosA
        const dy= deltaDepth * sinA

        for(let i=0;i<MAX_DEPTH;i++){
            const tileVertX  = Math.floor(xVert)
            const tileVertY  = Math.floor(yVert)
            if(this.map.getValue(tileVertX, tileVertY) ) break
            xVert += dx
            yVert += dy
            depthVert += deltaDepth
        }
        return depthVert
    }
    rayCast(){
        const {x:ox,y:oy} = this.player.pos()
       // const {x:xMap, y:yMap} = this.player.map_pos()

        let rayAngle = this.player.angle - HALF_FOV + 0.0001
        for(let ray=0;ray<NUM_RAYS;ray++){
            const sinA = Math.sin(rayAngle)
            const cosA = Math.cos(rayAngle)
            // horizontals
            const depthHorz = this.horizontals(rayAngle,cosA,sinA)
          //  this.ctx.stroke(255,0, 0)
          //  this.ctx.line(ox*100, oy*100, ox*100+100*depthHorz*cosA, oy*100+100*depthHorz*sinA)
            // verticals
           const depthVert = this.verticals(rayAngle,cosA,sinA)

          // this.ctx.stroke(0,255, 0)
          //  this.ctx.line(ox*100, oy*100, ox*100+100*depthVert*cosA, oy*100+100*depthVert*sinA)
          
            // DEPTH
            let depth = 0
            if (depthVert < depthHorz){
               depth = depthVert
            }else{
            depth = depthHorz
            }
            // DRAW debug
            this.ctx.stroke(255, 255, 0)
            this.ctx.line(ox*100, oy*100, 100*ox+100*depth*cosA, 100*oy+100*depth*sinA)
            
         
            rayAngle += DELTA_ANGLE
        }
    }
    update(){
        this.rayCast()
    }
    draw(){

    }
}

export default RayCasting