// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// s_sound.c effects and music management; device playback is adapted to Web Audio.
import { S_music,S_sfx } from './sounds';
import { sfxenum_t as SFX,musicenum_t as MUS,type musicinfo_t,type sfxinfo_t } from './sounds.h';
import { I_SetChannels,I_GetSfxLumpNum,I_StartSound,I_StopSound,I_SoundIsPlaying,I_UpdateSoundParams } from './i_sound';
import { GameMode_t } from './doomdef.h';
import { W_GetNumForName,W_CacheLumpNum } from './w_wad';
import { I_RegisterSong,I_UnRegisterSong,I_PlaySong,I_StopSong,I_PauseSong,I_ResumeSong,I_SetMusicVolume,I_QrySongPlaying } from './i_sound';
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
    S_StopMusic();mus_paused=false;for(const music of S_music){music.lumpnum=0;music.data=null;music.handle=0;}
    I_SetChannels();S_SetSfxVolume(sfxVolume);S_SetMusicVolume(musicVolume);
    numChannels=channelCount;channels.length=0;
    for(let i=0;i<numChannels;i++)channels.push({sfxinfo:null,origin:null,handle:0});
    for(let i=1;i<SFX.NUMSFX;i++)S_sfx[i].lumpnum=S_sfx[i].usefulness=-1;
}
export function S_SetSfxVolume(volume:number):void {
    if(!Number.isInteger(volume)||volume<0||volume>127)throw new Error(`Attempt to set sfx volume at ${volume}`);snd_SfxVolume=volume;
}
export function S_SetMusicVolume(volume:number):void {
    if(!Number.isInteger(volume)||volume<0||volume>127)throw new Error(`Attempt to set music volume at ${volume}`);I_SetMusicVolume(127);I_SetMusicVolume(volume);snd_MusicVolume=volume;
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


export let mus_playing:musicinfo_t|null=null,mus_paused=false;
interface music_context_t {gamemode:GameMode_t;gameepisode:number;gamemap:number}
let musicGame:music_context_t|null=null;
export function S_InitMusicContext(value:music_context_t):void {musicGame=value;}
export function S_GetMusicState(){return {name:mus_playing?.name??null,paused:mus_paused,playing:mus_playing?I_QrySongPlaying(mus_playing.handle):false,volume:snd_MusicVolume};}
export function S_Start():void {
    if(!musicGame)throw new Error('Music gameplay is not linked');
    for(let i=0;i<numChannels;i++)if(channels[i].sfxinfo)S_StopChannel(i);
    mus_paused=false;const g=musicGame;
    const spmus=[MUS.mus_e3m4,MUS.mus_e3m2,MUS.mus_e3m3,MUS.mus_e1m5,MUS.mus_e2m7,MUS.mus_e2m4,MUS.mus_e2m6,MUS.mus_e2m5,MUS.mus_e1m9];
    const mnum=g.gamemode===GameMode_t.commercial?MUS.mus_runnin+g.gamemap-1:g.gameepisode<4?MUS.mus_e1m1+(g.gameepisode-1)*9+g.gamemap-1:spmus[g.gamemap-1];
    S_ChangeMusic(mnum,true);
}
export function S_StartMusic(id:number):void {S_ChangeMusic(id,false);}
export function S_ChangeMusic(id:number,looping:boolean):void {
    if(!Number.isInteger(id)||id<=MUS.mus_None||id>=MUS.NUMMUSIC)throw new Error(`Bad music number ${id}`);
    const music=S_music[id];if(mus_playing===music)return;S_StopMusic();
    if(!music.lumpnum)music.lumpnum=W_GetNumForName(`d_${music.name}`);
    music.data=W_CacheLumpNum(music.lumpnum,1);music.handle=0;
    try {music.handle=I_RegisterSong(music.data);I_PlaySong(music.handle,looping);}catch(error){I_UnRegisterSong(music.handle);music.data=null;throw error;}
    mus_playing=music;
}
export function S_StopMusic():void {
    if(!mus_playing)return;if(mus_paused)I_ResumeSong(mus_playing.handle);
    I_StopSong(mus_playing.handle);I_UnRegisterSong(mus_playing.handle);mus_playing.data=null;mus_playing=null;
}
export function S_PauseSound():void {if(mus_playing&&!mus_paused){I_PauseSong(mus_playing.handle);mus_paused=true;}}
export function S_ResumeSound():void {if(mus_playing&&mus_paused){I_ResumeSong(mus_playing.handle);mus_paused=false;}}
