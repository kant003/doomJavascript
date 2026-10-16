// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Getter functions replace pointers to mutable gameplay fields.
export const BG=4,FG=0;
export interface st_number_t {x:number;y:number;width:number;oldnum:number;num:()=>number;on:()=>boolean;p:Uint8Array[];data:number}
export interface st_percent_t {n:st_number_t;p:Uint8Array}
export interface st_multicon_t {x:number;y:number;oldinum:number;inum:()=>number;on:()=>boolean;p:Uint8Array[];data:number}
export interface st_binicon_t {x:number;y:number;oldval:boolean;val:()=>boolean;on:()=>boolean;p:Uint8Array;data:number}
export type {STlib_init,STlib_initNum,STlib_updateNum,STlib_initPercent,STlib_updatePercent,STlib_initMultIcon,STlib_updateMultIcon,STlib_initBinIcon,STlib_updateBinIcon} from './st_lib';
