// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial port: shared sector queries and dependencies for sector thinkers.
import { mapstate as m } from './r_state.h';
import type { line_t,sector_t,side_t,degenmobj_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
import type { thinker_t } from './d_think.h';
import { P_AddThinker } from './p_tick';
import { ML_TWOSIDED } from './doomdata.h';
import { FRACUNIT as F } from './m_fixed.h';
import type { sfxenum_t } from './sounds.h';
export interface sector_context_t {S_StartSound(origin:mobj_t|degenmobj_t|null,sound:sfxenum_t):void}
let context:sector_context_t|null=null;
export function P_InitSectorContext(game:sector_context_t):void {context=game;}
export function P_SectorSound(origin:mobj_t|degenmobj_t|null,sound:sfxenum_t):void {if(!context)throw new Error('Sector sound is not linked');context.S_StartSound(origin,sound);}
const owners=new WeakMap<thinker_t,{thinker:thinker_t}>();
export function P_AddSpecialThinker<T extends {thinker:thinker_t}>(effect:T,action:(argument:unknown)=>void):T {owners.set(effect.thinker,effect);P_AddThinker(effect.thinker);effect.thinker.function=action;return effect;}
export function P_SpecialForThinker<T extends {thinker:thinker_t}>(argument:unknown):T {
    const effect=owners.get(argument as thinker_t)??(argument&&typeof argument==='object'&&'thinker' in argument?argument as T:null);
    if(!effect)throw new Error('Special thinker has no owner');return effect as T;
}
export function getSide(sector:number,line:number,side:number):side_t {return m.sides[m.sectors[sector].lines[line].sidenum[side]];}
export function getSector(sector:number,line:number,side:number):sector_t {return getSide(sector,line,side).sector;}
export function twoSided(sector:number,line:number):number {return m.sectors[sector].lines[line].flags&ML_TWOSIDED;}
export function getNextSector(line:line_t,sec:sector_t):sector_t|null {if(!(line.flags&ML_TWOSIDED))return null;return line.frontsector===sec?line.backsector:line.frontsector;}
export function P_FindLowestFloorSurrounding(sec:sector_t):number {let height=sec.floorheight;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.min(height,other.floorheight);}return height;}
export function P_FindHighestFloorSurrounding(sec:sector_t):number {let height=-500*F;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.max(height,other.floorheight);}return height;}
export function P_FindNextHighestFloor(sec:sector_t,currentheight:number):number {
    const heights:number[]=[];for(const l of sec.lines){const other=getNextSector(l,sec);if(other&&other.floorheight>currentheight)heights.push(other.floorheight);if(heights.length>=20)break;}
    return heights.length?Math.min(...heights):currentheight;
}
export function P_FindLowestCeilingSurrounding(sec:sector_t):number {let height=0x7fffffff;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.min(height,other.ceilingheight);}return height;}
export function P_FindHighestCeilingSurrounding(sec:sector_t):number {let height=0;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.max(height,other.ceilingheight);}return height;}
export function P_FindSectorFromLineTag(line:Pick<line_t,'tag'>,start:number):number {for(let i=start+1;i<m.numsectors;i++)if(m.sectors[i].tag===line.tag)return i;return -1;}
export function P_FindMinSurroundingLight(sec:sector_t,max:number):number {let min=max;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)min=Math.min(min,other.lightlevel);}return min;}
