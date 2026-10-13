import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoWad,makeWad,maskedPatch } from '../src/web/demo';
import { W_InitFile,W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData,R_GetMaskedColumn,R_InitTextures,texturestate as t } from '../src/linuxdoom-1.10/r_data';
import { R_InitSprites,R_InitSpriteDefs,R_ClearSprites,R_NewVisSprite,R_SortVisSprites,R_DrawMaskedColumn,R_AddSprites,R_ProjectSprite,spritesState as ss,R_DrawSprite } from '../src/linuxdoom-1.10/r_things';
import { P_LoadMapData } from '../src/linuxdoom-1.10/p_setup';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { R_InitLightTables,R_SetViewSize,R_ExecuteSetViewSize,R_RenderWorldView,R_RenderPlayerView,view } from '../src/linuxdoom-1.10/r_main';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { draw,R_DrawColumn,R_InitTranslationTables } from '../src/linuxdoom-1.10/r_draw';
import { bsp } from '../src/linuxdoom-1.10/r_bsp';
import { sky } from '../src/linuxdoom-1.10/r_sky';
import { FRACUNIT } from '../src/linuxdoom-1.10/m_fixed.h';
import { mobjinfo,states,sprnames,stateActionSymbols,stateActionNames,I_LinkStateActions } from '../src/linuxdoom-1.10/info';
import { statenum_t,spritenum_t,mobjtype_t } from '../src/linuxdoom-1.10/info.h';
import { mobjflag_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { sfxenum_t } from '../src/linuxdoom-1.10/sounds.h';
import type { player_t } from '../src/linuxdoom-1.10/d_player.h';
import { createStaticMapActors } from '../src/web/map-actors';
function unpack(raw:Uint8Array):{name:string;data:Uint8Array}[]{const v=new DataView(raw.buffer),d=v.getInt32(8,true);return Array.from({length:v.getInt32(4,true)},(_,i)=>{const p=d+i*16,o=v.getInt32(p,true),n=v.getInt32(p+4,true);return{name:new TextDecoder().decode(raw.subarray(p+8,p+16)).split('\0')[0],data:raw.slice(o,o+n)};});}
function init(raw=demoWad()):void{
    W_InitFile({name:'sprites.wad',data:raw});R_InitData();P_LoadMapData(W_GetNumForName('E1M1'));V_Init();R_InitSprites(sprnames);
    R_InitTranslationTables();R_InitLightTables();R_SetViewSize(11,0);R_ExecuteSetViewSize();sky.skyflatnum=-1;view.viewx=view.viewy=view.viewangle=0;view.viewz=41*FRACUNIT;
}
function spriteWad(names:string[]):Uint8Array{const lumps=unpack(demoWad()),start=lumps.findIndex(l=>l.name==='S_START'),end=lumps.findIndex(l=>l.name==='S_END');lumps.splice(start+1,end-start-1,...names.map(name=>({name,data:maskedPatch(2,4,()=>112,1,4)})));return makeWad(lumps);}
test('Every state and actor scalar matches the original initializer expressions',()=>{
    const raw=readFileSync('original/linuxdoom-1.10/info.c','utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'');
    assert.equal(states.length,statenum_t.NUMSTATES);assert.equal(mobjinfo.length,mobjtype_t.NUMMOBJTYPES);assert.equal(sprnames.length,spritenum_t.NUMSPRITES);
    const names=raw.match(/sprnames\[NUMSPRITES\]\s*=\s*\{([\s\S]*?)\};/)![1].match(/"[A-Z0-9]{4}"/g)!.map(n=>JSON.parse(n));assert.deepEqual(sprnames,names);
    const scope={...spritenum_t,...statenum_t,...sfxenum_t,...mobjflag_t,FRACUNIT};
    function evaluate(expression:string):number{
        const replaced=expression.trim().replace(/\b[A-Za-z_]\w*\b/g,name=>{const value=scope[name as keyof typeof scope];assert.equal(typeof value,'number',name);return String(value);});
        assert.match(replaced,/^[\d\s|*()+\-]+$/);return Function(`"use strict"; return (${replaced});`)() as number;
    }
    const stateBody=raw.match(/states\[NUMSTATES\]\s*=\s*\{([\s\S]*?)\};/)![1].replace(/\{(A_\w+|NULL)\}/g,'$1');
    const stateRows=[...stateBody.matchAll(/\{([^{}]+)\}/g)];assert.equal(stateRows.length,states.length);
    stateRows.forEach((row,i)=>{const fields=row[1].split(',');assert.equal(fields.length,7);const st=states[i];
        for(const [key,index] of [['sprite',0],['frame',1],['tics',2],['nextstate',4],['misc1',5],['misc2',6]] as const)assert.equal(st[key],evaluate(fields[index]),`${i}.${key}`);
        assert.equal(stateActionSymbols[i],fields[3].trim()==='NULL'?null:fields[3].trim());
    });
    const actorBody=raw.match(/mobjinfo\[NUMMOBJTYPES\]\s*=\s*\{([\s\S]*?)\};/)![1];const rows=[...actorBody.matchAll(/\{([^{}]+)\}/g)];assert.equal(rows.length,mobjinfo.length);
    rows.forEach((row,i)=>{const values=row[1].split(',').filter(v=>v.trim());const keys=Object.keys(mobjinfo[i]);assert.equal(keys.length,values.length);
        keys.forEach((key,k)=>assert.equal(mobjinfo[i][key as keyof typeof mobjinfo[number]],evaluate(values[k]),`${i}.${key}`));
    });
});
test('Unlinked actions fail explicitly; linked actions have real function identity',()=>{
    I_LinkStateActions({},false);const index=stateActionSymbols.indexOf('A_Look');assert.ok(index>=0);const argument={calls:0};
    const action=states[index].action;assert.equal(typeof action,'function');assert.throws(()=>(action as (a:unknown)=>void)(argument),/not linked/);
    const bound=(a:unknown):void=>{(a as typeof argument).calls++;};I_LinkStateActions({A_Look:bound},false);
    assert.strictEqual(states[index].action,bound);bound(argument);assert.equal(argument.calls,1);
    assert.throws(()=>I_LinkStateActions({A_NotReal:bound},false),/Unknown/);assert.throws(()=>I_LinkStateActions({A_Look:bound}),/Missing/);
    I_LinkStateActions({},false);assert.ok(stateActionNames.length>60);assert.equal(states[statenum_t.S_NULL].action,null);
});
test('Sprite rot=0 populates eight views and paired rotation names preserve mirroring',()=>{
    init();R_InitSpriteDefs(['COLU']);assert.equal(ss.sprites[0].numframes,1);assert.equal(ss.sprites[0].spriteframes[0].rotate,false);assert.deepEqual([...ss.sprites[0].spriteframes[0].flip],Array(8).fill(0));
    W_InitFile({name:'rot.wad',data:spriteWad(['TESTA1','TESTA2A8','TESTA3A7','TESTA4A6','TESTA5'])});R_InitData();R_InitSpriteDefs(['TEST']);
    const frame=ss.sprites[0].spriteframes[0];assert.equal(frame.rotate,true);assert.deepEqual([...frame.flip],[0,0,0,0,0,1,1,1]);assert.equal(frame.lump[1],frame.lump[7]);
});
test('Invalid, duplicate, mixed or missing rotations are rejected',()=>{
    for(const names of [['TESTA1'],['TESTA0','TESTA1'],['TESTA0','TESTA0'],['TESTZ9'],['TESTA'],['TESTB0']]){
        W_InitFile({name:'bad.wad',data:spriteWad(names)});R_InitData();assert.throws(()=>R_InitSpriteDefs(['TEST']),/R_InitSprites/);
    }
});
test('Masked posts leave holes intact, respect top/bottom clips and restore texturemid',()=>{
    init();screens[0].fill(7);const patch=maskedPatch(1,8,(_x,y)=>y===2?5:y===3?6:y===6?9:null);
    draw.dc_x=20;draw.dc_iscale=FRACUNIT;draw.dc_texturemid=90*FRACUNIT;draw.dc_colormap=Uint8Array.from({length:256},(_,i)=>i);view.colfunc=R_DrawColumn;
    ss.spryscale=FRACUNIT;ss.sprtopscreen=10*FRACUNIT;ss.mfloorclip={data:new Int16Array(320).fill(200),base:0};ss.mceilingclip={data:new Int16Array(320).fill(-1),base:0};
    R_DrawMaskedColumn(patch.subarray(12));assert.equal(screens[0][12*320+20],5);assert.equal(screens[0][13*320+20],6);assert.equal(screens[0][16*320+20],9);assert.equal(screens[0][14*320+20],7);assert.equal(draw.dc_texturemid,90*FRACUNIT);
    screens[0].fill(7);ss.mfloorclip.data.fill(14);ss.mceilingclip.data.fill(12);R_DrawMaskedColumn(patch.subarray(12));assert.equal(screens[0][12*320+20],7);assert.equal(screens[0][13*320+20],6);assert.equal(screens[0][16*320+20],7);
    assert.throws(()=>R_DrawMaskedColumn(new Uint8Array([0,5])),/Truncated/);
});
test('Static objects use original spawnstate data and render without executing actions',()=>{
    init();const actors=createStaticMapActors();assert.equal(actors.length,1);const actor=actors[0];assert.equal(actor.info!.doomednum,2028);assert.strictEqual(actor.state,states[actor.info!.spawnstate]);assert.strictEqual(actor.subsector!.sector!.thinglist,actor);
    R_RenderWorldView({x:0,y:0,z:41*FRACUNIT,angle:0});assert.equal(ss.vissprites.length,1);assert.ok(screens[0].includes(242));assert.equal(actor.tics,-1);
    view.validcount++;R_ClearSprites();R_AddSprites(actor.subsector!.sector!);R_AddSprites(actor.subsector!.sector!);assert.equal(ss.vissprites.length,1);
    actor.x=-72*FRACUNIT;R_ClearSprites();R_ProjectSprite(actor);assert.equal(ss.vissprites.length,0);
});
test('Stable depth sorting keeps equal scales in input order and honors overflow limit',()=>{
    init();R_ClearSprites();const a=R_NewVisSprite(),b=R_NewVisSprite(),c=R_NewVisSprite();a.scale=20;b.scale=10;c.scale=10;
    R_SortVisSprites();assert.deepEqual(ss.sorted,[b,c,a]);assert.strictEqual(ss.vsprsortedhead.next,b);assert.strictEqual(a.next,ss.vsprsortedhead);
    R_ClearSprites();for(let i=0;i<128;i++)R_NewVisSprite();assert.strictEqual(R_NewVisSprite(),ss.overflowsprite);assert.equal(ss.vissprites.length,128);
});
test('Opaque wall silhouettes fully occlude a sprite behind the wall',()=>{
    init();R_RenderWorldView({x:0,y:0,z:41*FRACUNIT,angle:0});const before=screens[0].slice();
    const actor=createStaticMapActors()[0];actor.x=192*FRACUNIT;actor.y=0;ss.spritelights=view.scalelight[12];R_ClearSprites();R_ProjectSprite(actor);
    assert.equal(ss.vissprites.length,1);R_DrawSprite(ss.vissprites[0]);assert.deepEqual(screens[0],before);
});
function maskedWindow():Uint8Array{
    const lumps=unpack(demoWad());const tex=lumps.find(l=>l.name==='TEXTURE1')!,old=new DataView(tex.data.buffer),defs=[0,1].map(i=>{const o=old.getInt32(4+i*4,true);return tex.data.slice(o,o+32);});
    const mask=defs[1].slice();mask.fill(0,0,8);mask.set(new TextEncoder().encode('MASKED'));new DataView(mask.buffer).setInt16(26,1,true);defs.push(mask);
    const data=new Uint8Array(16+96),dv=new DataView(data.buffer);dv.setInt32(0,3,true);defs.forEach((def,i)=>{dv.setInt32(4+i*4,16+i*32,true);data.set(def,16+i*32);});tex.data=data;
    const names=lumps.find(l=>l.name==='PNAMES')!,pn=new Uint8Array(20);new DataView(pn.buffer).setInt32(0,2,true);pn.set(new TextEncoder().encode('WALLPAT'),4);pn.set(new TextEncoder().encode('MASKPAT'),12);names.data=pn;
    lumps.splice(lumps.findIndex(l=>l.name==='F_START'),0,{name:'MASKPAT',data:maskedPatch(128,128,(x)=>x%32<8?201:null)});
    const sector=lumps.find(l=>l.name==='SECTORS')!,sec=new Uint8Array(52);sec.set(sector.data);sec.set(sector.data,26);sector.data=sec;
    const sides=lumps.find(l=>l.name==='SIDEDEFS')!,sd=new Uint8Array(90);sd.set(sides.data);sd.set(sides.data,30);sd.set(sides.data,60);sd.fill(0,50,58);sd.set(new TextEncoder().encode('MASKED'),50);new DataView(sd.buffer).setInt16(88,1,true);sides.data=sd;
    const lines=lumps.find(l=>l.name==='LINEDEFS')!,lv=new DataView(lines.data.buffer);lv.setInt16(18,4,true);lv.setInt16(24,1,true);lv.setInt16(26,2,true);
    return makeWad(lumps);
}
test('Transparent wall posts draw in front of far sprites and behind near sprites',()=>{
    for(const near of [true,false]){
        init(maskedWindow());const actor=createStaticMapActors()[0];actor.x=(near?72:144)*FRACUNIT;actor.y=0;
        R_RenderWorldView({x:0,y:0,z:41*FRACUNIT,angle:0});
        assert.equal(screens[0][100*320+162],near?112:201);
        assert.equal(screens[0][100*320+160],112); // Neighboring transparent column exposes the sprite at either depth.
        const ds=bsp.drawsegs.find(ds=>ds.maskedtexturecol);assert.ok(ds);assert.ok(ds.maskedtexturecol!.data.every(column=>column===32767));
    }
});
test('Masked columns retain their post headers and composite masked caches fail explicitly',()=>{
    init();const col=R_GetMaskedColumn(1,0);assert.equal(col[0],0);assert.equal(col[1],128);
    const lumps=unpack(demoWad()),tex=lumps.find(l=>l.name==='TEXTURE1')!;
    const body=tex.data.slice(44,76),extra=new Uint8Array(42);extra.set(body);extra.set(body.subarray(22,32),32);new DataView(extra.buffer).setInt16(20,2,true);
    const out=new Uint8Array(8+42);new DataView(out.buffer).setInt32(0,1,true);new DataView(out.buffer).setInt32(4,8,true);out.set(extra,8);tex.data=out;
    W_InitFile({name:'composite.wad',data:makeWad(lumps)});R_InitTextures();assert.throws(()=>R_GetMaskedColumn(0,0),/Masked composite/);
});
test('Player view retains four NetUpdate calls and draws a psprite overlay when provided',()=>{
    init();const actor=createStaticMapActors()[0];actor.x=actor.y=0;actor.angle=0;const powers=new Int32Array(6);
    const player={mo:actor,viewz:41*FRACUNIT,extralight:0,fixedcolormap:0,powers,psprites:[{state:states[actor.info!.spawnstate],tics:-1,sx:160*FRACUNIT,sy:100*FRACUNIT},{state:null,tics:0,sx:0,sy:0}]} as player_t;
    let calls=0;R_RenderPlayerView(player,()=>{calls++;});assert.equal(calls,4);assert.strictEqual(view.viewplayer,player);assert.ok(screens[0].includes(242));
});

test('Player color translation changes only the original green ramp',()=>{
    init();const actor=createStaticMapActors()[0],camera={x:0,y:0,z:41*FRACUNIT,angle:0};R_RenderWorldView(camera);const before=screens[0].slice();
    actor.flags|=0x04000000;R_RenderWorldView(camera);let changed=0;
    for(let i=0;i<before.length;i++)if(before[i]!==screens[0][i]){assert.ok(before[i]>=0x70 && before[i]<=0x7f);assert.equal(screens[0][i],0x60+(before[i]&15));changed++;}
    assert.ok(changed>100);
});
test('Shadow sprites select the fuzz renderer and restore the base column function',()=>{
    init();const actor=createStaticMapActors()[0];actor.flags|=mobjflag_t.MF_SHADOW;
    R_RenderWorldView({x:0,y:0,z:41*FRACUNIT,angle:0});assert.equal(ss.vissprites[0].colormap,null);assert.strictEqual(view.colfunc,view.basecolfunc);
    assert.ok(draw.fuzzpos>=0 && draw.fuzzpos<50);assert.strictEqual(draw.colormaps,t.colormaps);
});
