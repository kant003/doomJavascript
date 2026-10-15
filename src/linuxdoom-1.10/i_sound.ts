// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Platform adaptation of effects I/O. Web Audio replaces the OSS device and C mixer.
import { W_GetNumForName,W_CheckNumForName,W_CacheLumpNum } from './w_wad';
import { S_sfx } from './sounds';
import type { sfxinfo_t } from './sounds.h';
import type { sound_sample_t,sound_params_t,sound_backend_t } from './i_sound.h';
let backend:sound_backend_t|null=null;
const samples=new Map<number,sound_sample_t>();
export function I_InstallSoundBackend(driver:sound_backend_t):void {backend?.reset();samples.clear();backend=driver;}
function driver():sound_backend_t {if(!backend)throw new Error('Sound backend is not linked');return backend;}
export function I_DecodeSound(data:Uint8Array):sound_sample_t {
    if(data.length<8)throw new Error('Truncated DMX sound header');
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
    if(v.getUint16(0,true)!==3)throw new Error('Unsupported sound format: expected DMX PCM (3)');
    const sampleRate=v.getUint16(2,true),count=v.getUint32(4,true);
    if(!sampleRate||!count||count>data.length-8)throw new Error('Invalid DMX sample rate or sample count');
    return {sampleRate,samples:Float32Array.from(data.subarray(8,8+count),value=>(value-128)/128)};
}
export function I_InitSound():void {
    driver().reset();samples.clear();for(const sfx of S_sfx){sfx.data=null;sfx.lumpnum=-1;}
}
export function I_ShutdownSound():void {backend?.reset();samples.clear();}
export function I_SetChannels():void {driver().reset();}
export function I_GetSfxLumpNum(sfx:sfxinfo_t):number {
    // Resolve linked PCM first; keep getsfx's pistol fallback for effects absent in older WADs.
    const base=sfx.link??sfx,name=`ds${base.name}`,lump=W_CheckNumForName(name);
    return lump>=0?lump:W_GetNumForName('dspistol');
}
export function I_StartSound(id:number,volume:number,separation:number,pitch:number,priority:number):number {
    const sfx=S_sfx[id];if(!sfx||id<1)throw new Error(`Bad sfx #: ${id}`);
    const lump=I_GetSfxLumpNum(sfx);let sample=samples.get(lump);
    if(!sample){sample=I_DecodeSound(W_CacheLumpNum(lump,1));samples.set(lump,sample);}
    return driver().start(sample,{volume,separation,pitch,priority});
}
export function I_StopSound(handle:number):void {driver().stop(handle);}
export function I_SoundIsPlaying(handle:number):boolean {return driver().isPlaying(handle);}
export function I_UpdateSoundParams(handle:number,volume:number,separation:number,pitch:number):void {driver().update(handle,{volume,separation,pitch,priority:0});}
// The quadratic stereo gains from addsfx; reusable by the Web Audio platform driver.
export function I_StereoGains(params:Pick<sound_params_t,'volume'|'separation'>):[number,number] {
    const {volume,separation}=params;
    if(!Number.isInteger(volume)||volume<0||volume>127||!Number.isInteger(separation)||separation<0||separation>255)throw new Error('Invalid sound volume or separation');
    const sep=separation+1;
    return [(volume-((volume*sep*sep)>>16))/127,(volume-((volume*(sep-257)*(sep-257))>>16))/127];
}
