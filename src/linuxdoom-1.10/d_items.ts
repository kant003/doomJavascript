// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Literal conversion of d_items.c.
import { ammotype_t } from "./doomdef.h";
import { statenum_t } from "./info.h";
import type { weaponinfo_t } from "./d_items.h";
export const weaponinfo: weaponinfo_t[] = [
    { ammo: ammotype_t.am_noammo, upstate: statenum_t.S_PUNCHUP, downstate: statenum_t.S_PUNCHDOWN, readystate: statenum_t.S_PUNCH, atkstate: statenum_t.S_PUNCH1, flashstate: statenum_t.S_NULL },
    { ammo: ammotype_t.am_clip, upstate: statenum_t.S_PISTOLUP, downstate: statenum_t.S_PISTOLDOWN, readystate: statenum_t.S_PISTOL, atkstate: statenum_t.S_PISTOL1, flashstate: statenum_t.S_PISTOLFLASH },
    { ammo: ammotype_t.am_shell, upstate: statenum_t.S_SGUNUP, downstate: statenum_t.S_SGUNDOWN, readystate: statenum_t.S_SGUN, atkstate: statenum_t.S_SGUN1, flashstate: statenum_t.S_SGUNFLASH1 },
    { ammo: ammotype_t.am_clip, upstate: statenum_t.S_CHAINUP, downstate: statenum_t.S_CHAINDOWN, readystate: statenum_t.S_CHAIN, atkstate: statenum_t.S_CHAIN1, flashstate: statenum_t.S_CHAINFLASH1 },
    { ammo: ammotype_t.am_misl, upstate: statenum_t.S_MISSILEUP, downstate: statenum_t.S_MISSILEDOWN, readystate: statenum_t.S_MISSILE, atkstate: statenum_t.S_MISSILE1, flashstate: statenum_t.S_MISSILEFLASH1 },
    { ammo: ammotype_t.am_cell, upstate: statenum_t.S_PLASMAUP, downstate: statenum_t.S_PLASMADOWN, readystate: statenum_t.S_PLASMA, atkstate: statenum_t.S_PLASMA1, flashstate: statenum_t.S_PLASMAFLASH1 },
    { ammo: ammotype_t.am_cell, upstate: statenum_t.S_BFGUP, downstate: statenum_t.S_BFGDOWN, readystate: statenum_t.S_BFG, atkstate: statenum_t.S_BFG1, flashstate: statenum_t.S_BFGFLASH1 },
    { ammo: ammotype_t.am_noammo, upstate: statenum_t.S_SAWUP, downstate: statenum_t.S_SAWDOWN, readystate: statenum_t.S_SAW, atkstate: statenum_t.S_SAW1, flashstate: statenum_t.S_NULL },
    { ammo: ammotype_t.am_shell, upstate: statenum_t.S_DSGUNUP, downstate: statenum_t.S_DSGUNDOWN, readystate: statenum_t.S_DSGUN, atkstate: statenum_t.S_DSGUN1, flashstate: statenum_t.S_DSGUNFLASH1 },
];
