// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Effects portion of s_sound.c. Level music, music transport and MUS decoding remain pending.
import { S_sfx } from './sounds';
import { sfxenum_t as SFX,type sfxinfo_t } from './sounds.h';
import { I_SetChannels,I_GetSfxLumpNum,I_StartSound,I_StopSound,I_SoundIsPlaying,I_UpdateSoundParams } from './i_sound';
import type { sound_origin_t,sound_listener_t,sound_adjustment_t } from './s_sound.h';
import { M_Random } from './m_random';
import { FRACUNIT as F,FRACBITS } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { R_PointToAngle2 } from './r_main';
import { ANGLETOFINESHIFT,finesine } from './tables.h';
export interface sound_context_t {gamemap:number;listener:sound_listener_t|null}
let game:sound_context_t|null=null;
export function S_InitSoundContext(context:sound_context_t):void {game=context;}
function state():sound_context_t {if(!game)throw new Error('Sound gameplay is not linked');return game;}
export interface channel_t {sfxinfo:sfxinfo_t|null;origin:sound_origin_t|null;handle:number}
export const channels:channel_t[]=[];
export let snd_SfxVolume=15,snd_MusicVolume=15,numChannels=8;
export const S_CLIPPING_DIST=1200*F,S_CLOSE_DIST=160*F,S_ATTENUATOR=(S_CLIPPING_DIST-S_CLOSE_DIST)>>FRACBITS;
export function S_Init(sfxVolume:number,musicVolume:number,channelCount=8):void {
    if(!Number.isInteger(channelCount)||channelCount<1||channelCount>128)throw new Error('Invalid number of sound channels');
    I_SetChannels();S_SetSfxVolume(sfxVolume);S_SetMusicVolume(musicVolume);
    numChannels=channelCount;channels.length=0;
    for(let i=0;i<numChannels;i++)channels.push({sfxinfo:null,origin:null,handle:0});
    for(let i=1;i<SFX.NUMSFX;i++)S_sfx[i].lumpnum=S_sfx[i].usefulness=-1;
}
export function S_SetSfxVolume(volume:number):void {
    if(!Number.isInteger(volume)||volume<0||volume>127)throw new Error(`Attempt to set sfx volume at ${volume}`);snd_SfxVolume=volume;
}
// Retain the setting without pretending to play MUS through the unfinished music backend.
export function S_SetMusicVolume(volume:number):void {
    if(!Number.isInteger(volume)||volume<0||volume>127)throw new Error(`Attempt to set music volume at ${volume}`);snd_MusicVolume=volume;
}
export function S_StartSound(origin:sound_origin_t|null,id:number):void {S_StartSoundAtVolume(origin,id,snd_SfxVolume);}
export function S_StartSoundAtVolume(origin:sound_origin_t|null,id:number,volume:number):void {
    if(!Number.isInteger(id)||id<1||id>=SFX.NUMSFX)throw new Error(`Bad sfx #: ${id}`);
    if(channels.length!==numChannels)throw new Error('S_Init must precede sound playback');
    const sfx=S_sfx[id];let pitch=128,priority=64;
    if(sfx.link){pitch=sfx.pitch;priority=sfx.priority;volume+=sfx.volume;if(volume<1)return;volume=Math.min(volume,snd_SfxVolume);}
    const params:sound_adjustment_t={volume,separation:128,pitch};
    if(origin&&origin!==state().listener){
        const listener=state().listener;if(!listener)throw new Error('Positional sound requires a listener');
        const audible=S_AdjustSoundParams(listener,origin,params);
        if(origin.x===listener.x&&origin.y===listener.y)params.separation=128;
        if(!audible)return;
    }
    if(id>=SFX.sfx_sawup&&id<=SFX.sfx_sawhit)params.pitch+=8-(M_Random()&15);
    else if(id!==SFX.sfx_itemup&&id!==SFX.sfx_tink)params.pitch+=16-(M_Random()&31);
    params.pitch=Math.max(0,Math.min(255,params.pitch));
    S_StopSound(origin);const cnum=S_getChannel(origin,sfx);if(cnum<0)return;
    try {
        if(sfx.lumpnum<0)sfx.lumpnum=I_GetSfxLumpNum(sfx);
        if(sfx.usefulness++<0)sfx.usefulness=1;
        channels[cnum].handle=I_StartSound(id,params.volume,params.separation,params.pitch,priority);
    } catch(error){sfx.usefulness--;channels[cnum].sfxinfo=null;throw error;}
}
export function S_StopSound(origin:sound_origin_t|null):void {
    for(let cnum=0;cnum<numChannels;cnum++)if(channels[cnum]?.sfxinfo&&channels[cnum].origin===origin){S_StopChannel(cnum);break;}
}
export function S_StopChannel(cnum:number):void {
    const c=channels[cnum];if(!c)throw new Error(`Invalid sound channel ${cnum}`);
    if(c.sfxinfo){if(I_SoundIsPlaying(c.handle))I_StopSound(c.handle);c.sfxinfo.usefulness--;c.sfxinfo=null;}
}
export function S_getChannel(origin:sound_origin_t|null,sfxinfo:sfxinfo_t):number {
    let cnum=0;
    for(;cnum<numChannels;cnum++){
        if(!channels[cnum].sfxinfo)break;
        if(origin&&channels[cnum].origin===origin){S_StopChannel(cnum);break;}
    }
    if(cnum===numChannels){
        for(cnum=0;cnum<numChannels;cnum++)if(channels[cnum].sfxinfo!.priority>=sfxinfo.priority)break;
        if(cnum===numChannels)return -1;S_StopChannel(cnum);
    }
    channels[cnum].sfxinfo=sfxinfo;channels[cnum].origin=origin;return cnum;
}
export function S_AdjustSoundParams(listener:sound_listener_t,source:sound_origin_t,params:sound_adjustment_t):boolean {
    const adx=Math.abs((listener.x-source.x)|0),ady=Math.abs((listener.y-source.y)|0);
    let dist=(adx+ady-((Math.min(adx,ady))>>1))|0;
    if(state().gamemap!==8&&dist>S_CLIPPING_DIST)return false;
    let angle=R_PointToAngle2(listener.x,listener.y,source.x,source.y);
    angle=(angle>listener.angle?angle-listener.angle:angle+(0xffffffff-listener.angle))>>>0;
    params.separation=128-(FixedMul(96*F,finesine[angle>>>ANGLETOFINESHIFT])>>FRACBITS);
    if(dist<S_CLOSE_DIST)params.volume=snd_SfxVolume;
    else if(state().gamemap===8){dist=Math.min(dist,S_CLIPPING_DIST);params.volume=15+Math.trunc((snd_SfxVolume-15)*((S_CLIPPING_DIST-dist)>>FRACBITS)/S_ATTENUATOR);}
    else params.volume=Math.trunc(snd_SfxVolume*((S_CLIPPING_DIST-dist)>>FRACBITS)/S_ATTENUATOR);
    return params.volume>0;
}
export function S_UpdateSounds(listener:sound_listener_t):void {
    for(let cnum=0;cnum<numChannels;cnum++){
        const c=channels[cnum],sfx=c.sfxinfo;if(!sfx)continue;
        if(!I_SoundIsPlaying(c.handle)){S_StopChannel(cnum);continue;}
        const params:sound_adjustment_t={volume:snd_SfxVolume,pitch:128,separation:128};
        if(sfx.link){params.pitch=sfx.pitch;params.volume+=sfx.volume;if(params.volume<1){S_StopChannel(cnum);continue;}params.volume=Math.min(params.volume,snd_SfxVolume);}
        if(c.origin&&listener!==c.origin){
            if(!S_AdjustSoundParams(listener,c.origin,params))S_StopChannel(cnum);
            else I_UpdateSoundParams(c.handle,params.volume,params.separation,params.pitch);
        }
    }
}
