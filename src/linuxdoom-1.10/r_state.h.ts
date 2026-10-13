// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Shared renderer globals grouped into mutable objects to retain single ownership in ES modules.
import type { vertex_t, seg_t, sector_t, subsector_t, node_t, line_t, side_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
import type { mapthing_t } from './doomdata.h';
export const mapstate = {
    numvertexes: 0, vertexes: [] as vertex_t[], numsegs: 0, segs: [] as seg_t[], numsectors: 0, sectors: [] as sector_t[],
    numsubsectors: 0, subsectors: [] as subsector_t[], numnodes: 0, nodes: [] as node_t[],
    numlines: 0, lines: [] as line_t[], numsides: 0, sides: [] as side_t[],
    bmapwidth: 0, bmapheight: 0, blockmap: new Int16Array(0), blockmaplump: new Int16Array(0),
    bmaporgx: 0, bmaporgy: 0, blocklinks: [] as (mobj_t | null)[], rejectmatrix: new Uint8Array(0), things: [] as mapthing_t[],
};

export { texturestate } from './r_data';
export { spritesState } from './r_things';
export { view } from './r_main';
export { planes } from './r_plane';
export { wall } from './r_segs';
