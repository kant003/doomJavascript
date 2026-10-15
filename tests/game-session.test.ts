import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/web/game-session';
import { playableDemoWad } from '../src/web/playable-demo';
import { buildGameCommand,GameInput } from '../src/web/game-input';
import { G_CreatePlayer,G_InitGameContext,G_PlayerReborn } from '../src/linuxdoom-1.10/g_game';
import { W_InitFile } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../src/linuxdoom-1.10/r_data';
import { I_InstallSoundBackend,I_InitSound } from '../src/linuxdoom-1.10/i_sound';
import type { sound_backend_t,sound_params_t,sound_sample_t } from '../src/linuxdoom-1.10/i_sound.h';
import { S_Init,channels } from '../src/linuxdoom-1.10/s_sound';
import { R_RenderPlayerView,R_InitLightTables,R_SetViewSize,R_ExecuteSetViewSize,R_PointToAngle2 } from '../src/linuxdoom-1.10/r_main';
import { R_InitTranslationTables } from '../src/linuxdoom-1.10/r_draw';
import { R_InitSkyMap } from '../src/linuxdoom-1.10/r_sky';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { P_MobjForThinker,P_MobjThinker,P_RemoveMobj } from '../src/linuxdoom-1.10/p_mobj';
import { thinkercap,leveltime } from '../src/linuxdoom-1.10/p_tick';
import { P_TeleportMove,P_TryMove } from '../src/linuxdoom-1.10/p_map';
import { P_DamageMobj } from '../src/linuxdoom-1.10/p_inter';
import { P_SetupLevel } from '../src/linuxdoom-1.10/p_setup';
import { skill_t,weapontype_t as WP,KEY_RSHIFT } from '../src/linuxdoom-1.10/doomdef.h';
import { playerstate_t as PST,cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import type { mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,buttons,consistancy:0,chatchar:0});
class Device implements sound_backend_t {
 handles=new Set<number>();next=1;starts=0;
 start(_sample:sound_sample_t,_params:sound_params_t){this.starts++;this.handles.add(this.next);return this.next++;}
 stop(h:number){this.handles.delete(h);}isPlaying(h:number){return this.handles.has(h);}update(){}reset(){this.handles.clear();}
}
function actors():mobj_t[]{const a:mobj_t[]=[];for(let t=thinkercap.next;t&&t!==thinkercap;t=t.next)if(t.function===P_MobjThinker)a.push(P_MobjForThinker(t)!);return a;}
function init(){
 W_InitFile({name:'test.wad',data:playableDemoWad()});R_InitData();V_Init();const device=new Device();I_InstallSoundBackend(device);I_InitSound();S_Init(80,0);
 const events:string[]=[];const session=new GameSession('E1M1',{resetStatus:()=>events.push('status'),resetMessages:()=>events.push('messages'),closeAutomap:()=>events.push('map'),tactile:()=>events.push('hurt'),onExit:secret=>events.push(secret?'secret':'exit')});
 session.start();R_InitTranslationTables();R_InitLightTables();R_SetViewSize(11,0);R_ExecuteSetViewSize();R_InitSkyMap();return {session,device,events};
}
test('Player rebirth preserves scores/frags while restoring the original pistol, clips, flags and health',()=>{
 const p=G_CreatePlayer();G_InitGameContext({players:[p]});p.killcount=3;p.itemcount=4;p.secretcount=2;p.frags[1]=7;p.armorpoints=99;p.cheats=CF.CF_GODMODE;
 G_PlayerReborn(0);assert.deepEqual([p.killcount,p.itemcount,p.secretcount,p.frags[1]],[3,4,2,7]);assert.equal(p.health,100);assert.equal(p.ammo[0],50);assert.equal(p.maxammo[0],200);assert.equal(p.readyweapon,WP.wp_pistol);assert.equal(p.pendingweapon,WP.wp_pistol);assert.equal(p.armorpoints,0);assert.equal(p.cheats,0);assert.equal(p.attackdown,1);assert.ok(p.weaponowned[WP.wp_fist]);
});
test('Session setup spawns actual player/enemy/pickup actors and links presentation and all state actions',()=>{
 const {session,events}=init();assert.equal(session.player.mo!.x,-64*F);assert.equal(session.player.health,100);assert.equal(session.player.ammo[0],50);assert.equal(session.state.totalkills,1);assert.equal(actors().length,4);assert.deepEqual(events,['status','messages']);assert.equal(leveltime,0);
 session.step(cmd());assert.equal(leveltime,1);assert.equal(session.state.gametic,1);assert.ok(session.player.viewz>0);
});
test('Native player movement and sliding stop at room walls without bypassing collision',()=>{
 const {session}=init();for(const a of actors())if(a!==session.player.mo)P_RemoveMobj(a);
 for(let i=0;i<100;i++)session.step({...cmd(),forwardmove:25});assert.ok(session.player.mo!.x>0);assert.ok(session.player.mo!.x<=112*F);assert.equal(session.player.mo!.flags&0x1000,0);
});
test('Pickup contact from a running session grants real ammunition and removes the actor',()=>{
 const {session}=init();const clip=actors().find(a=>a.type===MT.MT_CLIP)!;assert.ok(P_TeleportMove(session.player.mo!,-24*F,-64*F));assert.ok(P_TryMove(session.player.mo!,0,-64*F));assert.equal(session.player.ammo[0],60);assert.equal(clip.thinker.function,-1);assert.ok(session.player.message);
});
test('Held fire uses native weapon states, hitscan and damage to kill the moving enemy',()=>{
 const {session,device}=init();session.player.cheats|=CF.CF_GODMODE;const target=actors().find(a=>a.type===MT.MT_TROOP)!;
 for(let i=0;i<220;i++){session.player.mo!.angle=R_PointToAngle2(session.player.mo!.x,session.player.mo!.y,target.x,target.y);session.step(cmd(BT.BT_ATTACK));}
 assert.ok(session.player.ammo[0]<50);assert.ok(target.health<=0);assert.equal(session.player.killcount,1);assert.ok(device.starts>0);assert.equal(session.player.health,100);
});
test('Player renderer draws changing simulation and weapon overlays on the native framebuffer',()=>{
 const {session}=init();let polls=0;R_RenderPlayerView(session.player,()=>polls++);const initial=screens[0].slice();
 for(let i=0;i<24;i++)session.step(cmd());R_RenderPlayerView(session.player,()=>polls++);assert.equal(polls,8);assert.notDeepEqual(screens[0],initial);assert.ok(screens[0].some(v=>v!==0));
 session.step(cmd(BT.BT_ATTACK));R_RenderPlayerView(session.player,()=>polls++);
});
test('Death, use and the next session tic restart the level with fresh resources and player state',()=>{
 const {session}=init();session.player.armorpoints=0;P_DamageMobj(session.player.mo!,null,null,10000);assert.equal(session.player.playerstate,PST.PST_DEAD);
 session.step(cmd(BT.BT_USE));assert.equal(session.player.playerstate,PST.PST_REBORN);session.step(cmd());assert.equal(session.player.health,100);assert.equal(session.player.ammo[0],50);assert.equal(session.player.playerstate,PST.PST_LIVE);assert.equal(actors().length,4);assert.equal(leveltime,0);assert.equal(session.player.frags[0],1);
});
test('Repeated restart resets counters, thinkers, clocks and sound channels instead of accumulating objects',()=>{
 const {session}=init();for(let n=0;n<3;n++){for(let i=0;i<40;i++)session.step(cmd());session.start();assert.equal(actors().length,4);assert.equal(leveltime,0);assert.equal(session.state.gametic,0);assert.equal(session.player.killcount,0);assert.equal(channels.filter(c=>c.sfxinfo).length,0);}
});
test('Completed level emits its exit request and freezes further simulation until restart',()=>{
 const {session,events}=init();session.state.G_SecretExitLevel();assert.ok(session.completed);session.step({...cmd(),forwardmove:25});assert.equal(leveltime,0);assert.deepEqual(events,['status','messages','secret']);session.start();assert.equal(session.completed,false);
});
test('Session replay of the same 200 commands is deterministic',()=>{
 function run(){const {session}=init();session.player.cheats|=CF.CF_GODMODE;for(let i=0;i<200;i++)session.step({...cmd(i>50?BT.BT_ATTACK:0),forwardmove:i<12?25:0,angleturn:i<80?10:0});return actors().map(a=>[a.type,a.x,a.y,a.z,a.health,a.tics,a.momx,a.momy]);}
 assert.deepEqual(run(),run());
});
test('Single-player setup rejects deathmatch explicitly before trying to create multiplayer spawns',()=>{
 const {session}=init();session.state.deathmatch=1;assert.throws(()=>P_SetupLevel(1,1,1,skill_t.sk_medium),/Deathmatch/);
});
test('Browser commands preserve cancellation, walking/running, firing, use and weapon selection',()=>{
 const keys=(s:string)=>new Set([...s].map(c=>c.charCodeAt(0)));assert.equal(buildGameCommand(keys('ws')).forwardmove,0);assert.equal(buildGameCommand(keys('w')).forwardmove,25);
 const running=keys('w');running.add(KEY_RSHIFT);assert.equal(buildGameCommand(running).forwardmove,50);assert.equal(buildGameCommand(keys('q')).sidemove,-24);
 const input=buildGameCommand(keys(' f3'));assert.ok(input.buttons&BT.BT_ATTACK);assert.ok(input.buttons&BT.BT_USE);assert.ok(input.buttons&BT.BT_CHANGE);assert.equal((input.buttons&BT.BT_WEAPONMASK)>>BT.BT_WEAPONSHIFT,2);
});

test('Short key taps survive until one tic and held keys continue without repeating use edges',()=>{
 const input=new GameInput();input.keyDown(32);input.keyUp(32);assert.ok(input.command().buttons&BT.BT_ATTACK);assert.equal(input.command().buttons,0);
 input.keyDown(119);assert.equal(input.command().forwardmove,25);assert.equal(input.command().forwardmove,25);input.clear();assert.equal(input.command().forwardmove,0);
});
