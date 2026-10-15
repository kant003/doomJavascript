// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { P_Random } from './m_random';
import { mapstate as m } from './r_state.h';
import type { sector_t,line_t } from './r_defs.h';
import { P_AddSpecialThinker,P_SpecialForThinker,P_FindMinSurroundingLight,P_FindSectorFromLineTag,getNextSector } from './p_spec';
import { GLOWSPEED,STROBEBRIGHT,SLOWDARK,type fireflicker_t,type lightflash_t,type strobe_t,type glow_t } from './p_spec.h';

export function T_FireFlicker(argument:unknown):void {
    const flick=P_SpecialForThinker<fireflicker_t>(argument);
    if(--flick.count)return;
    const amount=(P_Random()&3)*16;
    flick.sector.lightlevel=flick.sector.lightlevel-amount<flick.minlight?flick.minlight:flick.maxlight-amount;
    flick.count=4;
}
export function P_SpawnFireFlicker(sector:sector_t):void {
    sector.special=0;
    P_AddSpecialThinker<fireflicker_t>({thinker:{prev:null,next:null,function:null},sector,maxlight:sector.lightlevel,
        minlight:P_FindMinSurroundingLight(sector,sector.lightlevel)+16,count:4},T_FireFlicker);
}
export function T_LightFlash(argument:unknown):void {
    const flash=P_SpecialForThinker<lightflash_t>(argument);
    if(--flash.count)return;
    if(flash.sector.lightlevel===flash.maxlight){flash.sector.lightlevel=flash.minlight;flash.count=(P_Random()&flash.mintime)+1;}
    else {flash.sector.lightlevel=flash.maxlight;flash.count=(P_Random()&flash.maxtime)+1;}
}
export function P_SpawnLightFlash(sector:sector_t):void {
    sector.special=0;
    P_AddSpecialThinker<lightflash_t>({thinker:{prev:null,next:null,function:null},sector,maxlight:sector.lightlevel,
        minlight:P_FindMinSurroundingLight(sector,sector.lightlevel),maxtime:64,mintime:7,count:(P_Random()&64)+1},T_LightFlash);
}
export function T_StrobeFlash(argument:unknown):void {
    const flash=P_SpecialForThinker<strobe_t>(argument);
    if(--flash.count)return;
    if(flash.sector.lightlevel===flash.minlight){flash.sector.lightlevel=flash.maxlight;flash.count=flash.brighttime;}
    else {flash.sector.lightlevel=flash.minlight;flash.count=flash.darktime;}
}
export function P_SpawnStrobeFlash(sector:sector_t,fastOrSlow:number,inSync:number):void {
    const maxlight=sector.lightlevel;
    let minlight=P_FindMinSurroundingLight(sector,maxlight);
    if(minlight===maxlight)minlight=0;
    sector.special=0;
    P_AddSpecialThinker<strobe_t>({thinker:{prev:null,next:null,function:null},sector,darktime:fastOrSlow,brighttime:STROBEBRIGHT,
        maxlight,minlight,count:inSync?1:(P_Random()&7)+1},T_StrobeFlash);
}
export function EV_StartLightStrobing(line:Pick<line_t,'tag'>):void {
    let secnum=-1;
    while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){const sec=m.sectors[secnum];if(!sec.specialdata)P_SpawnStrobeFlash(sec,SLOWDARK,0);}
}
export function EV_TurnTagLightsOff(line:Pick<line_t,'tag'>):void {
    for(const sector of m.sectors)if(sector.tag===line.tag)sector.lightlevel=P_FindMinSurroundingLight(sector,sector.lightlevel);
}
export function EV_LightTurnOn(line:Pick<line_t,'tag'>,bright:number):void {
    for(const sector of m.sectors)if(sector.tag===line.tag){
        // C reuses bright across tagged sectors, including a value found in the first sector.
        if(!bright)for(const l of sector.lines){const other=getNextSector(l,sector);if(other&&other.lightlevel>bright)bright=other.lightlevel;}
        sector.lightlevel=bright;
    }
}
export function T_Glow(argument:unknown):void {
    const g=P_SpecialForThinker<glow_t>(argument);
    if(g.direction===-1){g.sector.lightlevel-=GLOWSPEED;if(g.sector.lightlevel<=g.minlight){g.sector.lightlevel+=GLOWSPEED;g.direction=1;}}
    else if(g.direction===1){g.sector.lightlevel+=GLOWSPEED;if(g.sector.lightlevel>=g.maxlight){g.sector.lightlevel-=GLOWSPEED;g.direction=-1;}}
}
export function P_SpawnGlowingLight(sector:sector_t):void {
    P_AddSpecialThinker<glow_t>({thinker:{prev:null,next:null,function:null},sector,
        minlight:P_FindMinSurroundingLight(sector,sector.lightlevel),maxlight:sector.lightlevel,direction:-1},T_Glow);
    sector.special=0;
}
