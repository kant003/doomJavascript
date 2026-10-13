// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import type { thinker_t } from './d_think.h';
import type { mobj_t } from './p_mobj.h';
export const SIL_NONE = 0, SIL_BOTTOM = 1, SIL_TOP = 2, SIL_BOTH = 3, MAXDRAWSEGS = 256;
export interface vertex_t { x: number; y: number }
export interface degenmobj_t { thinker: thinker_t; x: number; y: number; z: number }
export interface sector_t {
    floorheight: number; ceilingheight: number; floorpic: number; ceilingpic: number;
    lightlevel: number; special: number; tag: number; soundtraversed: number; soundtarget: mobj_t | null;
    blockbox: Int32Array; soundorg: degenmobj_t; validcount: number; thinglist: mobj_t | null;
    specialdata: unknown; linecount: number; lines: line_t[];
}
export interface side_t { textureoffset: number; rowoffset: number; toptexture: number; bottomtexture: number; midtexture: number; sector: sector_t }
export enum slopetype_t { ST_HORIZONTAL, ST_VERTICAL, ST_POSITIVE, ST_NEGATIVE }
export interface line_t {
    v1: vertex_t; v2: vertex_t; dx: number; dy: number; flags: number; special: number; tag: number;
    sidenum: [number, number]; bbox: Int32Array; slopetype: slopetype_t;
    frontsector: sector_t | null; backsector: sector_t | null; validcount: number; specialdata: unknown;
}
export interface subsector_t { sector: sector_t | null; numlines: number; firstline: number }
export interface seg_t { v1: vertex_t; v2: vertex_t; offset: number; angle: number; sidedef: side_t; linedef: line_t; frontsector: sector_t; backsector: sector_t | null }
export interface node_t { x: number; y: number; dx: number; dy: number; bbox: [Int32Array, Int32Array]; children: [number, number] }
export interface post_t { topdelta: number; length: number }
export type column_t = post_t;
export type lighttable_t = number;
// Pointer spans retain an explicit base for the original [x1] addressing convention.
export interface ClipSpan { data: Int16Array; base: number }
export interface drawseg_t {
    curline: seg_t; x1: number; x2: number; scale1: number; scale2: number; scalestep: number;
    silhouette: number; bsilheight: number; tsilheight: number;
    sprtopclip: ClipSpan | null; sprbottomclip: ClipSpan | null; maskedtexturecol: ClipSpan | null;
}
export interface patch_t { width: number; height: number; leftoffset: number; topoffset: number; columnofs: Uint32Array }
export interface vissprite_t {
    prev: vissprite_t | null; next: vissprite_t | null; x1: number; x2: number;
    gx: number; gy: number; gz: number; gzt: number; startfrac: number; scale: number; xiscale: number;
    texturemid: number; patch: number; colormap: Uint8Array | null; mobjflags: number;
}
export interface spriteframe_t { rotate: boolean; lump: Int16Array; flip: Uint8Array }
export interface spritedef_t { numframes: number; spriteframes: spriteframe_t[] }
// The original pads permit [-1] and [SCREENWIDTH] access; reserve two extra bytes.
// top/bottom are the whole padded array, with logical x addressed as x + 1.
export interface visplane_t { height: number; picnum: number; lightlevel: number; minx: number; maxx: number; top: Uint8Array; bottom: Uint8Array }
