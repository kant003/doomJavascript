// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Browser platform implementation: replaces X11 indexed visual with Canvas ImageData.
import { SCREENWIDTH, SCREENHEIGHT, KEY_RIGHTARROW, KEY_LEFTARROW, KEY_UPARROW, KEY_DOWNARROW,
    KEY_ESCAPE, KEY_ENTER, KEY_TAB, KEY_BACKSPACE, KEY_RSHIFT, KEY_RCTRL, KEY_RALT, KEY_PAUSE } from './doomdef.h';
import { evtype_t } from './d_event.h';
import type { event_t } from './d_event.h';
import { screens, gammatable, usegamma } from './v_video';
import { I_Error } from './i_system';
let context: CanvasRenderingContext2D | null = null;
let image: ImageData;
let dispose: (() => void) | null = null;
const palette = new Uint8Array(768);
const pending: event_t[] = [];
export function I_InitGraphics(canvas: HTMLCanvasElement): void {
    I_ShutdownGraphics();
    canvas.width = SCREENWIDTH; canvas.height = SCREENHEIGHT;
    context = canvas.getContext('2d', { alpha: false });
    if (!context) I_Error('Canvas 2D unavailable');
    image = context.createImageData(SCREENWIDTH, SCREENHEIGHT);
    for (let i = 0; i < 256; i++) palette.fill(i, i * 3, i * 3 + 3);
    const keys: Record<string, number> = {
        ArrowRight: KEY_RIGHTARROW, ArrowLeft: KEY_LEFTARROW, ArrowUp: KEY_UPARROW, ArrowDown: KEY_DOWNARROW,
        Escape: KEY_ESCAPE, Enter: KEY_ENTER, Tab: KEY_TAB, Backspace: KEY_BACKSPACE,
        ShiftLeft: KEY_RSHIFT, ShiftRight: KEY_RSHIFT, ControlLeft: KEY_RCTRL, ControlRight: KEY_RCTRL,
        AltLeft: KEY_RALT, AltRight: KEY_RALT, Pause: KEY_PAUSE,
    };
    const held = new Set<number>();
    const postKey = (e: KeyboardEvent): void => {
        if (document.activeElement !== canvas) return;
        const f = /^F(\d+)$/.exec(e.code);
        const key = keys[e.code] ?? (f ? (Number(f[1]) <= 10 ? 0x80 + 0x3a + Number(f[1]) : 0x80 + 0x57 + Number(f[1]) - 11)
            : e.key.length === 1 ? e.key.toLowerCase().charCodeAt(0) : 0);
        if (!key) return;
        e.preventDefault();
        if (e.repeat) return;
        if (e.type === 'keydown') held.add(key); else held.delete(key);
        pending.push({ type: e.type === 'keydown' ? evtype_t.ev_keydown : evtype_t.ev_keyup, data1: key, data2: 0, data3: 0 });
    };
    const release = (): void => { for (const key of held) pending.push({ type: evtype_t.ev_keyup, data1: key, data2: 0, data3: 0 }); held.clear(); };
    window.addEventListener('keydown', postKey); window.addEventListener('keyup', postKey);
    window.addEventListener('blur', release); canvas.addEventListener('blur', release);
    dispose = () => {
        window.removeEventListener('keydown', postKey); window.removeEventListener('keyup', postKey);
        window.removeEventListener('blur', release); canvas.removeEventListener('blur', release);
    };
}
export function I_ShutdownGraphics(): void { dispose?.(); dispose = null; context = null; pending.length = 0; }
export function I_SetPalette(pal: Uint8Array): void {
    if (pal.length < 768) I_Error('PLAYPAL must contain at least 768 bytes');
    palette.set(pal.subarray(0, 768));
}
export function I_FinishUpdate(): void {
    if (!context) return;
    const gamma = gammatable[usegamma];
    for (let i = 0; i < screens[0].length; i++) {
        const color = screens[0][i] * 3, dest = i * 4;
        image.data[dest] = gamma[palette[color]];
        image.data[dest + 1] = gamma[palette[color + 1]];
        image.data[dest + 2] = gamma[palette[color + 2]];
        image.data[dest + 3] = 255;
    }
    context.putImageData(image, 0, 0);
}
export function I_ReadScreen(scr: Uint8Array): void { scr.set(screens[0]); }
export function I_StartTic(): event_t[] { return pending.splice(0); }
export function I_StartFrame(): void { /* empty in upstream */ }
export function I_UpdateNoBlit(): void { /* empty in upstream */ }
