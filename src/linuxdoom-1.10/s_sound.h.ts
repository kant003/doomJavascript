// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Pointer parameters use coordinates and a mutable parameter object in TypeScript.
export interface sound_origin_t {x:number;y:number;z:number}
export interface sound_listener_t extends sound_origin_t {angle:number}
export interface sound_adjustment_t {volume:number;separation:number;pitch:number}

// Header signatures only: calls use s_sound.ts to avoid runtime module cycles.
export type { S_Init,S_Start,S_StartSound,S_StartSoundAtVolume,S_StopSound,
    S_StartMusic,S_ChangeMusic,S_StopMusic,S_PauseSound,S_ResumeSound,
    S_UpdateSounds,S_SetMusicVolume,S_SetSfxVolume } from './s_sound';
