// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { plat_e as ST,plattype_e as PT,result_e as RES,PLATSPEED,PLATWAIT,MAXPLATS,type plat_t } from './p_spec.h';
import { T_MovePlane } from './p_floor';
import { P_AddSpecialThinker,P_SpecialForThinker,P_SectorSound,P_FindSectorFromLineTag,P_FindNextHighestFloor,P_FindLowestFloorSurrounding,P_FindHighestFloorSurrounding } from './p_spec';
import { P_RemoveThinker,leveltime } from './p_tick';
import { P_Random } from './m_random';
import { mapstate as m } from './r_state.h';
import type { line_t } from './r_defs.h';
import { FRACUNIT as F } from './m_fixed.h';
import { sfxenum_t as SFX } from './sounds.h';
export const activeplats:(plat_t|null)[]=Array(MAXPLATS).fill(null);
export function T_PlatRaise(argument:unknown):void {
 const p=P_SpecialForThinker<plat_t>(argument);let res:RES;
 switch(p.status){case ST.up:res=T_MovePlane(p.sector,p.speed,p.high,p.crush,0,1);
  if((p.type===PT.raiseAndChange||p.type===PT.raiseToNearestAndChange)&&!(leveltime&7))P_SectorSound(p.sector.soundorg,SFX.sfx_stnmov);
  if(res===RES.crushed&&!p.crush){p.count=p.wait;p.status=ST.down;P_SectorSound(p.sector.soundorg,SFX.sfx_pstart);}
  else if(res===RES.pastdest){p.count=p.wait;p.status=ST.waiting;P_SectorSound(p.sector.soundorg,SFX.sfx_pstop);if(p.type!==PT.perpetualRaise)P_RemoveActivePlat(p);}break;
 case ST.down:res=T_MovePlane(p.sector,p.speed,p.low,false,0,-1);if(res===RES.pastdest){p.count=p.wait;p.status=ST.waiting;P_SectorSound(p.sector.soundorg,SFX.sfx_pstop);}break;
 case ST.waiting:p.count=(p.count-1)|0;if(!p.count){p.status=p.sector.floorheight===p.low?ST.up:ST.down;P_SectorSound(p.sector.soundorg,SFX.sfx_pstart);}break;
 case ST.in_stasis:break;}
}
export function EV_DoPlat(line:Pick<line_t,'tag'>,type:PT,amount:number):number {
 if(type===PT.perpetualRaise)P_ActivateInStasis(line.tag);let secnum=-1,rtn=0;
 while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){const sec=m.sectors[secnum];if(sec.specialdata)continue;rtn=1;
  const p:plat_t={thinker:{prev:null,next:null,function:null},sector:sec,type,crush:false,tag:line.tag,speed:0,low:0,high:0,wait:0,count:0,status:ST.up,oldstatus:ST.up};
  P_AddSpecialThinker(p,T_PlatRaise);sec.specialdata=p;
  switch(type){case PT.raiseToNearestAndChange:case PT.raiseAndChange:
   p.speed=PLATSPEED/2;sec.floorpic=m.sides[(line as line_t).sidenum[0]].sector.floorpic;
   p.high=type===PT.raiseToNearestAndChange?P_FindNextHighestFloor(sec,sec.floorheight):(sec.floorheight+Math.imul(amount,F))|0;
   p.wait=0;p.status=ST.up;if(type===PT.raiseToNearestAndChange)sec.special=0;P_SectorSound(sec.soundorg,SFX.sfx_stnmov);break;
  case PT.downWaitUpStay:case PT.blazeDWUS:
   p.speed=PLATSPEED*(type===PT.blazeDWUS?8:4);p.low=Math.min(P_FindLowestFloorSurrounding(sec),sec.floorheight);p.high=sec.floorheight;p.wait=35*PLATWAIT;p.status=ST.down;P_SectorSound(sec.soundorg,SFX.sfx_pstart);break;
  case PT.perpetualRaise:p.speed=PLATSPEED;p.low=Math.min(P_FindLowestFloorSurrounding(sec),sec.floorheight);p.high=Math.max(P_FindHighestFloorSurrounding(sec),sec.floorheight);
   p.wait=35*PLATWAIT;p.status=P_Random()&1;P_SectorSound(sec.soundorg,SFX.sfx_pstart);break;}
  P_AddActivePlat(p);
 }return rtn;
}
export function P_ActivateInStasis(tag:number):void {for(const p of activeplats)if(p&&p.tag===tag&&p.status===ST.in_stasis){p.status=p.oldstatus;p.thinker.function=T_PlatRaise;}}
export function EV_StopPlat(line:Pick<line_t,'tag'>):void {for(const p of activeplats)if(p&&p.tag===line.tag&&p.status!==ST.in_stasis){p.oldstatus=p.status;p.status=ST.in_stasis;p.thinker.function=null;}}
export function P_AddActivePlat(p:plat_t):void {const i=activeplats.indexOf(null);if(i<0)throw new Error('P_AddActivePlat: no more plats!');activeplats[i]=p;}
export function P_RemoveActivePlat(p:plat_t):void {const i=activeplats.indexOf(p);if(i<0)throw new Error("P_RemoveActivePlat: can't find plat!");p.sector.specialdata=null;P_RemoveThinker(p.thinker);activeplats[i]=null;}
