// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Conversion of f_wipe.c. A short* is a Uint16Array view of two indexed pixels.
import { screens, V_DrawBlock, V_MarkRect } from './v_video';
import { I_ReadScreen } from './i_video';
import { M_Random } from './m_random';
import { SCREENWIDTH, SCREENHEIGHT } from './doomdef.h';
let go = false;
let wipe_scr_start: Uint8Array, wipe_scr_end: Uint8Array, wipe_scr: Uint8Array;
let y = new Int32Array(0);
function shorts(bytes: Uint8Array): Uint16Array { return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2); }
export function wipe_shittyColMajorXform(array: Uint16Array, width: number, height: number): void {
    const dest = new Uint16Array(width * height);
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) dest[col * height + row] = array[row * width + col];
    array.set(dest);
}
export function wipe_initColorXForm(width: number, height: number, _ticks: number): number {
    wipe_scr.set(wipe_scr_start.subarray(0, width * height)); return 0;
}
export function wipe_doColorXForm(width: number, height: number, ticks: number): number {
    let changed = false;
    for (let i = 0; i < width * height; i++) {
        if (wipe_scr[i] > wipe_scr_end[i]) { wipe_scr[i] = Math.max(wipe_scr[i] - ticks, wipe_scr_end[i]); changed = true; }
        else if (wipe_scr[i] < wipe_scr_end[i]) { wipe_scr[i] = Math.min(wipe_scr[i] + ticks, wipe_scr_end[i]); changed = true; }
    }
    return Number(!changed);
}
export function wipe_exitColorXForm(_width: number, _height: number, _ticks: number): number { return 0; }
export function wipe_initMelt(width: number, height: number, _ticks: number): number {
    wipe_scr.set(wipe_scr_start.subarray(0, width * height));
    wipe_shittyColMajorXform(shorts(wipe_scr_start), width / 2, height);
    wipe_shittyColMajorXform(shorts(wipe_scr_end), width / 2, height);
    y = new Int32Array(width);
    y[0] = -(M_Random() % 16);
    for (let i = 1; i < width; i++) {
        y[i] = y[i - 1] + M_Random() % 3 - 1;
        if (y[i] > 0) y[i] = 0;
        else if (y[i] === -16) y[i] = -15;
    }
    return 0;
}
export function wipe_doMelt(width: number, height: number, ticks: number): number {
    let done = true;
    width /= 2;
    const start = shorts(wipe_scr_start), end = shorts(wipe_scr_end), dest = shorts(wipe_scr);
    while (ticks--) for (let i = 0; i < width; i++) {
        if (y[i] < 0) { y[i]++; done = false; }
        else if (y[i] < height) {
            const dy = Math.min(y[i] < 16 ? y[i] + 1 : 8, height - y[i]);
            for (let j = 0; j < dy; j++) dest[(y[i] + j) * width + i] = end[i * height + y[i] + j];
            y[i] += dy;
            for (let j = 0; j < height - y[i]; j++) dest[(y[i] + j) * width + i] = start[i * height + j];
            done = false;
        }
    }
    return Number(done);
}
export function wipe_exitMelt(_width: number, _height: number, _ticks: number): number { y = new Int32Array(0); return 0; }
// Upstream wipes always operate on full screens. Refuse unsupported subrectangles explicitly.
function fullScreen(x: number, row: number, width: number, height: number): void {
    if (x !== 0 || row !== 0 || width !== SCREENWIDTH || height !== SCREENHEIGHT) throw new Error('Wipe requires a full 320 × 200 screen');
}
export function wipe_StartScreen(x: number, row: number, width: number, height: number): number {
    fullScreen(x, row, width, height); go = false; wipe_scr_start = screens[2]; I_ReadScreen(wipe_scr_start); return 0;
}
export function wipe_EndScreen(x: number, row: number, width: number, height: number): number {
    fullScreen(x, row, width, height); wipe_scr_end = screens[3]; I_ReadScreen(wipe_scr_end);
    V_DrawBlock(x, row, 0, width, height, wipe_scr_start); return 0;
}
export function wipe_ScreenWipe(wipeno: number, x: number, row: number, width: number, height: number, ticks: number): boolean {
    fullScreen(x, row, width, height);
    if (wipeno !== 0 && wipeno !== 1) throw new Error('Invalid wipe type');
    if (!Number.isInteger(ticks) || ticks < 0) throw new Error('Invalid wipe ticks');
    const wipes = [wipe_initColorXForm, wipe_doColorXForm, wipe_exitColorXForm, wipe_initMelt, wipe_doMelt, wipe_exitMelt];
    if (!go) { go = true; wipe_scr = screens[0]; wipes[wipeno * 3](width, height, ticks); }
    V_MarkRect(0, 0, width, height);
    if (wipes[wipeno * 3 + 1](width, height, ticks)) { go = false; wipes[wipeno * 3 + 2](width, height, ticks); }
    return !go;
}
