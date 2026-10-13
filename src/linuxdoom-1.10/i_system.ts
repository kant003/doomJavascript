// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Browser adaptation of the implemented low-level i_system.c primitives.
import { TICRATE } from './doomdef.h';
import type { ticcmd_t } from './d_ticcmd.h';
export let mb_used = 6;
const emptycmd: ticcmd_t = { forwardmove: 0, sidemove: 0, angleturn: 0, consistancy: 0, chatchar: 0, buttons: 0 };
let basetime: number | null = null;
export function I_BaseTiccmd(): ticcmd_t { return emptycmd; }
export function I_GetHeapSize(): number { return mb_used * 1024 * 1024; }
export function I_ZoneBase(size: Int32Array): Uint8Array { size[0] = I_GetHeapSize(); return new Uint8Array(size[0]); }
export function I_GetTime(): number {
    const now = performance.now();
    basetime ??= now;
    return Math.floor((now - basetime) * TICRATE / 1000);
}
export function I_AllocLow(length: number): Uint8Array { return new Uint8Array(length); }
export function I_BeginRead(): void { /* empty in upstream */ }
export function I_EndRead(): void { /* empty in upstream */ }
export function I_Tactile(_on: number, _off: number, _total: number): void { /* unused in upstream */ }
export function I_Error(message: string, ...args: unknown[]): never {
    let i = 0;
    throw new Error(message.replace(/%[isd]/g, () => String(args[i++])));
}
// Waiting is asynchronous on the browser's main thread.
export async function I_WaitVBL(count: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, count * 1000 / 70));
}
