import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/linuxdoom-1.10/g_game';
import { createHeadlessGame } from './helpers/game-session';
import { GameSession } from '../src/web/game-session';
import { VERSION,KEY_ESCAPE,skill_t,GameMode_t } from '../src/linuxdoom-1.10/doomdef.h';
import { buttoncode_t as BT,evtype_t as EV,gameaction_t as GA } from '../src/linuxdoom-1.10/d_event.h';
import { W_CacheLumpName } from '../src/linuxdoom-1.10/w_wad';
import { demoRecordingFixture } from '../src/web/demo-recording';
import { thinkercap,leveltime } from '../src/linuxdoom-1.10/p_tick';
import { states } from '../src/linuxdoom-1.10/info';
import { P_MobjForThinker } from '../src/linuxdoom-1.10/p_mobj';
import { prndindex } from '../src/linuxdoom-1.10/m_random';
import { menuactive,M_ClearMenus } from '../src/linuxdoom-1.10/m_menu';
const cmd=(n=0)=>({forwardmove:0,sidemove:0,angleturn:0,buttons:n,consistancy:0,chatchar:0});
const event=(data1:number)=>({type:EV.ev_keydown,data1,data2:0,data3:0});
function setup(){const f=createHeadlessGame();G.G_InitControlsContext(G.G_CreateControls());return f;}
function stream(commands:ReturnType<typeof cmd>[],header:number[]=[]){const data=new Uint8Array(14+commands.length*4);data.set([VERSION,2,1,1,0,0,0,0,0,1,0,0,0]);data.set(header);commands.forEach((c,i)=>data.set([c.forwardmove,c.sidemove,(c.angleturn+128)>>8,c.buttons],13+i*4));data[data.length-1]=128;return data;}
function world(session:GameSession){const actors=[];for(let t=thinkercap.next;t&&t!==thinkercap;t=t.next){const m=P_MobjForThinker(t);if(m)actors.push([m.type,m.x,m.y,m.z,m.angle,m.health,m.tics,m.state?states.indexOf(m.state):-1,m.sprite,m.frame,m.momx,m.momy,m.momz]);}return {actors,ammo:[...session.player.ammo],health:session.player.health,powers:[...session.player.powers],armor:session.player.armorpoints,weapons:[...session.player.weaponowned],cards:[...session.player.cards],readyweapon:session.player.readyweapon,pendingweapon:session.player.pendingweapon,psprites:session.player.psprites.map(p=>[p.state?states.indexOf(p.state):-1,p.tics,p.sx,p.sy]),leveltime,rng:prndindex};}
test('Demo headers preserve version, flags and four player slots, count tics and allow explicit 1.9 compatibility',()=>{
 const data=stream([cmd(),cmd()], [VERSION,3,2,4,0,1,1,1]);const h=G.G_ReadDemoHeader(data);assert.equal(h.skill,3);assert.equal(h.episode,2);assert.equal(h.map,4);assert.ok(h.fastparm&&h.respawnparm&&h.nomonsters);assert.equal(h.tics,2);assert.deepEqual(h.playeringame,[true,false,false,false]);data[0]=109;assert.throws(()=>G.G_ReadDemoHeader(data),/Versión/);assert.equal(G.G_ReadDemoHeader(data,true).version,109);
});
test('Malformed and unsupported demo streams are rejected before altering the active game',()=>{
 const {session}=setup(),before=world(session);const good=stream([cmd()]);for(const data of [good.subarray(0,5),good.subarray(0,good.length-1),Uint8Array.from([111,...good.subarray(1)]),Uint8Array.from([VERSION,9,...good.subarray(2)])])assert.throws(()=>session.playDemo(data));const bad=good.slice();bad[8]=3;assert.throws(()=>session.playDemo(bad));const noPlayers=good.slice();noPlayers[9]=0;assert.throws(()=>session.playDemo(noPlayers));assert.deepEqual(world(session),before);assert.equal(session.state.gameaction,GA.ga_nothing);
});
test('Browser playback rejects multiplayer, deathmatch and missing destination maps atomically',()=>{
 const {session}=setup(),multi=new Uint8Array(22);multi.set([VERSION,2,1,1,0,0,0,0,0,1,1,0,0]);multi[21]=128;assert.equal(G.G_ReadDemoHeader(multi).tics,1);assert.throws(()=>session.playDemo(multi),/un jugador/);const death=stream([cmd()]);death[4]=1;assert.throws(()=>session.playDemo(death),/deathmatch/);const missing=stream([cmd()]);missing[3]=9;assert.throws(()=>session.playDemo(missing),/E1M9/);assert.equal(session.mapname,'E1M1');assert.equal(session.state.demoplayback,false);
});
test('Playback initializes the native header and consumes signed movements and high-byte angle only',()=>{
 const {session}=setup(),data=stream([{...cmd(BT.BT_ATTACK),forwardmove:-25,sidemove:-40,angleturn:-256}], [VERSION,1]);session.playDemo(data,'unit');assert.equal(session.state.gameaction,GA.ga_playdemo);session.step({...cmd(),forwardmove:50});assert.equal(session.state.gameskill,skill_t.sk_easy);assert.equal(session.demo.tics,1);assert.equal(session.state.demoplayback,true);assert.equal(session.player.cmd.forwardmove,-25);assert.equal(session.player.cmd.sidemove,-40);assert.equal(session.player.cmd.angleturn,-256);const state=world(session);session.step(cmd());assert.equal(session.demo.finished,true);assert.equal(session.state.demoplayback,false);assert.deepEqual(world(session),state);session.step({...cmd(),forwardmove:50});assert.deepEqual(world(session),state);
});
test('Recording quantizes the simulation command, writes the original header and appends exactly one marker',()=>{
 const {session}=setup();session.recordDemo('unit');const input={...cmd(),angleturn:129,forwardmove:25};session.step(input);assert.equal(input.angleturn,129);assert.equal(session.player.cmd.angleturn,256);session.step({...cmd(),angleturn:-129,sidemove:-24});session.finishRecording();const data=G.G_GetRecordedDemo()!;assert.equal(data.length,22);assert.deepEqual([...data.subarray(0,13)],[VERSION,2,1,1,0,0,0,0,0,1,0,0,0]);assert.deepEqual([...data.subarray(13)],[25,0,1,0,0,232,255,0,128]);session.finishRecording();assert.deepEqual(G.G_GetRecordedDemo(),data);assert.equal(session.state.usergame,true);
});
test('A recorded 240-tic run reproduces every actor, inventory, level time and gameplay RNG exactly',()=>{
 const {session}=setup();session.recordDemo('deterministic');for(let i=0;i<240;i++)session.step({...cmd(i>80&&i<180?BT.BT_ATTACK:0),forwardmove:i<20?25:i<40?-25:0,sidemove:i>=40&&i<60?24:0,angleturn:i<100?321:-147});const expected=world(session);session.finishRecording();const bytes=G.G_GetRecordedDemo()!,fresh=setup().session;fresh.playDemo(bytes);for(let i=0;i<240;i++)fresh.step({...cmd(BT.BT_USE),forwardmove:50});assert.deepEqual(world(fresh),expected);fresh.step(cmd());assert.equal(fresh.demo.finished,true);assert.equal(fresh.demo.tics,240);
});
test('Opening a menu does not consume recorded/playback tics and closing resumes the exact next command',()=>{
 const {session}=setup();session.playDemo(stream(Array.from({length:8},()=>({...cmd(),forwardmove:10}))));session.step(cmd());assert.equal(session.demo.tics,1);session.respond(event(KEY_ESCAPE));assert.ok(menuactive);const before=world(session);for(let i=0;i<10;i++)session.step(cmd());assert.equal(session.demo.tics,1);assert.deepEqual(world(session),before);session.respond(event(KEY_ESCAPE));session.step(cmd());assert.equal(session.demo.tics,2);assert.equal(leveltime,2);
});
test('Pause commands in the stream freeze physics but still consume tics until the matching resume',()=>{
 const {session}=setup();session.playDemo(stream([cmd(BT.BT_SPECIAL|BT.BTS_PAUSE),{...cmd(),forwardmove:25},cmd(BT.BT_SPECIAL|BT.BTS_PAUSE),{...cmd(),forwardmove:25}]));session.step(cmd());assert.equal(session.state.paused,true);assert.equal(leveltime,0);session.step(cmd());assert.equal(leveltime,0);assert.equal(session.demo.tics,2);session.step(cmd());assert.equal(session.state.paused,false);assert.equal(leveltime,1);session.step(cmd());assert.equal(leveltime,2);
});
test('Playback respects nomonsters/respawn/fast flags and a fresh session restores normal tables',()=>{
 const {session}=setup();session.playDemo(stream([cmd()],[VERSION,2,1,1,0,1,1,1]));session.step(cmd());assert.equal(session.state.totalkills,0);assert.ok(session.state.fastparm&&session.state.respawnmonsters&&session.state.nomonsters);session.stopDemo();assert.equal(session.state.fastparm,false);assert.equal(session.state.nomonsters,false);assert.ok(session.demo.finished);setup();
});
test('Synthetic WAD contains an authored replay that reaches its marker without an external asset',()=>{
 const {session}=setup(),bytes=W_CacheLumpName('DEMO1',1);assert.deepEqual(bytes,demoRecordingFixture());session.playDemo(bytes,'DEMO1');for(let i=0;i<351;i++)session.step(cmd());assert.ok(session.demo.finished);assert.equal(session.demo.tics,350);assert.equal(leveltime,350);
});
test('Recording restarts the map instead of capturing unreproducible mid-level inventory',()=>{
 const {session}=setup();session.player.health=17;session.player.ammo[0]=2;for(let i=0;i<7;i++)session.step({...cmd(),forwardmove:25});session.recordDemo();session.step(cmd());assert.equal(session.state.gametic,1);assert.equal(session.player.health,100);assert.equal(session.player.ammo[0],50);assert.equal(leveltime,1);session.finishRecording();assert.equal(G.G_ReadDemoHeader(G.G_GetRecordedDemo()!).tics,1);
});
test('Recording buffer exhaustion finishes safely and preserves a complete parseable stream',()=>{
 const {session}=setup();G.G_RecordDemo('small',32);G.G_BeginRecording();for(let i=0;i<12&&session.state.demorecording;i++)session.step(cmd());const data=G.G_GetRecordedDemo()!;assert.ok(data.length<=32);assert.equal(data[data.length-1],128);assert.equal(G.G_ReadDemoHeader(data).tics,session.demo.tics);assert.equal(session.state.demorecording,false);
});
test('Starting a new native game terminates a recording and exits replay mode cleanly',()=>{
 const {session}=setup();session.recordDemo();session.step(cmd());G.G_DeferedInitNew(skill_t.sk_hard,1,1);session.step(cmd());assert.equal(session.state.demorecording,false);assert.equal(G.G_ReadDemoHeader(G.G_GetRecordedDemo()!).tics,1);session.playDemo(stream([cmd()]));session.step(cmd());G.G_DeferedInitNew(skill_t.sk_easy,1,1);session.step(cmd());assert.equal(session.state.demoplayback,false);assert.equal(session.demo.finished,false);assert.equal(session.state.gameskill,skill_t.sk_easy);M_ClearMenus();
});

test('A demo records and replays the native intermission and next-level transition in one stream',()=>{
 const first=createHeadlessGame(true).session;G.G_InitControlsContext(G.G_CreateControls());first.recordDemo();let reached=false;for(let i=0;i<400;i++){first.step(cmd(i%10===2?BT.BT_USE:0));if(first.mapname==='E1M2')reached=true;}assert.ok(reached);const expected={...world(first),map:first.mapname,state:first.state.gamestate};first.finishRecording();const data=G.G_GetRecordedDemo()!,second=createHeadlessGame(true).session;second.playDemo(data);for(let i=0;i<400;i++)second.step(cmd());assert.deepEqual({...world(second),map:second.mapname,state:second.state.gamestate},expected);second.step(cmd());assert.ok(second.demo.finished);
});
test('Angle quantization preserves rounding boundaries and signed-short wrap at 180 degrees',()=>{
 const {session}=setup();session.recordDemo();const angles=[-32768,-32767,-129,-128,-1,0,127,128,32767],expected=[-32768,-32768,-256,0,0,0,0,256,-32768];angles.forEach((angle,i)=>{session.step({...cmd(),angleturn:angle});assert.equal(session.player.cmd.angleturn,expected[i]);});session.finishRecording();const data=G.G_GetRecordedDemo()!,replay=setup().session;replay.playDemo(data);expected.forEach(angle=>{replay.step(cmd());assert.equal(replay.player.cmd.angleturn,angle);});
});
test('Empty demos end before physics, and bytes after the native marker are ignored',()=>{
 const {session}=setup(),empty=stream([]),padded=new Uint8Array(empty.length+4);padded.set(empty);padded.fill(42,empty.length);assert.equal(G.G_ReadDemoHeader(padded).end,14);session.playDemo(padded);session.step({...cmd(),forwardmove:50});assert.equal(session.demo.tics,0);assert.ok(session.demo.finished);assert.equal(leveltime,0);
});
