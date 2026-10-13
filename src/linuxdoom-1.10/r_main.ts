// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// r_main.c: view geometry, projection, lighting and frame setup. Sprites/game orchestration remain pending.
import { FixedMul, FixedDiv } from './m_fixed';
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import { NF_SUBSECTOR } from './doomdata.h';
import type { node_t, seg_t, subsector_t } from './r_defs.h';
import { mapstate } from './r_state.h';
import { SCREENWIDTH, SCREENHEIGHT } from './doomdef.h';
import { ANG90, ANG180, ANG270, ANGLETOFINESHIFT, FINEANGLES, DBITS } from './tables.h';
import { finesine, finecosine, finetangent, tantoangle, SlopeDiv } from './tables';
import { BOXLEFT, BOXRIGHT, BOXBOTTOM, BOXTOP } from './m_bbox.h';
import { LIGHTLEVELS, MAXLIGHTZ, LIGHTZSHIFT, LIGHTSCALESHIFT, MAXLIGHTSCALE, NUMCOLORMAPS } from './r_main.h';
import { texturestate } from './r_data';
import { draw, R_InitBuffer, R_DrawColumn, R_DrawColumnLow, R_DrawFuzzColumn, R_DrawTranslatedColumn, R_DrawSpan, R_DrawSpanLow } from './r_draw';
import type { player_t } from './d_player.h';
import { planes, R_ClearPlanes, R_DrawPlanes } from './r_plane';
import { wall } from './r_segs';
import { R_ClearClipSegs, R_ClearDrawSegs, R_RenderBSPNode } from './r_bsp';

export function R_PointOnSide(x: number, y: number, node: Pick<node_t, 'x' | 'y' | 'dx' | 'dy'>): number {
    if (!node.dx) return Number(x <= node.x ? node.dy > 0 : node.dy < 0);
    if (!node.dy) return Number(y <= node.y ? node.dx < 0 : node.dx > 0);
    const dx = (x - node.x) | 0, dy = (y - node.y) | 0;
    if ((node.dy ^ node.dx ^ dx ^ dy) & 0x80000000) return (node.dy ^ dx) & 0x80000000 ? 1 : 0;
    const left = FixedMul(node.dy >> FRACBITS, dx), right = FixedMul(dy, node.dx >> FRACBITS);
    return right < left ? 0 : 1;
}
export function R_PointOnSegSide(x: number, y: number, line: seg_t): number {
    return R_PointOnSide(x, y, { x: line.v1.x, y: line.v1.y, dx: (line.v2.x - line.v1.x) | 0, dy: (line.v2.y - line.v1.y) | 0 });
}
export function R_PointInSubsector(x: number, y: number): subsector_t {
    if (!mapstate.numnodes) {
        if (!mapstate.subsectors[0]) throw new Error('No subsectors loaded');
        return mapstate.subsectors[0];
    }
    let nodenum = mapstate.numnodes - 1, remaining = mapstate.numnodes + 1;
    while (!(nodenum & NF_SUBSECTOR)) {
        if (!remaining--) throw new Error('Cyclic BSP traversal');
        const node = mapstate.nodes[nodenum]; if (!node) throw new Error('Invalid BSP node');
        nodenum = node.children[R_PointOnSide(x, y, node)];
    }
    const ss = mapstate.subsectors[nodenum & ~NF_SUBSECTOR];
    if (!ss) throw new Error('Invalid BSP subsector'); return ss;
}

export const FIELDOFVIEW = 2048;
export const view = {
    viewangleoffset: 0, validcount: 1, fixedcolormap: null as Uint8Array | null,
    centerx: 160, centery: 100, centerxfrac: 160 * FRACUNIT, centeryfrac: 100 * FRACUNIT, projection: 160 * FRACUNIT,
    framecount: 0, sscount: 0, linecount: 0, loopcount: 0, viewx: 0, viewy: 0, viewz: 41 * FRACUNIT,
    viewangle: 0, viewcos: 0, viewsin: 0, viewplayer: null as player_t | null,
    detailshift: 0, viewwidth: 320, viewheight: 200, scaledviewwidth: 320, clipangle: 0,
    viewangletox: new Int32Array(FINEANGLES / 2), xtoviewangle: new Uint32Array(SCREENWIDTH + 1),
    scalelight: [] as Uint8Array[][], scalelightfixed: [] as Uint8Array[], zlight: [] as Uint8Array[][], extralight: 0,
    walllights: [] as Uint8Array[], colfunc: R_DrawColumn, basecolfunc: R_DrawColumn,
    fuzzcolfunc: R_DrawFuzzColumn, transcolfunc: R_DrawTranslatedColumn, spanfunc: R_DrawSpan,
    setsizeneeded: false, setblocks: 11, setdetail: 0, pspritescale: FRACUNIT, pspriteiscale: FRACUNIT,
    screenheightarray: new Int16Array(SCREENWIDTH), negonearray: new Int16Array(SCREENWIDTH).fill(-1),
};
export function R_AddPointToBox(x: number, y: number, box: Int32Array): void {
    if (x < box[BOXLEFT]) box[BOXLEFT] = x;
    if (x > box[BOXRIGHT]) box[BOXRIGHT] = x;
    if (y < box[BOXBOTTOM]) box[BOXBOTTOM] = y;
    if (y > box[BOXTOP]) box[BOXTOP] = y;
}
export function R_PointToAngle(x: number, y: number): number {
    x = (x - view.viewx) | 0; y = (y - view.viewy) | 0;
    if (!x && !y) return 0;
    if (x >= 0) {
        if (y >= 0) return (x > y ? tantoangle[SlopeDiv(y,x)] : ANG90 - 1 - tantoangle[SlopeDiv(x,y)]) >>> 0;
        y = -y;
        return (x > y ? -tantoangle[SlopeDiv(y,x)] : ANG270 + tantoangle[SlopeDiv(x,y)]) >>> 0;
    }
    x = -x;
    if (y >= 0) return (x > y ? ANG180 - 1 - tantoangle[SlopeDiv(y,x)] : ANG90 + tantoangle[SlopeDiv(x,y)]) >>> 0;
    y = -y;
    return (x > y ? ANG180 + tantoangle[SlopeDiv(y,x)] : ANG270 - 1 - tantoangle[SlopeDiv(x,y)]) >>> 0;
}
export function R_PointToAngle2(x1: number, y1: number, x2: number, y2: number): number {
    view.viewx = x1 | 0; view.viewy = y1 | 0; return R_PointToAngle(x2,y2);
}
export function R_PointToDist(x: number, y: number): number {
    let dx = Math.abs((x - view.viewx) | 0), dy = Math.abs((y - view.viewy) | 0);
    if (!dx && !dy) return 0; // Upstream dereferences outside tantoangle for its undefined 0/0 case.
    if (dy > dx) [dx,dy] = [dy,dx];
    const angle = ((tantoangle[FixedDiv(dy,dx) >> DBITS] + ANG90) >>> 0) >>> ANGLETOFINESHIFT;
    return FixedDiv(dx,finesine[angle]);
}
export function R_ScaleFromGlobalAngle(visangle: number): number {
    const anglea = (ANG90 + visangle - view.viewangle) >>> 0, angleb = (ANG90 + visangle - wall.rw_normalangle) >>> 0;
    const sinea = finesine[anglea >>> ANGLETOFINESHIFT], sineb = finesine[angleb >>> ANGLETOFINESHIFT];
    const num = FixedMul(view.projection,sineb) << view.detailshift, den = FixedMul(wall.rw_distance,sinea);
    return den > (num >> 16) ? Math.max(256,Math.min(64 * FRACUNIT,FixedDiv(num,den))) : 64 * FRACUNIT;
}
export function R_InitPointToAngle(): void { /* unused in C: literal tables.c lookup is retained */ }
export function R_InitTables(): void { /* unused in C: literal tables.c lookups are retained */ }
export function R_InitTextureMapping(): void {
    const focallength = FixedDiv(view.centerxfrac,finetangent[FINEANGLES/4 + FIELDOFVIEW/2]);
    for (let i=0;i<FINEANGLES/2;i++) {
        let t: number;
        if (finetangent[i] > FRACUNIT*2) t = -1;
        else if (finetangent[i] < -FRACUNIT*2) t = view.viewwidth + 1;
        else t = Math.max(-1,Math.min(view.viewwidth + 1,((view.centerxfrac - FixedMul(finetangent[i],focallength) + FRACUNIT - 1) | 0) >> FRACBITS));
        view.viewangletox[i] = t;
    }
    for (let x=0;x<=view.viewwidth;x++) {
        let i=0; while (view.viewangletox[i] > x) i++;
        view.xtoviewangle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
    }
    for (let i=0;i<FINEANGLES/2;i++) {
        if (view.viewangletox[i] === -1) view.viewangletox[i] = 0;
        else if (view.viewangletox[i] === view.viewwidth+1) view.viewangletox[i] = view.viewwidth;
    }
    view.clipangle = view.xtoviewangle[0];
}
function lightmap(level: number): Uint8Array { return texturestate.colormaps.subarray(Math.max(0,Math.min(NUMCOLORMAPS-1,level))*256,Math.max(0,Math.min(NUMCOLORMAPS-1,level))*256+256); }
export function R_InitLightTables(): void {
    if (texturestate.colormaps.length < NUMCOLORMAPS*256) throw new Error('Initialize render resources before lighting');
    view.zlight = Array.from({length:LIGHTLEVELS},(_,i)=> {
        const startmap = Math.trunc((LIGHTLEVELS-1-i)*2*NUMCOLORMAPS/LIGHTLEVELS);
        return Array.from({length:MAXLIGHTZ},(_,j)=> {
            const scale = FixedDiv(SCREENWIDTH/2*FRACUNIT,(j+1)<<LIGHTZSHIFT) >> LIGHTSCALESHIFT;
            return lightmap(startmap - Math.trunc(scale/2));
        });
    });
}
export function R_SetViewSize(blocks: number, detail: number): void {
    if (!Number.isInteger(blocks) || blocks < 3 || blocks > 11 || (detail !== 0 && detail !== 1)) throw new Error('Invalid view size/detail');
    view.setsizeneeded = true; view.setblocks = blocks; view.setdetail = detail;
}
export function R_ExecuteSetViewSize(): void {
    view.setsizeneeded = false;
    view.scaledviewwidth = view.setblocks === 11 ? SCREENWIDTH : view.setblocks*32;
    view.viewheight = view.setblocks === 11 ? SCREENHEIGHT : Math.trunc(view.setblocks*168/10) & ~7;
    view.detailshift = view.setdetail; view.viewwidth = view.scaledviewwidth >> view.detailshift;
    view.centery = view.viewheight >> 1; view.centerx = view.viewwidth >> 1;
    view.centerxfrac = view.centerx << FRACBITS; view.centeryfrac = view.centery << FRACBITS; view.projection = view.centerxfrac;
    view.colfunc = view.basecolfunc = view.detailshift ? R_DrawColumnLow : R_DrawColumn;
    view.fuzzcolfunc = R_DrawFuzzColumn; view.transcolfunc = R_DrawTranslatedColumn;
    view.spanfunc = view.detailshift ? R_DrawSpanLow : R_DrawSpan;
    R_InitBuffer(view.scaledviewwidth,view.viewheight); draw.centery = view.centery;
    R_InitTextureMapping();
    view.pspritescale = Math.trunc(FRACUNIT*view.viewwidth/SCREENWIDTH);
    view.pspriteiscale = Math.trunc(FRACUNIT*SCREENWIDTH/view.viewwidth);
    view.screenheightarray.fill(view.viewheight,0,view.viewwidth);
    for (let i=0;i<view.viewheight;i++) {
        const dy = Math.abs(((i - view.viewheight/2) << FRACBITS) + FRACUNIT/2);
        planes.yslope[i] = FixedDiv((view.viewwidth << view.detailshift)/2*FRACUNIT,dy);
    }
    for (let i=0;i<view.viewwidth;i++) planes.distscale[i] = FixedDiv(FRACUNIT,Math.abs(finecosine[view.xtoviewangle[i] >>> ANGLETOFINESHIFT]));
    view.scalelight = Array.from({length:LIGHTLEVELS},(_,i)=> {
        const startmap = Math.trunc((LIGHTLEVELS-1-i)*2*NUMCOLORMAPS/LIGHTLEVELS);
        return Array.from({length:MAXLIGHTSCALE},(_,j)=>lightmap(startmap - Math.trunc(Math.trunc(j*SCREENWIDTH/(view.viewwidth << view.detailshift))/2)));
    });
}
export interface WorldCamera { x: number; y: number; z: number; angle: number; extralight?: number; fixedcolormap?: number }
export function R_SetupWorldFrame(camera: WorldCamera): void {
    view.viewx = camera.x | 0; view.viewy = camera.y | 0; view.viewz = camera.z | 0;
    view.viewangle = (camera.angle + view.viewangleoffset) >>> 0; view.extralight = camera.extralight ?? 0;
    view.viewsin = finesine[view.viewangle >>> ANGLETOFINESHIFT]; view.viewcos = finecosine[view.viewangle >>> ANGLETOFINESHIFT];
    view.sscount = 0;
    const fixed = camera.fixedcolormap ?? 0;
    if (!Number.isInteger(fixed) || fixed < 0 || (fixed+1)*256 > texturestate.colormaps.length) throw new Error('Invalid fixed colormap');
    view.fixedcolormap = fixed ? texturestate.colormaps.subarray(fixed*256,(fixed+1)*256) : null;
    if (view.fixedcolormap) view.walllights = view.scalelightfixed = Array(MAXLIGHTSCALE).fill(view.fixedcolormap);
    view.framecount++; view.validcount++;
}
export function R_SetupFrame(player: player_t): void {
    if (!player.mo) throw new Error('Player has no map object');
    view.viewplayer = player;
    R_SetupWorldFrame({x:player.mo.x,y:player.mo.y,z:player.viewz,angle:player.mo.angle,extralight:player.extralight,fixedcolormap:player.fixedcolormap});
}
// World inspection boundary. No actor sprites, masked textures, psprites or NetUpdate yet.
export function R_RenderWorldView(camera: WorldCamera): void {
    if (view.setsizeneeded) R_ExecuteSetViewSize();
    R_SetupWorldFrame(camera); R_ClearClipSegs(); R_ClearDrawSegs(); R_ClearPlanes();
    R_RenderBSPNode(mapstate.numnodes-1); R_DrawPlanes();
}
