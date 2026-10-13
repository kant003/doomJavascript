// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { FRACBITS, FRACUNIT as F } from './m_fixed.h';
import { FixedMul, FixedDiv } from './m_fixed';
import { BOXTOP as T, BOXBOTTOM as B, BOXLEFT as L, BOXRIGHT as R } from './m_bbox.h';
import { mobjflag_t as MF, type mobj_t } from './p_mobj.h';
import type { player_t } from './d_player.h';
import { slopetype_t as ST, type line_t, type sector_t } from './r_defs.h';
import { ML_BLOCKING, ML_BLOCKMONSTERS, ML_TWOSIDED } from './doomdata.h';
import { mobjtype_t as MT, statenum_t as S } from './info.h';
import { P_Random } from './m_random';
import { P_SetMobjState, P_RemoveMobj, P_SpawnMobj, P_SpawnPuff, P_SpawnBlood } from './p_mobj';
import { R_PointInSubsector, R_PointToAngle2, view } from './r_main';
import { mapstate as m } from './r_state.h';
import { sky } from './r_sky';
import { ANG180, ANGLETOFINESHIFT, finecosine, finesine } from './tables.h';
import { MAXRADIUS, MAPBLOCKSHIFT, PT_ADDLINES, PT_ADDTHINGS, USERANGE, type intercept_t } from './p_local.h';
import { P_BoxOnLineSide, P_PointOnLineSide, P_LineOpening, openings as o, P_UnsetThingPosition, P_SetThingPosition,
    P_BlockThingsIterator, P_BlockLinesIterator, P_PathTraverse, P_AproxDistance, trace } from './p_maputl';
import { P_CheckSight, sight } from './p_sight';
import { leveltime } from './p_tick';
import { sfxenum_t as SFX } from './sounds.h';

export interface map_context_t {
    gamemap:number;
    P_DamageMobj(target:mobj_t,inflictor:mobj_t|null,source:mobj_t|null,damage:number):void;
    P_TouchSpecialThing(special:mobj_t,toucher:mobj_t):void;
    P_CrossSpecialLine(line:number,side:number,thing:mobj_t):void;
    P_ShootSpecialLine(thing:mobj_t,line:line_t):void;
    P_UseSpecialLine(thing:mobj_t,line:line_t,side:number):boolean;
    S_StartSound(origin:mobj_t,sound:SFX):void;
}
let context:map_context_t|null=null;
export function P_InitMapContext(game:map_context_t):void {context=game;}
function game():map_context_t {if(!context)throw new Error('P_InitMapContext: gameplay dependencies are not linked');return context;}
export const mapclip={tmbbox:new Int32Array(4),tmthing:null as mobj_t|null,tmflags:0,tmx:0,tmy:0,floatok:false,
    tmfloorz:0,tmceilingz:0,tmdropoffz:0,ceilingline:null as line_t|null,spechit:[] as line_t[],numspechit:0,
    bestslidefrac:0,secondslidefrac:0,bestslideline:null as line_t|null,secondslideline:null as line_t|null,slidemo:null as mobj_t|null,tmxmove:0,tmymove:0,
    linetarget:null as mobj_t|null,shootthing:null as mobj_t|null,shootz:0,la_damage:0,attackrange:0,aimslope:0,usething:null as mobj_t|null,
    bombsource:null as mobj_t|null,bombspot:null as mobj_t|null,bombdamage:0,crushchange:false,nofit:false};
const c=mapclip;
function initPosition(thing:mobj_t,x:number,y:number):void {
    c.tmthing=thing;c.tmflags=thing.flags;c.tmx=x;c.tmy=y;
    c.tmbbox[T]=y+thing.radius;c.tmbbox[B]=y-thing.radius;c.tmbbox[R]=x+thing.radius;c.tmbbox[L]=x-thing.radius;
    const sec=R_PointInSubsector(x,y).sector!;c.ceilingline=null;c.tmfloorz=c.tmdropoffz=sec.floorheight;c.tmceilingz=sec.ceilingheight;
    view.validcount=(view.validcount+1)|0;c.numspechit=0;c.spechit.length=0;
}
function blocks(extra:number,things:boolean,callback:((thing:mobj_t)=>boolean)|((line:line_t)=>boolean)):boolean {
    const xl=(c.tmbbox[L]-m.bmaporgx-extra)>>MAPBLOCKSHIFT,xh=(c.tmbbox[R]-m.bmaporgx+extra)>>MAPBLOCKSHIFT;
    const yl=(c.tmbbox[B]-m.bmaporgy-extra)>>MAPBLOCKSHIFT,yh=(c.tmbbox[T]-m.bmaporgy+extra)>>MAPBLOCKSHIFT;
    for(let x=xl;x<=xh;x++)for(let y=yl;y<=yh;y++) {
        const ok=things?P_BlockThingsIterator(x,y,callback as (thing:mobj_t)=>boolean):P_BlockLinesIterator(x,y,callback as (line:line_t)=>boolean);
        if(!ok)return false;
    }return true;
}
export function PIT_StompThing(thing:mobj_t):boolean {
    if(!(thing.flags&MF.MF_SHOOTABLE))return true;
    const mover=c.tmthing!,dist=(thing.radius+mover.radius)|0;
    if(Math.abs((thing.x-c.tmx)|0)>=dist||Math.abs((thing.y-c.tmy)|0)>=dist||thing===mover)return true;
    if(!mover.player&&game().gamemap!==30)return false;
    game().P_DamageMobj(thing,mover,mover,10000);return true;
}
export function P_TeleportMove(thing:mobj_t,x:number,y:number):boolean {
    initPosition(thing,x,y);if(!blocks(MAXRADIUS,true,PIT_StompThing))return false;
    P_UnsetThingPosition(thing);thing.floorz=c.tmfloorz;thing.ceilingz=c.tmceilingz;thing.x=x;thing.y=y;P_SetThingPosition(thing);return true;
}
export function PIT_CheckLine(ld:line_t):boolean {
    if(c.tmbbox[R]<=ld.bbox[L]||c.tmbbox[L]>=ld.bbox[R]||c.tmbbox[T]<=ld.bbox[B]||c.tmbbox[B]>=ld.bbox[T])return true;
    if(P_BoxOnLineSide(c.tmbbox,ld)!==-1)return true;
    if(!ld.backsector)return false;
    if(!(c.tmthing!.flags&MF.MF_MISSILE)) {
        if(ld.flags&ML_BLOCKING)return false;
        if(!c.tmthing!.player&&(ld.flags&ML_BLOCKMONSTERS))return false;
    }
    P_LineOpening(ld);
    if(o.opentop<c.tmceilingz){c.tmceilingz=o.opentop;c.ceilingline=ld;}
    c.tmfloorz=Math.max(c.tmfloorz,o.openbottom);c.tmdropoffz=Math.min(c.tmdropoffz,o.lowfloor);
    if(ld.special){if(c.numspechit>=8)throw new Error('P_CheckPosition: MAXSPECIALCROSS exceeded');c.spechit[c.numspechit++]=ld;}
    return true;
}
export function PIT_CheckThing(thing:mobj_t):boolean {
    if(!(thing.flags&(MF.MF_SOLID|MF.MF_SPECIAL|MF.MF_SHOOTABLE)))return true;
    const mover=c.tmthing!,dist=(thing.radius+mover.radius)|0;
    if(Math.abs((thing.x-c.tmx)|0)>=dist||Math.abs((thing.y-c.tmy)|0)>=dist||thing===mover)return true;
    if(mover.flags&MF.MF_SKULLFLY) {
        game().P_DamageMobj(thing,mover,mover,(P_Random()%8+1)*mover.info!.damage);
        mover.flags&=~MF.MF_SKULLFLY;mover.momx=mover.momy=mover.momz=0;P_SetMobjState(mover,mover.info!.spawnstate);return false;
    }
    if(mover.flags&MF.MF_MISSILE) {
        if(mover.z>((thing.z+thing.height)|0)||((mover.z+mover.height)|0)<thing.z)return true;
        if(mover.target&&(mover.target.type===thing.type||(mover.target.type===MT.MT_KNIGHT&&thing.type===MT.MT_BRUISER)||(mover.target.type===MT.MT_BRUISER&&thing.type===MT.MT_KNIGHT))) {
            if(thing===mover.target)return true;if(thing.type!==MT.MT_PLAYER)return false;
        }
        if(!(thing.flags&MF.MF_SHOOTABLE))return !(thing.flags&MF.MF_SOLID);
        game().P_DamageMobj(thing,mover,mover.target,(P_Random()%8+1)*mover.info!.damage);return false;
    }
    if(thing.flags&MF.MF_SPECIAL){const solid=thing.flags&MF.MF_SOLID;if(c.tmflags&MF.MF_PICKUP)game().P_TouchSpecialThing(thing,mover);return !solid;}
    return !(thing.flags&MF.MF_SOLID);
}
export function P_CheckPosition(thing:mobj_t,x:number,y:number):boolean {
    initPosition(thing,x,y);if(c.tmflags&MF.MF_NOCLIP)return true;
    return blocks(MAXRADIUS,true,PIT_CheckThing)&&blocks(0,false,PIT_CheckLine);
}
export function P_TryMove(thing:mobj_t,x:number,y:number):boolean {
    c.floatok=false;if(!P_CheckPosition(thing,x,y))return false;
    if(!(thing.flags&MF.MF_NOCLIP)) {
        if(((c.tmceilingz-c.tmfloorz)|0)<thing.height)return false;c.floatok=true;
        if(!(thing.flags&MF.MF_TELEPORT)&&((c.tmceilingz-thing.z)|0)<thing.height)return false;
        if(!(thing.flags&MF.MF_TELEPORT)&&((c.tmfloorz-thing.z)|0)>24*F)return false;
        if(!(thing.flags&(MF.MF_DROPOFF|MF.MF_FLOAT))&&((c.tmfloorz-c.tmdropoffz)|0)>24*F)return false;
    }
    P_UnsetThingPosition(thing);const oldx=thing.x,oldy=thing.y;
    thing.floorz=c.tmfloorz;thing.ceilingz=c.tmceilingz;thing.x=x;thing.y=y;P_SetThingPosition(thing);
    if(!(thing.flags&(MF.MF_TELEPORT|MF.MF_NOCLIP)))while(c.numspechit-->0) {
        const ld=c.spechit[c.numspechit],side=P_PointOnLineSide(thing.x,thing.y,ld),oldside=P_PointOnLineSide(oldx,oldy,ld);
        if(side!==oldside&&ld.special)game().P_CrossSpecialLine(m.lines.indexOf(ld),oldside,thing);
    }return true;
}
export function P_ThingHeightClip(thing:mobj_t):boolean {
    const onfloor=thing.z===thing.floorz;P_CheckPosition(thing,thing.x,thing.y);thing.floorz=c.tmfloorz;thing.ceilingz=c.tmceilingz;
    if(onfloor)thing.z=thing.floorz;else if(((thing.z+thing.height)|0)>thing.ceilingz)thing.z=(thing.ceilingz-thing.height)|0;
    return ((thing.ceilingz-thing.floorz)|0)>=thing.height;
}
export function P_HitSlideLine(ld:line_t):void {
    if(ld.slopetype===ST.ST_HORIZONTAL){c.tmymove=0;return;}if(ld.slopetype===ST.ST_VERTICAL){c.tmxmove=0;return;}
    const side=P_PointOnLineSide(c.slidemo!.x,c.slidemo!.y,ld);
    let lineangle=R_PointToAngle2(0,0,ld.dx,ld.dy);if(side===1)lineangle=(lineangle+ANG180)>>>0;
    let delta=(R_PointToAngle2(0,0,c.tmxmove,c.tmymove)-lineangle)>>>0;if(delta>ANG180)delta=(delta+ANG180)>>>0;
    lineangle>>>=ANGLETOFINESHIFT;delta>>>=ANGLETOFINESHIFT;
    const len=FixedMul(P_AproxDistance(c.tmxmove,c.tmymove),finecosine[delta]);
    c.tmxmove=FixedMul(len,finecosine[lineangle]);c.tmymove=FixedMul(len,finesine[lineangle]);
}
export function PTR_SlideTraverse(input:intercept_t):boolean {
    if(!input.isaline)throw new Error('PTR_SlideTraverse: not a line');const li=input.d.line,mo=c.slidemo!;
    if(!(li.flags&ML_TWOSIDED)){if(P_PointOnLineSide(mo.x,mo.y,li))return true;}
    else {P_LineOpening(li);if(o.openrange>=mo.height&&((o.opentop-mo.z)|0)>=mo.height&&((o.openbottom-mo.z)|0)<=24*F)return true;}
    if(input.frac<c.bestslidefrac){c.secondslidefrac=c.bestslidefrac;c.secondslideline=c.bestslideline;c.bestslidefrac=input.frac;c.bestslideline=li;}return false;
}
export function P_SlideMove(mo:mobj_t):void {
    c.slidemo=mo;
    const stairstep=()=>{if(!P_TryMove(mo,mo.x,(mo.y+mo.momy)|0))P_TryMove(mo,(mo.x+mo.momx)|0,mo.y);};
    for(let hitcount=1;hitcount<3;hitcount++) {
        const leadx=(mo.x+(mo.momx>0?mo.radius:-mo.radius))|0,trailx=(mo.x+(mo.momx>0?-mo.radius:mo.radius))|0;
        const leady=(mo.y+(mo.momy>0?mo.radius:-mo.radius))|0,traily=(mo.y+(mo.momy>0?-mo.radius:mo.radius))|0;c.bestslidefrac=F+1;
        for(const [x,y] of [[leadx,leady],[trailx,leady],[leadx,traily]])P_PathTraverse(x,y,(x+mo.momx)|0,(y+mo.momy)|0,PT_ADDLINES,PTR_SlideTraverse);
        if(c.bestslidefrac===F+1){stairstep();return;}
        c.bestslidefrac-=0x800;
        if(c.bestslidefrac>0&&!P_TryMove(mo,(mo.x+FixedMul(mo.momx,c.bestslidefrac))|0,(mo.y+FixedMul(mo.momy,c.bestslidefrac))|0)){stairstep();return;}
        c.bestslidefrac=F-(c.bestslidefrac+0x800);if(c.bestslidefrac>F)c.bestslidefrac=F;if(c.bestslidefrac<=0)return;
        c.tmxmove=FixedMul(mo.momx,c.bestslidefrac);c.tmymove=FixedMul(mo.momy,c.bestslidefrac);P_HitSlideLine(c.bestslideline!);
        mo.momx=c.tmxmove;mo.momy=c.tmymove;if(P_TryMove(mo,(mo.x+c.tmxmove)|0,(mo.y+c.tmymove)|0))return;
    }stairstep();
}
export function PTR_AimTraverse(input:intercept_t):boolean {
    const dist=FixedMul(c.attackrange,input.frac);
    if(input.isaline) {
        const li=input.d.line;if(!(li.flags&ML_TWOSIDED))return false;P_LineOpening(li);if(o.openbottom>=o.opentop)return false;
        if(li.frontsector!.floorheight!==li.backsector!.floorheight)sight.bottomslope=Math.max(sight.bottomslope,FixedDiv((o.openbottom-c.shootz)|0,dist));
        if(li.frontsector!.ceilingheight!==li.backsector!.ceilingheight)sight.topslope=Math.min(sight.topslope,FixedDiv((o.opentop-c.shootz)|0,dist));
        return sight.topslope>sight.bottomslope;
    }
    const th=input.d.thing;if(th===c.shootthing||!(th.flags&MF.MF_SHOOTABLE))return true;
    let top=FixedDiv((th.z+th.height-c.shootz)|0,dist),bottom=FixedDiv((th.z-c.shootz)|0,dist);
    if(top<sight.bottomslope||bottom>sight.topslope)return true;
    top=Math.min(top,sight.topslope);bottom=Math.max(bottom,sight.bottomslope);c.aimslope=Math.trunc(((top+bottom)|0)/2);c.linetarget=th;return false;
}
function impact(frac:number):{x:number;y:number;z:number} {return {x:(trace.x+FixedMul(trace.dx,frac))|0,y:(trace.y+FixedMul(trace.dy,frac))|0,z:(c.shootz+FixedMul(c.aimslope,FixedMul(frac,c.attackrange)))|0};}
export function PTR_ShootTraverse(input:intercept_t):boolean {
    const dist=FixedMul(c.attackrange,input.frac);
    if(input.isaline) {
        const li=input.d.line;if(li.special)game().P_ShootSpecialLine(c.shootthing!,li);
        let blocking=!(li.flags&ML_TWOSIDED);
        if(!blocking){P_LineOpening(li);blocking=(li.frontsector!.floorheight!==li.backsector!.floorheight&&FixedDiv((o.openbottom-c.shootz)|0,dist)>c.aimslope)
            ||(li.frontsector!.ceilingheight!==li.backsector!.ceilingheight&&FixedDiv((o.opentop-c.shootz)|0,dist)<c.aimslope);}
        if(!blocking)return true;
        const p=impact((input.frac-FixedDiv(4*F,c.attackrange))|0);
        if(li.frontsector!.ceilingpic===sky.skyflatnum&&(p.z>li.frontsector!.ceilingheight||li.backsector?.ceilingpic===sky.skyflatnum))return false;
        P_SpawnPuff(p.x,p.y,p.z);return false;
    }
    const th=input.d.thing;if(th===c.shootthing||!(th.flags&MF.MF_SHOOTABLE))return true;
    if(FixedDiv((th.z+th.height-c.shootz)|0,dist)<c.aimslope||FixedDiv((th.z-c.shootz)|0,dist)>c.aimslope)return true;
    const p=impact((input.frac-FixedDiv(10*F,c.attackrange))|0);
    if(th.flags&MF.MF_NOBLOOD)P_SpawnPuff(p.x,p.y,p.z);else P_SpawnBlood(p.x,p.y,p.z,c.la_damage);
    if(c.la_damage)game().P_DamageMobj(th,c.shootthing,c.shootthing,c.la_damage);return false;
}
export function P_AimLineAttack(t1:mobj_t,angle:number,distance:number):number {
    angle>>>=ANGLETOFINESHIFT;c.shootthing=t1;c.shootz=(t1.z+(t1.height>>1)+8*F)|0;
    sight.topslope=Math.trunc(100*F/160);sight.bottomslope=Math.trunc(-100*F/160);c.attackrange=distance;c.linetarget=null;
    P_PathTraverse(t1.x,t1.y,(t1.x+Math.imul(distance>>FRACBITS,finecosine[angle]))|0,(t1.y+Math.imul(distance>>FRACBITS,finesine[angle]))|0,PT_ADDLINES|PT_ADDTHINGS,PTR_AimTraverse);
    return c.linetarget?c.aimslope:0;
}
export function P_LineAttack(t1:mobj_t,angle:number,distance:number,slope:number,damage:number):void {
    angle>>>=ANGLETOFINESHIFT;c.shootthing=t1;c.la_damage=damage;c.shootz=(t1.z+(t1.height>>1)+8*F)|0;c.attackrange=distance;c.aimslope=slope;
    P_PathTraverse(t1.x,t1.y,(t1.x+Math.imul(distance>>FRACBITS,finecosine[angle]))|0,(t1.y+Math.imul(distance>>FRACBITS,finesine[angle]))|0,PT_ADDLINES|PT_ADDTHINGS,PTR_ShootTraverse);
}
export function PTR_UseTraverse(input:intercept_t):boolean {
    if(!input.isaline)throw new Error('PTR_UseTraverse: not a line');const line=input.d.line;
    if(!line.special){P_LineOpening(line);if(o.openrange<=0){game().S_StartSound(c.usething!,SFX.sfx_noway);return false;}return true;}
    game().P_UseSpecialLine(c.usething!,line,P_PointOnLineSide(c.usething!.x,c.usething!.y,line));return false;
}
export function P_UseLines(player:player_t):void {
    c.usething=player.mo;const mo=player.mo!,angle=mo.angle>>>ANGLETOFINESHIFT;
    P_PathTraverse(mo.x,mo.y,(mo.x+Math.imul(USERANGE>>FRACBITS,finecosine[angle]))|0,(mo.y+Math.imul(USERANGE>>FRACBITS,finesine[angle]))|0,PT_ADDLINES,PTR_UseTraverse);
}
export function PIT_RadiusAttack(thing:mobj_t):boolean {
    if(!(thing.flags&MF.MF_SHOOTABLE)||thing.type===MT.MT_CYBORG||thing.type===MT.MT_SPIDER)return true;
    const dx=Math.abs((thing.x-c.bombspot!.x)|0),dy=Math.abs((thing.y-c.bombspot!.y)|0);
    const dist=Math.max(0,(Math.max(dx,dy)-thing.radius)>>FRACBITS);if(dist>=c.bombdamage)return true;
    if(P_CheckSight(thing,c.bombspot!))game().P_DamageMobj(thing,c.bombspot,c.bombsource,c.bombdamage-dist);return true;
}
export function P_RadiusAttack(spot:mobj_t,source:mobj_t|null,damage:number):void {
    // Preserve the original fixed-point MAXRADIUS inside this integer shift, including wrapping.
    const dist=(damage+MAXRADIUS)<<FRACBITS,xl=(spot.x-dist-m.bmaporgx)>>MAPBLOCKSHIFT,xh=(spot.x+dist-m.bmaporgx)>>MAPBLOCKSHIFT;
    const yl=(spot.y-dist-m.bmaporgy)>>MAPBLOCKSHIFT,yh=(spot.y+dist-m.bmaporgy)>>MAPBLOCKSHIFT;
    c.bombspot=spot;c.bombsource=source;c.bombdamage=damage;
    for(let y=yl;y<=yh;y++)for(let x=xl;x<=xh;x++)P_BlockThingsIterator(x,y,PIT_RadiusAttack);
}
export function PIT_ChangeSector(thing:mobj_t):boolean {
    if(P_ThingHeightClip(thing))return true;
    if(thing.health<=0){P_SetMobjState(thing,S.S_GIBS);thing.flags&=~MF.MF_SOLID;thing.height=thing.radius=0;return true;}
    if(thing.flags&MF.MF_DROPPED){P_RemoveMobj(thing);return true;}
    if(!(thing.flags&MF.MF_SHOOTABLE))return true;c.nofit=true;
    if(c.crushchange&&!(leveltime&3)) {
        game().P_DamageMobj(thing,null,null,10);const mo=P_SpawnMobj(thing.x,thing.y,(thing.z+Math.trunc(thing.height/2))|0,MT.MT_BLOOD);
        mo.momx=(P_Random()-P_Random())<<12;mo.momy=(P_Random()-P_Random())<<12;
    }return true;
}
export function P_ChangeSector(sector:sector_t,crunch:boolean):boolean {
    c.nofit=false;c.crushchange=crunch;
    for(let x=sector.blockbox[L];x<=sector.blockbox[R];x++)for(let y=sector.blockbox[B];y<=sector.blockbox[T];y++)P_BlockThingsIterator(x,y,PIT_ChangeSector);
    return c.nofit;
}
