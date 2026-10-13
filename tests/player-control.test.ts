import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as control from '../src/linuxdoom-1.10/p_user';
import { P_InitPlayerContext, P_Thrust, P_MovePlayer, P_CalcHeight, P_DeathThink, P_PlayerThink, onground } from '../src/linuxdoom-1.10/p_user';
import { createPlayer } from './helpers/player';
import { demoWad } from '../src/web/demo';
import { createStaticMapActors } from '../src/web/map-actors';
import { W_InitFile, W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../src/linuxdoom-1.10/r_data';
import { R_InitSprites } from '../src/linuxdoom-1.10/r_things';
import { P_LoadMapData } from '../src/linuxdoom-1.10/p_setup';
import { states, sprnames } from '../src/linuxdoom-1.10/info';
import { statenum_t as S } from '../src/linuxdoom-1.10/info.h';
import { playerstate_t as PST, cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { mobjflag_t as MF } from '../src/linuxdoom-1.10/p_mobj.h';
import { GameMode_t, weapontype_t as WP, powertype_t as PW } from '../src/linuxdoom-1.10/doomdef.h';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { FixedMul } from '../src/linuxdoom-1.10/m_fixed';
import { VIEWHEIGHT } from '../src/linuxdoom-1.10/p_local.h';
import { ANG90, ANG180, FINEANGLES, FINEMASK, finecosine, finesine } from '../src/linuxdoom-1.10/tables.h';
import { P_InitThinkers, P_ResetLevelTime, P_Ticker } from '../src/linuxdoom-1.10/p_tick';

function init() {
    W_InitFile({name:'demo.wad',data:demoWad()});R_InitData();P_LoadMapData(W_GetNumForName('E1M1'));R_InitSprites(sprnames);
    P_InitThinkers();P_ResetLevelTime();const p=createPlayer(),a=createStaticMapActors()[0];
    a.player=p;p.mo=a;a.x=a.y=a.z=a.momx=a.momy=a.momz=0;a.flags=0;a.angle=0;a.state=states[S.S_PLAY];a.reactiontime=0;
    P_MovePlayer(p);const calls:string[]=[];
    const g={gamemode:GameMode_t.registered,P_MovePsprites:()=>calls.push('psprites'),P_PlayerInSpecialSector:()=>calls.push('sector'),P_UseLines:()=>calls.push('use')};
    P_InitPlayerContext(g);return {p,a,g,calls};
}
test('All five player functions correspond to the original definitions',()=>{
    const source=readFileSync('original/linuxdoom-1.10/p_user.c','utf8');
    const names=[...source.matchAll(/^(?:void[ \t]+)?(P_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(row=>row[1]);assert.equal(names.length,5);
    for(const name of names)assert.equal(typeof control[name as keyof typeof control],'function',name);
});
test('Thrust uses original angle tables, signed momentum overflow and strafe direction',()=>{
    const {p,a}=init();P_Thrust(p,0,F);assert.equal(a.momx,FixedMul(F,finecosine[0]));assert.equal(a.momy,FixedMul(F,finesine[0]));
    a.momx=0x7fffffff;a.momy=0;P_Thrust(p,0,F);assert.equal(a.momx,(0x7fffffff+finecosine[0])|0);
    a.momx=a.momy=0;p.cmd.sidemove=32;P_MovePlayer(p);assert.ok(a.momy<0);assert.strictEqual(a.state,states[S.S_PLAY_RUN1]);
});
test('MovePlayer turns while airborne but only thrusts on the ground',()=>{
    const {p,a}=init();a.z=F;p.cmd.angleturn=-1;p.cmd.forwardmove=50;P_MovePlayer(p);
    assert.equal(a.angle,(-1<<16)>>>0);assert.equal(onground,false);assert.equal(a.momx,0);assert.strictEqual(a.state,states[S.S_PLAY_RUN1]);
    a.z=0;p.cmd.angleturn=0;P_MovePlayer(p);assert.equal(onground,true);assert.notEqual(a.momx,0);
});
test('CalcHeight caps bob, restores live eye height and clips the grounded view',()=>{
    const {p,a}=init();a.momx=30*F;P_CalcHeight(p);assert.equal(p.bob,0x100000);
    p.viewheight=VIEWHEIGHT-2*F;p.deltaviewheight=F;P_CalcHeight(p);assert.equal(p.viewheight,VIEWHEIGHT-F);assert.equal(p.deltaviewheight,1.25*F);
    p.viewheight=VIEWHEIGHT;p.deltaviewheight=F;P_CalcHeight(p);assert.equal(p.viewheight,VIEWHEIGHT);assert.equal(p.deltaviewheight,0);
    p.viewheight=0;p.deltaviewheight=-F;P_CalcHeight(p);assert.equal(p.viewheight,VIEWHEIGHT/2);assert.equal(p.deltaviewheight,1+F/4);
    a.ceilingz=24*F;P_CalcHeight(p);assert.equal(p.viewz,20*F);
});
test('Bobbing retains integer FINEANGLES/20 timing and the airborne clamp overwrite',()=>{
    const {p,a}=init();a.momx=F;
    const clock={paused:false,netgame:false,menuactive:false,demoplayback:false,players:[p],consoleplayer:0,playeringame:[false,false,false,false],P_PlayerThink:()=>assert.fail('inactive'),P_UpdateSpecials:()=>{},P_RespawnSpecials:()=>{}};
    P_Ticker(clock);P_CalcHeight(p);const phase=Math.trunc(FINEANGLES/20)&FINEMASK;assert.equal(p.viewz,VIEWHEIGHT+FixedMul(Math.trunc(p.bob/2),finesine[phase]));
    a.ceilingz=24*F;a.z=F;P_MovePlayer(p);P_CalcHeight(p);assert.equal(p.viewz,F+VIEWHEIGHT);
    a.z=0;P_MovePlayer(p);p.cheats=CF.CF_NOMOMENTUM;P_CalcHeight(p);assert.equal(p.viewz,VIEWHEIGHT);
});
test('PlayerThink preserves teleport reaction delay, chainsaw lunge and noclip flags',()=>{
    const {p,a,calls}=init();a.reactiontime=2;p.cmd.forwardmove=50;p.cheats=CF.CF_NOCLIP;P_PlayerThink(p);assert.equal(a.reactiontime,1);assert.equal(a.momx,0);assert.ok(a.flags&MF.MF_NOCLIP);
    p.cheats=0;P_PlayerThink(p);assert.equal(a.flags&MF.MF_NOCLIP,0);assert.equal(a.momx,0);
    a.flags|=MF.MF_JUSTATTACKED;p.cmd.angleturn=20;p.cmd.sidemove=50;P_PlayerThink(p);
    assert.equal(p.cmd.forwardmove,100);assert.equal(p.cmd.sidemove,0);assert.equal(p.cmd.angleturn,0);assert.equal(a.flags&MF.MF_JUSTATTACKED,0);assert.ok(a.momx>0);assert.deepEqual(calls,['psprites','psprites','psprites']);
});
test('Sector, use and psprite hooks retain order; use repeats only after release',()=>{
    const {p,a,calls}=init();a.subsector!.sector!.special=9;p.cmd.buttons=BT.BT_USE;P_PlayerThink(p);assert.deepEqual(calls,['sector','use','psprites']);assert.equal(p.usedown,1);
    calls.length=0;P_PlayerThink(p);assert.deepEqual(calls,['sector','psprites']);p.cmd.buttons=0;P_PlayerThink(p);assert.equal(p.usedown,0);
    p.cmd.buttons=BT.BT_USE;P_PlayerThink(p);assert.equal(calls.filter(c=>c==='use').length,1);
    p.cmd.buttons=BT.BT_SPECIAL|BT.BT_USE|BT.BT_CHANGE;P_PlayerThink(p);assert.equal(p.cmd.buttons,0);assert.equal(p.usedown,0);
});
function selectWeapon(p:ReturnType<typeof createPlayer>,weapon:WP){p.cmd.buttons=BT.BT_CHANGE|(weapon<<BT.BT_WEAPONSHIFT);P_PlayerThink(p);}
test('Weapon selection respects ownership, berserk/chainsaw, commercial shotgun and shareware',()=>{
    const {p,g}=init();p.weaponowned.fill(true);p.readyweapon=WP.wp_pistol;
    selectWeapon(p,WP.wp_fist);assert.equal(p.pendingweapon,WP.wp_chainsaw);
    p.readyweapon=WP.wp_chainsaw;p.powers[PW.pw_strength]=1;selectWeapon(p,WP.wp_fist);assert.equal(p.pendingweapon,WP.wp_fist);
    g.gamemode=GameMode_t.commercial;p.readyweapon=WP.wp_shotgun;selectWeapon(p,WP.wp_shotgun);assert.equal(p.pendingweapon,WP.wp_supershotgun);
    p.readyweapon=WP.wp_supershotgun;selectWeapon(p,WP.wp_shotgun);assert.equal(p.pendingweapon,WP.wp_shotgun);
    g.gamemode=GameMode_t.shareware;p.pendingweapon=WP.wp_nochange;selectWeapon(p,WP.wp_plasma);assert.equal(p.pendingweapon,WP.wp_nochange);selectWeapon(p,WP.wp_bfg);assert.equal(p.pendingweapon,WP.wp_nochange);
    g.gamemode=GameMode_t.registered;p.weaponowned[WP.wp_missile]=false;selectWeapon(p,WP.wp_missile);assert.equal(p.pendingweapon,WP.wp_nochange);
});
test('Powers update in original order and select flashing inverse/infrared colormaps',()=>{
    const {p,a}=init();p.powers[PW.pw_strength]=1;p.powers[PW.pw_invisibility]=1;p.powers[PW.pw_ironfeet]=2;p.powers[PW.pw_invulnerability]=130;p.powers[PW.pw_infrared]=200;
    a.flags|=MF.MF_SHADOW;p.damagecount=2;p.bonuscount=3;P_PlayerThink(p);
    assert.equal(p.powers[PW.pw_strength],2);assert.equal(p.powers[PW.pw_invisibility],0);assert.equal(a.flags&MF.MF_SHADOW,0);assert.equal(p.powers[PW.pw_ironfeet],1);assert.equal(p.damagecount,1);assert.equal(p.bonuscount,2);assert.equal(p.fixedcolormap,32);
    p.powers[PW.pw_invulnerability]=9;P_PlayerThink(p);assert.equal(p.fixedcolormap,32);p.powers[PW.pw_invulnerability]=8;P_PlayerThink(p);assert.equal(p.fixedcolormap,0);
    p.powers[PW.pw_invulnerability]=1;P_PlayerThink(p);assert.equal(p.fixedcolormap,1);p.powers[PW.pw_infrared]=8;P_PlayerThink(p);assert.equal(p.fixedcolormap,0);
});
test('Death view falls, turns five degrees toward attacker and use requests rebirth',()=>{
    const {p,a,calls}=init();p.playerstate=PST.PST_DEAD;p.viewheight=8*F;p.damagecount=3;p.attacker={...a,x:0,y:100*F};
    a.angle=0;P_DeathThink(p);assert.equal(p.viewheight,7*F);assert.equal(a.angle,Math.trunc(ANG90/18));assert.equal(p.damagecount,3);
    a.angle=ANG180;P_DeathThink(p);assert.equal(a.angle,ANG180-Math.trunc(ANG90/18));assert.equal(p.viewheight,6*F);
    a.angle=ANG90;p.cmd.buttons=BT.BT_USE;P_DeathThink(p);assert.equal(p.damagecount,2);assert.equal(p.playerstate,PST.PST_REBORN);assert.equal(calls.length,3);
});
test('Dead player exits before live powers, weapon/use and sector processing',()=>{
    const {p,a,calls}=init();p.playerstate=PST.PST_DEAD;a.subsector!.sector!.special=9;p.powers[PW.pw_strength]=10;p.cmd.buttons=BT.BT_USE;p.damagecount=3;
    P_PlayerThink(p);assert.deepEqual(calls,['psprites']);assert.equal(p.powers[PW.pw_strength],10);assert.equal(p.damagecount,2);assert.equal(p.usedown,0);assert.equal(p.playerstate,PST.PST_REBORN);
});
