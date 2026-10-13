import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W_InitFile,W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData,texturestate } from '../src/linuxdoom-1.10/r_data';
import { P_LoadMapData } from '../src/linuxdoom-1.10/p_setup';
import { demoWad,makeWad } from '../src/web/demo';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { view,R_InitLightTables,R_SetViewSize,R_ExecuteSetViewSize,R_PointToAngle,R_PointToAngle2,R_PointToDist,R_ScaleFromGlobalAngle,R_RenderWorldView,R_AddPointToBox } from '../src/linuxdoom-1.10/r_main';
import { bsp,R_ClearClipSegs,R_ClipPassWallSegment,R_ClipSolidWallSegment,R_CheckBBox } from '../src/linuxdoom-1.10/r_bsp';
import { planes,R_ClearPlanes,R_FindPlane,R_CheckPlane,MAXVISPLANES } from '../src/linuxdoom-1.10/r_plane';
import { wall } from '../src/linuxdoom-1.10/r_segs';
import { sky,R_InitSkyMap } from '../src/linuxdoom-1.10/r_sky';
import { ANG45,ANG90,ANG180,ANG270 } from '../src/linuxdoom-1.10/tables.h';
import { FRACUNIT } from '../src/linuxdoom-1.10/m_fixed.h';
import { stepInspectionCamera } from '../src/web/world-preview';
function init(data=demoWad()):void{
    W_InitFile({name:'world.wad',data});R_InitData();P_LoadMapData(W_GetNumForName('E1M1'));V_Init();R_InitLightTables();
    R_SetViewSize(11,0);R_ExecuteSetViewSize();R_InitSkyMap();sky.skyflatnum=-1;view.viewx=view.viewy=view.viewangle=0;
}
function hash(bytes:Uint8Array):number{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return h;}
test('Original octant angles retain boundary offsets and unsigned wrapping',()=>{
    init();const f=FRACUNIT;
    for(const [x,y,angle] of [[1,0,0],[0,1,ANG90-1],[-1,0,ANG180-1],[0,-1,ANG270],[1,1,ANG45-1],[-1,1,ANG90+ANG45],[-1,-1,ANG270-1-ANG45],[1,-1,ANG270+ANG45]])
        assert.equal(R_PointToAngle(x*f,y*f),angle);
    assert.equal(R_PointToAngle(0,0),0);assert.equal(R_PointToAngle2(10*f,-20*f,11*f,-20*f),0);
    assert.equal(view.viewx,10*f);assert.equal(view.viewy,-20*f);
    assert.equal(R_PointToDist(view.viewx,view.viewy),0);
    assert.ok(Math.abs(R_PointToDist(view.viewx+3*f,view.viewy+4*f)-5*f)<256);
});
test('Renderer bounding boxes expand all four edges on the first point',()=>{
    const box=new Int32Array([-2147483648,2147483647,2147483647,-2147483648]);R_AddPointToBox(3,4,box);
    assert.deepEqual([...box],[4,4,3,3]);
});
test('Projection maps 90 degrees to the view and deferred sizes preserve high/low geometry',()=>{
    init();assert.equal(view.viewwidth,320);assert.equal(view.centerxfrac,160*FRACUNIT);assert.ok(Math.abs(view.clipangle-ANG45)<0x100000);
    for(let i=1;i<view.viewangletox.length;i++)assert.ok(view.viewangletox[i]<=view.viewangletox[i-1]);
    assert.equal(view.viewangletox[0],320);assert.equal(view.viewangletox.at(-1),0);
    assert.equal(view.xtoviewangle[160],0);
    R_SetViewSize(8,1);assert.equal(view.viewwidth,320);assert.equal(view.setsizeneeded,true);
    R_ExecuteSetViewSize();assert.equal(view.viewwidth,128);assert.equal(view.scaledviewwidth,256);assert.equal(view.viewheight,128);
    assert.equal(view.pspritescale,Math.trunc(FRACUNIT*128/320));assert.ok(planes.yslope[64]>planes.yslope[0]);
    assert.equal(view.screenheightarray[0],128);assert.throws(()=>R_SetViewSize(12,0));
});
test('Lighting tables reference exact colormap slices and wall scales stay clamped',()=>{
    init();for(const row of view.zlight)for(const map of row){assert.equal(map.length,256);assert.equal(map.buffer,texturestate.colormaps.buffer);}
    assert.ok(view.zlight[0][127].byteOffset>=view.zlight[15][127].byteOffset);
    wall.rw_normalangle=0;wall.rw_distance=FRACUNIT;assert.equal(R_ScaleFromGlobalAngle(0),64*FRACUNIT);
    wall.rw_distance=10000*FRACUNIT;assert.ok(R_ScaleFromGlobalAngle(0)>=256);
});
test('Solid clipping emits exactly newly visible pixels and merges coverage',()=>{
    init();R_ClearClipSegs();const coverage=new Uint8Array(320);
    let seed=1234;
    for(let trial=0;trial<400;trial++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const first=seed%320;
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const last=first+seed%(320-first);
        const expected=[];for(let x=first;x<=last;x++)if(!coverage[x])expected.push(x);
        const actual:number[]=[];R_ClipSolidWallSegment(first,last,(a,b)=>{assert.ok(a<=b);for(let x=a;x<=b;x++)actual.push(x);});
        assert.deepEqual(actual,expected);coverage.fill(1,first,last+1);
        for(let i=1;i<bsp.solidsegs.length;i++)assert.ok(bsp.solidsegs[i-1].last<bsp.solidsegs[i].first-1);
    }
});
test('Window clipping leaves the solid list unchanged and exposes only gaps',()=>{
    init();R_ClearClipSegs();R_ClipSolidWallSegment(10,20,()=>{});R_ClipSolidWallSegment(30,40,()=>{});
    const before=JSON.stringify(bsp.solidsegs),spans:number[][]=[];
    R_ClipPassWallSegment(5,45,(a,b)=>spans.push([a,b]));assert.deepEqual(spans,[[5,9],[21,29],[41,45]]);assert.equal(JSON.stringify(bsp.solidsegs),before);
    view.viewx=view.viewy=0;assert.equal(R_CheckBBox(Int32Array.from([10*FRACUNIT,-10*FRACUNIT,-10*FRACUNIT,10*FRACUNIT])),true);
});
test('Visplanes merge disjoint coverage, split overlap and retain sentinel pads',()=>{
    init();R_ClearPlanes();const pl=R_FindPlane(0,0,192);assert.strictEqual(R_FindPlane(0,0,192),pl);
    assert.strictEqual(R_CheckPlane(pl,0,319),pl);pl.top[21]=10;pl.bottom[21]=30;
    const split=R_CheckPlane(pl,20,25);assert.notStrictEqual(split,pl);assert.equal(split.top.length,322);assert.equal(split.top[0],255);assert.equal(split.top[321],255);
    R_ClearPlanes();for(let i=0;i<MAXVISPLANES;i++)R_FindPlane(i,0,192);assert.throws(()=>R_FindPlane(999,0,192),/no more visplanes/);
});
test('World rendering draws walls and flat spans deterministically across octants',()=>{
    init();const hashes=new Set<number>();
    for(const angle of [0,ANG45,ANG90,ANG180,ANG270]){
        screens[0].fill(0);const camera={x:0,y:0,z:64*FRACUNIT,angle};R_RenderWorldView(camera);
        assert.ok(bsp.drawsegs.length>0);assert.equal(view.sscount,1);assert.ok(screens[0].filter(Boolean).length>60000);
        const first=hash(screens[0]);screens[0].fill(0);R_RenderWorldView(camera);assert.equal(hash(screens[0]),first);hashes.add(first);
        assert.ok(planes.visplanes.some(pl=>pl.height===0 && pl.maxx>=pl.minx));
        assert.ok(planes.visplanes.some(pl=>pl.height===128*FRACUNIT && pl.maxx>=pl.minx));
        for(const seg of bsp.drawsegs){assert.ok(seg.scale1>=256);assert.ok(seg.scale1<=64*FRACUNIT);assert.equal(seg.silhouette,3);}
    }assert.ok(hashes.size>=3);
});
test('Fixed colormap applies to both wall columns and floor spans',()=>{
    init();R_RenderWorldView({x:0,y:0,z:64*FRACUNIT,angle:ANG45,fixedcolormap:5});
    assert.equal(view.fixedcolormap!.byteOffset,texturestate.colormaps.byteOffset+5*256);
    const allowed=new Set(texturestate.colormaps.subarray(5*256,6*256));for(const pixel of screens[0])assert.ok(allowed.has(pixel));
    assert.throws(()=>R_RenderWorldView({x:0,y:0,z:0,angle:0,fixedcolormap:100}),/Invalid fixed/);
});
function windowMap(closed=false):Uint8Array{
    const raw=demoWad(),v=new DataView(raw.buffer),directory=v.getInt32(8,true);
    const lumps=Array.from({length:v.getInt32(4,true)},(_,i)=>{const p=directory+i*16,o=v.getInt32(p,true),n=v.getInt32(p+4,true);return{name:new TextDecoder().decode(raw.subarray(p+8,p+16)).split('\0')[0],data:raw.slice(o,o+n)};});
    const sector=lumps.find(l=>l.name==='SECTORS')!,extended=new Uint8Array(52);extended.set(sector.data);extended.set(sector.data,26);
    const sv=new DataView(extended.buffer);sv.setInt16(26,closed?128:32,true);sv.setInt16(28,96,true);sector.data=extended;
    const sides=lumps.find(l=>l.name==='SIDEDEFS')!,sd=new Uint8Array(60);sd.set(sides.data);sd.set(sides.data,30);
    sd.set(new TextEncoder().encode('TESTWALL'),4);sd.set(new TextEncoder().encode('TESTWALL'),12);sd.fill(0,20,28);sd[20]=45;
    new DataView(sd.buffer).setInt16(58,1,true);sides.data=sd;
    const lines=lumps.find(l=>l.name==='LINEDEFS')!;const lv=new DataView(lines.data.buffer);lv.setInt16(14+4,4,true);lv.setInt16(14+12,1,true);
    return makeWad(lumps);
}
test('Two-sided upper/lower wall tiers preserve portal clips and closed-door occlusion',()=>{
    for(const closed of [false,true]){
        init(windowMap(closed));R_RenderWorldView({x:0,y:0,z:64*FRACUNIT,angle:0});
        const ds=bsp.drawsegs.find(seg=>seg.curline.linedef.backsector!==null);assert.ok(ds);
        assert.ok(screens[0].some(Boolean));assert.ok(planes.floorclip[160]>planes.ceilingclip[160] || closed);
        assert.equal(ds.maskedtexturecol,null);
    }
});
test('Inspection camera uses integer tics and does not substitute for player physics',()=>{
    const camera={x:0,y:0,z:41*FRACUNIT,angle:0};assert.equal(stepInspectionCamera(camera,new Set()),false);
    assert.equal(stepInspectionCamera(camera,new Set([119])),true);assert.ok(Math.abs(camera.x-4*FRACUNIT)<16);assert.equal(camera.z,41*FRACUNIT);
    const old=camera.angle;stepInspectionCamera(camera,new Set([97]));assert.equal(camera.angle,(old+ANG45/16)>>>0);
});
