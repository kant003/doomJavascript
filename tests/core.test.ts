import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FixedMul, FixedDiv, FixedDiv2 } from '../src/linuxdoom-1.10/m_fixed';
import { FRACUNIT } from '../src/linuxdoom-1.10/m_fixed.h';
import { M_ClearRandom, M_Random, P_Random, rndtable } from '../src/linuxdoom-1.10/m_random';
import { finesine, finetangent, tantoangle, finecosine, SlopeDiv } from '../src/linuxdoom-1.10/tables';
import { M_SetArgv, M_CheckParm } from '../src/linuxdoom-1.10/m_argv';
import { SwapSHORT, SwapLONG } from '../src/linuxdoom-1.10/m_swap';
import { SCRAMBLE } from '../src/linuxdoom-1.10/m_cheat.h';
import { cht_CheckCheat, cht_GetParam } from '../src/linuxdoom-1.10/m_cheat';
import { W_InitFile, W_InitMultipleFiles, W_CacheLumpName, W_CacheLumpNum, W_GetNumForName, W_CheckNumForName, W_ReadLump, W_Reload, W_LumpLength, W_NumLumps } from '../src/linuxdoom-1.10/w_wad';
import { V_Init, V_DrawPatch, V_DrawPatchFlipped, V_DrawBlock, V_GetBlock, V_CopyRect, screens, gammatable } from '../src/linuxdoom-1.10/v_video';
import { draw, R_InitBuffer, R_DrawColumn, R_DrawSpan, R_InitTranslationTables } from '../src/linuxdoom-1.10/r_draw';
import { wipe_StartScreen, wipe_EndScreen, wipe_ScreenWipe } from '../src/linuxdoom-1.10/f_wipe';
import { weaponinfo } from '../src/linuxdoom-1.10/d_items';
import { weapontype_t, ammotype_t } from '../src/linuxdoom-1.10/doomdef.h';
import { statenum_t } from '../src/linuxdoom-1.10/info.h';
import { demoWad, makeWad } from '../src/web/demo';
import { listMaps, loadMapPreview, drawMapPreview } from '../src/web/map-preview';

test('Fixed point preserves negative floor, truncation, saturation and multiplication overflow', () => {
    assert.equal(FixedMul(FRACUNIT, FRACUNIT), FRACUNIT);
    assert.equal(FixedMul(-1, 1), -1);
    assert.equal(FixedMul(2147483647, 2147483647), -65536);
    assert.equal(FixedDiv(3 * FRACUNIT, 2 * FRACUNIT), FRACUNIT * 1.5);
    assert.equal(FixedDiv2(-1, 3), -21845);
    assert.equal(FixedDiv(1, 0), 2147483647);
    assert.equal(FixedDiv(-1, 0), -2147483648);
    assert.equal(FixedDiv(-2147483648, 1), -2147483648);
    assert.throws(() => FixedDiv2(1, 0)); assert.throws(() => FixedDiv2(0, 0));
});
test('Every trig and RNG table entry equals upstream source literals', () => {
    const original = readFileSync('original/linuxdoom-1.10/tables.c', 'utf8');
    for (const [name, table] of [['finesine', finesine], ['finetangent', finetangent], ['tantoangle', tantoangle]] as const) {
        const match = original.match(new RegExp('\\b' + name + '\\[[^\\]\\n]+\\]\\s*=\\s*\\{([\\s\\S]*?)\\};'))!;
        const values = match[1].match(/-?\d+/g)!.map(Number);
        assert.equal(table.length, values.length, name);
        values.forEach((value, i) => assert.equal(table[i], value, `${name}[${i}]`));
    }
    assert.equal(finesine.length, 10240); assert.equal(finetangent.length, 4096); assert.equal(tantoangle.length, 2049);
    assert.equal(finecosine[0], finesine[2048]); assert.equal(finecosine.buffer, finesine.buffer);
    const random = readFileSync('original/linuxdoom-1.10/m_random.c', 'utf8').match(/rndtable\[256\]\s*=\s*\{([\s\S]*?)\};/)![1];
    assert.deepEqual([...rndtable], random.match(/\d+/g)!.map(Number));
});
test('All five gamma tables equal original literal values', () => {
    const body = readFileSync('original/linuxdoom-1.10/v_video.c', 'utf8').match(/gammatable\[5\]\[256\]\s*=\s*\{([\s\S]*?)\};/)![1];
    const rows = [...body.matchAll(/\{([^{}]+)\}/g)].map(m => m[1].match(/\d+/g)!.map(Number));
    assert.deepEqual(gammatable.map(row => [...row]), rows);
});
test('Gameplay and cosmetic RNG streams advance independently and wrap after 256 values', () => {
    M_ClearRandom(); assert.equal(M_Random(), 8); assert.equal(M_Random(), 109); assert.equal(P_Random(), 8);
    M_ClearRandom(); for (let i = 0; i < 256; i++) M_Random(); assert.equal(M_Random(), 8);
});
test('Unsigned SlopeDiv, byte swapping and command-line search', () => {
    assert.equal(SlopeDiv(0,511),2048); assert.equal(SlopeDiv(512,1024),1024); assert.equal(SlopeDiv(0xffffffff,512),2048);
    assert.equal(SwapSHORT(0x1234),0x3412); assert.equal(SwapLONG(0x89abcdef),0xefcdab89);
    M_SetArgv(['doom','-FILE','test.wad','-skill','3']); assert.equal(M_CheckParm('-file'),1); assert.equal(M_CheckParm('-warp'),0);
});
test('Cheat codes preserve scrambling, mismatch reset and mutable parameters', () => {
    const sequence = new Uint8Array([...Array.from('idclev', c => SCRAMBLE(c.charCodeAt(0))), 1, 0, 0, 255]);
    const cheat = { sequence, p: null as number | null };
    assert.equal(cht_CheckCheat(cheat, 'x'.charCodeAt(0)),0);
    const results = Array.from('idclev12', c => cht_CheckCheat(cheat,c.charCodeAt(0)));
    assert.equal(results.at(-1),1); assert.equal(results.slice(0,-1).every(r=>r===0),true);
    const buffer = new Uint8Array(3); cht_GetParam(cheat,buffer); assert.deepEqual([...buffer],[49,50,0]);
    assert.deepEqual([...sequence.slice(-3)],[0,0,255]);
});
function wad(name: string, values: number[]): { name: string; data: Uint8Array } {
    return { name: 'fixture.wad', data: makeWad([{ name, data: new Uint8Array(values) }]) };
}
test('WAD lookup is case-insensitive, truncated to 8 chars, and later PWADs override earlier lumps', () => {
    W_InitMultipleFiles([wad('TEXTURE1',[1,2]),wad('TEXTURE1',[3,4,5])]);
    assert.equal(W_NumLumps(),2); assert.equal(W_CheckNumForName('texture1too-long'),1);
    assert.deepEqual([...W_CacheLumpName('texture1',1)],[3,4,5]); assert.equal(W_LumpLength(0),2);
    assert.equal(W_CheckNumForName('missing'),-1); assert.throws(()=>W_GetNumForName('missing'));
    assert.strictEqual(W_CacheLumpNum(1,1),W_CacheLumpNum(1,101));
});
test('WAD validation rejects corrupt directories, lumps, indexes and small destinations', () => {
    W_InitFile(wad('GOOD',[42]));
    const bad = wad('BAD',[1]); new DataView(bad.data.buffer).setInt32(8,2147483647,true);
    assert.throws(()=>W_InitFile(bad),/directory/); assert.equal(W_CacheLumpName('GOOD',1)[0],42);
    assert.throws(()=>W_InitFile({ name: 'bad.wad', data: new Uint8Array(4) }),/header/);
    const invalid = wad('BAD',[1]); const v = new DataView(invalid.data.buffer); v.setInt32(v.getInt32(8,true)+4,99999,true);
    assert.throws(()=>W_InitFile(invalid),/Invalid lump/);
    assert.throws(()=>W_LumpLength(-1)); assert.throws(()=>W_LumpLength(1)); assert.throws(()=>W_ReadLump(0,new Uint8Array()));
    assert.throws(()=>W_InitMultipleFiles([]),/no files/);
});
test('Zero-sized marker lumps and single-lump files work', () => {
    W_InitMultipleFiles([{ name: 'levels.wad', data: makeWad([{ name:'E1M1',data:new Uint8Array() }]) }, { name: '/path/raw.lmp', data: new Uint8Array([8,9]) }]);
    assert.equal(W_LumpLength(0),0); assert.deepEqual([...W_CacheLumpName('RAW',1)],[8,9]);
});
test('WAD reload invalidates a cached file and rejects changed directory names', () => {
    W_InitFile(wad('FIRST',[1])); const before = W_CacheLumpName('FIRST',1);
    W_Reload(wad('FIRST',[2,3])); assert.deepEqual([...W_CacheLumpName('FIRST',1)],[2,3]); assert.notStrictEqual(before,W_CacheLumpName('FIRST',1));
    assert.throws(()=>W_Reload(wad('OTHER',[4])),/changed directory/);
});
function smallPatch(): Uint8Array {
    const bytes = new Uint8Array(30), v = new DataView(bytes.buffer);
    v.setInt16(0,2,true);v.setInt16(2,2,true);v.setUint32(8,16,true);v.setUint32(12,23,true);
    bytes.set([0,2,0,10,20,0,255],16);bytes.set([0,2,0,30,40,0,255],23);return bytes;
}
test('Patch rendering handles post columns, transparency and horizontal flip', () => {
    V_Init(); screens[0].fill(7); const patch = smallPatch();
    V_DrawPatch(5,6,0,patch);
    assert.deepEqual([screens[0][6*320+5],screens[0][7*320+5],screens[0][6*320+6],screens[0][7*320+6]],[10,20,30,40]);
    assert.equal(screens[0][6*320+4],7);
    V_DrawPatchFlipped(5,6,0,patch); assert.deepEqual([screens[0][6*320+5],screens[0][6*320+6]],[30,10]);
});
test('Malformed patches fail before writing and block copies preserve row stride', () => {
    V_Init(); const patch = smallPatch();patch[23]=200;assert.throws(()=>V_DrawPatch(0,0,0,patch),/Invalid patch post/);assert.equal(screens[0].some(Boolean),false);
    V_DrawBlock(10,11,0,2,2,new Uint8Array([1,2,3,4]));
    const dest = new Uint8Array(4);V_GetBlock(10,11,0,2,2,dest);assert.deepEqual([...dest],[1,2,3,4]);
    V_CopyRect(10,11,0,2,2,20,21,1);V_GetBlock(20,21,1,2,2,dest);assert.deepEqual([...dest],[1,2,3,4]);
    assert.throws(()=>V_DrawBlock(-1,0,0,1,1,new Uint8Array(1)));
});
test('Column and floor-span primitives write expected texture samples at view offsets', () => {
    V_Init(); R_InitBuffer(320,200); draw.centery=0;
    draw.dc_colormap=Uint8Array.from({length:256},(_,i)=>i);draw.dc_source=Uint8Array.from({length:128},(_,i)=>i);
    Object.assign(draw,{dc_x:2,dc_yl:0,dc_yh:3,dc_texturemid:0,dc_iscale:FRACUNIT});R_DrawColumn();
    assert.deepEqual([screens[0][2],screens[0][322],screens[0][642],screens[0][962]],[0,1,2,3]);
    draw.ds_colormap=draw.dc_colormap;draw.ds_source=Uint8Array.from({length:4096},(_,i)=>i&255);
    Object.assign(draw,{ds_y:10,ds_x1:4,ds_x2:7,ds_xfrac:0,ds_yfrac:0,ds_xstep:FRACUNIT,ds_ystep:0});R_DrawSpan();
    assert.deepEqual([...screens[0].slice(3204,3208)],[0,1,2,3]);
    R_InitTranslationTables();assert.equal(draw.translationtables[0x72],0x62);assert.equal(draw.translationtables[0x72+256],0x42);assert.equal(draw.translationtables[0x72+512],0x22);
});
test('Melt completes with exactly the target frame after delayed columns', () => {
    V_Init();M_ClearRandom();screens[0].fill(12);wipe_StartScreen(0,0,320,200);
    const target=Uint8Array.from({length:64000},(_,i)=>i&255);screens[0].set(target);wipe_EndScreen(0,0,320,200);
    let done=false, frames=0;while(!done && frames++<200) done=wipe_ScreenWipe(1,0,0,320,200,1);
    assert.equal(done,true);assert.ok(frames>20);assert.deepEqual(screens[0],target);
});
test('Weapon data retains original ammo and state indexes', () => {
    assert.equal(weaponinfo.length,9);assert.equal(weaponinfo[weapontype_t.wp_pistol].ammo,ammotype_t.am_clip);
    assert.equal(weaponinfo[weapontype_t.wp_pistol].atkstate,statenum_t.S_PISTOL1);
    assert.equal(weaponinfo[weapontype_t.wp_supershotgun].ammo,ammotype_t.am_shell);
});
test('Synthetic WAD exercises title, geometry loading and preview without commercial data', () => {
    W_InitFile({name:'demo.wad',data:demoWad()});V_Init();
    assert.equal(W_CacheLumpName('PLAYPAL',1).length,768);V_DrawPatch(0,0,0,W_CacheLumpName('TITLEPIC',1));
    assert.ok(screens[0].some(Boolean));const maps=listMaps();assert.equal(maps.length,1);
    const map=loadMapPreview(maps[0].index);assert.equal(map.vertices.length,4);assert.equal(map.lines.length,4);
    drawMapPreview(map);assert.ok(screens[0].some(b=>b===176));
});
