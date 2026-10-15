// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Browser boundary for the effects API; MUS/music backend remains pending.
export interface sound_sample_t {sampleRate:number;samples:Float32Array}
export interface sound_params_t {volume:number;separation:number;pitch:number;priority:number}
export interface sound_backend_t {
    start(sample:sound_sample_t,params:sound_params_t):number;
    stop(handle:number):void;
    isPlaying(handle:number):boolean;
    update(handle:number,params:sound_params_t):void;
    reset():void;
}
