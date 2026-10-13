// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// v_video.c translated to byte arrays. Patch posts remain column-major and indexed.
import { SCREENWIDTH, SCREENHEIGHT } from './doomdef.h';
import { M_AddToBox, M_ClearBox } from './m_bbox';
import { I_Error } from './i_system';
export { gammatable } from './v_gamma';
export const screens: Uint8Array[] = Array.from({ length: 5 }, () => new Uint8Array(0));
export const dirtybox = new Int32Array(4);
export let usegamma = 0;
export function V_SetGamma(gamma: number): void { usegamma = ((gamma % 5) + 5) % 5; }
export function V_Init(): void {
    const base = new Uint8Array(SCREENWIDTH * SCREENHEIGHT * 4);
    for (let i = 0; i < 4; i++) screens[i] = base.subarray(i * SCREENWIDTH * SCREENHEIGHT, (i + 1) * SCREENWIDTH * SCREENHEIGHT);
    // Screen 4 is the renderer's separate status-bar buffer in upstream; allocate it here.
    screens[4] = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    M_ClearBox(dirtybox);
}
export function V_MarkRect(x: number, y: number, width: number, height: number): void {
    M_AddToBox(dirtybox, x, y);
    M_AddToBox(dirtybox, x + width - 1, y + height - 1);
}
function validRect(x: number, y: number, scrn: number, width: number, height: number): boolean {
    return [x, y, scrn, width, height].every(Number.isInteger) && x >= 0 && y >= 0 && width >= 0 && height >= 0
        && x + width <= SCREENWIDTH && y + height <= SCREENHEIGHT && scrn >= 0 && scrn <= 4;
}
export function V_CopyRect(srcx: number, srcy: number, srcscrn: number, width: number, height: number, destx: number, desty: number, destscrn: number): void {
    if (!validRect(srcx, srcy, srcscrn, width, height) || !validRect(destx, desty, destscrn, width, height)) I_Error('Bad V_CopyRect');
    V_MarkRect(destx, desty, width, height);
    for (let row = 0; row < height; row++) {
        const src = (srcy + row) * SCREENWIDTH + srcx;
        screens[destscrn].set(screens[srcscrn].subarray(src, src + width), (desty + row) * SCREENWIDTH + destx);
    }
}
export interface PatchHeader { width: number; height: number; leftoffset: number; topoffset: number }
export function V_PatchHeader(patch: Uint8Array): PatchHeader {
    if (patch.length < 8) I_Error('Truncated patch header');
    const view = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);
    const width = view.getInt16(0, true), height = view.getInt16(2, true);
    if (width < 0 || height < 0 || 8 + width * 4 > patch.length) I_Error('Invalid patch dimensions');
    return { width, height, leftoffset: view.getInt16(4, true), topoffset: view.getInt16(6, true) };
}
function drawPatch(x: number, y: number, scrn: number, patch: Uint8Array, flipped: boolean): void {
    const h = V_PatchHeader(patch);
    y -= h.topoffset; x -= h.leftoffset;
    if (!validRect(x, y, scrn, h.width, h.height)) {
        if (flipped) I_Error('Bad V_DrawPatch in V_DrawPatchFlipped');
        console.warn(`V_DrawPatch: patch at ${x},${y} exceeds LFB (ignored)`);
        return;
    }
    // Validate all posts before painting so malformed data cannot leave a half-written frame.
    const view = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);
    const posts: { column: number; top: number; pixels: Uint8Array }[] = [];
    for (let col = 0; col < h.width; col++) {
        let offset = view.getUint32(8 + (flipped ? h.width - 1 - col : col) * 4, true);
        while (true) {
            if (offset >= patch.length) I_Error('Truncated patch column');
            if (patch[offset] === 0xff) break;
            if (offset + 4 > patch.length) I_Error('Truncated patch post');
            const top = patch[offset], length = patch[offset + 1];
            if (top + length > h.height || offset + length + 4 > patch.length) I_Error('Invalid patch post');
            posts.push({ column: col, top, pixels: patch.subarray(offset + 3, offset + 3 + length) });
            offset += length + 4;
        }
    }
    if (!scrn) V_MarkRect(x, y, h.width, h.height);
    for (const post of posts) {
        let dest = (y + post.top) * SCREENWIDTH + x + post.column;
        for (const pixel of post.pixels) { screens[scrn][dest] = pixel; dest += SCREENWIDTH; }
    }
}
export function V_DrawPatch(x: number, y: number, scrn: number, patch: Uint8Array): void { drawPatch(x, y, scrn, patch, false); }
export function V_DrawPatchFlipped(x: number, y: number, scrn: number, patch: Uint8Array): void { drawPatch(x, y, scrn, patch, true); }
export function V_DrawPatchDirect(x: number, y: number, scrn: number, patch: Uint8Array): void { V_DrawPatch(x, y, scrn, patch); }
export function V_DrawBlock(x: number, y: number, scrn: number, width: number, height: number, src: Uint8Array): void {
    if (!validRect(x, y, scrn, width, height) || src.length < width * height) I_Error('Bad V_DrawBlock');
    V_MarkRect(x, y, width, height);
    for (let row = 0; row < height; row++) screens[scrn].set(src.subarray(row * width, (row + 1) * width), (y + row) * SCREENWIDTH + x);
}
export function V_GetBlock(x: number, y: number, scrn: number, width: number, height: number, dest: Uint8Array): void {
    if (!validRect(x, y, scrn, width, height) || dest.length < width * height) I_Error('Bad V_GetBlock');
    for (let row = 0; row < height; row++) {
        const p = (y + row) * SCREENWIDTH + x;
        dest.set(screens[scrn].subarray(p, p + width), row * width);
    }
}
