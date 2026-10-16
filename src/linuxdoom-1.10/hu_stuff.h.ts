// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { KEY_ENTER,TICRATE } from './doomdef.h';
export const HU_FONTSTART=33,HU_FONTEND=95,HU_FONTSIZE=HU_FONTEND-HU_FONTSTART+1,HU_BROADCAST=5;
export const HU_MSGREFRESH=KEY_ENTER,HU_MSGX=0,HU_MSGY=0,HU_MSGWIDTH=64,HU_MSGHEIGHT=1,HU_MSGTIMEOUT=4*TICRATE;
export type { HU_Init,HU_Start,HU_Responder,HU_Ticker,HU_Drawer,HU_dequeueChatChar,HU_Erase } from './hu_stuff';
