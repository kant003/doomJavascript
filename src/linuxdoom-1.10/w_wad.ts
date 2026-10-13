// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Conversion of w_wad.c. OS handles become indexes into immutable in-memory files.
import type { WadFile, lumpinfo_t } from './w_wad.h';
import { I_Error } from './i_system';
export let lumpinfo: lumpinfo_t[] = [];
export let numlumps = 0;
export let lumpcache: (Uint8Array | null)[] = [];
const files: WadFile[] = [];
const tags: number[] = [];
const decoder = new TextDecoder('ascii');
export function strupr(s: string): string { return s.toUpperCase(); }
export function filelength(handle: number): number { return files[handle].data.length; }
export function ExtractFileBase(path: string): string {
    const base = path.replaceAll('\\', '/').split('/').at(-1)!.split('.')[0];
    if (base.length > 8) I_Error('Filename base of %s >8 chars', path);
    return base.toUpperCase();
}
function readName(bytes: Uint8Array): string { return decoder.decode(bytes).split('\0')[0]; }
function directory(file: WadFile, handle: number): lumpinfo_t[] {
    const data = file.data;
    if (!/wad$/i.test(file.name)) return [{ name: ExtractFileBase(file.name), handle, position: 0, size: data.length }];
    if (data.length < 12) I_Error('WAD header truncated: %s', file.name);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const id = decoder.decode(data.subarray(0, 4));
    if (id !== 'IWAD' && id !== 'PWAD') I_Error("Wad file %s doesn't have IWAD or PWAD id", file.name);
    const count = view.getInt32(4, true), offset = view.getInt32(8, true);
    if (count < 0 || offset < 0 || offset + count * 16 > data.length) I_Error('Invalid WAD directory: %s', file.name);
    const entries: lumpinfo_t[] = [];
    for (let i = 0; i < count; i++) {
        const p = offset + i * 16;
        const position = view.getInt32(p, true), size = view.getInt32(p + 4, true);
        if (position < 0 || size < 0 || position + size > data.length) I_Error('Invalid lump %i in %s', i, file.name);
        entries.push({ name: readName(data.subarray(p + 8, p + 16)), handle, position, size });
    }
    return entries;
}
export function W_AddFile(file: WadFile): void {
    if (file.name.startsWith('~')) I_Error('Use W_Reload with a replacement file; tilde paths are not supported in the browser');
    const stored = { name: file.name, data: file.data.slice() };
    const entries = directory(stored, files.length);
    files.push(stored);
    for (const entry of entries) lumpinfo.push(entry);
    numlumps = lumpinfo.length;
    for (let i = lumpcache.length; i < numlumps; i++) { lumpcache.push(null); tags.push(0); }
}
export function W_InitMultipleFiles(filenames: readonly WadFile[]): void {
    // Validate everything before replacing the previous session.
    filenames.forEach((file, i) => directory(file, i));
    if (!filenames.some((file, i) => directory(file, i).length)) I_Error('W_InitFiles: no files found');
    files.length = 0; tags.length = 0; lumpinfo = []; lumpcache = []; numlumps = 0;
    for (const file of filenames) W_AddFile(file);
}
export function W_InitFile(file: WadFile): void { W_InitMultipleFiles([file]); }
export function W_NumLumps(): number { return numlumps; }
export function W_CheckNumForName(name: string): number {
    const name8 = name.split('\0')[0].slice(0, 8).toUpperCase();
    for (let i = numlumps - 1; i >= 0; i--) if (lumpinfo[i].name === name8) return i;
    return -1;
}
export function W_GetNumForName(name: string): number {
    const i = W_CheckNumForName(name);
    if (i === -1) I_Error('W_GetNumForName: %s not found!', name);
    return i;
}
function lumpAt(lump: number): lumpinfo_t {
    if (!Number.isInteger(lump) || lump < 0 || lump >= numlumps) I_Error('Invalid lump index %i', lump);
    return lumpinfo[lump];
}
export function W_LumpLength(lump: number): number { return lumpAt(lump).size; }
export function W_ReadLump(lump: number, dest: Uint8Array): void {
    const l = lumpAt(lump);
    if (dest.length < l.size) I_Error('W_ReadLump: destination too small');
    dest.set(files[l.handle].data.subarray(l.position, l.position + l.size));
}
export function W_CacheLumpNum(lump: number, tag: number): Uint8Array {
    lumpAt(lump);
    if (!lumpcache[lump]) { lumpcache[lump] = new Uint8Array(W_LumpLength(lump)); W_ReadLump(lump, lumpcache[lump]!); }
    tags[lump] = tag;
    return lumpcache[lump]!;
}
export function W_CacheLumpName(name: string, tag: number): Uint8Array { return W_CacheLumpNum(W_GetNumForName(name), tag); }
// Browser extension: caller supplies refreshed bytes. Unlike the original fragile reload hack,
// refuse changed directory sizes/names and invalidate only the replaced file's cache.
export function W_Reload(file: WadFile): void {
    const handle = files.findIndex(f => f.name === file.name);
    if (handle < 0) I_Error("W_Reload: couldn't open %s", file.name);
    const stored = { name: file.name, data: file.data.slice() }, entries = directory(stored, handle);
    const indexes = lumpinfo.flatMap((l, i) => l.handle === handle ? [i] : []);
    if (entries.length !== indexes.length || entries.some((l, i) => l.name !== lumpinfo[indexes[i]].name)) I_Error('W_Reload: changed directory');
    files[handle] = stored;
    indexes.forEach((index, i) => { lumpinfo[index] = entries[i]; lumpcache[index] = null; tags[index] = 0; });
}
// Filesystem profiler becomes a returned text report that the web shell can download.
export function W_Profile(): string {
    return lumpinfo.map((l, i) => `${l.name.padEnd(8)} ${lumpcache[i] ? (tags[i] < 100 ? 'S' : 'P') : ' '}`).join('\n');
}
