// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Pointer parameters use coordinates and a mutable parameter object in TypeScript.
export interface sound_origin_t {x:number;y:number;z:number}
export interface sound_listener_t extends sound_origin_t {angle:number}
export interface sound_adjustment_t {volume:number;separation:number;pitch:number}
