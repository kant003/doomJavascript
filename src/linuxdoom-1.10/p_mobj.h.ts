// Emacs style mode select   -*- C++ -*- 
//-----------------------------------------------------------------------------
//
// $Id:$
//
// Copyright (C) 1993-1996 by id Software, Inc.
//
// This source is available for distribution and/or modification
// only under the terms of the DOOM Source Code License as
// published by id Software. All rights reserved.
//
// The source is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// FITNESS FOR A PARTICULAR PURPOSE. See the DOOM Source Code License
// for more details.
//
// DESCRIPTION:
//	Map Objects, MObj, definition and handling.
//
//-----------------------------------------------------------------------------


// TypeScript conversion. See PORTING.md for platform adaptations.
export enum mobjflag_t { 
    
    MF_SPECIAL		= 1,
    
    MF_SOLID		= 2,
    
    MF_SHOOTABLE	= 4,
    
    MF_NOSECTOR		= 8,
    
    MF_NOBLOCKMAP	= 16,                    

    
    MF_AMBUSH		= 32,
    
    MF_JUSTHIT		= 64,
    
    MF_JUSTATTACKED	= 128,
    
    
    MF_SPAWNCEILING	= 256,
    
    
    
    MF_NOGRAVITY	= 512,

    
    
    MF_DROPOFF		= 0x400,
    
    MF_PICKUP		= 0x800,
    
    MF_NOCLIP		= 0x1000,
    
    MF_SLIDE		= 0x2000,
    
    
    MF_FLOAT		= 0x4000,
    
    
    MF_TELEPORT		= 0x8000,
    
    
    MF_MISSILE		= 0x10000,	
    
    
    MF_DROPPED		= 0x20000,
    
    
    MF_SHADOW		= 0x40000,
    
    
    MF_NOBLOOD		= 0x80000,
    
    
    MF_CORPSE		= 0x100000,
    
    
    MF_INFLOAT		= 0x200000,

    
    
    
    MF_COUNTKILL	= 0x400000,
    
    
    
    MF_COUNTITEM	= 0x800000,

    
    
    MF_SKULLFLY		= 0x1000000,

    
    
    MF_NOTDMATCH    	= 0x2000000,

    
    
    
    
    MF_TRANSLATION  	= 0xc000000,
    
    MF_TRANSSHIFT	= 26

 }
import type { thinker_t } from './d_think.h';
import type { subsector_t } from './r_defs.h';
import type { player_t } from './d_player.h';
import type { state_t, mobjinfo_t, mobjtype_t, spritenum_t } from './info.h';
import type { mapthing_t } from './doomdata.h';
export interface mobj_t {
    thinker: thinker_t; x: number; y: number; z: number;
    snext: mobj_t | null; sprev: mobj_t | null; angle: number; sprite: spritenum_t; frame: number;
    bnext: mobj_t | null; bprev: mobj_t | null; subsector: subsector_t | null;
    floorz: number; ceilingz: number; radius: number; height: number;
    momx: number; momy: number; momz: number; validcount: number;
    type: mobjtype_t; info: mobjinfo_t | null; tics: number; state: state_t | null;
    flags: number; health: number; movedir: number; movecount: number; target: mobj_t | null;
    reactiontime: number; threshold: number; player: player_t | null; lastlook: number;
    spawnpoint: mapthing_t; tracer: mobj_t | null;
}
