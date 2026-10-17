// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { SCREENHEIGHT,SCREENWIDTH } from './doomdef.h';
export const ST_HEIGHT=32,ST_WIDTH=SCREENWIDTH,ST_Y=SCREENHEIGHT-ST_HEIGHT;
export enum st_stateenum_t {AutomapState,FirstPersonState}
export enum st_chatstateenum_t {StartChatState,WaitDestState,GetChatState}
export type { ST_Responder,ST_Ticker,ST_Drawer,ST_Start,ST_Init } from './st_stuff';
