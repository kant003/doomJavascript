// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export interface wadinfo_t { identification: 'IWAD' | 'PWAD'; numlumps: number; infotableofs: number }
export interface filelump_t { filepos: number; size: number; name: string }
export interface lumpinfo_t { name: string; handle: number; position: number; size: number }
// Platform boundary: load files asynchronously, then run all W_* reads synchronously.
export interface WadFile { name: string; data: Uint8Array }
export * from './w_wad';
