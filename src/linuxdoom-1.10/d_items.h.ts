// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import type { ammotype_t } from './doomdef.h';
export interface weaponinfo_t { ammo: ammotype_t; upstate: number; downstate: number; readystate: number; atkstate: number; flashstate: number }
export { weaponinfo } from './d_items';
