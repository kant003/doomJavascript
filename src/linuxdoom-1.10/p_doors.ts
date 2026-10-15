// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { vldoor_e as DT,result_e as RES,VDOORSPEED,VDOORWAIT,type vldoor_t } from './p_spec.h';
import { T_MovePlane } from './p_floor';
import { P_AddSpecialThinker,P_SpecialForThinker,P_SectorSound,P_FindSectorFromLineTag,P_FindLowestCeilingSurrounding } from './p_spec';
import { P_RemoveThinker } from './p_tick';
import { mapstate as m } from './r_state.h';
import type { line_t,sector_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
import { card_t as CARD } from './doomdef.h';
import { FRACUNIT as F } from './m_fixed.h';
import { sfxenum_t as SFX } from './sounds.h';
import * as TEXT from './d_englsh.h';
function createDoor(sec:sector_t):vldoor_t {
 const door:vldoor_t={thinker:{prev:null,next:null,function:null},sector:sec,type:DT.normal,topheight:0,speed:0,direction:0,topwait:0,topcountdown:0};P_AddSpecialThinker(door,T_VerticalDoor);sec.specialdata=door;return door;
}
function remove(door:vldoor_t):void {door.sector.specialdata=null;P_RemoveThinker(door.thinker);}
export function T_VerticalDoor(argument:unknown):void {
 const d=P_SpecialForThinker<vldoor_t>(argument);let res:RES;
 switch(d.direction){case 0:d.topcountdown=(d.topcountdown-1)|0;if(!d.topcountdown){switch(d.type){case DT.blazeRaise:d.direction=-1;P_SectorSound(d.sector.soundorg,SFX.sfx_bdcls);break;
  case DT.normal:d.direction=-1;P_SectorSound(d.sector.soundorg,SFX.sfx_dorcls);break;case DT.close30ThenOpen:d.direction=1;P_SectorSound(d.sector.soundorg,SFX.sfx_doropn);break;}}break;
 case 2:d.topcountdown=(d.topcountdown-1)|0;if(!d.topcountdown&&d.type===DT.raiseIn5Mins){d.direction=1;d.type=DT.normal;P_SectorSound(d.sector.soundorg,SFX.sfx_doropn);}break;
 case -1:res=T_MovePlane(d.sector,d.speed,d.sector.floorheight,false,1,-1);
  if(res===RES.pastdest){switch(d.type){case DT.blazeRaise:case DT.blazeClose:remove(d);P_SectorSound(d.sector.soundorg,SFX.sfx_bdcls);break;
   case DT.normal:case DT.close:remove(d);break;case DT.close30ThenOpen:d.direction=0;d.topcountdown=35*30;break;}}
  else if(res===RES.crushed&&d.type!==DT.blazeClose&&d.type!==DT.close){d.direction=1;P_SectorSound(d.sector.soundorg,SFX.sfx_doropn);}break;
 case 1:res=T_MovePlane(d.sector,d.speed,d.topheight,false,1,1);if(res===RES.pastdest){switch(d.type){case DT.blazeRaise:case DT.normal:d.direction=0;d.topcountdown=d.topwait;break;
  case DT.close30ThenOpen:case DT.blazeOpen:case DT.open:remove(d);break;}}break;
 }
}
function locked(line:line_t,thing:mobj_t,manual:boolean):boolean {
 const p=thing.player;let card:CARD,skull:CARD,message:string;
 const blue=manual?[26,32]:[99,133],yellow=manual?[27,34]:[136,137],red=manual?[28,33]:[134,135];
 if(blue.includes(line.special)){card=CARD.it_bluecard;skull=CARD.it_blueskull;message=manual?TEXT.PD_BLUEK:TEXT.PD_BLUEO;}
 else if(yellow.includes(line.special)){card=CARD.it_yellowcard;skull=CARD.it_yellowskull;message=manual?TEXT.PD_YELLOWK:TEXT.PD_YELLOWO;}
 else if(red.includes(line.special)){card=CARD.it_redcard;skull=CARD.it_redskull;message=manual?TEXT.PD_REDK:TEXT.PD_REDO;}else return false;
 if(!p)return true;if(p.cards[card]||p.cards[skull])return false;p.message=message;P_SectorSound(null,SFX.sfx_oof);return true;
}
export function EV_DoLockedDoor(line:line_t,type:DT,thing:mobj_t):number {if(!thing.player||locked(line,thing,false))return 0;return EV_DoDoor(line,type);}
export function EV_DoDoor(line:Pick<line_t,'tag'>,type:DT):number {
 let secnum=-1,rtn=0;while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){const sec=m.sectors[secnum];if(sec.specialdata)continue;rtn=1;
  const d=createDoor(sec);d.type=type;d.topwait=VDOORWAIT;d.speed=VDOORSPEED;
  switch(type){case DT.blazeClose:d.speed*=4;
   case DT.close:d.topheight=(P_FindLowestCeilingSurrounding(sec)-4*F)|0;d.direction=-1;P_SectorSound(sec.soundorg,type===DT.blazeClose?SFX.sfx_bdcls:SFX.sfx_dorcls);break;
   case DT.close30ThenOpen:d.topheight=sec.ceilingheight;d.direction=-1;P_SectorSound(sec.soundorg,SFX.sfx_dorcls);break;
   case DT.blazeRaise:case DT.blazeOpen:d.speed*=4;
   case DT.normal:case DT.open:d.direction=1;d.topheight=(P_FindLowestCeilingSurrounding(sec)-4*F)|0;
    if(d.topheight!==sec.ceilingheight)P_SectorSound(sec.soundorg,type===DT.blazeRaise||type===DT.blazeOpen?SFX.sfx_bdopn:SFX.sfx_doropn);break;
  }
 }return rtn;
}
export function EV_VerticalDoor(line:line_t,thing:mobj_t):void {
 if(locked(line,thing,true))return;const sec=m.sides[line.sidenum[1]]?.sector;if(!sec)throw new Error('EV_VerticalDoor: missing back side');
 if(sec.specialdata&&[1,26,27,28,117].includes(line.special)){
  const d=sec.specialdata as vldoor_t;if(d.direction===-1)d.direction=1;else {if(!thing.player)return;d.direction=-1;}return;
 }
 P_SectorSound(sec.soundorg,line.special===117||line.special===118?SFX.sfx_bdopn:SFX.sfx_doropn);
 const d=createDoor(sec);d.direction=1;d.speed=VDOORSPEED;d.topwait=VDOORWAIT;
 switch(line.special){case 1:case 26:case 27:case 28:d.type=DT.normal;break;case 31:case 32:case 33:case 34:d.type=DT.open;line.special=0;break;
  case 117:d.type=DT.blazeRaise;d.speed*=4;break;case 118:d.type=DT.blazeOpen;line.special=0;d.speed*=4;break;}
 d.topheight=(P_FindLowestCeilingSurrounding(sec)-4*F)|0;
}
export function P_SpawnDoorCloseIn30(sec:sector_t):void {const d=createDoor(sec);sec.special=0;d.direction=0;d.type=DT.normal;d.speed=VDOORSPEED;d.topcountdown=30*35;}
export function P_SpawnDoorRaiseIn5Mins(sec:sector_t,_secnum:number):void {const d=createDoor(sec);sec.special=0;d.direction=2;d.type=DT.raiseIn5Mins;d.speed=VDOORSPEED;d.topheight=(P_FindLowestCeilingSurrounding(sec)-4*F)|0;d.topwait=VDOORWAIT;d.topcountdown=5*60*35;}
