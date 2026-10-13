// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import { FixedMul, FixedDiv } from './m_fixed';
import { BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT } from './m_bbox.h';
import { slopetype_t, type line_t } from './r_defs.h';
import { mobjflag_t, type mobj_t } from './p_mobj.h';
import { mapstate as m } from './r_state.h';
import { R_PointInSubsector, view } from './r_main';
import { MAPBLOCKSIZE, MAPBLOCKSHIFT, MAPBTOFRAC, MAXINTERCEPTS, PT_ADDLINES, PT_ADDTHINGS, PT_EARLYOUT,
    type divline_t, type intercept_t, type traverser_t } from './p_local.h';

export function P_AproxDistance(dx: number, dy: number): number {
    dx = Math.abs(dx); dy = Math.abs(dy);
    return (dx + dy - (Math.min(dx, dy) >> 1)) | 0;
}
export function P_PointOnLineSide(x: number, y: number, line: line_t): number {
    if (!line.dx) return +(x <= line.v1.x ? line.dy > 0 : line.dy < 0);
    if (!line.dy) return +(y <= line.v1.y ? line.dx < 0 : line.dx > 0);
    const dx = (x - line.v1.x) | 0, dy = (y - line.v1.y) | 0;
    return +(FixedMul(dy, line.dx >> FRACBITS) >= FixedMul(line.dy >> FRACBITS, dx));
}
export function P_BoxOnLineSide(tmbox: ArrayLike<number>, ld: line_t): number {
    let p1: number, p2: number;
    switch (ld.slopetype) {
        case slopetype_t.ST_HORIZONTAL:
            p1 = +(tmbox[BOXTOP] > ld.v1.y); p2 = +(tmbox[BOXBOTTOM] > ld.v1.y);
            if (ld.dx < 0) { p1 ^= 1; p2 ^= 1; } break;
        case slopetype_t.ST_VERTICAL:
            p1 = +(tmbox[BOXRIGHT] < ld.v1.x); p2 = +(tmbox[BOXLEFT] < ld.v1.x);
            if (ld.dy < 0) { p1 ^= 1; p2 ^= 1; } break;
        case slopetype_t.ST_POSITIVE:
            p1 = P_PointOnLineSide(tmbox[BOXLEFT], tmbox[BOXTOP], ld);
            p2 = P_PointOnLineSide(tmbox[BOXRIGHT], tmbox[BOXBOTTOM], ld); break;
        case slopetype_t.ST_NEGATIVE:
            p1 = P_PointOnLineSide(tmbox[BOXRIGHT], tmbox[BOXTOP], ld);
            p2 = P_PointOnLineSide(tmbox[BOXLEFT], tmbox[BOXBOTTOM], ld); break;
        default: throw new Error('Invalid line slope');
    }
    return p1 === p2 ? p1 : -1;
}
export function P_PointOnDivlineSide(x: number, y: number, line: divline_t): number {
    if (!line.dx) return +(x <= line.x ? line.dy > 0 : line.dy < 0);
    if (!line.dy) return +(y <= line.y ? line.dx < 0 : line.dx > 0);
    const dx = (x - line.x) | 0, dy = (y - line.y) | 0;
    if ((line.dy ^ line.dx ^ dx ^ dy) & 0x80000000) return +!!((line.dy ^ dx) & 0x80000000);
    return +(FixedMul(dy >> 8, line.dx >> 8) >= FixedMul(line.dy >> 8, dx >> 8));
}
export function P_MakeDivline(li: line_t, dl: divline_t): void { dl.x = li.v1.x; dl.y = li.v1.y; dl.dx = li.dx; dl.dy = li.dy; }
export function P_InterceptVector(v2: divline_t, v1: divline_t): number {
    const den = (FixedMul(v1.dy >> 8, v2.dx) - FixedMul(v1.dx >> 8, v2.dy)) | 0;
    if (!den) return 0;
    const num = (FixedMul((v1.x - v2.x) >> 8, v1.dy) + FixedMul((v2.y - v1.y) >> 8, v1.dx)) | 0;
    return FixedDiv(num, den);
}
export const openings = { opentop: 0, openbottom: 0, openrange: 0, lowfloor: 0 };
export function P_LineOpening(linedef: line_t): void {
    if (linedef.sidenum[1] === -1) { openings.openrange = 0; return; }
    const front = linedef.frontsector!, back = linedef.backsector!;
    openings.opentop = Math.min(front.ceilingheight, back.ceilingheight);
    openings.openbottom = Math.max(front.floorheight, back.floorheight);
    openings.lowfloor = Math.min(front.floorheight, back.floorheight);
    openings.openrange = (openings.opentop - openings.openbottom) | 0;
}
function blockIndex(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < m.bmapwidth && y < m.bmapheight ? y * m.bmapwidth + x : -1;
}
function thingBlock(thing: mobj_t): number { return blockIndex((thing.x - m.bmaporgx) >> MAPBLOCKSHIFT, (thing.y - m.bmaporgy) >> MAPBLOCKSHIFT); }
export function P_UnsetThingPosition(thing: mobj_t): void {
    if (!(thing.flags & mobjflag_t.MF_NOSECTOR)) {
        if (thing.snext) thing.snext.sprev = thing.sprev;
        if (thing.sprev) thing.sprev.snext = thing.snext;
        else thing.subsector!.sector!.thinglist = thing.snext;
    }
    if (!(thing.flags & mobjflag_t.MF_NOBLOCKMAP)) {
        if (thing.bnext) thing.bnext.bprev = thing.bprev;
        if (thing.bprev) thing.bprev.bnext = thing.bnext;
        else { const index = thingBlock(thing); if (index >= 0) m.blocklinks[index] = thing.bnext; }
    }
    // C leaves this object's links intact; callers must unlink before changing x/y or flags.
}
export function P_SetThingPosition(thing: mobj_t): void {
    const ss = R_PointInSubsector(thing.x, thing.y); thing.subsector = ss;
    if (!(thing.flags & mobjflag_t.MF_NOSECTOR)) {
        const sec = ss.sector!; thing.sprev = null; thing.snext = sec.thinglist;
        if (sec.thinglist) sec.thinglist.sprev = thing;
        sec.thinglist = thing;
    }
    if (!(thing.flags & mobjflag_t.MF_NOBLOCKMAP)) {
        const index = thingBlock(thing); thing.bprev = null;
        thing.bnext = index < 0 ? null : m.blocklinks[index];
        if (thing.bnext) thing.bnext.bprev = thing;
        if (index >= 0) m.blocklinks[index] = thing;
    }
}
export function P_BlockLinesIterator(x: number, y: number, func: (line: line_t) => boolean): boolean {
    const index = blockIndex(x, y); if (index < 0) return true;
    // Start at the original offset, including the leading zero (line 0), as C does.
    for (let offset = m.blockmap[index]; offset < m.blockmaplump.length; offset++) {
        const number = m.blockmaplump[offset]; if (number === -1) return true;
        const ld = m.lines[number]; if (!ld) throw new Error('Invalid BLOCKMAP line');
        if (ld.validcount === view.validcount) continue;
        ld.validcount = view.validcount; if (!func(ld)) return false;
    }
    throw new Error('Unterminated BLOCKMAP list');
}
export function P_BlockThingsIterator(x: number, y: number, func: (thing: mobj_t) => boolean): boolean {
    const index = blockIndex(x, y); if (index < 0) return true;
    for (let thing = m.blocklinks[index]; thing; thing = thing.bnext) if (!func(thing)) return false;
    return true;
}
export const intercepts: intercept_t[] = [];
export const trace: divline_t = { x: 0, y: 0, dx: 0, dy: 0 };
export let earlyout = false;
// Declared but unused by the original source.
export const ptflags = 0;
function addIntercept(intercept: intercept_t): void {
    if (intercepts.length >= MAXINTERCEPTS) throw new Error('P_PathTraverse: MAXINTERCEPTS exceeded');
    intercepts.push(intercept);
}
export function PIT_AddLineIntercepts(ld: line_t): boolean {
    let s1: number, s2: number;
    if (Math.abs(trace.dx) > FRACUNIT * 16 || Math.abs(trace.dy) > FRACUNIT * 16) {
        s1 = P_PointOnDivlineSide(ld.v1.x, ld.v1.y, trace); s2 = P_PointOnDivlineSide(ld.v2.x, ld.v2.y, trace);
    } else {
        s1 = P_PointOnLineSide(trace.x, trace.y, ld); s2 = P_PointOnLineSide((trace.x + trace.dx) | 0, (trace.y + trace.dy) | 0, ld);
    }
    if (s1 === s2) return true;
    const dl: divline_t = { x: 0, y: 0, dx: 0, dy: 0 }; P_MakeDivline(ld, dl);
    const frac = P_InterceptVector(trace, dl); if (frac < 0) return true;
    if (earlyout && frac < FRACUNIT && !ld.backsector) return false;
    addIntercept({ frac, isaline: true, d: { line: ld } }); return true;
}
export function PIT_AddThingIntercepts(thing: mobj_t): boolean {
    const positive = (trace.dx ^ trace.dy) > 0;
    const x1 = (thing.x - thing.radius) | 0, x2 = (thing.x + thing.radius) | 0;
    const y1 = (thing.y + (positive ? thing.radius : -thing.radius)) | 0;
    const y2 = (thing.y + (positive ? -thing.radius : thing.radius)) | 0;
    if (P_PointOnDivlineSide(x1, y1, trace) === P_PointOnDivlineSide(x2, y2, trace)) return true;
    const frac = P_InterceptVector(trace, { x: x1, y: y1, dx: (x2 - x1) | 0, dy: (y2 - y1) | 0 });
    if (frac < 0) return true;
    addIntercept({ frac, isaline: false, d: { thing } }); return true;
}
export function P_TraverseIntercepts(func: traverser_t, maxfrac: number): boolean {
    for (let count = intercepts.length; count > 0; count--) {
        let dist = 0x7fffffff, selected: intercept_t | null = null;
        for (const scan of intercepts) if (scan.frac < dist) { dist = scan.frac; selected = scan; }
        if (dist > maxfrac) return true;
        if (!selected) throw new Error('P_TraverseIntercepts: no finite intercept');
        if (!func(selected)) return false;
        selected.frac = 0x7fffffff;
    }
    return true;
}
// Shared trace/intercept state, non-reentrant just like the original.
export function P_PathTraverse(x1: number, y1: number, x2: number, y2: number, flags: number, trav: traverser_t): boolean {
    earlyout = !!(flags & PT_EARLYOUT); view.validcount = (view.validcount + 1) | 0; intercepts.length = 0;
    if (((x1 - m.bmaporgx) & (MAPBLOCKSIZE - 1)) === 0) x1 = (x1 + FRACUNIT) | 0;
    if (((y1 - m.bmaporgy) & (MAPBLOCKSIZE - 1)) === 0) y1 = (y1 + FRACUNIT) | 0;
    trace.x = x1; trace.y = y1; trace.dx = (x2 - x1) | 0; trace.dy = (y2 - y1) | 0;
    x1 = (x1 - m.bmaporgx) | 0; y1 = (y1 - m.bmaporgy) | 0;
    x2 = (x2 - m.bmaporgx) | 0; y2 = (y2 - m.bmaporgy) | 0;
    const xt1 = x1 >> MAPBLOCKSHIFT, yt1 = y1 >> MAPBLOCKSHIFT, xt2 = x2 >> MAPBLOCKSHIFT, yt2 = y2 >> MAPBLOCKSHIFT;
    let mapxstep: number, mapystep: number, partial: number, xstep: number, ystep: number;
    if (xt2 !== xt1) {
        mapxstep = xt2 > xt1 ? 1 : -1;
        partial = mapxstep > 0 ? FRACUNIT - ((x1 >> MAPBTOFRAC) & (FRACUNIT - 1)) : (x1 >> MAPBTOFRAC) & (FRACUNIT - 1);
        ystep = FixedDiv((y2 - y1) | 0, Math.abs((x2 - x1) | 0));
    } else { mapxstep = 0; partial = FRACUNIT; ystep = 256 * FRACUNIT; }
    let yintercept = ((y1 >> MAPBTOFRAC) + FixedMul(partial, ystep)) | 0;
    if (yt2 !== yt1) {
        mapystep = yt2 > yt1 ? 1 : -1;
        partial = mapystep > 0 ? FRACUNIT - ((y1 >> MAPBTOFRAC) & (FRACUNIT - 1)) : (y1 >> MAPBTOFRAC) & (FRACUNIT - 1);
        xstep = FixedDiv((x2 - x1) | 0, Math.abs((y2 - y1) | 0));
    } else { mapystep = 0; partial = FRACUNIT; xstep = 256 * FRACUNIT; }
    let xintercept = ((x1 >> MAPBTOFRAC) + FixedMul(partial, xstep)) | 0;
    let mapx = xt1, mapy = yt1;
    for (let count = 0; count < 64; count++) {
        if ((flags & PT_ADDLINES) && !P_BlockLinesIterator(mapx, mapy, PIT_AddLineIntercepts)) return false;
        if ((flags & PT_ADDTHINGS) && !P_BlockThingsIterator(mapx, mapy, PIT_AddThingIntercepts)) return false;
        if (mapx === xt2 && mapy === yt2) break;
        if ((yintercept >> FRACBITS) === mapy) { yintercept = (yintercept + ystep) | 0; mapx += mapxstep; }
        else if ((xintercept >> FRACBITS) === mapx) { xintercept = (xintercept + xstep) | 0; mapy += mapystep; }
    }
    return P_TraverseIntercepts(trav, FRACUNIT);
}
