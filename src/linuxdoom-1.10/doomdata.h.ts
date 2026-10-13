// Emacs style mode select   -*- C++ -*- 
//-----------------------------------------------------------------------------
//
// $Id:$
//
// Copyright (C) 1993-1996 by id Software, Inc.
//
// This source is available for distribution and/or modification
// only under the terms of the DOOM Source Code License as
// published by id Software. All rights reserved.
//
// The source is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// FITNESS FOR A PARTICULAR PURPOSE. See the DOOM Source Code License
// for more details.
//
// DESCRIPTION:
//  all external data is defined here
//  most of the data is loaded into different structures at run time
//  some internal structures shared by many modules are here
//
//-----------------------------------------------------------------------------

// TypeScript conversion. See PORTING.md for platform adaptations.
export const ML_LABEL = 0;
export const ML_THINGS = ML_LABEL + 1;
export const ML_LINEDEFS = ML_THINGS + 1;
export const ML_SIDEDEFS = ML_LINEDEFS + 1;
export const ML_VERTEXES = ML_SIDEDEFS + 1;
export const ML_SEGS = ML_VERTEXES + 1;
export const ML_SSECTORS = ML_SEGS + 1;
export const ML_NODES = ML_SSECTORS + 1;
export const ML_SECTORS = ML_NODES + 1;
export const ML_REJECT = ML_SECTORS + 1;
export const ML_BLOCKMAP = ML_REJECT + 1;
export const ML_BLOCKING = 1;
export const ML_BLOCKMONSTERS = 2;
export const ML_TWOSIDED = 4;
export const ML_DONTPEGTOP = 8;
export const ML_DONTPEGBOTTOM = 16;
export const ML_SECRET = 32;
export const ML_SOUNDBLOCK = 64;
export const ML_DONTDRAW = 128;
export const ML_MAPPED = 256;
export const NF_SUBSECTOR = 0x8000;

export interface mapvertex_t { x: number; y: number }
export interface mapsidedef_t { textureoffset: number; rowoffset: number; toptexture: string; bottomtexture: string; midtexture: string; sector: number }
export interface maplinedef_t { v1: number; v2: number; flags: number; special: number; tag: number; sidenum: [number, number] }
export interface mapsector_t { floorheight: number; ceilingheight: number; floorpic: string; ceilingpic: string; lightlevel: number; special: number; tag: number }
export interface mapsubsector_t { numsegs: number; firstseg: number }
export interface mapseg_t { v1: number; v2: number; angle: number; linedef: number; side: number; offset: number }
export interface mapnode_t { x: number; y: number; dx: number; dy: number; bbox: [number[], number[]]; children: [number, number] }
export interface mapthing_t { x: number; y: number; angle: number; type: number; options: number }
