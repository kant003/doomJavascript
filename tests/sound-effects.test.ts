import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { S_sfx,S_music } from '../src/linuxdoom-1.10/sounds';
import { sfxenum_t as SFX,musicenum_t as MUS } from '../src/linuxdoom-1.10/sounds.h';
import * as sound from '../src/linuxdoom-1.10/s_sound';
import { S_Init,S_InitSoundContext,S_StartSound,S_StartSoundAtVolume,S_StopSound,S_StopChannel,S_UpdateSounds,S_AdjustSoundParams,S_SetSfxVolume,S_SetMusicVolume,S_getChannel,channels } from '../src/linuxdoom-1.10/s_sound';
import { I_InstallSoundBackend,I_InitSound,I_StartSound,I_StopSound,I_SoundIsPlaying,I_UpdateSoundParams,I_DecodeSound,I_GetSfxLumpNum,I_StereoGains } from '../src/linuxdoom-1.10/i_sound';
import type { sound_sample_t,sound_params_t,sound_backend_t } from '../src/linuxdoom-1.10/i_sound.h';
import { W_InitFile,W_AddFile,W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { makeWad,demoSound } from '../src/web/demo';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { M_ClearRandom,rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import { ANG90,ANG180 } from '../src/linuxdoom-1.10/tables.h';
import { createCombatWorld } from './helpers/combat-world';
import { P_InitPspriteContext,A_FirePistol } from '../src/linuxdoom-1.10/p_pspr';
import { P_NoiseAlert } from '../src/linuxdoom-1.10/p_enemy';
import { P_AimLineAttack,P_LineAttack,mapclip } from '../src/linuxdoom-1.10/p_map';
import { P_DamageMobj } from '../src/linuxdoom-1.10/p_inter';
import { P_InitSectorContext } from '../src/linuxdoom-1.10/p_spec';
import { EV_DoDoor } from '../src/linuxdoom-1.10/p_doors';
import { vldoor_e as DT } from '../src/linuxdoom-1.10/p_spec.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { GameMode_t } from '../src/linuxdoom-1.10/doomdef.h';
class Device implements sound_backend_t {
 starts:{sample:sound_sample_t;params:sound_params_t;handle:number}[]=[];stops:number[]=[];updates:{handle:number;params:sound_params_t}[]=[];active=new Set<number>();next=1;
 start(sample:sound_sample_t,params:sound_params_t){const handle=this.next++;this.starts.push({sample,params:{...params},handle});this.active.add(handle);return handle;}
 stop(handle:number){this.stops.push(handle);this.active.delete(handle);}
 isPlaying(handle:number){return this.active.has(handle);}
 update(handle:number,params:sound_params_t){this.updates.push({handle,params:{...params}});}
 reset(){this.active.clear();}
}
function init(count=8){
 W_InitFile({name:'audio.wad',data:makeWad([{name:'DSPISTOL',data:demoSound()},{name:'DSITEMUP',data:demoSound()}])});
 const device=new Device();I_InstallSoundBackend(device);I_InitSound();S_Init(100,0,count);
 const listener={x:0,y:0,z:0,angle:0},game={gamemap:1,listener};S_InitSoundContext(game);M_ClearRandom();return {device,listener,game};
}
test('Sound tables preserve all original names, priorities, flags and the chaingun link',()=>{
 const c=readFileSync('original/linuxdoom-1.10/sounds.c','utf8');const original=c.split('sfxinfo_t S_sfx')[1];
 const rows=[...original.matchAll(/\{ "(\w+)",\s*(false|true),\s*(\d+),\s*(0|&S_sfx\[sfx_pistol\]),\s*(-?\d+),\s*(-?\d+),\s*0 \}/g)];
 assert.equal(S_sfx.length,SFX.NUMSFX);assert.equal(rows.length,S_sfx.length);rows.forEach((r,i)=>{const s=S_sfx[i];assert.deepEqual([s.name,s.singularity,s.priority,s.pitch,s.volume],[r[1],r[2]==='true',+r[3],+r[5],+r[6]]);assert.strictEqual(s.link,r[4]==='0'?null:S_sfx[SFX.sfx_pistol]);});
 assert.equal(S_music.length,MUS.NUMMUSIC);assert.deepEqual(S_music.map(m=>m.name),[null,...[...c.split('sfxinfo_t S_sfx')[0].matchAll(/\{ "([^"]+)", 0 \}/g)].map(r=>r[1])]);
});
test('DMX decoder reads little-endian sample rate/count, offset views and unsigned PCM endpoints',()=>{
 const bytes=new Uint8Array(20),v=new DataView(bytes.buffer);v.setUint16(3,3,true);v.setUint16(5,11025,true);v.setUint32(7,4,true);bytes.set([0,128,255,64],11);const result=I_DecodeSound(bytes.subarray(3,15));
 assert.equal(result.sampleRate,11025);assert.deepEqual([...result.samples],[-1,0,127/128,-0.5]);
});
test('DMX decoder rejects truncated headers, unsupported formats, zero rate/count and oversized data claims',()=>{
 assert.throws(()=>I_DecodeSound(new Uint8Array(7)),/Truncated/);
 const bytes=demoSound(),v=new DataView(bytes.buffer);v.setUint16(0,0,true);assert.throws(()=>I_DecodeSound(bytes),/format/);v.setUint16(0,3,true);
 v.setUint16(2,0,true);assert.throws(()=>I_DecodeSound(bytes),/Invalid/);v.setUint16(2,11025,true);
 v.setUint32(4,0,true);assert.throws(()=>I_DecodeSound(bytes),/Invalid/);v.setUint32(4,0xffffffff,true);assert.throws(()=>I_DecodeSound(bytes),/Invalid/);
});
test('Platform effects use actual handles, cache a decoded lump and resolve aliases/fallbacks',()=>{
 const {device}=init();const a=I_StartSound(SFX.sfx_pistol,100,128,128,64),b=I_StartSound(SFX.sfx_chgun,80,128,150,64);
 assert.ok(I_SoundIsPlaying(a));assert.strictEqual(device.starts[0].sample,device.starts[1].sample);assert.equal(I_GetSfxLumpNum(S_sfx[SFX.sfx_chgun]),W_GetNumForName('DSPISTOL'));
 assert.equal(I_GetSfxLumpNum(S_sfx[SFX.sfx_doropn]),W_GetNumForName('DSPISTOL'));I_UpdateSoundParams(a,50,0,100);assert.equal(device.updates[0].params.volume,50);I_StopSound(a);assert.equal(I_SoundIsPlaying(a),false);assert.equal(I_SoundIsPlaying(b),true);
});
test('Changing WAD resets PCM cache and active voices',()=>{
 const {device}=init();I_StartSound(SFX.sfx_pistol,100,128,128,64);const previous=device.starts[0].sample;
 const bytes=demoSound();bytes[8]=255;W_InitFile({name:'other.wad',data:makeWad([{name:'DSPISTOL',data:bytes}])});I_InitSound();assert.equal(device.active.size,0);
 I_StartSound(SFX.sfx_pistol,100,128,128,64);assert.notStrictEqual(device.starts[1].sample,previous);assert.equal(device.starts[1].sample.samples[0],127/128);
});
test('Original quadratic stereo gains retain asymmetry at center and correct extreme channels',()=>{
 assert.deepEqual(I_StereoGains({volume:127,separation:0}),[1,0]);const right=I_StereoGains({volume:127,separation:255});assert.equal(right[0],0);assert.equal(right[1],1);
 assert.deepEqual(I_StereoGains({volume:0,separation:128}),[0,0]);assert.throws(()=>I_StereoGains({volume:128,separation:128}),/Invalid/);
 const center=I_StereoGains({volume:127,separation:128});assert.ok(center[0]>0.7&&center[1]>0.7);assert.notEqual(center[0],center[1]);
});
test('Sound IDs and volume boundaries reject invalid and one-past-the-end values',()=>{
 init();for(const id of [0,-1,SFX.NUMSFX,1.5])assert.throws(()=>S_StartSound(null,id),/Bad sfx/);
 for(const vol of [-1,128,1.5]){assert.throws(()=>S_SetSfxVolume(vol),/volume/);assert.throws(()=>S_SetMusicVolume(vol),/volume/);}
});
test('StartSound preserves cosmetic RNG, saw pitch range, linked pitch and exceptions',()=>{
 const {device}=init();S_StartSound(null,SFX.sfx_pistol);assert.equal(device.starts[0].params.pitch,136);assert.equal(rndindex,1);assert.equal(prndindex,0);
 M_ClearRandom();S_StartSound(null,SFX.sfx_sawup);assert.equal(device.starts[1].params.pitch,128);
 M_ClearRandom();S_StartSound(null,SFX.sfx_chgun);assert.equal(device.starts[2].params.pitch,158);
 M_ClearRandom();S_StartSound(null,SFX.sfx_itemup);S_StartSound(null,SFX.sfx_tink);assert.equal(rndindex,0);
});
test('Local and global sounds center without attenuation; distant sounds are rejected before cosmetic RNG',()=>{
 const {device,listener}=init();S_StartSound(listener,SFX.sfx_pistol);assert.equal(device.starts[0].params.volume,100);assert.equal(device.starts[0].params.separation,128);
 S_StartSound(null,SFX.sfx_pistol);assert.equal(device.starts[1].params.volume,100);M_ClearRandom();S_StartSound({x:1201*F,y:0,z:0},SFX.sfx_pistol);assert.equal(device.starts.length,2);assert.equal(rndindex,0);
});
test('Distance attenuation preserves close/clipping boundaries and map 8 minimum volume',()=>{
 const {listener,game}=init();const params={volume:100,separation:128,pitch:128};
 assert.equal(S_AdjustSoundParams(listener,{x:160*F,y:0,z:0},params),true);assert.equal(params.volume,100);
 S_AdjustSoundParams(listener,{x:680*F,y:0,z:0},params);assert.equal(params.volume,50);
 assert.equal(S_AdjustSoundParams(listener,{x:1200*F,y:0,z:0},params),false);assert.equal(params.volume,0);
 game.gamemap=8;assert.equal(S_AdjustSoundParams(listener,{x:5000*F,y:0,z:0},params),true);assert.equal(params.volume,15);
});
test('Spatial separation follows listener angle and source side with fixed-point sine tables',()=>{
 const {listener}=init(),p={volume:100,separation:128,pitch:128};S_AdjustSoundParams(listener,{x:0,y:100*F,z:0},p);assert.ok(p.separation<=33);
 S_AdjustSoundParams(listener,{x:0,y:-100*F,z:0},p);assert.ok(p.separation>=223);listener.angle=ANG180;S_AdjustSoundParams(listener,{x:0,y:100*F,z:0},p);assert.ok(p.separation>=223);
 listener.angle=ANG90;S_AdjustSoundParams(listener,{x:0,y:100*F,z:0},p);assert.ok(Math.abs(p.separation-128)<=1);
});
test('Sound origins replace themselves, including the original NULL-origin stop behavior',()=>{
 const {device,listener}=init();S_StartSound(listener,SFX.sfx_pistol);const first=device.starts[0].handle;S_StartSound(listener,SFX.sfx_shotgn);assert.deepEqual(device.stops,[first]);assert.equal(channels.filter(c=>c.sfxinfo).length,1);
 S_StartSound(null,SFX.sfx_itemup);const global=device.starts.at(-1)!.handle;S_StartSound(null,SFX.sfx_pistol);assert.ok(device.stops.includes(global));S_StopSound(listener);assert.equal(channels.filter(c=>c.sfxinfo).length,1);
});
test('Channel priorities reject more important incumbents and evict the first lower-priority effect',()=>{
 const {device}=init(2),a={x:0,y:0,z:0},b={x:0,y:0,z:0};
 S_getChannel(a,S_sfx[SFX.sfx_telept]);S_getChannel(b,S_sfx[SFX.sfx_pistol]);assert.equal(S_getChannel({x:0,y:0,z:0},S_sfx[SFX.sfx_itemup]),-1);
 assert.equal(S_getChannel({x:0,y:0,z:0},S_sfx[SFX.sfx_telept]),0);assert.strictEqual(channels[1].sfxinfo,S_sfx[SFX.sfx_pistol]);
});
test('Updates change moving-source parameters, remove inaudible sources and release ended voices',()=>{
 const {device,listener}=init(),origin={x:100*F,y:0,z:0};S_StartSound(origin,SFX.sfx_pistol);const handle=device.starts[0].handle;
 origin.x=680*F;S_UpdateSounds(listener);assert.equal(device.updates[0].params.volume,50);assert.equal(device.updates[0].params.pitch,128);
 origin.x=1201*F;S_UpdateSounds(listener);assert.equal(device.active.size,0);assert.equal(channels[0].sfxinfo,null);
 S_StartSound(listener,SFX.sfx_pistol);const info=channels[0].sfxinfo!,usefulness=info.usefulness;device.active.clear();S_UpdateSounds(listener);assert.equal(channels[0].sfxinfo,null);assert.equal(info.usefulness,usefulness-1);
});
test('A malformed requested sound fails explicitly and releases its logical channel',()=>{
 const {device}=init();W_AddFile({name:'bad.wad',data:makeWad([{name:'DSBAD',data:new Uint8Array(1)},{name:'DSPISTOL',data:new Uint8Array(1)}])});
 assert.throws(()=>S_StartSound(null,SFX.sfx_pistol),/Truncated/);assert.equal(device.starts.length,0);assert.equal(channels[0].sfxinfo,null);
});
test('Weapon action and sector door callbacks reach the real sound manager and decode WAD PCM',()=>{
 const {g,p,a,context}=createCombatWorld();const device=new Device();I_InstallSoundBackend(device);I_InitSound();S_Init(100,0);S_InitSoundContext({gamemap:1,listener:a});
 P_InitPspriteContext({gamemode:GameMode_t.commercial,get linetarget(){return mapclip.linetarget;},S_StartSound,P_NoiseAlert,P_AimLineAttack,P_LineAttack,P_DamageMobj});
 A_FirePistol(p,p.psprites[0]);assert.equal(device.starts.length,1);assert.equal(device.starts[0].sample.sampleRate,11025);assert.equal(channels[0].sfxinfo,S_sfx[SFX.sfx_pistol]);
 P_InitSectorContext({S_StartSound});m.sectors[0].tag=1;EV_DoDoor({tag:1},DT.open);assert.ok(device.starts.length>1);assert.ok(channels.some(c=>c.sfxinfo===S_sfx[SFX.sfx_doropn]));
});
