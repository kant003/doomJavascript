// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial header: spatial utilities and thinkers; other gameplay declarations pending.
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import type { line_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
export const MAPBLOCKUNITS = 128, MAPBLOCKSIZE = MAPBLOCKUNITS * FRACUNIT;
export const MAPBLOCKSHIFT = FRACBITS + 7, MAPBMASK = MAPBLOCKSIZE - 1, MAPBTOFRAC = MAPBLOCKSHIFT - FRACBITS;
export const MAXRADIUS = 32 * FRACUNIT, MAXINTERCEPTS = 128;
export const FLOATSPEED = 4 * FRACUNIT, VIEWHEIGHT = 41 * FRACUNIT;
export const GRAVITY = FRACUNIT, MAXMOVE = 30 * FRACUNIT, MELEERANGE = 64 * FRACUNIT;
export const MISSILERANGE = 32 * 64 * FRACUNIT;
export const USERANGE = 64 * FRACUNIT;
export const MAXHEALTH = 100, BASETHRESHOLD = 100;
export const ONFLOORZ = -0x80000000, ONCEILINGZ = 0x7fffffff, ITEMQUESIZE = 128;
export const PT_ADDLINES = 1, PT_ADDTHINGS = 2, PT_EARLYOUT = 4;
export interface divline_t { x: number; y: number; dx: number; dy: number }
export type intercept_t = { frac: number; isaline: true; d: { line: line_t } } | { frac: number; isaline: false; d: { thing: mobj_t } };
export type traverser_t = (intercept: intercept_t) => boolean;
export { P_InitThinkers, P_AddThinker, P_RemoveThinker, P_RunThinkers, P_AllocateThinker, thinkercap, leveltime } from './p_tick';
export * from './p_maputl';
