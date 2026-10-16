// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Browser boundary for PCM effects and MUS music playback.
export interface sound_sample_t {sampleRate:number;samples:Float32Array}
export interface sound_params_t {volume:number;separation:number;pitch:number;priority:number}
export interface sound_backend_t {
    start(sample:sound_sample_t,params:sound_params_t):number;
    stop(handle:number):void;
    isPlaying(handle:number):boolean;
    update(handle:number,params:sound_params_t):void;
    reset():void;
}

// Platform music contract. MUS timestamps are at 140 ticks per second.
export type music_event_t={tick:number;channel:number}&(
    {type:'noteOn';note:number;velocity:number}|{type:'noteOff';note:number}|
    {type:'pitch';value:number}|{type:'program';value:number}|{type:'control';controller:number;value:number});
export interface music_score_t {events:music_event_t[];durationTicks:number;instruments:number[]}
export interface music_backend_t {
    play(score:music_score_t,looping:boolean,volume:number):number;
    stop(handle:number):void;pause(handle:number):void;resume(handle:number):void;
    isPlaying(handle:number):boolean;setVolume(volume:number):void;reset():void;
}
