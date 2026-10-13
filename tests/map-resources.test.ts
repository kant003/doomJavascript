import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoWad, makeWad } from '../src/web/demo';
import { W_InitFile, W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData, R_InitTextures, R_GetColumn, R_CheckTextureNumForName, R_TextureNumForName, R_FlatNumForName, R_DrawColumnInCache, R_PrecacheLevel, texturestate as t } from '../src/linuxdoom-1.10/r_data';
import { P_LoadMapData, P_LoadThings } from '../src/linuxdoom-1.10/p_setup';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { R_PointInSubsector, R_PointOnSide, R_PointOnSegSide } from '../src/linuxdoom-1.10/r_main';
import { FRACUNIT } from '../src/linuxdoom-1.10/m_fixed.h';
import { GameMode_t } from '../src/linuxdoom-1.10/doomdef.h';
import { NF_SUBSECTOR, ML_TWOSIDED } from '../src/linuxdoom-1.10/doomdata.h';
import { slopetype_t } from '../src/linuxdoom-1.10/r_defs.h';
import { V_Init, screens } from '../src/linuxdoom-1.10/v_video';
import { R_InitBuffer, R_DrawColumn, draw } from '../src/linuxdoom-1.10/r_draw';

function init(): void { W_InitFile({ name:'demo.wad',data:demoWad() });R_InitData(); }
function unpack(data: Uint8Array): {name:string;data:Uint8Array}[] {
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength), count=v.getInt32(4,true), directory=v.getInt32(8,true);
    return Array.from({length:count},(_,i)=>{
        const p=directory+i*16,start=v.getInt32(p,true),length=v.getInt32(p+4,true);
        return {name:new TextDecoder().decode(data.subarray(p+8,p+16)).split('\0')[0],data:data.slice(start,start+length)};
    });
}
function modify(name:string, action:(data:Uint8Array)=>Uint8Array): Uint8Array {
    return makeWad(unpack(demoWad()).map(l=>l.name===name?{...l,data:action(l.data)}:l));
}
function patch(values:number[],width=1):Uint8Array {
    const height=values.length/width, bytes=new Uint8Array(8+width*4+width*(height+5)),v=new DataView(bytes.buffer);
    v.setInt16(0,width,true);v.setInt16(2,height,true);
    for(let x=0;x<width;x++){
        const p=8+width*4+x*(height+5);v.setUint32(8+x*4,p,true);bytes[p+1]=height;
        for(let y=0;y<height;y++) bytes[p+3+y]=values[y*width+x];bytes[p+height+4]=255;
    }
    return bytes;
}
function texture(name:string,width:number,height:number,patches:{index:number;y:number;x?:number}[]):Uint8Array {
    const data=new Uint8Array(8+22+patches.length*10),v=new DataView(data.buffer);
    v.setInt32(0,1,true);v.setInt32(4,8,true);data.set(new TextEncoder().encode(name),8);
    v.setInt16(20,width,true);v.setInt16(22,height,true);v.setInt16(28,patches.length,true);
    patches.forEach((p,i)=>{v.setInt16(30+i*10,p.x??0,true);v.setInt16(32+i*10,p.y,true);v.setInt16(34+i*10,p.index,true);});return data;
}
function pnames(names:string[]):Uint8Array {
    const data=new Uint8Array(4+names.length*8);new DataView(data.buffer).setInt32(0,names.length,true);
    names.forEach((n,i)=>data.set(new TextEncoder().encode(n),4+i*8));return data;
}
test('Render resources initialize original identity translations, dimensions and names',()=>{
    init();assert.equal(t.numtextures,2);assert.equal(t.numflats,1);assert.equal(t.numspritelumps,1);
    assert.equal(t.textureheight[0],128*FRACUNIT);assert.equal(t.texturewidthmask[0],127);
    assert.equal(R_CheckTextureNumForName('testwall'),1);assert.equal(R_CheckTextureNumForName('-'),0);
    assert.throws(()=>R_TextureNumForName('MISSING'));assert.equal(R_FlatNumForName('TESTFLAT'),0);
    assert.deepEqual([...t.texturetranslation],[0,1,0]);assert.deepEqual([...t.flattranslation],[0,0]);
    assert.equal(t.colormaps.length,34*256);assert.equal(R_GetColumn(0,128)[0],R_GetColumn(0,0)[0]);
});
test('Single patch at lump zero is retrievable and non-power-of-two widths preserve original mask',()=>{
    W_InitFile({name:'tex.wad',data:makeWad([{name:'PATCHA',data:patch([1,2,3],3)},{name:'PNAMES',data:pnames(['PATCHA'])},
        {name:'TEXTURE1',data:texture('THREE',3,1,[{index:0,y:0}])}])});R_InitTextures();
    assert.equal(t.texturecolumnlump[0][0],0);assert.equal(R_GetColumn(0,0)[0],1);assert.equal(t.texturewidthmask[0],1);
    assert.equal(R_GetColumn(0,2)[0],1);assert.equal(R_GetColumn(0,-1)[0],2);
});
test('Composite columns overlay patches in order and honor vertical origins',()=>{
    W_InitFile({name:'tex.wad',data:makeWad([{name:'PATCHA',data:patch([10,20,30,40])},{name:'PATCHB',data:patch([50,60,70,80])},
        {name:'PNAMES',data:pnames(['PATCHA','PATCHB'])},{name:'TEXTURE1',data:texture('STACK',1,4,[{index:0,y:0},{index:1,y:1}])}])});R_InitTextures();
    assert.equal(t.texturecolumnlump[0][0],-1);assert.equal(t.texturecompositesize[0],4);assert.equal(t.texturecomposite[0],null);
    assert.deepEqual([...R_GetColumn(0,0)],[10,50,60,70]);assert.notEqual(t.texturecomposite[0],null);
});
test('Composite top clipping preserves original C source pointer behavior',()=>{
    const output=new Uint8Array(4);R_DrawColumnInCache(patch([50,60,70,80]).subarray(12),output,-1,4);
    assert.deepEqual([...output],[50,60,70,0]);
});
test('Texture validation rejects missing patches, empty columns and corrupt directories',()=>{
    W_InitFile({name:'bad.wad',data:makeWad([{name:'PNAMES',data:pnames(['MISSING'])},{name:'TEXTURE1',data:texture('BROKEN',1,4,[{index:0,y:0}])}])});
    assert.throws(()=>R_InitTextures(),/Missing patch/);
    W_InitFile({name:'bad.wad',data:makeWad([{name:'PATCHA',data:patch([1])},{name:'PNAMES',data:pnames(['PATCHA'])},
        {name:'TEXTURE1',data:texture('HOLE',2,1,[{index:0,y:0}])}])});assert.throws(()=>R_InitTextures(),/column without a patch/);
    init();const previous=t.textures;
    W_InitFile({name:'bad.wad',data:modify('TEXTURE1',data=>{new DataView(data.buffer).setInt32(4,2147483647,true);return data;})});
    assert.throws(()=>R_InitData(),/bad texture directory/);assert.strictEqual(t.textures,previous);
});
test('Complete map readers scale signed coordinates and retain reference identity',()=>{
    init();const level=P_LoadMapData(W_GetNumForName('E1M1'));
    assert.equal(level.numvertexes,4);assert.equal(level.numsegs,4);assert.equal(level.numsectors,1);assert.equal(level.numsubsectors,1);
    assert.equal(level.vertexes[0].x,-128*FRACUNIT);assert.equal(level.sectors[0].ceilingheight,128*FRACUNIT);
    assert.strictEqual(level.lines[0].v1,level.vertexes[1]);assert.strictEqual(level.segs[0].linedef,level.lines[0]);
    assert.strictEqual(level.segs[0].sidedef,level.sides[0]);assert.strictEqual(level.sides[0].sector,level.sectors[0]);
    assert.strictEqual(level.subsectors[0].sector,level.sectors[0]);assert.equal(level.lines[0].slopetype,slopetype_t.ST_HORIZONTAL);
    assert.equal(level.sectors[0].linecount,4);assert.equal(level.sectors[0].soundorg.x,0);assert.equal(level.sectors[0].soundorg.y,0);
    assert.deepEqual([...level.sectors[0].blockbox],[1,0,0,1]);assert.deepEqual([...level.blockmaplump],[-128,-128,2,2,8,8,8,8,0,0,1,2,3,-1]);
    assert.equal(level.blocklinks.length,4);assert.strictEqual(R_PointInSubsector(0,0),level.subsectors[0]);
    assert.strictEqual(level.blockmap.buffer,level.blockmaplump.buffer);
});
test('Two-sided lines sharing one sector are grouped once',()=>{
    init();W_InitFile({name:'twosided.wad',data:modify('LINEDEFS',data=>{const v=new DataView(data.buffer);v.setInt16(4,ML_TWOSIDED,true);v.setInt16(12,0,true);return data;})});
    const level=P_LoadMapData(W_GetNumForName('E1M1'));
    assert.strictEqual(level.segs[0].frontsector,level.segs[0].backsector);assert.equal(level.sectors[0].linecount,4);
});
test('Bad cross-lump indexes, missing reject bits and block list terminators fail atomically',()=>{
    for(const [name,mutate,pattern] of [
        ['LINEDEFS',(data:Uint8Array)=>{new DataView(data.buffer).setInt16(0,100,true);return data;},/LINEDEFS vertex/],
        ['REJECT',()=>new Uint8Array(),/REJECT/],
        ['BLOCKMAP',(data:Uint8Array)=>{new DataView(data.buffer).setInt16(26,0,true);return data;},/terminator/],
        ['SEGS',(data:Uint8Array)=>{new DataView(data.buffer).setInt16(8,2,true);return data;},/side must/],
    ] as const){
        init();P_LoadMapData(W_GetNumForName('E1M1'));const previous=m.lines;
        W_InitFile({name:'bad.wad',data:modify(name,mutate)});assert.throws(()=>P_LoadMapData(W_GetNumForName('E1M1')),pattern);
        assert.strictEqual(m.lines,previous);
    }
});
function twoLeaves(cyclic=false):Uint8Array {
    const lumps=unpack(demoWad());lumps.find(l=>l.name==='SSECTORS')!.data=new Uint8Array([4,0,0,0,4,0,0,0]);
    const nodes=new Uint8Array(28),v=new DataView(nodes.buffer);v.setInt16(6,256,true);
    v.setUint16(24,cyclic?0:NF_SUBSECTOR,true);v.setUint16(26,NF_SUBSECTOR|1,true);lumps.find(l=>l.name==='NODES')!.data=nodes;return makeWad(lumps);
}
test('Original BSP classification traverses the root to the correct leaf',()=>{
    init();W_InitFile({name:'bsp.wad',data:twoLeaves()});P_LoadMapData(W_GetNumForName('E1M1'));
    assert.strictEqual(R_PointInSubsector(64*FRACUNIT,0),m.subsectors[0]);assert.strictEqual(R_PointInSubsector(-64*FRACUNIT,0),m.subsectors[1]);
    assert.equal(R_PointOnSide(0,0,m.nodes[0]),1);assert.equal(R_PointOnSegSide(0,0,m.segs[0]),0);
});
test('Cyclic BSP and out-of-range leaves are rejected before traversal',()=>{
    init();W_InitFile({name:'cyclic.wad',data:twoLeaves(true)});assert.throws(()=>P_LoadMapData(W_GetNumForName('E1M1')),/Cyclic BSP/);
    const lumps=unpack(twoLeaves());const node=lumps.find(l=>l.name==='NODES')!;new DataView(node.data.buffer).setUint16(24,NF_SUBSECTOR|5,true);
    W_InitFile({name:'bad.wad',data:makeWad(lumps)});assert.throws(()=>P_LoadMapData(W_GetNumForName('E1M1')),/NODES subsector/);
});
test('Thing loading preserves the original DOOM I break at a DOOM II monster',()=>{
    init();const things=new Uint8Array(30),v=new DataView(things.buffer);[1,68,2].forEach((type,i)=>v.setInt16(i*10+6,type,true));
    W_InitFile({name:'things.wad',data:modify('THINGS',()=>things)});
    const spawned:number[]=[];P_LoadThings(W_GetNumForName('THINGS'),GameMode_t.shareware,thing=>spawned.push(thing.type));assert.deepEqual(spawned,[1]);
    spawned.length=0;P_LoadThings(W_GetNumForName('THINGS'),GameMode_t.commercial,thing=>spawned.push(thing.type));assert.deepEqual(spawned,[1,68,2]);
});
test('Precache accounts for flats and texture patches; demo playback returns immediately',()=>{
    init();const level=P_LoadMapData(W_GetNumForName('E1M1'));
    const context={demoplayback:false,sectors:level.sectors,sides:level.sides,skytexture:0,activeSprites:[],sprites:[]};
    R_PrecacheLevel(context);assert.equal(t.flatmemory,4096);assert.ok(t.texturememory>128*128);
    t.flatmemory=123;R_PrecacheLevel({...context,demoplayback:true});assert.equal(t.flatmemory,123);
});
test('Resources connect to original column drawing and light map bytes',()=>{
    init();V_Init();R_InitBuffer(320,200);draw.centery=0;draw.dc_colormap=t.colormaps.subarray(0,256);
    draw.dc_source=R_GetColumn(0,0);Object.assign(draw,{dc_x:5,dc_yl:0,dc_yh:127,dc_texturemid:0,dc_iscale:FRACUNIT});R_DrawColumn();
    for(let row=0;row<128;row++) assert.equal(screens[0][row*320+5],draw.dc_colormap[draw.dc_source[row]]);
});
test('Runtime actor, player and info interfaces include every upstream field',()=>{
    for(const [file,struct] of [['p_mobj.h','mobj_s'],['d_player.h','player_s']] as const){
        const original=readFileSync(`original/linuxdoom-1.10/${file}`,'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'');
        const body=original.match(new RegExp('typedef struct '+struct+'\\s*\\{([\\s\\S]*?)\\}'))![1];
        const converted=readFileSync(`src/linuxdoom-1.10/${file}.ts`,'utf8');
        const fields=[...body.matchAll(/\b(\w+)\s*(?:\[[^\]]+\])?\s*;/g)].map(match=>match[1]);
        for(const field of fields) assert.match(converted,new RegExp('\\b'+field+'\\s*:'),`${file}: ${field}`);
    }
});
