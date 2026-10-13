// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Conversion of r_draw.c. Writable C globals are fields on draw (ES module bindings are read-only).
import { SCREENWIDTH, SCREENHEIGHT, GameMode_t } from './doomdef.h';
import { FRACBITS } from './m_fixed.h';
import { screens, V_DrawPatch, V_MarkRect } from './v_video';
import { W_CacheLumpName } from './w_wad';
import { I_Error } from './i_system';
export const draw = {
    viewwidth: 320, scaledviewwidth: 320, viewheight: 168, viewwindowx: 0, viewwindowy: 0,
    centery: 84, gamemode: GameMode_t.shareware,
    ylookup: new Int32Array(832), columnofs: new Int32Array(1120),
    dc_colormap: new Uint8Array(256) as Uint8Array, dc_x: 0, dc_yl: 0, dc_yh: -1, dc_iscale: 0, dc_texturemid: 0,
    dc_source: new Uint8Array(128) as Uint8Array, dc_translation: new Uint8Array(256), translationtables: new Uint8Array(768),
    colormaps: new Uint8Array(256 * 32), fuzzpos: 0,
    ds_y: 0, ds_x1: 0, ds_x2: -1, ds_colormap: new Uint8Array(256) as Uint8Array,
    ds_xfrac: 0, ds_yfrac: 0, ds_xstep: 0, ds_ystep: 0, ds_source: new Uint8Array(4096) as Uint8Array,
};
export const FUZZTABLE = 50;
export const fuzzoffset = new Int32Array([
    1,-1,1,-1,1,1,-1,1,1,-1,1,1,1,-1,1,1,1,-1,-1,-1,-1,1,-1,-1,1,1,1,1,-1,
    1,-1,1,1,-1,-1,1,1,-1,-1,-1,-1,1,1,1,1,-1,1,1,-1,1
].map(n => n * SCREENWIDTH));
function checkColumn(x: number): void {
    if (x < 0 || x >= draw.viewwidth || draw.dc_yl < 0 || draw.dc_yh >= draw.viewheight) I_Error('R_DrawColumn: invalid bounds');
}
export function R_DrawColumn(): void {
    if (draw.dc_yh < draw.dc_yl) return;
    checkColumn(draw.dc_x);
    let dest = draw.ylookup[draw.dc_yl] + draw.columnofs[draw.dc_x];
    let frac = (draw.dc_texturemid + (draw.dc_yl - draw.centery) * draw.dc_iscale) | 0;
    for (let count = draw.dc_yh - draw.dc_yl; count >= 0; count--) {
        screens[0][dest] = draw.dc_colormap[draw.dc_source[(frac >> FRACBITS) & 127]];
        dest += SCREENWIDTH; frac = (frac + draw.dc_iscale) | 0;
    }
}
export function R_DrawColumnLow(): void {
    if (draw.dc_yh < draw.dc_yl) return;
    draw.dc_x <<= 1;
    checkColumn(draw.dc_x + 1);
    let dest = draw.ylookup[draw.dc_yl] + draw.columnofs[draw.dc_x];
    let dest2 = draw.ylookup[draw.dc_yl] + draw.columnofs[draw.dc_x + 1];
    let frac = (draw.dc_texturemid + (draw.dc_yl - draw.centery) * draw.dc_iscale) | 0;
    for (let count = draw.dc_yh - draw.dc_yl; count >= 0; count--) {
        screens[0][dest2] = screens[0][dest] = draw.dc_colormap[draw.dc_source[(frac >> FRACBITS) & 127]];
        dest += SCREENWIDTH; dest2 += SCREENWIDTH; frac = (frac + draw.dc_iscale) | 0;
    }
}
export function R_DrawFuzzColumn(): void {
    if (!draw.dc_yl) draw.dc_yl = 1;
    if (draw.dc_yh === draw.viewheight - 1) draw.dc_yh = draw.viewheight - 2;
    if (draw.dc_yh < draw.dc_yl) return;
    checkColumn(draw.dc_x);
    let dest = draw.ylookup[draw.dc_yl] + draw.columnofs[draw.dc_x];
    for (let count = draw.dc_yh - draw.dc_yl; count >= 0; count--) {
        screens[0][dest] = draw.colormaps[6 * 256 + screens[0][dest + fuzzoffset[draw.fuzzpos]]];
        if (++draw.fuzzpos === FUZZTABLE) draw.fuzzpos = 0;
        dest += SCREENWIDTH;
    }
}
export function R_DrawTranslatedColumn(): void {
    if (draw.dc_yh < draw.dc_yl) return;
    checkColumn(draw.dc_x);
    let dest = draw.ylookup[draw.dc_yl] + draw.columnofs[draw.dc_x];
    let frac = (draw.dc_texturemid + (draw.dc_yl - draw.centery) * draw.dc_iscale) | 0;
    for (let count = draw.dc_yh - draw.dc_yl; count >= 0; count--) {
        screens[0][dest] = draw.dc_colormap[draw.dc_translation[draw.dc_source[frac >> FRACBITS]]];
        dest += SCREENWIDTH; frac = (frac + draw.dc_iscale) | 0;
    }
}
export function R_InitTranslationTables(): void {
    for (let i = 0; i < 256; i++) {
        if (i >= 0x70 && i <= 0x7f) {
            draw.translationtables[i] = 0x60 + (i & 0xf);
            draw.translationtables[i + 256] = 0x40 + (i & 0xf);
            draw.translationtables[i + 512] = 0x20 + (i & 0xf);
        } else draw.translationtables[i] = draw.translationtables[i + 256] = draw.translationtables[i + 512] = i;
    }
}
function checkSpan(): void {
    if (draw.ds_x2 < draw.ds_x1 || draw.ds_x1 < 0 || draw.ds_x2 >= draw.viewwidth || draw.ds_y < 0 || draw.ds_y >= draw.viewheight) I_Error('R_DrawSpan: invalid bounds');
}
export function R_DrawSpan(): void {
    checkSpan();
    let xfrac = draw.ds_xfrac | 0, yfrac = draw.ds_yfrac | 0;
    let dest = draw.ylookup[draw.ds_y] + draw.columnofs[draw.ds_x1];
    for (let count = draw.ds_x2 - draw.ds_x1; count >= 0; count--) {
        const spot = ((yfrac >> (16 - 6)) & (63 * 64)) + ((xfrac >> 16) & 63);
        screens[0][dest++] = draw.ds_colormap[draw.ds_source[spot]];
        xfrac = (xfrac + draw.ds_xstep) | 0; yfrac = (yfrac + draw.ds_ystep) | 0;
    }
}
export function R_DrawSpanLow(): void {
    checkSpan();
    let xfrac = draw.ds_xfrac | 0, yfrac = draw.ds_yfrac | 0;
    draw.ds_x1 <<= 1; draw.ds_x2 <<= 1;
    let dest = draw.ylookup[draw.ds_y] + draw.columnofs[draw.ds_x1];
    // Preserve the original doubled-count loop, including its documented blocky-mode bug.
    for (let count = draw.ds_x2 - draw.ds_x1; count >= 0; count--) {
        const spot = ((yfrac >> (16 - 6)) & (63 * 64)) + ((xfrac >> 16) & 63);
        screens[0][dest++] = draw.ds_colormap[draw.ds_source[spot]];
        screens[0][dest++] = draw.ds_colormap[draw.ds_source[spot]];
        xfrac = (xfrac + draw.ds_xstep) | 0; yfrac = (yfrac + draw.ds_ystep) | 0;
    }
}
export function R_InitBuffer(width: number, height: number): void {
    if (width < 1 || width > SCREENWIDTH || height < 1 || height > SCREENHEIGHT) I_Error('Invalid view dimensions');
    draw.viewwidth = draw.scaledviewwidth = width; draw.viewheight = height;
    draw.centery = height >> 1;
    draw.viewwindowx = (SCREENWIDTH - width) >> 1;
    draw.viewwindowy = width === SCREENWIDTH ? 0 : (SCREENHEIGHT - 32 - height) >> 1;
    if (draw.viewwindowy < 0) I_Error('Invalid view window');
    for (let i = 0; i < width; i++) draw.columnofs[i] = draw.viewwindowx + i;
    for (let i = 0; i < height; i++) draw.ylookup[i] = (i + draw.viewwindowy) * SCREENWIDTH;
}
export function R_FillBackScreen(): void {
    if (draw.scaledviewwidth === SCREENWIDTH) return;
    const src = W_CacheLumpName(draw.gamemode === GameMode_t.commercial ? 'GRNROCK' : 'FLOOR7_2', 101);
    if (src.length < 4096) I_Error('Invalid border flat');
    for (let y = 0; y < SCREENHEIGHT - 32; y++) for (let x = 0; x < SCREENWIDTH; x++) screens[1][y * SCREENWIDTH + x] = src[(y & 63) * 64 + (x & 63)];
    const patch = (name: string, x: number, y: number): void => V_DrawPatch(x, y, 1, W_CacheLumpName(name, 101));
    const { viewwindowx: vx, viewwindowy: vy, scaledviewwidth: w, viewheight: h } = draw;
    for (let x = 0; x < w; x += 8) { patch('brdr_t', vx + x, vy - 8); patch('brdr_b', vx + x, vy + h); }
    for (let y = 0; y < h; y += 8) { patch('brdr_l', vx - 8, vy + y); patch('brdr_r', vx + w, vy + y); }
    patch('brdr_tl', vx - 8, vy - 8); patch('brdr_tr', vx + w, vy - 8);
    patch('brdr_bl', vx - 8, vy + h); patch('brdr_br', vx + w, vy + h);
}
export function R_VideoErase(ofs: number, count: number): void { screens[0].set(screens[1].subarray(ofs, ofs + count), ofs); }
export function R_DrawViewBorder(): void {
    if (draw.scaledviewwidth === SCREENWIDTH) return;
    const top = Math.trunc((SCREENHEIGHT - 32 - draw.viewheight) / 2);
    let side = Math.trunc((SCREENWIDTH - draw.scaledviewwidth) / 2);
    R_VideoErase(0, top * SCREENWIDTH + side);
    let ofs = (draw.viewheight + top) * SCREENWIDTH - side;
    R_VideoErase(ofs, top * SCREENWIDTH + side);
    ofs = top * SCREENWIDTH + SCREENWIDTH - side; side <<= 1;
    for (let i = 1; i < draw.viewheight; i++) { R_VideoErase(ofs, side); ofs += SCREENWIDTH; }
    V_MarkRect(0, 0, SCREENWIDTH, SCREENHEIGHT - 32);
}
