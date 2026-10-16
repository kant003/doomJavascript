import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WI_InitContext,WI_Start,WI_Ticker,WI_GetState } from '../src/linuxdoom-1.10/wi_stuff';
import { stateenum_t as ST } from '../src/linuxdoom-1.10/wi_stuff.h';
import { G_CreatePlayer,G_CreateIntermission } from '../src/linuxdoom-1.10/g_game';
import { GameMode_t as MODE } from '../src/linuxdoom-1.10/doomdef.h';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
function fixture(mode=MODE.shareware){
 const players=Array.from({length:4},G_CreatePlayer),info=G_CreateIntermission(),sounds:{tic:number;id:SFX}[]=[];let done=0;
 const context={gamemode:mode,players,playeringame:[true,false,false,false],netgame:false,deathmatch:0,S_ChangeMusic:()=>{},S_StartSound:(_origin:null,id:SFX)=>sounds.push({tic:WI_GetState().bcnt,id}),G_WorldDone:()=>done++};
 WI_InitContext(context);WI_Start(info);
 const tick=(n=1,buttons=0)=>{for(let i=0;i<n;i++){players[0].cmd.buttons=buttons;WI_Ticker();}};
 return {players,info,sounds,context,tick,get done(){return done;}};
}
test('Intermission normalizes zero denominators in the original shared structure and resets counters',()=>{
 const f=fixture();assert.deepEqual([f.info.maxkills,f.info.maxitems,f.info.maxsecret],[1,1,1]);
 assert.deepEqual([WI_GetState().kills,WI_GetState().items,WI_GetState().secret,WI_GetState().time,WI_GetState().par],[-1,-1,-1,-1,-1]);
 f.tick(10,BT.BT_ATTACK);WI_Start(f.info);assert.equal(WI_GetState().bcnt,0);assert.equal(WI_GetState().sp_state,1);
 f.info.epsd=3;WI_Start(f.info);assert.equal(f.info.epsd,0);f.context.gamemode=MODE.retail;f.info.epsd=3;WI_Start(f.info);assert.equal(f.info.epsd,3);
});
test('Single-player counting preserves every original pause, truncation, step and sound boundary',()=>{
 const f=fixture(),p=f.info.plyr[0];f.info.maxkills=3;f.info.maxitems=2;f.info.maxsecret=1;p.skills=1;p.sitems=1;p.ssecret=1;p.stime=7*35+34;f.info.partime=5*35+34;
 f.tick(34);assert.equal(WI_GetState().sp_state,1);assert.equal(WI_GetState().kills,-1);
 f.tick();assert.equal(WI_GetState().sp_state,2);assert.equal(WI_GetState().kills,-1);
 f.tick();assert.equal(WI_GetState().kills,1);assert.deepEqual(f.sounds,[{tic:36,id:SFX.sfx_pistol}]);
 f.tick(16);assert.equal(WI_GetState().kills,33);assert.equal(WI_GetState().sp_state,3);
 f.tick(35);assert.equal(WI_GetState().sp_state,4);f.tick(26);assert.equal(WI_GetState().items,50);assert.equal(WI_GetState().sp_state,5);
 f.tick(35+51);assert.equal(WI_GetState().secret,100);assert.equal(WI_GetState().sp_state,7);
 f.tick(35);assert.equal(WI_GetState().sp_state,8);f.tick();assert.deepEqual([WI_GetState().time,WI_GetState().par],[2,2]);
 f.tick();assert.deepEqual([WI_GetState().time,WI_GetState().par],[5,5]);f.tick();assert.deepEqual([WI_GetState().time,WI_GetState().par],[7,5]);
 f.tick(34);assert.equal(WI_GetState().sp_state,9);f.tick();assert.equal(WI_GetState().bcnt,272);assert.equal(WI_GetState().sp_state,10);
 assert.deepEqual(f.sounds.filter(s=>s.id===SFX.sfx_barexp).map(s=>s.tic),[52,113,199,237]);
 assert.ok(f.sounds.filter(s=>s.id===SFX.sfx_pistol).every(s=>s.tic%4===0));f.tick(200);assert.equal(f.done,0);
});
test('Attack fills all statistics once; holding it cannot skip the summary',()=>{
 const f=fixture();f.info.plyr[0].skills=4;f.info.maxkills=3;f.tick(1,BT.BT_ATTACK);
 assert.equal(WI_GetState().kills,133);assert.equal(WI_GetState().sp_state,10);assert.equal(f.sounds.length,1);
 f.tick(200,BT.BT_ATTACK);assert.equal(WI_GetState().state,ST.StatCount);assert.equal(f.done,0);
 f.tick();f.tick(1,BT.BT_ATTACK);assert.equal(WI_GetState().state,ST.ShowNextLoc);assert.equal(WI_GetState().cnt,140);assert.equal(f.sounds.at(-1)!.id,SFX.sfx_sgcock);
 f.tick(139);assert.equal(WI_GetState().state,ST.ShowNextLoc);f.tick();assert.equal(WI_GetState().state,ST.NoState);assert.equal(WI_GetState().cnt,10);
 f.tick(9);assert.equal(f.done,0);f.tick();assert.equal(f.done,1);
});
test('Use held at the exit is ignored until released; a fresh press advances the next location',()=>{
 const f=fixture();f.players[0].usedown=1;f.tick(1,BT.BT_USE);assert.equal(WI_GetState().sp_state,1);
 f.tick();f.tick(1,BT.BT_USE);assert.equal(WI_GetState().sp_state,10);f.tick();f.tick(1,BT.BT_USE);assert.equal(WI_GetState().state,ST.ShowNextLoc);
 f.tick();f.tick(1,BT.BT_USE);assert.equal(WI_GetState().state,ST.NoState);f.tick(10);assert.equal(f.done,1);
});
test('Commercial intermission omits the map-location delay and uses exactly ten final tics',()=>{
 const f=fixture(MODE.commercial);f.tick(1,BT.BT_ATTACK);f.tick();f.tick(1,BT.BT_USE);assert.equal(WI_GetState().state,ST.NoState);
 f.tick(9);assert.equal(f.done,0);f.tick();assert.equal(f.done,1);
});
test('Only active players accelerate and all-zero statistics finish without NaN',()=>{
 const f=fixture();f.players[1].cmd.buttons=BT.BT_ATTACK;f.tick(179);assert.equal(WI_GetState().sp_state,10);
 assert.deepEqual([WI_GetState().kills,WI_GetState().items,WI_GetState().secret,WI_GetState().time,WI_GetState().par],[0,0,0,0,0]);assert.equal(f.done,0);
});
test('Unconverted multiplayer intermissions are rejected explicitly',()=>{
 const f=fixture();f.context.netgame=true;assert.throws(()=>WI_Start(f.info),/Multiplayer/);f.context.netgame=false;f.context.deathmatch=1;assert.throws(()=>WI_Start(f.info),/Multiplayer/);
});
