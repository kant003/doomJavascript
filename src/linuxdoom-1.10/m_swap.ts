// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export function SwapSHORT(x: number): number { return ((x >>> 8) | (x << 8)) & 0xffff; }
export function SwapLONG(x: number): number {
    return ((x >>> 24) | ((x >>> 8) & 0xff00) | ((x << 8) & 0xff0000) | (x << 24)) >>> 0;
}
