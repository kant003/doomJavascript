import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as AM from '../src/linuxdoom-1.10/am_map';
import * as ST from '../src/linuxdoom-1.10/st_stuff';
import * as HU from '../src/linuxdoom-1.10/hu_stuff';
import { createHeadlessGame } from './helpers/game-session';
import { mapstate as map } from '../src/linuxdoom-1.10/r_state.h';
import { ML_MAPPED,ML_DONTDRAW,ML_SECRET } from '../src/linuxdoom-1.10/doomdata.h';
import { screens } from '../src/linuxdoom-1.10/v_video';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { KEY_TAB,KEY_RIGHTARROW,KEY_LEFTARROW,powertype_t as PW } from '../src/linuxdoom-1.10/doomdef.h';
import { evtype_t as EV,buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { M_ClearRandom,rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import { AM_MSGENTERED,AM_MSGEXITED } from '../src/linuxdoom-1.10/am_map.h';
const event=(key:number,type=EV.ev_keydown)=>({type,data1:key,data2:0,data3:0}),cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons});
const line=(ax:number,ay:number,bx:number,by:number):AM.mline_t=>({a:{x:ax,y:ay},b:{x:bx,y:by}});
const colors=()=>new Set(screens[0].subarray(0,320*168));
function fixture(){const value=createHeadlessGame(true);assert.ok(AM.AM_CanLoad());assert.equal(value.session.respond(event(KEY_TAB)),true);return value;}
function key(value:string){return AM.AM_Responder(event(value.charCodeAt(0)));}
function reveal(target:number){for(let i=0;i<3&&AM.AM_GetState().cheating!==target;i++)for(const c of 'iddt')key(c);assert.equal(AM.AM_GetState().cheating,target);}
test('Tab opens native automap, keeps status pixels intact and returns to the world',()=>{
 const {session}=fixture();assert.equal(session.state.automapactive,true);assert.equal(session.state.viewactive,false);screens[0].fill(77);AM.AM_Drawer();assert.ok(screens[0].subarray(320*168).every(v=>v===77));assert.ok(colors().has(209));assert.equal(session.respond(event(KEY_TAB)),true);assert.equal(session.state.automapactive,false);assert.equal(session.state.viewactive,true);
});
test('Automap scale zooms on tics, clamps both limits, releases on keyup and restores the big view',()=>{
 fixture();const before=AM.AM_GetState().scale;key('=');for(let i=0;i<400;i++)AM.AM_Ticker();assert.equal(AM.AM_GetState().scale,AM.AM_GetState().maxScale);AM.AM_Responder(event(61,EV.ev_keyup));const fixed=AM.AM_GetState().scale;AM.AM_Ticker();assert.equal(AM.AM_GetState().scale,fixed);key('-');for(let i=0;i<400;i++)AM.AM_Ticker();assert.equal(AM.AM_GetState().scale,AM.AM_GetState().minScale);AM.AM_Responder(event(45,EV.ev_keyup));key('=');AM.AM_Ticker();AM.AM_Responder(event(61,EV.ev_keyup));const restore=AM.AM_GetState().scale;key('0');assert.equal(AM.AM_GetState().scale,AM.AM_GetState().minScale);key('0');assert.ok(Math.abs(AM.AM_GetState().scale-restore)<=1);assert.ok(before>0);
});
test('Follow mode updates with the actor; disabling it enables clamped pan and releases its increment',()=>{
 const {session}=fixture();if(!AM.AM_GetState().followplayer)key('f');AM.AM_Ticker();const old=AM.AM_GetState().x;session.player.mo!.x+=32*F;AM.AM_Ticker();assert.notEqual(AM.AM_GetState().x,old);assert.equal(AM.AM_Responder(event(KEY_RIGHTARROW)),false);key('f');const before=AM.AM_GetState().x;assert.equal(AM.AM_Responder(event(KEY_RIGHTARROW)),true);for(let i=0;i<200;i++)AM.AM_Ticker();const end=AM.AM_GetState();assert.ok(end.x>=before);assert.ok(end.x+Math.trunc(end.width/2)<=Math.max(...map.vertexes.map(v=>v.x)));AM.AM_Responder(event(KEY_RIGHTARROW,EV.ev_keyup));AM.AM_Ticker();assert.equal(AM.AM_GetState().x,end.x);key('f');
});
test('Markers wrap ten slots, clear without leaving resources and survive a same-level close/reopen',()=>{
 const {session}=fixture();for(let i=0;i<12;i++)key('m');assert.equal(AM.AM_GetState().nextMark,2);assert.ok(AM.AM_GetState().marks.every(m=>m.x!==-1));session.respond(event(KEY_TAB));session.respond(event(KEY_TAB));assert.equal(AM.AM_GetState().nextMark,2);key('c');assert.equal(AM.AM_GetState().nextMark,0);assert.ok(AM.AM_GetState().marks.every(m=>m.x===-1));key('m');AM.AM_Drawer();session.start();session.respond(event(KEY_TAB));assert.equal(AM.AM_GetState().nextMark,0);
});
test('Wall colors distinguish mapped walls, hidden lines, teleporters, secrets and sector height changes',()=>{
 const {session}=fixture();reveal(0);const wall=map.lines[1],saved={...wall};for(const l of map.lines)l.flags=ML_DONTDRAW;wall.flags=ML_MAPPED;
 const draw=()=>{AM.AM_clearFB(0);AM.AM_drawWalls();return colors();};assert.ok(draw().has(176));wall.flags|=ML_DONTDRAW;assert.deepEqual([...draw()],[0]);wall.flags=0;session.player.powers[PW.pw_allmap]=1;assert.ok(draw().has(99));session.player.powers[PW.pw_allmap]=0;wall.flags=ML_MAPPED;wall.backsector={...wall.frontsector!};wall.special=39;assert.ok(draw().has(184));wall.special=0;wall.backsector.floorheight+=F;assert.ok(draw().has(64));wall.backsector.floorheight=wall.frontsector!.floorheight;wall.backsector.ceilingheight+=F;assert.ok(draw().has(231));wall.flags|=ML_SECRET;assert.ok(draw().has(176));wall.flags=ML_MAPPED;wall.backsector.ceilingheight=wall.frontsector!.ceilingheight;assert.deepEqual([...draw()],[0]);reveal(1);assert.ok(draw().has(96));Object.assign(wall,saved);
});
test('IDD T cycles full lines and things; deathmatch disables the reveal sequence',()=>{
 const {session}=fixture();reveal(0);AM.AM_clearFB(0);AM.AM_drawThings(112,16);assert.ok(colors().has(112));reveal(2);AM.AM_Drawer();assert.ok(colors().has(112));reveal(0);session.state.deathmatch=1;for(const c of 'iddt')key(c);assert.equal(AM.AM_GetState().cheating,0);
});
test('Grid, slope and fixed rotation retain original integer rules and do not consume RNG',()=>{
 fixture();M_ClearRandom();key('g');if(!AM.AM_GetState().grid)key('g');AM.AM_Drawer();assert.ok(colors().has(104));const slope={slp:0,islp:0};AM.AM_getIslope(line(0,0,F,0),slope);assert.equal(slope.islp,0x7fffffff);assert.equal(slope.slp,0);const p={x:F,y:0};AM.AM_rotate(p,0x40000000);assert.ok(Math.abs(p.x)<=30);assert.ok(Math.abs(p.y-F)<=30);assert.equal(rndindex,0);assert.equal(prndindex,0);
});
test('Native clipping rejects outside lines and rasterizes all octants inside the 320x168 buffer',()=>{
 fixture();const state=AM.AM_GetState(),cx=state.x+Math.trunc(state.width/2),cy=state.y+Math.trunc(state.height/2),out=line(0,0,0,0);assert.equal(AM.AM_clipMline(line(state.x-10*F,state.y,state.x-20*F,state.y+F),out),false);
 for(const [x,y] of [[0,0],[319,0],[319,167],[0,167],[160,0],[319,84],[160,167],[0,84]]){AM.AM_clearFB(0);AM.AM_drawFline(line(160,84,x,y),77);assert.equal(screens[0][y*320+x],77);assert.equal(screens[0][84*320+160],77);}
 assert.equal(AM.AM_clipMline(line(cx-state.width,cy,cx+state.width,cy),out),true);assert.ok([out.a,out.b].every(p=>p.x>=0&&p.x<320&&p.y>=0&&p.y<168));AM.AM_drawFline(line(-1,0,1,0),50);
});
test('HUD and status notifications follow native order, including the malformed exit initializer',()=>{
 const {session}=createHeadlessGame(true),events:ReturnType<typeof event>[]=[];AM.AM_InitContext({...session.state,ST_Responder:e=>{events.push(e);return ST.ST_Responder(e);}});AM.AM_Start();assert.equal(events[0].type,EV.ev_keyup);assert.equal(events[0].data1,AM_MSGENTERED);AM.AM_Stop();assert.deepEqual(events[1],{type:EV.ev_keydown,data1:EV.ev_keyup,data2:AM_MSGEXITED,data3:0});
 // Restore the live context rather than the spread copy used to capture notifications.
 AM.AM_InitContext(session.state);
});
test('Automap keeps the world ticking, shows native messages/title and closes on level completion',()=>{
 const {session}=fixture();session.respond(event(109));session.step(cmd());assert.equal(session.headsUp!.text,'Marked Spot 0');assert.equal(AM.AM_GetState().clock,1);HU.HU_Drawer();assert.equal(session.state.automapactive,true);session.state.G_ExitLevel();session.step(cmd());assert.equal(session.state.automapactive,false);
});

test('Native net-player colors respect invisibility, deathmatch and singledemo visibility',()=>{
 const {session}=fixture(),g=session.state,p=g.players[0];g.netgame=true;g.playeringame[1]=true;g.players[1].mo={...p.mo!,x:p.mo!.x+32*F};
 AM.AM_clearFB(0);AM.AM_drawPlayers();assert.ok(colors().has(112));assert.ok(colors().has(96));g.deathmatch=1;AM.AM_clearFB(0);AM.AM_drawPlayers();assert.equal(colors().has(96),false);g.singledemo=true;AM.AM_clearFB(0);AM.AM_drawPlayers();assert.ok(colors().has(96));g.players[1].powers[PW.pw_invisibility]=1;AM.AM_clearFB(0);AM.AM_drawPlayers();assert.ok(colors().has(246));
});
test('Missing marker graphics report the problem without interrupting gameplay or losing the HUD',()=>{
 const {session}=createHeadlessGame(true);const bytes=playableDemoWad(true),v=new DataView(bytes.buffer),directory=v.getInt32(8,true);
 for(let i=0;i<v.getInt32(4,true);i++){const at=directory+i*16,name=new TextDecoder().decode(bytes.subarray(at+8,at+16)).replace(/\0/g,'');if(name==='AMMNUM0')bytes[at+8]=88;}
 AM.AM_ResetLevel();W_InitFile({name:'no-marks.wad',data:bytes});session.start();assert.equal(session.respond(event(KEY_TAB)),true);session.step(cmd());assert.equal(session.state.automapactive,false);assert.equal(session.state.viewactive,true);assert.equal(session.headsUp!.text,'Faltan los gráficos AMMNUM del automapa en este WAD.');
});
import { playableDemoWad } from '../src/web/playable-demo';
import { W_InitFile } from '../src/linuxdoom-1.10/w_wad';
