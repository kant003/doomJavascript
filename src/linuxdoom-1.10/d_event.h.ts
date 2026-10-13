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
export enum evtype_t { 
    ev_keydown,
    ev_keyup,
    ev_mouse,
    ev_joystick
 }
export enum gameaction_t { 
    ga_nothing,
    ga_loadlevel,
    ga_newgame,
    ga_loadgame,
    ga_savegame,
    ga_playdemo,
    ga_completed,
    ga_victory,
    ga_worlddone,
    ga_screenshot
 }
export enum buttoncode_t { 
    
    BT_ATTACK		= 1,
    
    BT_USE		= 2,

    
    BT_SPECIAL		= 128,
    BT_SPECIALMASK	= 3,
    
    
    
    BT_CHANGE		= 4,
    
    BT_WEAPONMASK	= (8+16+32),
    BT_WEAPONSHIFT	= 3,

    
    BTS_PAUSE		= 1,
    
    BTS_SAVEGAME	= 2,

    
    
    BTS_SAVEMASK	= (4+8+16),
    BTS_SAVESHIFT 	= 2,
  
 }
export const MAXEVENTS = 64;

export interface event_t { type: evtype_t; data1: number; data2: number; data3: number }
