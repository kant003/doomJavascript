// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { KEY_BACKSPACE } from './doomdef.h';
export const BG=1,FG=0,HU_CHARERASE=KEY_BACKSPACE,HU_MAXLINES=4,HU_MAXLINELENGTH=80;
export interface hu_textline_t {x:number;y:number;f:Uint8Array[]|null;sc:number;l:Uint8Array;len:number;needsupdate:number}
export interface hu_stext_t {l:hu_textline_t[];h:number;cl:number;on:()=>boolean;laston:boolean}
export interface hu_itext_t {l:hu_textline_t;lm:number;on:()=>boolean;laston:boolean}
export type { HUlib_init,HUlib_clearTextLine,HUlib_initTextLine,HUlib_addCharToTextLine,HUlib_delCharFromTextLine,HUlib_drawTextLine,HUlib_eraseTextLine,HUlib_initSText,HUlib_addLineToSText,HUlib_addMessageToSText,HUlib_drawSText,HUlib_eraseSText,HUlib_initIText,HUlib_delCharFromIText,HUlib_eraseLineFromIText,HUlib_resetIText,HUlib_addPrefixToIText,HUlib_keyInIText,HUlib_drawIText,HUlib_eraseIText } from './hu_lib';
