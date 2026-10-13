import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as inter from '../src/linuxdoom-1.10/p_inter';
import { P_InitInteractionContext, P_GiveAmmo, P_GiveWeapon, P_GiveBody, P_GiveArmor, P_GiveCard, P_GivePower, P_TouchSpecialThing, P_DamageMobj, maxammo, type interaction_context_t } from '../src/linuxdoom-1.10/p_inter';
import { createMobjWorld } from './helpers/mobj-world';
import { P_SpawnMobj } from '../src/linuxdoom-1.10/p_mobj';
import { P_InitMapContext, P_TryMove, P_SlideMove, P_CheckPosition, P_AimLineAttack, P_LineAttack, mapclip } from '../src/linuxdoom-1.10/p_map';
import { P_InitPspriteContext, weaponStateActions, A_FirePistol } from '../src/linuxdoom-1.10/p_pspr';
import { P_InitEnemyContext, reloadStateActions, deathStateActions, A_Fall, A_PlayerScream, A_Scream, A_Explode, P_NoiseAlert } from '../src/linuxdoom-1.10/p_enemy';
import { P_RunThinkers } from '../src/linuxdoom-1.10/p_tick';
import { mobjinfo, states, I_LinkStateActions } from '../src/linuxdoom-1.10/info';
import { mobjtype_t as MT, spritenum_t as SPR, statenum_t as S } from '../src/linuxdoom-1.10/info.h';
import { ammotype_t as AM, weapontype_t as WP, powertype_t as PW, powerduration_t as DUR, skill_t, GameMode_t, card_t as CARD } from '../src/linuxdoom-1.10/doomdef.h';
import { mobjflag_t as MF, type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { playerstate_t as PST, cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { M_ClearRandom, prndindex } from '../src/linuxdoom-1.10/m_random';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import * as TEXT from '../src/linuxdoom-1.10/d_englsh.h';

import { createCombatWorld as init } from './helpers/combat-world';

function item(sprite:SPR,x=32*F):mobj_t {
    const type=mobjinfo.findIndex(i=>states[i.spawnstate].sprite===sprite);assert.ok(type>=0,SPR[sprite]);return P_SpawnMobj(x,0,ONFLOORZ,type);
}
test('All nine original interaction functions and every literal pickup message are present',()=>{
    const source=readFileSync('original/linuxdoom-1.10/p_inter.c','utf8');const names=[...source.matchAll(/^(?:(?:void|boolean)[ \t]+)?(P_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);assert.equal(names.length,9);
    for(const name of names)assert.equal(typeof inter[name as keyof typeof inter],'function',name);
    const raw=readFileSync('original/linuxdoom-1.10/d_englsh.h','utf8');const values=[...raw.matchAll(/^#define\s+(GOT\w+)\s+("(?:\\.|[^"\\])*")/gm)];assert.equal(values.length,37);
    for(const row of values)assert.equal(TEXT[row[1] as keyof typeof TEXT],JSON.parse(row[2]));
    assert.equal(TEXT.HUSTR_KEYGREEN,'g'.charCodeAt(0));assert.ok(TEXT.NEWGAME.endsWith(TEXT.PRESSKEY));
});
test('GiveAmmo preserves clip sizes, skill doubling, caps and empty-ammo weapon preference',()=>{
    const {p,context}=init();p.readyweapon=WP.wp_fist;P_GiveAmmo(p,AM.am_clip,0);assert.equal(p.ammo[AM.am_clip],5);assert.equal(p.pendingweapon,WP.wp_pistol);
    p.ammo[AM.am_clip]=0;p.weaponowned[WP.wp_chaingun]=true;context.gameskill=skill_t.sk_baby;P_GiveAmmo(p,AM.am_clip,1);assert.equal(p.ammo[AM.am_clip],20);assert.equal(p.pendingweapon,WP.wp_chaingun);
    p.ammo[AM.am_clip]=199;P_GiveAmmo(p,AM.am_clip,5);assert.equal(p.ammo[AM.am_clip],200);assert.equal(P_GiveAmmo(p,AM.am_clip,1),false);
    assert.equal(P_GiveAmmo(p,AM.am_noammo,1),false);assert.throws(()=>P_GiveAmmo(p,AM.NUMAMMO,1),/bad type/);
    p.weaponowned[WP.wp_shotgun]=true;p.readyweapon=WP.wp_pistol;P_GiveAmmo(p,AM.am_shell,1);assert.equal(p.pendingweapon,WP.wp_shotgun);
});
test('Placed net weapons persist, dropped weapons give one load and normal finds give two',()=>{
    const {p,context,sounds}=init();assert.equal(P_GiveWeapon(p,WP.wp_shotgun,true),true);assert.equal(p.ammo[AM.am_shell],4);
    assert.equal(P_GiveWeapon(p,WP.wp_shotgun,false),true);assert.equal(p.ammo[AM.am_shell],12);
    context.netgame=true;context.deathmatch=1;assert.equal(P_GiveWeapon(p,WP.wp_plasma,false),false);assert.ok(p.weaponowned[WP.wp_plasma]);assert.equal(p.ammo[AM.am_cell],100);assert.equal(p.pendingweapon,WP.wp_plasma);assert.equal(sounds.at(-1)!.sound,SFX.sfx_wpnup);
});
test('Health, armor, keys and power grants retain independent cap and refresh behavior',()=>{
    const {p,a}=init();p.health=a.health=90;assert.equal(P_GiveBody(p,25),true);assert.equal(a.health,100);assert.equal(P_GiveBody(p,1),false);
    assert.equal(P_GiveArmor(p,2),true);assert.equal(P_GiveArmor(p,1),false);P_GiveCard(p,CARD.it_bluecard);assert.equal(p.bonuscount,6);p.bonuscount=9;P_GiveCard(p,CARD.it_bluecard);assert.equal(p.bonuscount,9);
    P_GivePower(p,PW.pw_invulnerability);assert.equal(p.powers[PW.pw_invulnerability],DUR.INVULNTICS);P_GivePower(p,PW.pw_invisibility);assert.ok(a.flags&MF.MF_SHADOW);
    assert.equal(P_GivePower(p,PW.pw_allmap),true);assert.equal(P_GivePower(p,PW.pw_allmap),false);
    p.health=a.health=20;P_GivePower(p,PW.pw_strength);assert.equal(p.health,100);assert.equal(p.powers[PW.pw_strength],1);
});
test('Every gettable sprite is processed by its real actor definition',()=>{
    const source=readFileSync('original/linuxdoom-1.10/p_inter.c','utf8');const names=[...source.matchAll(/case (SPR_\w+):/g)].map(r=>r[1]);assert.equal(names.length,36);
    for(const name of names){const {p,a,sounds}=init();p.health=a.health=50;const pickup=item(SPR[name as keyof typeof SPR] as SPR);P_TouchSpecialThing(pickup,a);
        assert.equal(pickup.thinker.function,-1,name);assert.ok(p.message,name);assert.equal(sounds.length,1,name);assert.equal(sounds[0].origin,null,name);}
});
test('Real movement picks up ammo, leaves unneeded health and respects reach/dead players',()=>{
    const {p,a}=init(),pickup=item(SPR.SPR_CLIP);assert.equal(P_TryMove(a,32*F,0),true);assert.equal(p.ammo[AM.am_clip],10);assert.equal(pickup.thinker.function,-1);
    const stim=item(SPR.SPR_STIM,64*F);assert.equal(P_TryMove(a,64*F,0),true);assert.notEqual(stim.thinker.function,-1);
    p.health=a.health=50;stim.z=100*F;P_TouchSpecialThing(stim,a);assert.equal(p.health,50);stim.z=-9*F;P_TouchSpecialThing(stim,a);assert.equal(p.health,50);
    stim.z=0;a.health=0;P_TouchSpecialThing(stim,a);assert.notEqual(stim.thinker.function,-1);
});
test('Keys remain for all net players; backpacks double capacity only once; medikit retains original post-heal message test',()=>{
    const {p,a,context,sounds}=init();context.netgame=true;const key=item(SPR.SPR_BKEY);P_TouchSpecialThing(key,a);assert.ok(p.cards[CARD.it_bluecard]);assert.notEqual(key.thinker.function,-1);assert.equal(sounds.length,0);
    context.netgame=false;const pack=item(SPR.SPR_BPAK);P_TouchSpecialThing(pack,a);assert.deepEqual([...p.maxammo],[400,100,600,100]);P_TouchSpecialThing(item(SPR.SPR_BPAK),a);assert.deepEqual([...p.maxammo],[400,100,600,100]);
    p.health=a.health=1;P_TouchSpecialThing(item(SPR.SPR_MEDI),a);assert.equal(p.health,26);assert.equal(p.message,TEXT.GOTMEDIKIT);
});
test('Damage applies green/blue armor, mirrors health, attributes attacker and records tactile request',()=>{
    const {p,a,tactile}=init();p.armortype=1;p.armorpoints=100;M_ClearRandom();P_DamageMobj(a,null,null,30);
    assert.equal(p.health,80);assert.equal(a.health,80);assert.equal(p.armorpoints,90);assert.equal(p.damagecount,20);assert.deepEqual(tactile[0],[40,10,80]);
    p.armortype=2;p.armorpoints=3;P_DamageMobj(a,null,null,10);assert.equal(p.health,73);assert.equal(p.armortype,0);assert.equal(p.armorpoints,0);assert.equal(p.attacker,null);
});
test('Baby damage, god mode, invulnerability and ending-sector survival preserve ordering',()=>{
    const {p,a,context}=init();context.gameskill=skill_t.sk_baby;P_DamageMobj(a,null,null,10);assert.equal(a.health,95);
    context.gameskill=skill_t.sk_medium;p.cheats=CF.CF_GODMODE;P_DamageMobj(a,null,null,99);assert.equal(a.health,95);p.cheats=0;p.powers[PW.pw_invulnerability]=1;P_DamageMobj(a,null,null,999);assert.equal(a.health,95);
    p.powers[PW.pw_invulnerability]=0;a.subsector!.sector!.special=11;P_DamageMobj(a,null,null,1000);assert.equal(a.health,1);assert.equal(p.health,1);assert.equal(p.playerstate,PST.PST_LIVE);
});
test('Thrust precedes invulnerability and chainsaw suppresses thrust',()=>{
    const {p,a,g}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_PLAYER);target.player=g.players[1];g.players[1].mo=target;g.players[1].cheats=CF.CF_GODMODE;
    P_DamageMobj(target,a,a,20);assert.equal(target.health,100);assert.ok(target.momx>0);target.momx=target.momy=0;p.readyweapon=WP.wp_chainsaw;P_DamageMobj(target,a,a,20);assert.equal(target.momx,0);assert.equal(target.momy,0);
});
test('Real pistol hits kill monsters, count kills and spawn dropped ammo; corpse frames clear solidity',()=>{
    const {p,a}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);p.ammo[AM.am_clip]=10;
    target.health=5;M_ClearRandom();A_FirePistol(p,p.psprites[0]);assert.ok(target.health<=0);assert.equal(target.flags&MF.MF_SHOOTABLE,0);assert.ok(target.flags&MF.MF_CORPSE);assert.equal(p.killcount,1);assert.equal(p.ammo[AM.am_clip],9);
    const dropped=m.sectors[0].thinglist!;assert.equal(dropped.type,MT.MT_CLIP);assert.ok(dropped.flags&MF.MF_DROPPED);
    for(let i=0;i<40;i++)P_RunThinkers();assert.equal(target.flags&MF.MF_SOLID,0);assert.ok(target.height<56*F);assert.ok(a.health>0);
});
test('Player death stops automap, drops weapon and counts environment suicide',()=>{
    const f=init(),{p,a,context}=f;context.automapactive=true;P_DamageMobj(a,null,null,1000);
    assert.equal(p.playerstate,PST.PST_DEAD);assert.equal(p.frags[0],1);assert.equal(a.flags&MF.MF_SOLID,0);assert.equal(p.damagecount,100);assert.equal(f.automapStops,1);
});
test('Pain and retargeting preserve reaction/threshold rules with explicit partial bindings',()=>{
    const {a}=init(),target=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_POSSESSED);target.threshold=1;M_ClearRandom();P_DamageMobj(target,null,a,1);
    assert.equal(target.health,19);assert.strictEqual(target.state,states[target.info!.painstate]);assert.ok(target.flags&MF.MF_JUSTHIT);assert.equal(target.reactiontime,0);
    target.threshold=0;P_DamageMobj(target,null,a,1);assert.strictEqual(target.target,a);assert.equal(target.threshold,100);
    // This fixture deliberately omits A_Chase from its partial bindings; execution must fail explicitly.
    target.state=states[target.info!.spawnstate];target.threshold=0;target.info={...target.info!,painchance:0};assert.throws(()=>P_DamageMobj(target,null,a,1),/A_Chase/);
});
test('Native radius explosions now reduce real health and respect boss immunity',()=>{
    const {a}=init(),victim=P_SpawnMobj(64*F,24*F,ONFLOORZ,MT.MT_POSSESSED),barrel=P_SpawnMobj(0,24*F,ONFLOORZ,MT.MT_BARREL);
    const boss=P_SpawnMobj(24*F,64*F,ONFLOORZ,MT.MT_CYBORG);barrel.target=a;A_Explode(barrel);assert.ok(victim.health<=0);assert.equal(boss.health,boss.info!.spawnhealth);
});
test('Death actions preserve random sound families, full-volume boss sounds and commercial player scream',()=>{
    const {a,sounds}=init(),boss=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_CYBORG);A_Scream(boss);assert.equal(sounds.at(-1)!.origin,null);
    a.health=-60;A_PlayerScream(a);assert.equal(sounds.at(-1)!.sound,SFX.sfx_pdiehi);a.flags|=MF.MF_SOLID;A_Fall(a);assert.equal(a.flags&MF.MF_SOLID,0);
});
