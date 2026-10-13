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
//  Sprite animation.
//
//-----------------------------------------------------------------------------


// TypeScript conversion. See PORTING.md for platform adaptations.
export const FF_FULLBRIGHT = 0x8000;
export const FF_FRAMEMASK = 0x7fff;
export enum psprnum_t { 
    ps_weapon,
    ps_flash,
    NUMPSPRITES

 }
import type { state_t } from './info.h';
export interface pspdef_t { state: state_t | null; tics: number; sx: number; sy: number }
