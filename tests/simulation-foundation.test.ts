import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P_InitThinkers, P_AddThinker, P_RemoveThinker, P_RunThinkers, thinkercap, P_Ticker, P_ResetLevelTime, leveltime, type ticker_context_t } from '../src/linuxdoom-1.10/p_tick';
import type { thinker_t } from '../src/linuxdoom-1.10/d_think.h';
import type { player_t } from '../src/linuxdoom-1.10/d_player.h';
import { P_AproxDistance, P_PointOnLineSide, P_PointOnDivlineSide, P_BoxOnLineSide, P_MakeDivline, P_InterceptVector, P_LineOpening, openings,
    P_SetThingPosition, P_UnsetThingPosition, P_BlockLinesIterator, P_BlockThingsIterator, P_PathTraverse, P_TraverseIntercepts, PIT_AddThingIntercepts, intercepts, trace } from '../src/linuxdoom-1.10/p_maputl';
import { PT_ADDLINES, PT_ADDTHINGS, PT_EARLYOUT, MAXINTERCEPTS, type divline_t } from '../src/linuxdoom-1.10/p_local.h';
import { mobjflag_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { slopetype_t } from '../src/linuxdoom-1.10/r_defs.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { view } from '../src/linuxdoom-1.10/r_main';
import { W_InitFile, W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../src/linuxdoom-1.10/r_data';
import { R_InitSprites } from '../src/linuxdoom-1.10/r_things';
import { sprnames } from '../src/linuxdoom-1.10/info';
import { P_LoadMapData } from '../src/linuxdoom-1.10/p_setup';
import { demoWad } from '../src/web/demo';
import { createStaticMapActors } from '../src/web/map-actors';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';

function thinker(fn: (self: thinker_t) => void): thinker_t { return { prev: null, next: null, function: (arg: unknown) => fn(arg as thinker_t) }; }
function init() { W_InitFile({name:'demo.wad',data:demoWad()}); R_InitData(); P_LoadMapData(W_GetNumForName('E1M1')); R_InitSprites(sprnames); return createStaticMapActors()[0]; }

test('Thinkers preserve insertion order, null actions and lazy removal', () => {
    P_InitThinkers(); const calls: string[] = [];
    const a = thinker(() => calls.push('a')), b = thinker(() => calls.push('b')), c: thinker_t = {prev:null,next:null,function:null};
    P_AddThinker(a); P_AddThinker(b); P_AddThinker(c);
    assert.strictEqual(thinkercap.next,a); assert.strictEqual(thinkercap.prev,c);
    P_RemoveThinker(b); assert.strictEqual(a.next,b); P_RunThinkers();
    assert.deepEqual(calls,['a']); assert.strictEqual(a.next,c); assert.strictEqual(c.prev,a);
    P_RemoveThinker(a); P_RemoveThinker(c); P_RunThinkers();
    assert.strictEqual(thinkercap.next,thinkercap); assert.strictEqual(thinkercap.prev,thinkercap);
});
test('Thinker callbacks can append this tic, mark future nodes and remove themselves next tic', () => {
    P_InitThinkers(); const calls: string[] = [];
    const b = thinker(() => calls.push('b')), c = thinker(() => calls.push('c'));
    const a = thinker(self => {calls.push('a');P_AddThinker(c);P_RemoveThinker(b);P_RemoveThinker(self);});
    P_AddThinker(a); P_AddThinker(b); P_RunThinkers(); assert.deepEqual(calls,['a','c']);
    assert.strictEqual(thinkercap.next,a); P_RunThinkers(); assert.deepEqual(calls,['a','c','c']); assert.strictEqual(thinkercap.next,c);
});
test('Ticker preserves four-player order, pause rules, special updates and level clock', () => {
    P_InitThinkers();P_ResetLevelTime();const calls: string[] = [];
    const players = Array.from({length:4},(_,i)=>({viewz:1,id:i} as unknown as player_t));
    const game: ticker_context_t = {paused:false,netgame:false,menuactive:false,demoplayback:false,players,consoleplayer:0,playeringame:[true,false,true,true],
        P_PlayerThink: p => calls.push(`p${players.indexOf(p)}`), P_UpdateSpecials:()=>calls.push('specials'),P_RespawnSpecials:()=>calls.push('respawn')};
    P_AddThinker(thinker(()=>calls.push('thinker')));P_Ticker(game);
    assert.deepEqual(calls,['p0','p2','p3','thinker','specials','respawn']);assert.equal(leveltime,1);
    calls.length=0;game.paused=true;P_Ticker(game);assert.equal(leveltime,1);assert.equal(calls.length,0);
    game.paused=false;game.menuactive=true;players[0].viewz=2;P_Ticker(game);assert.equal(leveltime,1);
    players[0].viewz=1;P_Ticker(game);assert.equal(leveltime,2);
    players[0].viewz=2;game.netgame=true;P_Ticker(game);assert.equal(leveltime,3);
    game.netgame=false;game.demoplayback=true;P_Ticker(game);assert.equal(leveltime,4);
});
test('Position links preserve head/middle/tail and relink after moving between blocks', () => {
    const a=init();a.flags=0;P_UnsetThingPosition(a);P_SetThingPosition(a);
    const b={...a,thinker:{...a.thinker}},c={...a,thinker:{...a.thinker}};P_SetThingPosition(b);P_SetThingPosition(c);
    assert.strictEqual(a.sprev,b);assert.strictEqual(b.sprev,c);assert.strictEqual(c.bnext,b);
    const x=(a.x-m.bmaporgx)>>23,y=(a.y-m.bmaporgy)>>23,index=y*m.bmapwidth+x;
    assert.strictEqual(m.blocklinks[index],c);P_UnsetThingPosition(b);assert.strictEqual(c.bnext,a);assert.strictEqual(a.bprev,c);
    P_UnsetThingPosition(c);assert.strictEqual(m.blocklinks[index],a);assert.equal(a.bprev,null);
    P_UnsetThingPosition(a);assert.equal(m.blocklinks[index],null);assert.equal(m.sectors[0].thinglist,null);
    a.x=-64*F;a.y=-64*F;P_SetThingPosition(a);assert.strictEqual(a.subsector!.sector!.thinglist,a);
    const seen: unknown[]=[];P_BlockThingsIterator((a.x-m.bmaporgx)>>23,(a.y-m.bmaporgy)>>23,o=>{seen.push(o);return true;});assert.deepEqual(seen,[a]);
    assert.equal(P_BlockThingsIterator((a.x-m.bmaporgx)>>23,(a.y-m.bmaporgy)>>23,()=>false),false);
});
test('NOSECTOR, NOBLOCKMAP and off-map origins have independent link behavior',()=>{
    const a=init();P_UnsetThingPosition(a);m.blocklinks.fill(null);a.flags=mobjflag_t.MF_NOSECTOR;P_SetThingPosition(a);
    assert.equal(m.sectors[0].thinglist,null);assert.ok(m.blocklinks.includes(a));assert.ok(a.subsector);P_UnsetThingPosition(a);
    a.flags=mobjflag_t.MF_NOBLOCKMAP;P_SetThingPosition(a);assert.strictEqual(m.sectors[0].thinglist,a);assert.ok(!m.blocklinks.includes(a));P_UnsetThingPosition(a);
    a.flags=0;a.x=3000*F;P_SetThingPosition(a);assert.strictEqual(m.sectors[0].thinglist,a);assert.equal(a.bnext,null);assert.equal(a.bprev,null);P_UnsetThingPosition(a);
});
test('BLOCKMAP lines include dummy line zero once and deduplicate across blocks',()=>{
    init();view.validcount++;const seen: number[]=[];
    for(let y=0;y<m.bmapheight;y++)for(let x=0;x<m.bmapwidth;x++)assert.equal(P_BlockLinesIterator(x,y,l=>{seen.push(m.lines.indexOf(l));return true;}),true);
    assert.deepEqual(seen,[0,1,2,3]);view.validcount++;let calls=0;assert.equal(P_BlockLinesIterator(0,0,()=>{calls++;return false;}),false);assert.equal(calls,1);
    assert.equal(P_BlockLinesIterator(-1,0,()=>{throw Error('outside');}),true);
    assert.equal(P_BlockThingsIterator(m.bmapwidth,0,()=>{throw Error('outside');}),true);
});
test('Geometry preserves fixed point side tests, box crossings and intercept fractions',()=>{
    init();assert.equal(P_AproxDistance(-3*F,4*F),5.5*F);
    const base=m.lines[0];
    for(const [dx,dy,slope] of [[8*F,0,slopetype_t.ST_HORIZONTAL],[0,8*F,slopetype_t.ST_VERTICAL],[8*F,8*F,slopetype_t.ST_POSITIVE],[8*F,-8*F,slopetype_t.ST_NEGATIVE]] as const){
        const line={...base,v1:{x:0,y:0},v2:{x:dx,y:dy},dx,dy,slopetype:slope};const dl:divline_t={x:0,y:0,dx:0,dy:0};P_MakeDivline(line,dl);
        assert.deepEqual(dl,{x:0,y:0,dx,dy});assert.equal(P_BoxOnLineSide([F,-F,-F,F],line),-1);
        for(const [x,y] of [[2*F,3*F],[-2*F,3*F],[2*F,-3*F],[-2*F,-3*F],[0,0]])assert.equal(P_PointOnDivlineSide(x,y,dl),P_PointOnLineSide(x,y,line));
    }
    assert.equal(P_InterceptVector({x:0,y:0,dx:100*F,dy:0},{x:25*F,y:-10*F,dx:0,dy:20*F}),F/4);
    assert.equal(P_InterceptVector({x:0,y:0,dx:F,dy:0},{x:0,y:F,dx:F,dy:0}),0);
});
test('Line openings choose restrictive ceiling/floor and single sided preserves other globals',()=>{
    init();const line={...m.lines[0],sidenum:[0,0] as [number,number],frontsector:{...m.sectors[0],floorheight:20*F,ceilingheight:100*F},backsector:{...m.sectors[0],floorheight:30*F,ceilingheight:120*F}};
    P_LineOpening(line);assert.deepEqual(openings,{opentop:100*F,openbottom:30*F,openrange:70*F,lowfloor:20*F});
    line.sidenum[1]=-1;P_LineOpening(line);assert.equal(openings.openrange,0);assert.equal(openings.opentop,100*F);
});
test('Path traversal orders object and wall hits, omits beyond end and supports early out',()=>{
    const a=init();P_UnsetThingPosition(a);a.flags=0;a.x=72*F;a.y=24*F;a.radius=16*F;P_SetThingPosition(a);
    const hits:{frac:number;line:boolean}[]=[];
    assert.equal(P_PathTraverse(0,24*F,256*F,24*F,PT_ADDLINES|PT_ADDTHINGS,i=>{hits.push({frac:i.frac,line:i.isaline});return true;}),true);
    // Origin lies on a BLOCKMAP boundary: C nudges x from 0 to 1 before tracing.
    assert.deepEqual(hits,[{frac:Math.trunc(71/255*F),line:false},{frac:Math.trunc(127/255*F),line:true}]);
    let calls=0;assert.equal(P_PathTraverse(0,24*F,256*F,24*F,PT_ADDLINES|PT_EARLYOUT,()=>{calls++;return true;}),false);assert.equal(calls,0);
    assert.equal(P_PathTraverse(0,24*F,30*F,24*F,PT_ADDLINES|PT_ADDTHINGS,()=>{calls++;return true;}),true);assert.equal(calls,0);
    assert.equal(P_PathTraverse(0,24*F,256*F,24*F,PT_ADDTHINGS,()=>false),false);
});
test('Path traversal handles axes, all diagonal quadrants and nudges block-boundary start',()=>{
    init();for(const [x,y] of [[256,0],[-256,0],[0,256],[0,-256],[256,256],[-256,256],[256,-256],[-256,-256]]){
        const hits:number[]=[];P_PathTraverse(0,0,x*F,y*F,PT_ADDLINES,i=>{hits.push(i.frac);return true;});assert.ok(hits.length>0,`${x},${y}`);
        const candidates=[trace.dx?((Math.sign(trace.dx)*128*F-trace.x)/trace.dx):Infinity,trace.dy?((Math.sign(trace.dy)*128*F-trace.y)/trace.dy):Infinity];
        const expected=Math.trunc(Math.min(...candidates)*F);assert.ok(hits.every(f=>Math.abs(f-expected)<=1),`${x},${y}: ${hits} versus ${expected}`);
    }
    P_PathTraverse(m.bmaporgx,m.bmaporgy,m.bmaporgx+10*F,m.bmaporgy+10*F,0,()=>true);
    assert.equal(trace.x,m.bmaporgx+F);assert.equal(trace.y,m.bmaporgy+F);
});
test('Intercept traversal is stable on ties, mutates visited fractions and rejects overflow',()=>{
    const a=init();intercepts.length=0;
    const first={frac:F/4,isaline:false as const,d:{thing:a}},second={...first},third={...first,frac:F/2};intercepts.push(third,first,second);
    const seen:unknown[]=[];assert.equal(P_TraverseIntercepts(i=>{seen.push(i);return true;},F/4),true);assert.deepEqual(seen,[first,second]);assert.equal(first.frac,0x7fffffff);assert.equal(third.frac,F/2);
    intercepts.length=0;trace.x=0;trace.y=a.y;trace.dx=256*F;trace.dy=0;
    for(let i=0;i<MAXINTERCEPTS;i++)assert.equal(PIT_AddThingIntercepts(a),true);
    assert.throws(()=>PIT_AddThingIntercepts(a),/MAXINTERCEPTS/);intercepts.length=0;
});
