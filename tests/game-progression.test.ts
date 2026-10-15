import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/game-session';
import { G_PlayerFinishLevel,G_ExitLevel,G_SecretExitLevel,G_DoCompleted,G_WorldDone,G_DoWorldDone,pars,cpars } from '../src/linuxdoom-1.10/g_game';
import { GameMode_t as MODE,gamestate_t as GS,powertype_t as PW,weapontype_t as WP } from '../src/linuxdoom-1.10/doomdef.h';
import { gameaction_t as GA,buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { mobjflag_t as MF } from '../src/linuxdoom-1.10/p_mobj.h';
import { W_AddFile } from '../src/linuxdoom-1.10/w_wad';
import { makeWad } from '../src/web/demo';
import { playerstate_t as PST } from '../src/linuxdoom-1.10/d_player.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { leveltime } from '../src/linuxdoom-1.10/p_tick';
import { rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import { R_RenderPlayerView } from '../src/linuxdoom-1.10/r_main';
import { screens } from '../src/linuxdoom-1.10/v_video';
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,buttons,consistancy:0,chatchar:0});
const marker=(name:string)=>W_AddFile({name:'route.wad',data:makeWad([{name,data:new Uint8Array()}])});
test('FinishLevel removes keys, powers, invisibility and palette effects while retaining inventory and scores',()=>{
 const {session}=createHeadlessGame(),p=session.player;p.health=p.mo!.health=70;p.armorpoints=42;p.ammo[0]=37;p.cards.fill(true);p.powers.fill(20);p.mo!.flags|=MF.MF_SHADOW;
 p.extralight=2;p.fixedcolormap=1;p.damagecount=8;p.bonuscount=9;p.killcount=3;p.frags[0]=2;
 G_PlayerFinishLevel(0);assert.ok(p.cards.every(v=>!v));assert.ok(p.powers.every(v=>!v));assert.equal(p.mo!.flags&MF.MF_SHADOW,0);assert.deepEqual([p.extralight,p.fixedcolormap,p.damagecount,p.bonuscount],[0,0,0,0]);assert.deepEqual([p.health,p.armorpoints,p.ammo[0],p.killcount,p.frags[0]],[70,42,37,3,2]);
});
test('Normal exits enqueue completion and commercial secret exits fall back when MAP31 is absent',()=>{
 const {session}=createHeadlessGame(),s=session.state;s.gamemode=MODE.commercial;G_SecretExitLevel();assert.equal(s.secretexit,false);assert.equal(s.gameaction,GA.ga_completed);
 marker('MAP31');G_SecretExitLevel();assert.equal(s.secretexit,true);G_ExitLevel();assert.equal(s.secretexit,false);
});
test('Original Doom progression handles normal routes, secret maps and all four secret returns',()=>{
 for(const [episode,map,secret,next] of [[1,1,false,1],[1,3,true,8],[2,5,true,8],[3,6,true,8],[4,2,true,8],[1,9,false,3],[2,9,false,5],[3,9,false,6],[4,9,false,2]] as const){
  const {session}=createHeadlessGame(),s=session.state;s.gameepisode=episode;s.gamemap=map;s.secretexit=secret;G_DoCompleted();assert.equal(s.wminfo.next,next,`${episode}/${map}`);assert.equal(s.wminfo.last,map-1);assert.equal(s.wminfo.epsd,episode-1);assert.equal(s.gamestate,GS.GS_INTERMISSION);
  if(map===9)assert.ok(s.players.every(p=>p.didsecret));
 }
});
test('Doom II progression preserves both secret branches, secret returns and ordinary routes',()=>{
 for(const [map,secret,next] of [[1,false,1],[15,false,15],[15,true,30],[31,true,31],[31,false,15],[32,false,15],[30,false,30]] as const){
  const {session}=createHeadlessGame(),s=session.state;s.gamemode=MODE.commercial;s.gamemap=map;s.secretexit=secret;G_DoCompleted();assert.equal(s.wminfo.next,next,`${map}/${secret}`);
 }
 // C has no default for a secret exit outside 15/31; keep the existing next field.
 const {session}=createHeadlessGame();session.state.gamemode=MODE.commercial;session.state.gamemap=2;session.state.secretexit=true;session.state.wminfo.next=7;G_DoCompleted();assert.equal(session.state.wminfo.next,7);
});
test('Completion copies independent per-player stats, time and frags and leaves an inactive player inactive',()=>{
 const {session,events}=createHeadlessGame(),s=session.state,p=session.player;session.step(cmd());session.step(cmd());
 p.killcount=3;p.itemcount=4;p.secretcount=1;p.frags[1]=9;s.totalkills=5;s.totalitems=7;s.totalsecret=2;s.automapactive=true;
 G_ExitLevel();G_DoCompleted();assert.equal(s.gameaction,GA.ga_nothing);assert.equal(s.viewactive,false);assert.equal(s.automapactive,false);assert.deepEqual(events.slice(-2),['map','exit']);
 const entry=s.wminfo.plyr[0];assert.deepEqual([entry.skills,entry.sitems,entry.ssecret,entry.stime],[3,4,1,2]);assert.equal(entry.frags[1],9);p.frags[1]=0;assert.equal(entry.frags[1],9);assert.equal(s.wminfo.plyr[1].in,false);assert.deepEqual([s.wminfo.maxkills,s.wminfo.maxitems,s.wminfo.maxsecret],[5,7,2]);
});
test('Par times preserve the original tables and avoid the out-of-bounds episode-four row',()=>{
 const {session}=createHeadlessGame(),s=session.state;assert.equal(cpars.length,32);assert.equal(pars[0].length,10);s.gameepisode=2;s.gamemap=6;G_DoCompleted();assert.equal(s.wminfo.partime,360*35);
 s.gameepisode=4;s.gamemap=2;G_DoCompleted();assert.equal(s.wminfo.partime,0);s.gamemode=MODE.commercial;s.gamemap=22;G_DoCompleted();assert.equal(s.wminfo.partime,150*35);
});
test('Episode ending requests victory without invoking intermission',()=>{
 const {session,events}=createHeadlessGame();session.state.gamemap=8;G_DoCompleted();assert.equal(session.state.gameaction,GA.ga_victory);assert.equal(events.filter(e=>e==='exit').length,0);
});
test('WorldDone invokes commercial finales at story boundaries and marks the visited secret',()=>{
 for(const [map,secret,finale] of [[1,false,false],[6,false,true],[11,false,true],[20,false,true],[30,false,true],[15,false,false],[15,true,true],[31,true,true],[31,false,false]] as const){
  const {session}=createHeadlessGame(),s=session.state;s.gamemode=MODE.commercial;s.gamemap=map;s.secretexit=secret;G_WorldDone();assert.equal(s.gamestate===GS.GS_FINALE,finale,`${map}/${secret}`);assert.equal(session.player.didsecret,secret);
 }
});
test('A native use trace completes the test room and the next map retains player inventory',()=>{
 const {session}=createHeadlessGame(true),p=session.player;p.health=p.mo!.health=75;p.armorpoints=42;p.ammo[0]=37;p.weaponowned[WP.wp_shotgun]=true;p.cards[0]=true;p.powers[PW.pw_ironfeet]=100;
 session.step(cmd());session.step(cmd(BT.BT_USE));assert.equal(session.completed,true);assert.equal(session.result!.mapname,'E1M1');assert.equal(session.nextMapName,'E1M2');assert.equal(session.nextAvailable,true);const old=p.mo;
 assert.equal(session.continueLevel(),true);assert.equal(session.mapname,'E1M2');assert.equal(session.completed,false);assert.equal(session.result,null);assert.strictEqual(session.player,p);assert.notStrictEqual(p.mo,old);
 assert.deepEqual([p.health,p.armorpoints,p.ammo[0]],[75,42,37]);assert.equal(p.weaponowned[WP.wp_shotgun],true);assert.equal(p.cards[0],false);assert.equal(p.powers[PW.pw_ironfeet],0);assert.equal(leveltime,0);assert.equal(session.player.killcount,0);
 R_RenderPlayerView(p,()=>{});assert.ok(screens[0].some(v=>v!==0));
});
test('Missing destination keeps the intermission intact, with no clock or inventory mutation',()=>{
 const {session}=createHeadlessGame();session.state.G_ExitLevel();session.step(cmd());assert.equal(session.nextAvailable,false);const p=session.player,mo=p.mo,time=leveltime;
 assert.equal(session.continueLevel(),false);session.step({...cmd(),forwardmove:50});assert.strictEqual(session.player.mo,mo);assert.equal(leveltime,time);assert.equal(session.mapname,'E1M1');assert.ok(session.completed);
});
test('The second synthetic exit reports the missing third map instead of inventing a level',()=>{
 const {session}=createHeadlessGame(true);session.step(cmd());session.step(cmd(BT.BT_USE));session.continueLevel();session.step(cmd());session.step(cmd(BT.BT_USE));assert.equal(session.result!.mapname,'E1M2');assert.equal(session.nextMapName,'E1M3');assert.equal(session.nextAvailable,false);assert.equal(session.continueLevel(),false);
});
test('Episode finale ends the session with a terminal result rather than looking for E1M9',()=>{
 const {session}=createHeadlessGame();session.state.gamemap=8;session.state.G_ExitLevel();session.step(cmd());assert.equal(session.state.gamestate,GS.GS_FINALE);assert.equal(session.result!.terminal,true);assert.equal(session.nextMapName,null);assert.equal(session.continueLevel(),false);
});
test('Continuing preserves cosmetic/gameplay RNG instead of reseeding a new game',()=>{
 const {session}=createHeadlessGame(true);session.step(cmd());session.step(cmd(BT.BT_USE));const before=[rndindex,prndindex];assert.ok(before.some(v=>v>0));session.continueLevel();assert.ok(prndindex>=before[1]);assert.equal(rndindex,before[0]);
});
test('A dead player carried through an exit is reborn before the destination spawns',()=>{
 const {session}=createHeadlessGame(true);session.state.G_ExitLevel();session.step(cmd());session.player.playerstate=PST.PST_DEAD;session.player.health=session.player.mo!.health=0;
 assert.equal(session.continueLevel(),true);assert.equal(session.player.health,100);assert.equal(session.player.ammo[0],50);assert.equal(session.player.playerstate,PST.PST_LIVE);
});
test('WorldDone loads the native destination and restores level state/view flags',()=>{
 const {session}=createHeadlessGame(true),s=session.state;s.wminfo.next=1;s.gameaction=GA.ga_worlddone;s.viewactive=false;G_DoWorldDone();
 assert.equal(session.mapname,'E1M2');assert.equal(s.gamestate,GS.GS_LEVEL);assert.equal(s.gameaction,GA.ga_nothing);assert.equal(s.viewactive,true);assert.equal(leveltime,0);assert.equal(m.things[0].type,1);
});
