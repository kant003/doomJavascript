// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// p_setup.c: map readers and P_GroupLines. Gameplay setup/spawning remains pending.
import { W_CacheLumpNum, lumpinfo } from './w_wad';
import { R_FlatNumForName, R_TextureNumForName, texturestate } from './r_data';
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import { FixedDiv } from './m_fixed';
import { BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT } from './m_bbox.h';
import { M_ClearBox, M_AddToBox } from './m_bbox';
import { ML_TWOSIDED, NF_SUBSECTOR, ML_BLOCKMAP, ML_VERTEXES, ML_SECTORS, ML_SIDEDEFS, ML_LINEDEFS, ML_SSECTORS, ML_NODES, ML_SEGS, ML_REJECT, ML_THINGS } from './doomdata.h';
import type { mapthing_t } from './doomdata.h';
import { GameMode_t } from './doomdef.h';
import { slopetype_t } from './r_defs.h';
import type { sector_t, side_t, line_t, node_t, seg_t } from './r_defs.h';
import { mapstate as s } from './r_state.h';
export const MAX_DEATHMATCH_STARTS = 10;
const MAPBLOCKSHIFT = FRACBITS + 7, MAXRADIUS = 32 * FRACUNIT;
function records(lump: number, size: number): { data: Uint8Array; view: DataView; count: number } {
    const data = W_CacheLumpNum(lump, 1);
    if (data.length % size) throw new Error(`${lumpinfo[lump].name}: invalid record size`);
    return { data, view: new DataView(data.buffer, data.byteOffset, data.byteLength), count: data.length / size };
}
function name(data: Uint8Array, p: number): string { return new TextDecoder('ascii').decode(data.subarray(p, p + 8)).split('\0')[0]; }
function at<T>(array: readonly T[], index: number, kind: string): T {
    if (!Number.isInteger(index) || index < 0 || index >= array.length) throw new Error(`${kind}: index ${index} outside ${array.length} records`);
    return array[index];
}
export function P_LoadVertexes(lump: number): void {
    const { view: v, count } = records(lump, 4);
    s.vertexes = Array.from({ length: count }, (_, i) => ({ x: v.getInt16(i * 4, true) << FRACBITS, y: v.getInt16(i * 4 + 2, true) << FRACBITS }));
    s.numvertexes = count;
}
export function P_LoadSectors(lump: number): void {
    const { data, view: v, count } = records(lump, 26);
    s.sectors = Array.from({ length: count }, (_, i): sector_t => {
        const p = i * 26, floorpic = R_FlatNumForName(name(data, p + 4)), ceilingpic = R_FlatNumForName(name(data, p + 12));
        if (floorpic < 0 || floorpic >= texturestate.numflats || ceilingpic < 0 || ceilingpic >= texturestate.numflats) throw new Error('Sector flat outside F_START/F_END');
        return { floorheight: v.getInt16(p, true) << FRACBITS, ceilingheight: v.getInt16(p + 2, true) << FRACBITS,
            floorpic, ceilingpic, lightlevel: v.getInt16(p + 20, true), special: v.getInt16(p + 22, true), tag: v.getInt16(p + 24, true),
            soundtraversed: 0, soundtarget: null, blockbox: new Int32Array(4),
            soundorg: { thinker: { prev: null, next: null, function: null }, x: 0, y: 0, z: 0 },
            validcount: 0, thinglist: null, specialdata: null, linecount: 0, lines: [] };
    }); s.numsectors = count;
}
export function P_LoadSideDefs(lump: number): void {
    const { data, view: v, count } = records(lump, 30);
    s.sides = Array.from({ length: count }, (_, i): side_t => {
        const p = i * 30;
        return { textureoffset: v.getInt16(p, true) << FRACBITS, rowoffset: v.getInt16(p + 2, true) << FRACBITS,
            toptexture: R_TextureNumForName(name(data, p + 4)), bottomtexture: R_TextureNumForName(name(data, p + 12)),
            midtexture: R_TextureNumForName(name(data, p + 20)), sector: at(s.sectors, v.getInt16(p + 28, true), 'SIDEDEFS sector') };
    }); s.numsides = count;
}
export function P_LoadLineDefs(lump: number): void {
    const { view: v, count } = records(lump, 14);
    s.lines = Array.from({ length: count }, (_, i): line_t => {
        const p = i * 14, v1 = at(s.vertexes, v.getInt16(p, true), 'LINEDEFS vertex'), v2 = at(s.vertexes, v.getInt16(p + 2, true), 'LINEDEFS vertex');
        const dx = (v2.x - v1.x) | 0, dy = (v2.y - v1.y) | 0;
        const bbox = new Int32Array(4); bbox[BOXLEFT] = Math.min(v1.x, v2.x); bbox[BOXRIGHT] = Math.max(v1.x, v2.x);
        bbox[BOXBOTTOM] = Math.min(v1.y, v2.y); bbox[BOXTOP] = Math.max(v1.y, v2.y);
        const sidenum: [number, number] = [v.getInt16(p + 10, true), v.getInt16(p + 12, true)];
        return { v1, v2, dx, dy, bbox, flags: v.getInt16(p + 4, true), special: v.getInt16(p + 6, true), tag: v.getInt16(p + 8, true), sidenum,
            slopetype: !dx ? slopetype_t.ST_VERTICAL : !dy ? slopetype_t.ST_HORIZONTAL : FixedDiv(dy, dx) > 0 ? slopetype_t.ST_POSITIVE : slopetype_t.ST_NEGATIVE,
            frontsector: sidenum[0] === -1 ? null : at(s.sides, sidenum[0], 'LINEDEFS side').sector,
            backsector: sidenum[1] === -1 ? null : at(s.sides, sidenum[1], 'LINEDEFS side').sector, validcount: 0, specialdata: null };
    }); s.numlines = count;
}
export function P_LoadSubsectors(lump: number): void {
    const { view: v, count } = records(lump, 4);
    s.subsectors = Array.from({ length: count }, (_, i) => ({ sector: null, numlines: v.getInt16(i * 4, true), firstline: v.getInt16(i * 4 + 2, true) }));
    s.numsubsectors = count;
}
export function P_LoadNodes(lump: number): void {
    const { view: v, count } = records(lump, 28);
    s.nodes = Array.from({ length: count }, (_, i): node_t => {
        const p = i * 28;
        return { x: v.getInt16(p, true) << FRACBITS, y: v.getInt16(p + 2, true) << FRACBITS,
            dx: v.getInt16(p + 4, true) << FRACBITS, dy: v.getInt16(p + 6, true) << FRACBITS,
            bbox: [Int32Array.from({ length: 4 }, (_, k) => v.getInt16(p + 8 + k * 2, true) << FRACBITS), Int32Array.from({ length: 4 }, (_, k) => v.getInt16(p + 16 + k * 2, true) << FRACBITS)],
            children: [v.getUint16(p + 24, true), v.getUint16(p + 26, true)] };
    }); s.numnodes = count;
}
export function P_LoadSegs(lump: number): void {
    const { view: v, count } = records(lump, 12);
    s.segs = Array.from({ length: count }, (_, i): seg_t => {
        const p = i * 12, linedef = at(s.lines, v.getInt16(p + 6, true), 'SEGS linedef'), side = v.getInt16(p + 8, true);
        if (side !== 0 && side !== 1) throw new Error('SEGS side must be 0 or 1');
        const sidedef = at(s.sides, linedef.sidenum[side], 'SEGS sidedef');
        return { v1: at(s.vertexes, v.getInt16(p, true), 'SEGS vertex'), v2: at(s.vertexes, v.getInt16(p + 2, true), 'SEGS vertex'),
            angle: (v.getInt16(p + 4, true) << 16) >>> 0, offset: v.getInt16(p + 10, true) << 16,
            linedef, sidedef, frontsector: sidedef.sector,
            backsector: linedef.flags & ML_TWOSIDED ? at(s.sides, linedef.sidenum[side ^ 1], 'SEGS back side').sector : null };
    }); s.numsegs = count;
}
export function P_LoadBlockMap(lump: number): void {
    const { view: v, count } = records(lump, 2);
    if (count < 4) throw new Error('Truncated BLOCKMAP header');
    const blockmaplump = Int16Array.from({ length: count }, (_, i) => v.getInt16(i * 2, true));
    const width = blockmaplump[2], height = blockmaplump[3];
    if (width <= 0 || height <= 0 || 4 + width * height > count) throw new Error('Invalid BLOCKMAP dimensions');
    s.blockmaplump = blockmaplump; s.blockmap = blockmaplump.subarray(4);
    s.bmaporgx = blockmaplump[0] << FRACBITS; s.bmaporgy = blockmaplump[1] << FRACBITS;
    s.bmapwidth = width; s.bmapheight = height; s.blocklinks = Array(width * height).fill(null);
}
export function P_GroupLines(): void {
    for (const ss of s.subsectors) {
        if (ss.numlines <= 0 || ss.firstline < 0 || ss.firstline + ss.numlines > s.segs.length) throw new Error('SSECTORS segment range outside SEGS');
        ss.sector = s.segs[ss.firstline].sidedef.sector;
    }
    for (const sector of s.sectors) { sector.linecount = 0; sector.lines = []; }
    for (const line of s.lines) {
        if (!line.frontsector) throw new Error('LINEDEFS has no front sector');
        line.frontsector.linecount++;
        if (line.backsector && line.backsector !== line.frontsector) line.backsector.linecount++;
    }
    for (const sector of s.sectors) {
        const bbox = new Int32Array(4); M_ClearBox(bbox);
        for (const line of s.lines) if (line.frontsector === sector || line.backsector === sector) {
            sector.lines.push(line); M_AddToBox(bbox, line.v1.x, line.v1.y); M_AddToBox(bbox, line.v2.x, line.v2.y);
        }
        if (sector.lines.length !== sector.linecount) throw new Error('P_GroupLines: miscounted');
        sector.soundorg.x = Math.trunc(((bbox[BOXRIGHT] + bbox[BOXLEFT]) | 0) / 2);
        sector.soundorg.y = Math.trunc(((bbox[BOXTOP] + bbox[BOXBOTTOM]) | 0) / 2);
        let block = ((bbox[BOXTOP] - s.bmaporgy + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
        sector.blockbox[BOXTOP] = block >= s.bmapheight ? s.bmapheight - 1 : block;
        block = ((bbox[BOXBOTTOM] - s.bmaporgy - MAXRADIUS) | 0) >> MAPBLOCKSHIFT; sector.blockbox[BOXBOTTOM] = block < 0 ? 0 : block;
        block = ((bbox[BOXRIGHT] - s.bmaporgx + MAXRADIUS) | 0) >> MAPBLOCKSHIFT; sector.blockbox[BOXRIGHT] = block >= s.bmapwidth ? s.bmapwidth - 1 : block;
        block = ((bbox[BOXLEFT] - s.bmaporgx - MAXRADIUS) | 0) >> MAPBLOCKSHIFT; sector.blockbox[BOXLEFT] = block < 0 ? 0 : block;
    }
}
function readThings(lump: number): mapthing_t[] {
    const { view: v, count } = records(lump, 10);
    return Array.from({ length: count }, (_, i) => ({ x: v.getInt16(i * 10, true), y: v.getInt16(i * 10 + 2, true), angle: v.getInt16(i * 10 + 4, true), type: v.getInt16(i * 10 + 6, true), options: v.getInt16(i * 10 + 8, true) }));
}
export function P_LoadThings(lump: number, gamemode: GameMode_t, spawnMapThing: (thing: mapthing_t) => void): void {
    s.things = readThings(lump);
    for (const thing of s.things) {
        // Original uses break, not continue, at the first DOOM II monster in a DOOM I map.
        if (gamemode !== GameMode_t.commercial && [68,64,88,89,69,67,71,65,66,84].includes(thing.type)) break;
        spawnMapThing(thing);
    }
}
function validateBSP(): void {
    if (!s.numsubsectors || (!s.numnodes && s.numsubsectors !== 1)) throw new Error('Map requires subsectors and a BSP for multiple leaves');
    // Check every node, including disconnected records. An iterative DFS avoids JS stack limits.
    const color = new Uint8Array(s.numnodes);
    for (let root = 0; root < s.numnodes; root++) {
        const stack: [number, boolean][] = [[root, false]];
        while (stack.length) {
            const [index, leaving] = stack.pop()!;
            if (leaving) { color[index] = 2; continue; }
            if (color[index] === 2) continue;
            if (color[index] === 1) throw new Error('Cyclic BSP node graph');
            color[index] = 1; stack.push([index, true]);
            for (const child of s.nodes[index].children) {
                if (child & NF_SUBSECTOR) { at(s.subsectors, child & ~NF_SUBSECTOR, 'NODES subsector'); }
                else { at(s.nodes, child, 'NODES child'); stack.push([child, false]); }
            }
        }
    }
}
function validateBlockMap(): void {
    const offsets = new Set(s.blockmap.subarray(0, s.bmapwidth * s.bmapheight));
    for (const offset of offsets) {
        if (offset < 4 + s.bmapwidth * s.bmapheight || offset >= s.blockmaplump.length) throw new Error('BLOCKMAP list offset outside data');
        let p = offset + 1; // The original skips the leading dummy 0 in each list.
        while (p < s.blockmaplump.length && s.blockmaplump[p] !== -1) { at(s.lines, s.blockmaplump[p++], 'BLOCKMAP linedef'); }
        if (p >= s.blockmaplump.length) throw new Error('BLOCKMAP list is missing its terminator');
    }
}
// Browser boundary: load only map geometry/resources, without claiming P_SetupLevel gameplay.
// Preserve the important P_SetupLevel load order. Fail atomically on malformed maps.
export function P_LoadMapData(lumpnum: number): typeof s {
    const previous = { ...s };
    const required: [number, string][] = [[ML_THINGS,'THINGS'],[ML_LINEDEFS,'LINEDEFS'],[ML_SIDEDEFS,'SIDEDEFS'],[ML_VERTEXES,'VERTEXES'],[ML_SEGS,'SEGS'],[ML_SSECTORS,'SSECTORS'],[ML_NODES,'NODES'],[ML_SECTORS,'SECTORS'],[ML_REJECT,'REJECT'],[ML_BLOCKMAP,'BLOCKMAP']];
    for (const [offset, expected] of required) if (lumpinfo[lumpnum + offset]?.name !== expected) throw new Error(`Map missing ${expected} in classic lump order`);
    try {
        P_LoadBlockMap(lumpnum + ML_BLOCKMAP); P_LoadVertexes(lumpnum + ML_VERTEXES); P_LoadSectors(lumpnum + ML_SECTORS);
        P_LoadSideDefs(lumpnum + ML_SIDEDEFS); P_LoadLineDefs(lumpnum + ML_LINEDEFS); P_LoadSubsectors(lumpnum + ML_SSECTORS);
        P_LoadNodes(lumpnum + ML_NODES); P_LoadSegs(lumpnum + ML_SEGS);
        s.rejectmatrix = W_CacheLumpNum(lumpnum + ML_REJECT, 50).slice();
        if (s.rejectmatrix.length < Math.ceil(s.numsectors * s.numsectors / 8)) throw new Error('REJECT matrix is truncated');
        validateBSP(); validateBlockMap(); P_GroupLines(); s.things = readThings(lumpnum + ML_THINGS);
        return s;
    } catch (error) { Object.assign(s, previous); throw error; }
}
