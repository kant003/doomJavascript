import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as weapons from '../src/linuxdoom-1.10/p_pspr';
import { P_InitPspriteContext, P_SetPsprite, P_SetupPsprites, P_MovePsprites, P_CheckAmmo, P_FireWeapon, P_BulletSlope, P_GunShot, P_CalcSwing,
    A_WeaponReady, A_Lower, A_Raise, A_Punch, A_Saw, A_FireShotgun, A_FireShotgun2, A_FireCGun, A_FireMissile, A_FirePlasma, A_FireBFG,
    A_BFGSpray, A_Light0, A_Light1, A_Light2, weaponStateActions, swingx, swingy, type psprite_context_t } from '../src/linuxdoom-1.10/p_pspr';
import { P_InitEnemyContext, P_NoiseAlert, reloadStateActions } from '../src/linuxdoom-1.10/p_enemy';
import { createMobjWorld } from './helpers/mobj-world';
import { P_SpawnMobj } from '../src/linuxdoom-1.10/p_mobj';
import { states, I_LinkStateActions } from '../src/linuxdoom-1.10/info';
import { statenum_t as S, mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { weaponinfo } from '../src/linuxdoom-1.10/d_items';
import { GameMode_t, weapontype_t as WP, ammotype_t as AM, powertype_t as PW } from '../src/linuxdoom-1.10/doomdef.h';
import { playerstate_t as PST } from '../src/linuxdoom-1.10/d_player.h';
import { mobjflag_t as MF, type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { MELEERANGE, MISSILERANGE, ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import { M_ClearRandom, prndindex, rndtable } from '../src/linuxdoom-1.10/m_random';
import { ANG90, FINEANGLES, FINEMASK, finesine } from '../src/linuxdoom-1.10/tables.h';
import { FixedMul } from '../src/linuxdoom-1.10/m_fixed';
import { P_Ticker } from '../src/linuxdoom-1.10/p_tick';
import { P_InitPlayerContext, P_PlayerThink } from '../src/linuxdoom-1.10/p_user';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { P_SetThingPosition, P_UnsetThingPosition } from '../src/linuxdoom-1.10/p_maputl';

function init() {
    const fixture=createMobjWorld(),{g}=fixture,p=g.players[0];p.mo=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER);p.mo.player=p;
    const hits:{angle:number;range:number;slope:number;damage:number}[]=[],aims:number[]=[];let alerts=0;
    const context:psprite_context_t={gamemode:GameMode_t.commercial,linetarget:null,S_StartSound:g.S_StartSound,
        P_NoiseAlert:(target,emitter)=>{alerts++;P_NoiseAlert(target,emitter);},P_AimLineAttack:(_a,angle)=>{aims.push(angle);return F/2;},
        P_LineAttack:(_a,angle,range,slope,damage)=>hits.push({angle,range,slope,damage}),P_DamageMobj:()=>assert.fail('damage must be configured')};
    P_InitPspriteContext(context);P_InitEnemyContext({S_StartSound:g.S_StartSound});I_LinkStateActions({...weaponStateActions,...reloadStateActions},false);
    g.P_AimLineAttack=(mo,angle,range)=>{const slope=context.P_AimLineAttack(mo,angle,range);g.linetarget=context.linetarget;return slope;};
    g.P_TryMove=(mo,x,y)=>{P_UnsetThingPosition(mo);mo.x=x;mo.y=y;P_SetThingPosition(mo);return true;};
    p.ammo.fill(200);p.weaponowned.fill(true);M_ClearRandom();
    return {...fixture,p,psp:p.psprites[0],context,hits,aims,get alerts(){return alerts;}};
}
test('All active p_pspr functions are present and action bindings retain direct identities',()=>{
    init();const source=readFileSync('original/linuxdoom-1.10/p_pspr.c','utf8');
    const names=[...source.matchAll(/^(?:(?:void|boolean)[ \t]+)?((?:P|A)_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);assert.equal(names.length,30);
    for(const name of names)assert.equal(typeof weapons[name as keyof typeof weapons],'function',name);
    assert.strictEqual(states[S.S_PISTOL].action,A_WeaponReady);assert.equal(Object.keys(weaponStateActions).length,20);
});
test('Psprite zero-tic chains pass both arguments, apply misc coordinates and respect action removal',t=>{
    const {p,psp}=init();const saved=[S.S_PISTOL1,S.S_PISTOL2].map(i=>({...states[i]}));t.after(()=>{Object.assign(states[S.S_PISTOL1],saved[0]);Object.assign(states[S.S_PISTOL2],saved[1]);});
    const called:string[]=[];
    Object.assign(states[S.S_PISTOL1],{tics:0,misc1:12,misc2:-3,nextstate:S.S_PISTOL2,action:(a:unknown,b:unknown)=>{assert.strictEqual(a,p);assert.strictEqual(b,psp);called.push('one');}});
    Object.assign(states[S.S_PISTOL2],{tics:-1,misc1:0,action:()=>called.push('two')});P_SetPsprite(p,0,S.S_PISTOL1);
    assert.deepEqual(called,['one','two']);assert.equal(psp.sx,12*F);assert.equal(psp.sy,-3*F);assert.equal(psp.tics,-1);
    Object.assign(states[S.S_PISTOL1],{action:()=>P_SetPsprite(p,0,S.S_NULL)});P_SetPsprite(p,0,S.S_PISTOL1);assert.equal(psp.state,null);
});
test('Psprite transitions use the state selected by a nested action and guard infinite chains',t=>{
    const {p,psp}=init();const saved=[S.S_PISTOL1,S.S_PISTOL2,S.S_PISTOL3].map(i=>({...states[i]}));t.after(()=>[S.S_PISTOL1,S.S_PISTOL2,S.S_PISTOL3].forEach((i,n)=>Object.assign(states[i],saved[n])));
    Object.assign(states[S.S_PISTOL1],{tics:0,action:()=>{psp.state=states[S.S_PISTOL2];},nextstate:S.S_NULL});
    Object.assign(states[S.S_PISTOL2],{nextstate:S.S_PISTOL3});Object.assign(states[S.S_PISTOL3],{tics:2,action:null});
    P_SetPsprite(p,0,S.S_PISTOL1);assert.strictEqual(psp.state,states[S.S_PISTOL3]);
    Object.assign(states[S.S_PISTOL1],{tics:0,nextstate:S.S_PISTOL1,action:null});assert.throws(()=>P_SetPsprite(p,0,S.S_PISTOL1),/zero-tic/);
});
test('Setup raises weapon via original actions; finite/permanent flash tics follow weapon position',()=>{
    const {p,psp}=init();P_SetupPsprites(p);assert.equal(psp.sy,122*F);assert.equal(p.pendingweapon,WP.wp_nochange);
    for(let i=0;i<15;i++)P_MovePsprites(p);assert.strictEqual(psp.state,states[S.S_PISTOL]);assert.equal(psp.sy,32*F);
    p.psprites[1].state=states[S.S_PISTOLFLASH];p.psprites[1].tics=-1;psp.sx=7*F;P_MovePsprites(p);assert.equal(p.psprites[1].tics,-1);assert.equal(p.psprites[1].sx,psp.sx);assert.equal(p.psprites[1].sy,psp.sy);
});
test('Ammo thresholds and fallback preference preserve strict shell/cell inequalities',()=>{
    const {p,context,psp}=init();psp.sy=32*F;p.readyweapon=WP.wp_bfg;p.ammo.fill(0);p.ammo[AM.am_cell]=40;assert.equal(P_CheckAmmo(p),true);
    p.readyweapon=WP.wp_supershotgun;p.ammo[AM.am_shell]=2;assert.equal(P_CheckAmmo(p),true);
    p.readyweapon=WP.wp_pistol;p.ammo[AM.am_cell]=1;assert.equal(P_CheckAmmo(p),false);assert.equal(p.pendingweapon,WP.wp_plasma);
    p.ammo[AM.am_cell]=0;p.ammo[AM.am_shell]=2;P_CheckAmmo(p);assert.equal(p.pendingweapon,WP.wp_shotgun);
    p.ammo[AM.am_shell]=3;P_CheckAmmo(p);assert.equal(p.pendingweapon,WP.wp_supershotgun);
    context.gamemode=GameMode_t.shareware;p.ammo[AM.am_cell]=200;p.ammo[AM.am_shell]=0;P_CheckAmmo(p);assert.equal(p.pendingweapon,WP.wp_chainsaw);
    p.weaponowned.fill(false);context.gamemode=GameMode_t.commercial;p.weaponowned[WP.wp_bfg]=true;p.ammo[AM.am_cell]=40;P_CheckAmmo(p);assert.equal(p.pendingweapon,WP.wp_fist);
    p.ammo[AM.am_cell]=41;P_CheckAmmo(p);assert.equal(p.pendingweapon,WP.wp_bfg);
});
test('Ready action inhibits held rocket/BFG fire, allows pistol repeat and restores actor idle state',()=>{
    const f=init(),{p,psp}=f;p.cmd.buttons=BT.BT_ATTACK;p.readyweapon=WP.wp_missile;p.attackdown=1;A_WeaponReady(p,psp);assert.equal(f.alerts,0);
    p.readyweapon=WP.wp_bfg;A_WeaponReady(p,psp);assert.equal(f.alerts,0);
    p.readyweapon=WP.wp_pistol;A_WeaponReady(p,psp);assert.equal(f.alerts,1);assert.strictEqual(p.mo!.state,states[S.S_PLAY_ATK1]);
    p.cmd.buttons=0;p.mo!.state=states[S.S_PLAY_ATK2];A_WeaponReady(p,psp);assert.equal(p.attackdown,0);assert.strictEqual(p.mo!.state,states[S.S_PLAY]);
});
test('Lowering swaps pending weapon, dead weapons stay down and zero-health removes overlay',()=>{
    const {p,psp,sounds}=init();psp.sy=125*F;p.pendingweapon=WP.wp_chainsaw;A_Lower(p,psp);assert.equal(p.readyweapon,WP.wp_chainsaw);assert.equal(psp.sy,122*F);assert.equal(sounds.at(-1)!.sound,SFX.sfx_sawup);
    p.playerstate=PST.PST_DEAD;psp.sy=125*F;A_Lower(p,psp);assert.equal(psp.sy,128*F);
    p.playerstate=PST.PST_LIVE;p.health=0;A_Lower(p,psp);assert.equal(psp.state,null);
});
test('Bullet slope tries three angles and accurate/inaccurate gunshots consume original RNG',()=>{
    const {p,context,aims,hits}=init();context.P_AimLineAttack=(_a,angle)=>{aims.push(angle);context.linetarget=null;return angle;};P_BulletSlope(p.mo!);assert.deepEqual(aims,[0,1<<26,(-1<<26)>>>0]);
    P_GunShot(p.mo!,true);assert.equal(prndindex,1);assert.equal(hits[0].damage,15);assert.equal(hits[0].angle,0);assert.equal(hits[0].range,MISSILERANGE);
    P_GunShot(p.mo!,false);assert.equal(prndindex,4);assert.equal(hits[1].angle,((220-222)<<18)>>>0);
});
test('Shotguns emit seven/twenty pellets with original spread and exact ammunition cost',()=>{
    const {p,psp,hits,sounds}=init();p.readyweapon=WP.wp_shotgun;A_FireShotgun(p,psp);assert.equal(hits.length,7);assert.equal(p.ammo[AM.am_shell],199);assert.equal(prndindex,21);assert.equal(sounds[0].sound,SFX.sfx_shotgn);
    assert.equal(hits[0].damage,15);assert.equal(hits[0].angle,((109-220)<<18)>>>0);
    hits.length=0;M_ClearRandom();p.readyweapon=WP.wp_supershotgun;A_FireShotgun2(p,psp);assert.equal(hits.length,20);assert.equal(p.ammo[AM.am_shell],197);assert.equal(prndindex,100);
    assert.deepEqual(hits[0],{angle:((109-220)<<19)>>>0,range:MISSILERANGE,slope:F/2+((222-241)<<5),damage:15});
});
test('Chaingun flash alternates by state pointer and dry fire keeps ammunition unchanged',()=>{
    const {p,psp,hits,sounds}=init();p.readyweapon=WP.wp_chaingun;psp.state=states[S.S_CHAIN2];A_FireCGun(p,psp);
    assert.strictEqual(p.psprites[1].state,states[weaponinfo[p.readyweapon].flashstate+1]);assert.equal(p.ammo[AM.am_clip],199);assert.equal(hits.length,1);
    p.ammo[AM.am_clip]=0;A_FireCGun(p,psp);assert.equal(hits.length,1);assert.equal(sounds.length,2);
});
test('Punch strength, chainsaw sounds and target-facing keep melee RNG/order',()=>{
    const {p,psp,context,hits,sounds}=init();context.linetarget=P_SpawnMobj(0,100*F,ONFLOORZ,MT.MT_POSSESSED);M_ClearRandom();p.powers[PW.pw_strength]=1;A_Punch(p,psp);
    assert.equal(hits[0].damage,180);assert.equal(hits[0].range,MELEERANGE);assert.equal(sounds[0].sound,SFX.sfx_punch);assert.ok(Math.abs(p.mo!.angle-ANG90)<=1);
    M_ClearRandom();p.mo!.angle=0;A_Saw(p,psp);assert.equal(hits[1].range,MELEERANGE+1);assert.equal(sounds.at(-1)!.sound,SFX.sfx_sawhit);assert.ok(p.mo!.flags&MF.MF_JUSTATTACKED);
    context.linetarget=null;A_Saw(p,psp);assert.equal(sounds.at(-1)!.sound,SFX.sfx_sawful);
});
test('Projectile actions use native spawn and consume rocket/plasma/BFG ammunition',()=>{
    const {p,psp}=init();p.readyweapon=WP.wp_missile;A_FireMissile(p,psp);assert.equal(m.sectors[0].thinglist!.type,MT.MT_ROCKET);assert.equal(p.ammo[AM.am_misl],199);
    p.readyweapon=WP.wp_plasma;A_FirePlasma(p,psp);assert.equal(m.sectors[0].thinglist!.type,MT.MT_PLASMA);assert.equal(p.ammo[AM.am_cell],199);
    p.readyweapon=WP.wp_bfg;A_FireBFG(p,psp);assert.equal(m.sectors[0].thinglist!.type,MT.MT_BFG);assert.equal(p.ammo[AM.am_cell],159);
});
test('BFG spray uses originator, forty scan rays and fifteen RNG rolls per hit after effect spawn',()=>{
    const {p,context,aims}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED),bfg=P_SpawnMobj(0,0,32*F,MT.MT_BFG);bfg.target=p.mo;
    context.P_AimLineAttack=(source,angle)=>{assert.strictEqual(source,p.mo);aims.push(angle);context.linetarget=aims.length===1?target:null;return 0;};
    let damage=0;context.P_DamageMobj=(t,inflictor,source,d)=>{assert.strictEqual(t,target);assert.strictEqual(inflictor,p.mo);assert.strictEqual(source,p.mo);damage=d;};M_ClearRandom();A_BFGSpray(bfg);
    assert.equal(aims.length,40);assert.equal(aims[0],(-ANG90/2)>>>0);assert.equal(aims[39],(-ANG90/2+Math.trunc(ANG90/40)*39)>>>0);
    assert.equal(prndindex,16);assert.equal(damage,[...rndtable.slice(2,17)].reduce((n,r)=>n+(r&7)+1,0));assert.equal(m.sectors[0].thinglist!.type,MT.MT_EXTRABFG);
});
test('Player ticker runs native weapon sequence through firing/refire/reload without missing actions',()=>{
    const f=init(),{p,g,context,hits,sounds}=f;g.P_SetupPsprites=P_SetupPsprites;
    P_InitPlayerContext({gamemode:context.gamemode,P_MovePsprites,P_PlayerInSpecialSector:()=>assert.fail('no special'),P_UseLines:()=>assert.fail('no use')});
    p.readyweapon=WP.wp_supershotgun;P_SetupPsprites(p);g.players[0]=p;
    const clock={paused:false,netgame:false,menuactive:false,demoplayback:false,players:g.players,consoleplayer:0,playeringame:[true,false,false,false],P_PlayerThink,P_UpdateSpecials:()=>{},P_RespawnSpecials:()=>{}};
    for(let i=0;i<16;i++)P_Ticker(clock);p.cmd.buttons=BT.BT_ATTACK;P_Ticker(clock);p.cmd.buttons=0;
    for(let i=0;i<80;i++)P_Ticker(clock);
    assert.equal(hits.length,20);assert.ok(sounds.some(s=>s.sound===SFX.sfx_dbopn));assert.ok(sounds.some(s=>s.sound===SFX.sfx_dbload));assert.ok(sounds.some(s=>s.sound===SFX.sfx_dbcls));assert.strictEqual(p.psprites[0].state,states[S.S_DSGUN]);
    p.bob=F;P_CalcSwing(p);const phase=(Math.trunc(FINEANGLES/70)*97)&FINEMASK;assert.equal(swingx,FixedMul(F,finesine[phase]));assert.equal(swingy,-FixedMul(swingx,finesine[(phase+FINEANGLES/2)&FINEMASK]));
    A_Light2(p,p.psprites[1]);assert.equal(p.extralight,2);A_Light1(p,p.psprites[1]);assert.equal(p.extralight,1);A_Light0(p,p.psprites[1]);assert.equal(p.extralight,0);
});
