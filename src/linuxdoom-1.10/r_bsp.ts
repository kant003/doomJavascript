// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Original BSP visibility, wall clipping and sector sprite collection.
import { view,R_PointOnSide,R_PointToAngle } from './r_main';
import { ANG90,ANG180,ANGLETOFINESHIFT } from './tables.h';
import { NF_SUBSECTOR } from './doomdata.h';
import { BOXLEFT,BOXRIGHT,BOXTOP,BOXBOTTOM } from './m_bbox.h';
import { mapstate } from './r_state.h';
import { R_FindPlane,planes } from './r_plane';
import { sky } from './r_sky';
import { R_AddSprites } from './r_things';
import { wall,R_StoreWallRange } from './r_segs';
import type { seg_t,sector_t,drawseg_t } from './r_defs.h';
export interface cliprange_t {first:number;last:number}
export const bsp = {curline:null as seg_t|null,frontsector:null as sector_t|null,backsector:null as sector_t|null,
    drawsegs:[] as drawseg_t[],solidsegs:[] as cliprange_t[]};
export function R_ClearDrawSegs():void{bsp.drawsegs.length=0;}
export function R_ClearClipSegs():void{bsp.solidsegs=[{first:-0x7fffffff,last:-1},{first:view.viewwidth,last:0x7fffffff}];}
// Store is injectable for independent visibility tests; normal rendering uses R_StoreWallRange.
export function R_ClipPassWallSegment(first:number,last:number,store:(start:number,stop:number)=>void=R_StoreWallRange):void{
    let i=0;while(bsp.solidsegs[i].last<first-1)i++;
    if(first<bsp.solidsegs[i].first){
        if(last<bsp.solidsegs[i].first-1){store(first,last);return;}
        store(first,bsp.solidsegs[i].first-1);
    }
    if(last<=bsp.solidsegs[i].last)return;
    while(last>=bsp.solidsegs[i+1].first-1){
        store(bsp.solidsegs[i].last+1,bsp.solidsegs[i+1].first-1);i++;
        if(last<=bsp.solidsegs[i].last)return;
    }store(bsp.solidsegs[i].last+1,last);
}
export function R_ClipSolidWallSegment(first:number,last:number,store:(start:number,stop:number)=>void=R_StoreWallRange):void{
    let i=0;while(bsp.solidsegs[i].last<first-1)i++;
    const start=bsp.solidsegs[i];
    if(first<start.first){
        if(last<start.first-1){store(first,last);bsp.solidsegs.splice(i,0,{first,last});return;}
        store(first,start.first-1);start.first=first;
    }
    if(last<=start.last)return;
    let next=i;
    while(last>=bsp.solidsegs[next+1].first-1){
        store(bsp.solidsegs[next].last+1,bsp.solidsegs[next+1].first-1);next++;
        if(last<=bsp.solidsegs[next].last){start.last=bsp.solidsegs[next].last;bsp.solidsegs.splice(i+1,next-i);return;}
    }
    store(bsp.solidsegs[next].last+1,last);start.last=last;bsp.solidsegs.splice(i+1,next-i);
}
export function R_AddLine(line:seg_t):void{
    bsp.curline=line;
    let angle1=R_PointToAngle(line.v1.x,line.v1.y),angle2=R_PointToAngle(line.v2.x,line.v2.y);
    const span=(angle1-angle2)>>>0;if(span>=ANG180)return;
    wall.rw_angle1=angle1;angle1=(angle1-view.viewangle)>>>0;angle2=(angle2-view.viewangle)>>>0;
    let tspan=(angle1+view.clipangle)>>>0;
    if(tspan>2*view.clipangle){tspan=(tspan-2*view.clipangle)>>>0;if(tspan>=span)return;angle1=view.clipangle;}
    tspan=(view.clipangle-angle2)>>>0;
    if(tspan>2*view.clipangle){tspan=(tspan-2*view.clipangle)>>>0;if(tspan>=span)return;angle2=(-view.clipangle)>>>0;}
    const x1=view.viewangletox[((angle1+ANG90)>>>0)>>>ANGLETOFINESHIFT],x2=view.viewangletox[((angle2+ANG90)>>>0)>>>ANGLETOFINESHIFT];
    if(x1===x2)return;
    bsp.backsector=line.backsector;const back=line.backsector,front=bsp.frontsector!;
    if(!back || back.ceilingheight<=front.floorheight || back.floorheight>=front.ceilingheight){R_ClipSolidWallSegment(x1,x2-1);return;}
    if(back.ceilingheight===front.ceilingheight && back.floorheight===front.floorheight && back.ceilingpic===front.ceilingpic && back.floorpic===front.floorpic && back.lightlevel===front.lightlevel && line.sidedef.midtexture===0)return;
    R_ClipPassWallSegment(x1,x2-1);
}
export const checkcoord=[[3,0,2,1],[3,0,2,0],[3,1,2,0],[0,0,0,0],[2,0,2,1],[0,0,0,0],[3,1,3,0],[0,0,0,0],[2,0,3,1],[2,1,3,1],[2,1,3,0]];
export function R_CheckBBox(coord:Int32Array):boolean{
    const boxx=view.viewx<=coord[BOXLEFT]?0:view.viewx<coord[BOXRIGHT]?1:2;
    const boxy=view.viewy>=coord[BOXTOP]?0:view.viewy>coord[BOXBOTTOM]?1:2;
    const boxpos=(boxy<<2)+boxx;if(boxpos===5)return true;
    const c=checkcoord[boxpos];
    let angle1=(R_PointToAngle(coord[c[0]],coord[c[1]])-view.viewangle)>>>0;
    let angle2=(R_PointToAngle(coord[c[2]],coord[c[3]])-view.viewangle)>>>0;
    const span=(angle1-angle2)>>>0;if(span>=ANG180)return true;
    let tspan=(angle1+view.clipangle)>>>0;
    if(tspan>2*view.clipangle){tspan=(tspan-2*view.clipangle)>>>0;if(tspan>=span)return false;angle1=view.clipangle;}
    tspan=(view.clipangle-angle2)>>>0;
    if(tspan>2*view.clipangle){tspan=(tspan-2*view.clipangle)>>>0;if(tspan>=span)return false;angle2=(-view.clipangle)>>>0;}
    const x1=view.viewangletox[((angle1+ANG90)>>>0)>>>ANGLETOFINESHIFT],x2=view.viewangletox[((angle2+ANG90)>>>0)>>>ANGLETOFINESHIFT]-1;
    if(x1>x2)return false;
    let i=0;while(bsp.solidsegs[i].last<x2)i++;
    return !(x1>=bsp.solidsegs[i].first && x2<=bsp.solidsegs[i].last);
}
export function R_Subsector(num:number):void{
    const sub=mapstate.subsectors[num];if(!sub?.sector)throw new Error('Invalid BSP subsector sector');
    view.sscount++;const sector=bsp.frontsector=sub.sector;
    planes.floorplane=sector.floorheight<view.viewz?R_FindPlane(sector.floorheight,sector.floorpic,sector.lightlevel):null;
    planes.ceilingplane=sector.ceilingheight>view.viewz || sector.ceilingpic===sky.skyflatnum?R_FindPlane(sector.ceilingheight,sector.ceilingpic,sector.lightlevel):null;
    R_AddSprites(sector);
    for(let i=0;i<sub.numlines;i++)R_AddLine(mapstate.segs[sub.firstline+i]);
}
export function R_RenderBSPNode(bspnum:number):void{
    // Explicit stack retains front-before-back order without depending on JS recursion depth.
    const stack:{num:number;check:Int32Array|null}[]=[{num:bspnum,check:null}];
    let budget=mapstate.numnodes*2+mapstate.numsubsectors*2+1;
    while(stack.length){
        if(--budget<0)throw new Error('BSP traversal exceeds validated tree');
        const task=stack.pop()!;if(task.check && !R_CheckBBox(task.check))continue;
        if(task.num & NF_SUBSECTOR){R_Subsector(task.num===-1?0:task.num&~NF_SUBSECTOR);continue;}
        const node=mapstate.nodes[task.num];if(!node)throw new Error('Invalid render BSP node');
        const side=R_PointOnSide(view.viewx,view.viewy,node);
        stack.push({num:node.children[side^1],check:node.bbox[side^1]},{num:node.children[side],check:null});
    }
}
