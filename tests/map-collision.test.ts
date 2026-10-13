import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as collision from '../src/linuxdoom-1.10/p_map';
import * as vision from '../src/linuxdoom-1.10/p_sight';
import { P_InitMapContext, P_CheckPosition, P_TryMove, P_TeleportMove, P_SlideMove, P_ThingHeightClip, P_AimLineAttack, P_LineAttack,
    P_UseLines, P_RadiusAttack, P_ChangeSector, PIT_CheckLine, mapclip as c, type map_context_t } from '../src/linuxdoom-1.10/p_map';
import { P_CheckSight, P_DivlineSide, P_InterceptVector2, sight } from '../src/linuxdoom-1.10/p_sight';
import { createMobjWorld } from './helpers/mobj-world';
import { P_SpawnMobj, P_RemoveMobj, P_XYMovement } from '../src/linuxdoom-1.10/p_mobj';
import { P_SetThingPosition, P_UnsetThingPosition } from '../src/linuxdoom-1.10/p_maputl';
import { mobjtype_t as MT, statenum_t as S } from '../src/linuxdoom-1.10/info.h';
import { mobjflag_t as MF, type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { I_LinkStateActions, states } from '../src/linuxdoom-1.10/info';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { ML_TWOSIDED, ML_BLOCKING, ML_BLOCKMONSTERS } from '../src/linuxdoom-1.10/doomdata.h';
import { slopetype_t as ST, type line_t } from '../src/linuxdoom-1.10/r_defs.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { sky } from '../src/linuxdoom-1.10/r_sky';
import { view } from '../src/linuxdoom-1.10/r_main';
import { M_ClearRandom, prndindex } from '../src/linuxdoom-1.10/m_random';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import { weaponStateActions, P_InitPspriteContext, A_FireShotgun } from '../src/linuxdoom-1.10/p_pspr';
import { weapontype_t as WP, GameMode_t } from '../src/linuxdoom-1.10/doomdef.h';
import { P_NoiseAlert } from '../src/linuxdoom-1.10/p_enemy';

function init() {
    const fixture=createMobjWorld(),{g}=fixture;
    const damage:{target:mobj_t;inflictor:mobj_t|null;source:mobj_t|null;damage:number}[]=[],crossings:number[]=[],uses:line_t[]=[],shots:line_t[]=[];
    const context:map_context_t={gamemap:1,P_DamageMobj:(target,inflictor,source,d)=>damage.push({target,inflictor,source,damage:d}),
        P_TouchSpecialThing:()=>assert.fail('pickup must be configured'),P_CrossSpecialLine:i=>crossings.push(i),P_ShootSpecialLine:(_a,l)=>shots.push(l),
        P_UseSpecialLine:(_a,l)=>{uses.push(l);return true;},S_StartSound:g.S_StartSound};P_InitMapContext(context);
    g.P_TryMove=P_TryMove;g.P_CheckPosition=P_CheckPosition;g.P_SlideMove=P_SlideMove;g.P_AimLineAttack=P_AimLineAttack;
    Object.defineProperties(g,{ceilingline:{get:()=>c.ceilingline},linetarget:{get:()=>c.linetarget},attackrange:{get:()=>c.attackrange}});
    const p=g.players[0];p.mo=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER);p.mo.player=p;sky.skyflatnum=-1;
    return {...fixture,p,a:p.mo,context,damage,crossings,uses,shots};
}
function relocate(a:mobj_t,x:number,y:number):void {P_UnsetThingPosition(a);a.x=x;a.y=y;P_SetThingPosition(a);}
function internalLine(floor=0,ceiling=128*F):line_t {
    const back={...m.sectors[0],floorheight:floor,ceilingheight:ceiling},index=m.sides.length;
    m.sides.push({...m.sides[0],sector:m.sectors[0]},{...m.sides[0],sector:back});
    const line={...m.lines[0],v1:{x:0,y:-128*F},v2:{x:0,y:128*F},dx:0,dy:256*F,bbox:new Int32Array([128*F,-128*F,0,0]),
        slopetype:ST.ST_VERTICAL,flags:ML_TWOSIDED,sidenum:[index,index+1] as [number,number],frontsector:m.sectors[0],backsector:back,validcount:-1,special:0};
    m.lines.push(line);return line;
}
test('Every original movement/hitscan and sight function is exported',()=>{
    for(const [file,module,count] of [['p_map.c',collision,20],['p_sight.c',vision,5]] as const){
        const source=readFileSync(`original/linuxdoom-1.10/${file}`,'utf8');const names=[...source.matchAll(/^(?:(?:void|boolean|fixed_t|int)[ \t]+)?((?:P|PIT|PTR)_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);
        assert.equal(names.length,count);for(const name of names)assert.equal(typeof (module as Record<string,unknown>)[name],'function',name);
    }
});
test('TryMove blocks walls/solid objects, preserves rejected origins, and relinks successful movement',()=>{
    const {a}=init();assert.equal(P_TryMove(a,100*F,0),true);assert.equal(a.x,100*F);assert.equal(P_TryMove(a,120*F,0),false);assert.equal(a.x,100*F);
    const other=P_SpawnMobj(50*F,0,ONFLOORZ,MT.MT_POSSESSED);assert.equal(P_CheckPosition(a,50*F,0),false);assert.equal(a.x,100*F);
    other.flags&=~MF.MF_SOLID;assert.equal(P_TryMove(a,50*F,0),true);assert.strictEqual(a.subsector!.sector,m.sectors[0]);assert.ok(m.blocklinks.includes(a)||a.bprev!==null);
    a.flags|=MF.MF_NOCLIP;assert.equal(P_TryMove(a,130*F,0),true);assert.equal(a.x,130*F);
});
test('Native XY movement and sliding preserve wall clearance and continue tangential momentum',()=>{
    const {a}=init();relocate(a,100*F,0);a.momx=20*F;a.momy=10*F;P_XYMovement(a);
    assert.ok(a.x<=112*F);assert.ok(a.x>100*F);assert.ok(a.y>0);assert.equal(a.momx,0);assert.ok(a.momy>0);
    relocate(a,100*F,100*F);a.momx=20*F;a.momy=20*F;P_SlideMove(a);assert.ok(a.x<=112*F);assert.ok(a.y<=112*F);
});
test('Portal contact narrows height, records sky ceiling and honors blocking flags/step/dropoff',()=>{
    const {a,p}=init(),line=internalLine(32*F,90*F);
    P_CheckPosition(a,0,0);assert.equal(PIT_CheckLine(line),true);assert.equal(c.tmfloorz,32*F);assert.equal(c.tmceilingz,90*F);assert.strictEqual(c.ceilingline,line);
    line.flags|=ML_BLOCKING;assert.equal(PIT_CheckLine(line),false);a.flags|=MF.MF_MISSILE;assert.equal(PIT_CheckLine(line),true);a.flags&=~MF.MF_MISSILE;
    line.flags=ML_TWOSIDED|ML_BLOCKMONSTERS;assert.equal(PIT_CheckLine(line),true);a.player=null;assert.equal(PIT_CheckLine(line),false);
    // Replace each BLOCKMAP list's wall zero with this portal to exercise TryMove's fit checks.
    for(let i=0;i<m.blockmaplump.length;i++)if(m.blockmaplump[i]===0&&i>=4+m.bmapwidth*m.bmapheight)m.blockmaplump[i]=m.lines.length-1;
    line.flags=ML_TWOSIDED;a.player=p;assert.equal(P_TryMove(a,0,0),false);assert.equal(c.floatok,true);
    a.flags|=MF.MF_TELEPORT;assert.equal(P_TryMove(a,0,0),true);assert.equal(a.floorz,32*F);
    line.backsector!.ceilingheight=80*F;assert.equal(P_TryMove(a,0,0),false);assert.equal(c.floatok,false);
});
test('Special crossing runs only after a successful move and checks the original side',()=>{
    const {a,crossings}=init(),line=internalLine();line.special=7;relocate(a,-8*F,0);
    for(let i=4+m.bmapwidth*m.bmapheight;i<m.blockmaplump.length;i++)if(m.blockmaplump[i]===0)m.blockmaplump[i]=m.lines.length-1;
    assert.equal(P_TryMove(a,8*F,0),true);assert.deepEqual(crossings,[m.lines.length-1]);assert.equal(c.numspechit,-1);
    a.flags|=MF.MF_TELEPORT;P_TryMove(a,-8*F,0);assert.equal(crossings.length,1);
});
test('Special contact overflow fails explicitly rather than overwriting the eight-entry array',()=>{
    const {a}=init(),line=internalLine();line.special=7;P_CheckPosition(a,0,0);
    for(let i=0;i<8;i++)assert.equal(PIT_CheckLine(line),true);
    assert.throws(()=>PIT_CheckLine(line),/MAXSPECIALCROSS/);
});
test('Teleport stomp is allowed for players and map 30 monsters, not other monsters',()=>{
    const {a,context,damage}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);
    assert.equal(P_TeleportMove(a,64*F,0),true);assert.strictEqual(damage[0].target,target);assert.equal(damage[0].damage,10000);
    relocate(a,-64*F,0);a.player=null;assert.equal(P_TeleportMove(a,64*F,0),false);context.gamemap=30;assert.equal(P_TeleportMove(a,64*F,0),true);
});
test('Pickup and skull impact callbacks preserve removal, RNG and momentum semantics',()=>{
    const {a,context,damage}=init();const pickup=P_SpawnMobj(32*F,0,ONFLOORZ,MT.MT_CLIP);
    context.P_TouchSpecialThing=(special,toucher)=>{assert.strictEqual(toucher,a);P_RemoveMobj(special);};assert.equal(P_TryMove(a,32*F,0),true);assert.equal(pickup.thinker.function,-1);
    const target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);a.flags|=MF.MF_SKULLFLY;a.momx=F;M_ClearRandom();
    assert.equal(P_TryMove(a,64*F,0),false);assert.strictEqual(damage[0].target,target);assert.equal(damage[0].damage,a.info!.damage);assert.equal(prndindex,1);assert.equal(a.momx,0);assert.equal(a.flags&MF.MF_SKULLFLY,0);
});
test('Missiles skip their owner, explode harmlessly on species peers and damage other species',()=>{
    const {a,damage}=init(),peer=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED),rocket=P_SpawnMobj(-64*F,0,32*F,MT.MT_ROCKET);
    rocket.target=a;assert.equal(P_CheckPosition(rocket,a.x,a.y),true);assert.equal(P_CheckPosition(rocket,peer.x,peer.y),false);assert.strictEqual(damage[0].target,peer);
    rocket.target=peer;damage.length=0;const same=P_SpawnMobj(32*F,0,ONFLOORZ,MT.MT_POSSESSED);assert.equal(P_CheckPosition(rocket,32*F,0),false);assert.equal(damage.length,0);
    rocket.z=100*F;assert.equal(P_CheckPosition(rocket,32*F,0),true);assert.ok(same.height<rocket.z);
});
test('Autoaim chooses nearest target and LineAttack records impact/damage with native blood spawn',()=>{
    const {a,damage}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);P_SpawnMobj(100*F,0,ONFLOORZ,MT.MT_POSSESSED);
    const slope=P_AimLineAttack(a,0,256*F);assert.strictEqual(c.linetarget,target);P_LineAttack(a,0,256*F,slope,15);
    assert.equal(damage.length,1);assert.strictEqual(damage[0].target,target);assert.strictEqual(damage[0].source,a);assert.equal(damage[0].damage,15);assert.equal(m.sectors[0].thinglist!.type,MT.MT_BLOOD);
    target.flags|=MF.MF_NOBLOOD;P_LineAttack(a,0,256*F,slope,0);assert.equal(damage.length,1);assert.equal(m.sectors[0].thinglist!.type,MT.MT_PUFF);
});
test('Walls block target acquisition and spawn puffs; sky suppresses wall impacts',()=>{
    const {a,damage}=init();const target=P_SpawnMobj(200*F,0,ONFLOORZ,MT.MT_POSSESSED);assert.equal(P_AimLineAttack(a,0,256*F),0);assert.equal(c.linetarget,null);
    P_LineAttack(a,0,256*F,0,15);assert.equal(damage.length,0);assert.equal(m.sectors[0].thinglist!.type,MT.MT_PUFF);assert.ok(m.sectors[0].thinglist!.x<128*F);
    const before=m.sectors[0].thinglist;m.sectors[0].ceilingpic=7;sky.skyflatnum=7;P_LineAttack(a,0,256*F,2*F,15);assert.strictEqual(m.sectors[0].thinglist,before);assert.ok(target);
});
test('Weapon actions now use real map tracing rather than mocked aim/hitscan',()=>{
    const {p,a,g,context,damage}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);I_LinkStateActions(weaponStateActions,false);
    P_InitPspriteContext({gamemode:GameMode_t.commercial,get linetarget(){return c.linetarget;},S_StartSound:g.S_StartSound,P_NoiseAlert,
        P_AimLineAttack,P_LineAttack,P_DamageMobj:context.P_DamageMobj});p.readyweapon=WP.wp_shotgun;p.ammo.fill(200);A_FireShotgun(p,p.psprites[0]);
    assert.ok(damage.length>0);assert.ok(damage.every(d=>d.target===target&&d.source===a));assert.equal(p.ammo[1],199);
});
test('Use traces stop at a wall with noway sound, or invoke the first special',()=>{
    const {a,p,sounds,uses,shots}=init();relocate(a,100*F,0);P_UseLines(p);assert.equal(sounds.at(-1)!.sound,SFX.sfx_noway);
    const line=m.lines.find(l=>l.v1.x===128*F&&l.v2.x===128*F)!;line.special=11;P_UseLines(p);assert.deepEqual(uses,[line]);
    P_LineAttack(a,0,128*F,0,15);assert.deepEqual(shots,[line]);
});
test('Radius attacks use direct sight, distance falloff and boss immunity',()=>{
    const {a,damage}=init(),target=P_SpawnMobj(64*F,24*F,ONFLOORZ,MT.MT_POSSESSED),boss=P_SpawnMobj(24*F,24*F,ONFLOORZ,MT.MT_CYBORG);
    P_RadiusAttack(a,a,100);assert.ok(damage.some(d=>d.target===target&&d.damage===100-(64-target.radius/F)));assert.ok(!damage.some(d=>d.target===boss));
});
test('Sight respects REJECT, one-sided walls and original horizontal on-line comparison',()=>{
    const {a}=init(),target=P_SpawnMobj(64*F,24*F,ONFLOORZ,MT.MT_POSSESSED);assert.equal(P_CheckSight(a,target),true);
    const count=sight.sightcounts[0];m.rejectmatrix[0]=1;assert.equal(P_CheckSight(a,target),false);assert.equal(sight.sightcounts[0],count+1);m.rejectmatrix[0]=0;
    relocate(target,200*F,24*F);assert.equal(P_CheckSight(a,target),false);
    assert.equal(P_DivlineSide(7,50,{x:0,y:7,dx:F,dy:0}),2);assert.equal(P_DivlineSide(8,7,{x:0,y:7,dx:F,dy:0}),0);
    assert.equal(P_InterceptVector2({x:0,y:0,dx:100*F,dy:0},{x:25*F,y:-F,dx:0,dy:2*F}),F/4);
});
test('Sight traverses both BSP leaves and clips against a two-sided portal',()=>{
    const {a}=init(),target=P_SpawnMobj(64*F,24*F,ONFLOORZ,MT.MT_POSSESSED),line=internalLine(0,128*F);
    relocate(a,-64*F,24*F);const back=line.backsector!;m.sectors.push(back);m.numsectors=2;
    const seg={...m.segs[0],v1:line.v1,v2:line.v2,linedef:line,frontsector:line.frontsector!,backsector:back};
    m.segs=[seg];m.numsegs=1;m.subsectors=[{sector:m.sectors[0],firstline:0,numlines:1},{sector:back,firstline:0,numlines:1}];m.numsubsectors=2;
    m.nodes=[{x:0,y:0,dx:0,dy:256*F,bbox:[new Int32Array(4),new Int32Array(4)],children:[0x8001,0x8000]}];m.numnodes=1;
    a.subsector=m.subsectors[0];target.subsector=m.subsectors[1];assert.equal(P_CheckSight(a,target),true);
    back.floorheight=64*F;back.ceilingheight=64*F;assert.equal(P_CheckSight(a,target),false);
    back.floorheight=0;back.ceilingheight=128*F;m.rejectmatrix[0]=2;assert.equal(P_CheckSight(a,target),false);
});
test('Sector height changes raise grounded actors, clip floaters and crush every four tics',()=>{
    const {a,damage}=init();m.sectors[0].floorheight=10*F;assert.equal(P_ThingHeightClip(a),true);assert.equal(a.z,10*F);
    m.sectors[0].ceilingheight=32*F;assert.equal(P_ChangeSector(m.sectors[0],true),true);assert.ok(damage.some(d=>d.target===a&&d.damage===10));assert.equal(m.sectors[0].thinglist!.type,MT.MT_BLOOD);
    m.sectors[0].ceilingheight=128*F;assert.equal(P_ChangeSector(m.sectors[0],false),false);
});
