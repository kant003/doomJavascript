// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export enum stateenum_t { NoState=-1, StatCount, ShowNextLoc }
// Function signatures only: runtime entry points live in wi_stuff.ts.
export type { WI_Start,WI_Ticker,WI_Drawer } from './wi_stuff';
