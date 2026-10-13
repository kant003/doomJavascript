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
//
//
//-----------------------------------------------------------------------------


// TypeScript conversion. See PORTING.md for platform adaptations.
export enum playerstate_t { 
    
    PST_LIVE,
    
    PST_DEAD,
    
    PST_REBORN		

 }
export enum cheat_t { 
    
    CF_NOCLIP		= 1,
    
    CF_GODMODE		= 2,
    
    CF_NOMOMENTUM	= 4

 }
import type { mobj_t } from './p_mobj.h';
import type { ticcmd_t } from './d_ticcmd.h';
import type { weapontype_t } from './doomdef.h';
import type { pspdef_t } from './p_pspr.h';
export interface player_t {
    mo: mobj_t | null; playerstate: playerstate_t; cmd: ticcmd_t;
    viewz: number; viewheight: number; deltaviewheight: number; bob: number;
    health: number; armorpoints: number; armortype: number;
    powers: Int32Array; cards: boolean[]; backpack: boolean; frags: Int32Array;
    readyweapon: weapontype_t; pendingweapon: weapontype_t; weaponowned: boolean[];
    ammo: Int32Array; maxammo: Int32Array; attackdown: number; usedown: number;
    cheats: number; refire: number; killcount: number; itemcount: number; secretcount: number;
    message: string | null; damagecount: number; bonuscount: number; attacker: mobj_t | null;
    extralight: number; fixedcolormap: number; colormap: number; psprites: pspdef_t[]; didsecret: boolean;
}
export interface wbplayerstruct_t { in: boolean; skills: number; sitems: number; ssecret: number; stime: number; frags: Int32Array; score: number }
export interface wbstartstruct_t { epsd: number; didsecret: boolean; last: number; next: number; maxkills: number; maxitems: number; maxsecret: number; maxfrags: number; partime: number; pnum: number; plyr: wbplayerstruct_t[] }
