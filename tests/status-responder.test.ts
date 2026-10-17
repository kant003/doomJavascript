import { leveltime } from '../src/linuxdoom-1.10/p_tick';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/game-session';
import * as ST from '../src/linuxdoom-1.10/st_stuff';
import * as G from '../src/linuxdoom-1.10/g_game';
import { evtype_t as EV,gameaction_t as GA } from '../src/linuxdoom-1.10/d_event.h';
import { cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { GameMode_t as MODE,powertype_t as PW,weapontype_t as WP,skill_t } from '../src/linuxdoom-1.10/doomdef.h';
import { S_GetMusicState } from '../src/linuxdoom-1.10/s_sound';
import { states,mobjinfo } from '../src/linuxdoom-1.10/info';
import { statenum_t as STATE,mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import * as TEXT from '../src/linuxdoom-1.10/d_englsh.h';
const event=(c:number,type=EV.ev_keydown)=>({type,data1:c,data2:0,data3:0}),cmd=()=>({forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons:0});
function type(text:string){for(const ch of text)assert.equal(ST.ST_Responder(event(ch.charCodeAt(0))),false);}
test('God mode toggles through the original encoded recognizer and restores both health fields',()=>{
 const {session}=createHeadlessGame(true),p=session.player;p.health=p.mo!.health=17;type('iddqd');assert.ok(p.cheats&CF.CF_GODMODE);assert.equal(p.health,100);assert.equal(p.mo!.health,100);assert.equal(p.message,TEXT.STSTR_DQDON);type('iddqd');assert.equal(p.cheats&CF.CF_GODMODE,0);assert.equal(p.message,TEXT.STSTR_DQDOFF);
});
test('IDFA and IDKFA preserve armor, every weapon/ammo and their different key behavior',()=>{
 const {session}=createHeadlessGame(true),p=session.player;type('idfa');assert.equal(p.armorpoints,200);assert.equal(p.armortype,2);assert.ok(p.weaponowned.every(Boolean));assert.deepEqual(p.ammo,p.maxammo);assert.ok(p.cards.every(v=>!v));type('idkfa');assert.ok(p.cards.every(Boolean));assert.equal(p.message,TEXT.STSTR_KFAADDED);
});
test('Both noclip spellings toggle the original player flag, including across repeated uses',()=>{
 const {session}=createHeadlessGame(true);type('idclip');assert.ok(session.player.cheats&CF.CF_NOCLIP);type('idspispopd');assert.equal(session.player.cheats&CF.CF_NOCLIP,0);assert.equal(session.player.message,TEXT.STSTR_NCOFF);
});
test('BEHOLD power cheats use real P_GivePower and preserve the native toggle counters',()=>{
 const {session}=createHeadlessGame(true),p=session.player;for(const [suffix,power] of [['v',PW.pw_invulnerability],['s',PW.pw_strength],['i',PW.pw_invisibility],['r',PW.pw_ironfeet],['a',PW.pw_allmap],['l',PW.pw_infrared]] as const){type('idbehold'+suffix);assert.ok(p.powers[power]>0);assert.equal(p.message,TEXT.STSTR_BEHOLDX);type('idbehold'+suffix);assert.equal(p.powers[power],power===PW.pw_strength?0:1);}type('idbehold');assert.equal(p.message,TEXT.STSTR_BEHOLD);
});
test('CHOPPERS preserves its one-tic invulnerability quirk and MYPOS formats unsigned hex',()=>{
 const {session}=createHeadlessGame(true),p=session.player;type('idchoppers');assert.equal(p.weaponowned[WP.wp_chainsaw],true);assert.equal(p.powers[PW.pw_invulnerability],1);p.mo!.x=-F;p.mo!.y=2*F;p.mo!.angle=0x80000000;type('idmypos');assert.equal(p.message,'ang=0x80000000;x,y=(0xffff0000,0x20000)');
});
test('IDMUS delegates to real music, rejects missing/out-of-range data and supports repeated parameters',()=>{
 const {session}=createHeadlessGame(true);type('idmus12');assert.equal(S_GetMusicState().name,'e1m2');type('idmus11');assert.equal(S_GetMusicState().name,'e1m1');type('idmus99');assert.equal(session.player.message,TEXT.STSTR_NOMUS);type('idmus00');assert.equal(session.player.message,TEXT.STSTR_NOMUS);assert.equal(S_GetMusicState().name,'e1m1');
});
test('Netgame suppresses ordinary cheats, but native IDCLEV remains outside that guard',()=>{
 const {session}=createHeadlessGame(true);session.state.netgame=true;type('iddqd');assert.equal(session.player.cheats,0);type('idkfa');assert.ok(session.player.cards.every(v=>!v));type('idclev12');assert.equal(session.state.gameaction,GA.ga_newgame);
});
test('IDCLEV validates episode editions and preserves the commercial epsd=0 rejection',()=>{
 const {session}=createHeadlessGame(true);for(const code of ['00','21','19']){type('idclev'+code);assert.equal(session.state.gameaction,code==='19'?GA.ga_newgame:GA.ga_nothing);session.state.gameaction=GA.ga_nothing;}
 session.state.gamemode=MODE.commercial;type('idclev02');assert.equal(session.state.gameaction,GA.ga_nothing);session.state.gamemode=MODE.retail;type('idclev49');assert.equal(session.state.gameaction,GA.ga_newgame);
});
test('Deferred map changes run on a simulation boundary and reset inventory without keeping old actors',()=>{
 const {session}=createHeadlessGame(true),old=session.player.mo;session.player.ammo[0]=7;type('idclev12');assert.equal(session.mapname,'E1M1');session.step(cmd());assert.equal(session.mapname,'E1M2');assert.equal(leveltime,1);assert.notStrictEqual(session.player.mo,old);assert.equal(session.player.ammo[0],50);assert.equal(session.state.gameaction,GA.ga_nothing);assert.equal(S_GetMusicState().name,'e1m2');assert.equal(session.headsUp!.title,TEXT.HUSTR_E1M2);
});
test('A missing deferred map leaves the running level intact and reports the missing destination',()=>{
 const {session}=createHeadlessGame(true),old=session.player.mo;type('idclev13');session.step(cmd());assert.equal(session.mapname,'E1M1');assert.strictEqual(session.player.mo,old);assert.equal(session.headsUp!.text,'El mapa E1M3 no está cargado.');assert.equal(session.state.gameaction,GA.ga_nothing);
});
test('G_InitNew clamps skill/episode/map, handles pause, and transitions nightmare state/speeds exactly',()=>{
 const {session}=createHeadlessGame(true),g=session.state,tics=states.slice(STATE.S_SARG_RUN1,STATE.S_SARG_PAIN2+1).map(s=>s.tics),speeds=[MT.MT_BRUISERSHOT,MT.MT_HEADSHOT,MT.MT_TROOPSHOT].map(i=>mobjinfo[i].speed);let resumes=0,loads=0,sky=0;
 const context={...g,paused:true,S_ResumeSound:()=>resumes++,G_DoLoadLevel:()=>loads++,SetSkyForLevel:()=>sky++};G.G_InitNewContext(context);
 try {G.G_InitNew(99 as skill_t,9,99);assert.equal(context.gameskill,skill_t.sk_nightmare);assert.equal(context.gameepisode,1);assert.equal(context.gamemap,9);assert.equal(context.respawnmonsters,true);assert.equal(context.paused,false);assert.equal(resumes,1);assert.equal(loads,1);assert.equal(sky,1);assert.deepEqual(states.slice(STATE.S_SARG_RUN1,STATE.S_SARG_PAIN2+1).map(s=>s.tics),tics.map(t=>t>>1));assert.equal(mobjinfo[MT.MT_HEADSHOT].speed,20*F);G.G_InitNew(skill_t.sk_medium,0,0);assert.equal(context.gamemap,1);assert.equal(context.respawnmonsters,false);assert.equal(mobjinfo[MT.MT_HEADSHOT].speed,10*F);}
 finally {states.slice(STATE.S_SARG_RUN1,STATE.S_SARG_PAIN2+1).forEach((s,i)=>s.tics=tics[i]);[MT.MT_BRUISERSHOT,MT.MT_HEADSHOT,MT.MT_TROOPSHOT].forEach((id,i)=>mobjinfo[id].speed=speeds[i]);G.G_InitNewContext(g);}
});
test('G_DoNewGame resets multiplayer/command flags before invoking the native new-game path',()=>{
 const {session}=createHeadlessGame(true),g={...session.state,netgame:true,deathmatch:1,demoplayback:true,netdemo:true,fastparm:true,nomonsters:true,respawnparm:true,G_DoLoadLevel:()=>{},SetSkyForLevel:()=>{}};G.G_InitNewContext(g);G.G_DeferedInitNew(skill_t.sk_easy,1,2);assert.equal(g.gameaction,GA.ga_newgame);G.G_DoNewGame();assert.equal(g.gameskill,skill_t.sk_easy);assert.deepEqual(g.playeringame,[true,false,false,false]);assert.equal(g.netgame,false);assert.equal(g.fastparm,false);assert.equal(g.deathmatch,0);assert.equal(g.consoleplayer,0);assert.equal(g.gameaction,GA.ga_nothing);
});
