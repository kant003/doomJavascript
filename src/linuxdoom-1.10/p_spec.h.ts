// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Sector effects; unused sliding-door declarations remain excluded.
export enum vldoor_e {normal,close30ThenOpen,close,open,raiseIn5Mins,blazeRaise,blazeOpen,blazeClose}
export enum floor_e {lowerFloor,lowerFloorToLowest,turboLower,raiseFloor,raiseFloorToNearest,raiseToTexture,lowerAndChange,raiseFloor24,raiseFloor24AndChange,raiseFloorCrush,raiseFloorTurbo,donutRaise,raiseFloor512}
import type { thinker_t } from './d_think.h';
import type { sector_t,line_t,degenmobj_t } from './r_defs.h';
import { FRACUNIT } from './m_fixed.h';
export enum plat_e {up,down,waiting,in_stasis}
export enum plattype_e {perpetualRaise,downWaitUpStay,raiseAndChange,raiseToNearestAndChange,blazeDWUS}
export enum ceiling_e {lowerToFloor,raiseToHighest,lowerAndCrush,crushAndRaise,fastCrushAndRaise,silentCrushAndRaise}
export enum stair_e {build8,turbo16}
export enum result_e {ok,crushed,pastdest}
export interface floormove_t {thinker:thinker_t;type:floor_e;crush:boolean;sector:sector_t;direction:number;newspecial:number;texture:number;floordestheight:number;speed:number}
export interface ceiling_t {thinker:thinker_t;type:ceiling_e;sector:sector_t;bottomheight:number;topheight:number;speed:number;crush:boolean;direction:number;tag:number;olddirection:number}
export interface vldoor_t {thinker:thinker_t;type:vldoor_e;sector:sector_t;topheight:number;speed:number;direction:number;topwait:number;topcountdown:number}
export interface plat_t {thinker:thinker_t;sector:sector_t;speed:number;low:number;high:number;wait:number;count:number;status:plat_e;oldstatus:plat_e;crush:boolean;tag:number;type:plattype_e}
export const PLATWAIT=3,PLATSPEED=FRACUNIT,MAXPLATS=30,VDOORSPEED=FRACUNIT*2,VDOORWAIT=150,CEILSPEED=FRACUNIT,CEILWAIT=150,MAXCEILINGS=30,FLOORSPEED=FRACUNIT;
export interface fireflicker_t {thinker:thinker_t;sector:sector_t;count:number;maxlight:number;minlight:number}
export interface lightflash_t extends fireflicker_t {maxtime:number;mintime:number}
export interface strobe_t extends fireflicker_t {darktime:number;brighttime:number}
export interface glow_t {thinker:thinker_t;sector:sector_t;minlight:number;maxlight:number;direction:number}
export const GLOWSPEED=8,STROBEBRIGHT=5,FASTDARK=15,SLOWDARK=35;
export interface switchlist_t {name1:string;name2:string;episode:number}
export enum bwhere_e {top,middle,bottom}
export interface button_t {line:line_t|null;where:bwhere_e;btexture:number;btimer:number;soundorg:degenmobj_t|null}
export const MAXSWITCHES=50,MAXBUTTONS=16,BUTTONTIME=35,MO_TELEPORTMAN=14;
