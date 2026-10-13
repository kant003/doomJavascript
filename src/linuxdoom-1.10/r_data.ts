// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// r_data.c: names, texture lookup, composite columns, flats, sprites and colormaps.
import { W_CacheLumpName, W_CacheLumpNum, W_CheckNumForName, W_GetNumForName, W_LumpLength } from './w_wad';
import { V_PatchHeader } from './v_video';
import { FRACBITS } from './m_fixed.h';
import { I_Error } from './i_system';
import type { sector_t, side_t, spritedef_t } from './r_defs.h';
export interface texpatch_t { originx: number; originy: number; patch: number }
export interface texture_t { name: string; width: number; height: number; patchcount: number; patches: texpatch_t[] }
export const texturestate = {
    firstflat: 0, lastflat: -1, numflats: 0, firstpatch: 0, lastpatch: 0, numpatches: 0,
    firstspritelump: 0, lastspritelump: -1, numspritelumps: 0, numtextures: 0,
    textures: [] as texture_t[], texturewidthmask: new Int32Array(0), textureheight: new Int32Array(0),
    texturecompositesize: new Int32Array(0), texturecolumnlump: [] as Int16Array[], texturecolumnofs: [] as Uint16Array[],
    texturecomposite: [] as (Uint8Array | null)[], flattranslation: new Int32Array(0), texturetranslation: new Int32Array(0),
    spritewidth: new Int32Array(0), spriteoffset: new Int32Array(0), spritetopoffset: new Int32Array(0),
    colormaps: new Uint8Array(0), flatmemory: 0, texturememory: 0, spritememory: 0,
};
function view(data: Uint8Array): DataView { return new DataView(data.buffer, data.byteOffset, data.byteLength); }
function nameAt(data: Uint8Array, offset: number): string { return new TextDecoder('ascii').decode(data.subarray(offset, offset + 8)).split('\0')[0]; }
function textureAt(texnum: number): texture_t {
    if (!Number.isInteger(texnum) || texnum < 0 || texnum >= texturestate.numtextures) I_Error('Invalid texture %i', texnum);
    return texturestate.textures[texnum];
}
function columnOffset(patch: Uint8Array, col: number): number {
    const h = V_PatchHeader(patch);
    if (col < 0 || col >= h.width) I_Error('Invalid patch column');
    const offset = view(patch).getUint32(8 + col * 4, true);
    if (offset >= patch.length) I_Error('Patch column outside lump');
    return offset;
}
export function R_DrawColumnInCache(patch: Uint8Array, cache: Uint8Array, originy: number, cacheheight: number): void {
    let offset = 0;
    while (true) {
        if (offset >= patch.length) I_Error('Truncated texture column');
        if (patch[offset] === 255) break;
        if (offset + 4 > patch.length) I_Error('Truncated texture post');
        const length = patch[offset + 1];
        if (offset + length + 4 > patch.length) I_Error('Truncated texture pixels');
        let count = length, position = originy + patch[offset];
        if (position < 0) { count += position; position = 0; }
        if (position + count > cacheheight) count = cacheheight - position;
        // Preserve upstream clipping: a negative origin reduces count without advancing source.
        if (count > 0) cache.set(patch.subarray(offset + 3, offset + 3 + count), position);
        offset += length + 4;
    }
}
export function R_GenerateComposite(texnum: number): void {
    const texture = textureAt(texnum), block = new Uint8Array(texturestate.texturecompositesize[texnum]);
    const collump = texturestate.texturecolumnlump[texnum], colofs = texturestate.texturecolumnofs[texnum];
    for (const patch of texture.patches) {
        const realpatch = W_CacheLumpNum(patch.patch, 101), h = V_PatchHeader(realpatch);
        const x1 = patch.originx, x2 = Math.min(x1 + h.width, texture.width);
        for (let x = Math.max(0, x1); x < x2; x++) {
            if (collump[x] >= 0) continue;
            R_DrawColumnInCache(realpatch.subarray(columnOffset(realpatch, x - x1)), block.subarray(colofs[x], colofs[x] + texture.height), patch.originy, texture.height);
        }
    }
    texturestate.texturecomposite[texnum] = block;
}
export function R_GenerateLookup(texnum: number): void {
    const texture = textureAt(texnum), patchcount = new Uint8Array(texture.width);
    const collump = texturestate.texturecolumnlump[texnum], colofs = texturestate.texturecolumnofs[texnum];
    texturestate.texturecomposite[texnum] = null; texturestate.texturecompositesize[texnum] = 0;
    for (const patch of texture.patches) {
        const realpatch = W_CacheLumpNum(patch.patch, 101), h = V_PatchHeader(realpatch);
        const x1 = patch.originx, x2 = Math.min(x1 + h.width, texture.width);
        for (let x = Math.max(0, x1); x < x2; x++) {
            patchcount[x]++; collump[x] = patch.patch;
            const ofs = columnOffset(realpatch, x - x1) + 3;
            if (ofs > 65535) I_Error('Patch column offset exceeds classic 16-bit limit');
            colofs[x] = ofs;
        }
    }
    for (let x = 0; x < texture.width; x++) {
        if (!patchcount[x]) I_Error('R_GenerateLookup: column without a patch (%s)', texture.name);
        if (patchcount[x] > 1) {
            collump[x] = -1; colofs[x] = texturestate.texturecompositesize[texnum];
            if (texturestate.texturecompositesize[texnum] > 0x10000 - texture.height) I_Error('R_GenerateLookup: texture %i is >64k', texnum);
            texturestate.texturecompositesize[texnum] += texture.height;
        }
    }
}
export function R_GetColumn(tex: number, col: number): Uint8Array {
    const texture = textureAt(tex);
    col &= texturestate.texturewidthmask[tex];
    const lump = texturestate.texturecolumnlump[tex][col], ofs = texturestate.texturecolumnofs[tex][col];
    // Upstream uses >0; include valid lump 0 rather than dereference an absent composite.
    if (lump >= 0) {
        const bytes = W_CacheLumpNum(lump, 101);
        if (ofs >= bytes.length) I_Error('Texture column outside patch');
        return bytes.subarray(ofs); // May span posts: callers retain the original C pointer convention.
    }
    if (!texturestate.texturecomposite[tex]) R_GenerateComposite(tex);
    return texturestate.texturecomposite[tex]!.subarray(ofs, ofs + texture.height);
}
export function R_InitTextures(): void {
    const pnames = W_CacheLumpName('PNAMES', 1);
    if (pnames.length < 4) I_Error('Truncated PNAMES');
    const count = view(pnames).getInt32(0, true);
    if (count < 0 || 4 + count * 8 > pnames.length) I_Error('Invalid PNAMES directory');
    const lookup = Array.from({ length: count }, (_, i) => W_CheckNumForName(nameAt(pnames, 4 + i * 8)));
    const textures: texture_t[] = [];
    for (const name of ['TEXTURE1', 'TEXTURE2']) {
        if (name === 'TEXTURE2' && W_CheckNumForName(name) < 0) continue;
        const data = W_CacheLumpName(name, 1), v = view(data);
        if (data.length < 4) I_Error('Truncated %s', name);
        const num = v.getInt32(0, true);
        if (num < 0 || 4 + num * 4 > data.length) I_Error('R_InitTextures: bad texture directory');
        for (let i = 0; i < num; i++) {
            const offset = v.getInt32(4 + i * 4, true);
            if (offset < 0 || offset + 22 > data.length) I_Error('R_InitTextures: bad texture directory');
            const width = v.getInt16(offset + 12, true), height = v.getInt16(offset + 14, true), patchcount = v.getInt16(offset + 20, true);
            if (width <= 0 || height <= 0 || patchcount <= 0 || offset + 22 + patchcount * 10 > data.length) I_Error('Invalid texture definition');
            const texture: texture_t = { name: nameAt(data, offset), width, height, patchcount, patches: [] };
            for (let j = 0; j < patchcount; j++) {
                const p = offset + 22 + j * 10, patchIndex = v.getInt16(p + 4, true);
                if (patchIndex < 0 || patchIndex >= lookup.length || lookup[patchIndex] < 0) I_Error('R_InitTextures: Missing patch in texture %s', texture.name);
                if (lookup[patchIndex] > 32767) I_Error('Patch lump exceeds classic signed 16-bit limit');
                texture.patches.push({ originx: v.getInt16(p, true), originy: v.getInt16(p + 2, true), patch: lookup[patchIndex] });
            }
            textures.push(texture);
        }
    }
    texturestate.numtextures = textures.length; texturestate.textures = textures;
    texturestate.texturewidthmask = new Int32Array(textures.length); texturestate.textureheight = new Int32Array(textures.length);
    texturestate.texturecompositesize = new Int32Array(textures.length);
    texturestate.texturecolumnlump = textures.map(t => new Int16Array(t.width));
    texturestate.texturecolumnofs = textures.map(t => new Uint16Array(t.width));
    texturestate.texturecomposite = textures.map(() => null);
    textures.forEach((t, i) => {
        let j = 1; while (j * 2 <= t.width) j <<= 1;
        texturestate.texturewidthmask[i] = j - 1; texturestate.textureheight[i] = t.height << FRACBITS;
        R_GenerateLookup(i);
    });
    texturestate.texturetranslation = Int32Array.from({ length: textures.length + 1 }, (_, i) => i < textures.length ? i : 0);
}
export function R_InitFlats(): void {
    texturestate.firstflat = W_GetNumForName('F_START') + 1; texturestate.lastflat = W_GetNumForName('F_END') - 1;
    texturestate.numflats = texturestate.lastflat - texturestate.firstflat + 1;
    if (texturestate.numflats < 0) I_Error('Invalid flat marker order');
    texturestate.flattranslation = Int32Array.from({ length: texturestate.numflats + 1 }, (_, i) => i < texturestate.numflats ? i : 0);
}
export function R_InitSpriteLumps(): void {
    texturestate.firstspritelump = W_GetNumForName('S_START') + 1; texturestate.lastspritelump = W_GetNumForName('S_END') - 1;
    texturestate.numspritelumps = texturestate.lastspritelump - texturestate.firstspritelump + 1;
    if (texturestate.numspritelumps < 0) I_Error('Invalid sprite marker order');
    texturestate.spritewidth = new Int32Array(texturestate.numspritelumps);
    texturestate.spriteoffset = new Int32Array(texturestate.numspritelumps); texturestate.spritetopoffset = new Int32Array(texturestate.numspritelumps);
    for (let i = 0; i < texturestate.numspritelumps; i++) {
        const patch = V_PatchHeader(W_CacheLumpNum(texturestate.firstspritelump + i, 101));
        texturestate.spritewidth[i] = patch.width << FRACBITS; texturestate.spriteoffset[i] = patch.leftoffset << FRACBITS;
        texturestate.spritetopoffset[i] = patch.topoffset << FRACBITS;
    }
}
export function R_InitColormaps(): void {
    const data = W_CacheLumpName('COLORMAP', 1);
    if (data.length < 32 * 256 || data.length % 256) I_Error('Invalid COLORMAP light tables');
    texturestate.colormaps = data.slice(); // Typed arrays need no manual pointer alignment.
}
export function R_InitData(): void {
    const previous = { ...texturestate };
    try { R_InitTextures(); R_InitFlats(); R_InitSpriteLumps(); R_InitColormaps(); }
    catch (error) { Object.assign(texturestate, previous); throw error; }
}
export function R_FlatNumForName(name: string): number {
    const i = W_CheckNumForName(name);
    if (i < 0) I_Error('R_FlatNumForName: %s not found', name);
    return i - texturestate.firstflat;
}
export function R_CheckTextureNumForName(name: string): number {
    if (name[0] === '-') return 0;
    return texturestate.textures.findIndex(t => t.name.toUpperCase() === name.slice(0, 8).toUpperCase());
}
export function R_TextureNumForName(name: string): number {
    const i = R_CheckTextureNumForName(name);
    if (i < 0) I_Error('R_TextureNumForName: %s not found', name);
    return i;
}
// The original walks P_MobjThinker instances. The caller supplies the same active sprite IDs
// until p_mobj.c and r_things.c provide their live thinker/sprite tables.
export interface PrecacheContext { demoplayback: boolean; sectors: readonly sector_t[]; sides: readonly side_t[]; skytexture: number; activeSprites: readonly number[]; sprites: readonly spritedef_t[] }
export function R_PrecacheLevel(context: PrecacheContext): void {
    if (context.demoplayback) return;
    const flats = new Uint8Array(texturestate.numflats), textures = new Uint8Array(texturestate.numtextures);
    for (const sector of context.sectors) { flats[sector.floorpic] = 1; flats[sector.ceilingpic] = 1; }
    texturestate.flatmemory = texturestate.texturememory = texturestate.spritememory = 0;
    for (let i = 0; i < flats.length; i++) if (flats[i]) {
        const lump = texturestate.firstflat + i; texturestate.flatmemory += W_LumpLength(lump); W_CacheLumpNum(lump, 101);
    }
    for (const side of context.sides) { textures[side.toptexture] = 1; textures[side.midtexture] = 1; textures[side.bottomtexture] = 1; }
    textures[context.skytexture] = 1;
    for (let i = 0; i < textures.length; i++) if (textures[i]) for (const patch of texturestate.textures[i].patches) {
        texturestate.texturememory += W_LumpLength(patch.patch); W_CacheLumpNum(patch.patch, 101);
    }
    for (const sprite of [...new Set(context.activeSprites)].sort((a, b) => a - b)) {
        const definition = context.sprites[sprite]; if (!definition) I_Error('Invalid sprite in precache');
        for (const frame of definition.spriteframes) for (const offset of frame.lump) {
            const lump = texturestate.firstspritelump + offset; texturestate.spritememory += W_LumpLength(lump); W_CacheLumpNum(lump, 101);
        }
    }
}
