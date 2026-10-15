// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { ceiling_e as CT,result_e as RES,CEILSPEED,MAXCEILINGS,type ceiling_t } from './p_spec.h';
import { T_MovePlane } from './p_floor';
import { P_AddSpecialThinker,P_SpecialForThinker,P_SectorSound,P_FindSectorFromLineTag,P_FindHighestCeilingSurrounding } from './p_spec';
import { P_RemoveThinker,leveltime } from './p_tick';
import { mapstate as m } from './r_state.h';
import type { line_t } from './r_defs.h';
import { FRACUNIT as F } from './m_fixed.h';
import { sfxenum_t as SFX } from './sounds.h';
export const activeceilings:(ceiling_t|null)[]=Array(MAXCEILINGS).fill(null);
export function T_MoveCeiling(argument:unknown):void {
 const c=P_SpecialForThinker<ceiling_t>(argument);if(!c.direction)return;
 const res=T_MovePlane(c.sector,c.speed,c.direction===1?c.topheight:c.bottomheight,c.direction===1?false:c.crush,1,c.direction);
 if(!(leveltime&7)&&c.type!==CT.silentCrushAndRaise)P_SectorSound(c.sector.soundorg,SFX.sfx_stnmov);
 if(c.direction===1){if(res===RES.pastdest){if(c.type===CT.raiseToHighest)P_RemoveActiveCeiling(c);
   else if(c.type===CT.silentCrushAndRaise||c.type===CT.fastCrushAndRaise||c.type===CT.crushAndRaise){if(c.type===CT.silentCrushAndRaise)P_SectorSound(c.sector.soundorg,SFX.sfx_pstop);c.direction=-1;}}}
 else if(res===RES.pastdest){switch(c.type){case CT.silentCrushAndRaise:P_SectorSound(c.sector.soundorg,SFX.sfx_pstop);
   case CT.crushAndRaise:c.speed=CEILSPEED;
   case CT.fastCrushAndRaise:c.direction=1;break;
   case CT.lowerAndCrush:case CT.lowerToFloor:P_RemoveActiveCeiling(c);break;}}
 else if(res===RES.crushed&&(c.type===CT.silentCrushAndRaise||c.type===CT.crushAndRaise||c.type===CT.lowerAndCrush))c.speed=CEILSPEED/8;
}
export function EV_DoCeiling(line:Pick<line_t,'tag'>,type:CT):number {
 if(type===CT.fastCrushAndRaise||type===CT.silentCrushAndRaise||type===CT.crushAndRaise)P_ActivateInStasisCeiling(line);
 let rtn=0,secnum=-1;while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){const sec=m.sectors[secnum];if(sec.specialdata)continue;rtn=1;
  const c:ceiling_t={thinker:{prev:null,next:null,function:null},sector:sec,type,crush:false,topheight:0,bottomheight:0,speed:0,direction:0,tag:sec.tag,olddirection:0};
  P_AddSpecialThinker(c,T_MoveCeiling);sec.specialdata=c;
  switch(type){case CT.fastCrushAndRaise:c.crush=true;c.topheight=sec.ceilingheight;c.bottomheight=(sec.floorheight+8*F)|0;c.direction=-1;c.speed=CEILSPEED*2;break;
   case CT.silentCrushAndRaise:case CT.crushAndRaise:c.crush=true;c.topheight=sec.ceilingheight;
   case CT.lowerAndCrush:case CT.lowerToFloor:c.bottomheight=(sec.floorheight+(type!==CT.lowerToFloor?8*F:0))|0;c.direction=-1;c.speed=CEILSPEED;break;
   case CT.raiseToHighest:c.topheight=P_FindHighestCeilingSurrounding(sec);c.direction=1;c.speed=CEILSPEED;break;}
  P_AddActiveCeiling(c);
 }return rtn;
}
export function P_AddActiveCeiling(c:ceiling_t):void {const i=activeceilings.indexOf(null);if(i>=0)activeceilings[i]=c;}
export function P_RemoveActiveCeiling(c:ceiling_t):void {const i=activeceilings.indexOf(c);if(i>=0){c.sector.specialdata=null;P_RemoveThinker(c.thinker);activeceilings[i]=null;}}
export function P_ActivateInStasisCeiling(line:Pick<line_t,'tag'>):void {for(const c of activeceilings)if(c&&c.tag===line.tag&&!c.direction){c.direction=c.olddirection;c.thinker.function=T_MoveCeiling;}}
export function EV_CeilingCrushStop(line:Pick<line_t,'tag'>):number {let rtn=0;for(const c of activeceilings)if(c&&c.tag===line.tag&&c.direction){c.olddirection=c.direction;c.thinker.function=null;c.direction=0;rtn=1;}return rtn;}
