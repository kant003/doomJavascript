import assert from 'node:assert/strict';
import { P_InitInteractionContext, P_GiveAmmo, P_GiveWeapon, P_GiveBody, P_GiveArmor, P_GiveCard, P_GivePower, P_TouchSpecialThing, P_DamageMobj, maxammo, type interaction_context_t } from '../../src/linuxdoom-1.10/p_inter';
import { createMobjWorld } from './mobj-world';
import { P_SpawnMobj } from '../../src/linuxdoom-1.10/p_mobj';
import { P_InitMapContext, P_TryMove, P_SlideMove, P_CheckPosition, P_AimLineAttack, P_LineAttack, mapclip } from '../../src/linuxdoom-1.10/p_map';
import { P_InitPspriteContext, weaponStateActions, A_FirePistol } from '../../src/linuxdoom-1.10/p_pspr';
import { P_InitEnemyContext, reloadStateActions, deathStateActions, A_Fall, A_PlayerScream, A_Scream, A_Explode, P_NoiseAlert } from '../../src/linuxdoom-1.10/p_enemy';
import { P_RunThinkers } from '../../src/linuxdoom-1.10/p_tick';
import { mobjinfo, states, I_LinkStateActions } from '../../src/linuxdoom-1.10/info';
import { mobjtype_t as MT, spritenum_t as SPR, statenum_t as S } from '../../src/linuxdoom-1.10/info.h';
import { ammotype_t as AM, weapontype_t as WP, powertype_t as PW, powerduration_t as DUR, skill_t, GameMode_t, card_t as CARD } from '../../src/linuxdoom-1.10/doomdef.h';
import { mobjflag_t as MF, type mobj_t } from '../../src/linuxdoom-1.10/p_mobj.h';
import { playerstate_t as PST, cheat_t as CF } from '../../src/linuxdoom-1.10/d_player.h';
import { ONFLOORZ } from '../../src/linuxdoom-1.10/p_local.h';
import { FRACUNIT as F } from '../../src/linuxdoom-1.10/m_fixed.h';
import { mapstate as m } from '../../src/linuxdoom-1.10/r_state.h';
import { M_ClearRandom, prndindex } from '../../src/linuxdoom-1.10/m_random';
import { sfxenum_t as SFX } from '../../src/linuxdoom-1.10/sounds.h';
import * as TEXT from '../../src/linuxdoom-1.10/d_englsh.h';


export function createCombatWorld() {
    const fixture=createMobjWorld(),{g}=fixture,p=g.players[0];p.maxammo.set(maxammo);p.weaponowned[WP.wp_fist]=p.weaponowned[WP.wp_pistol]=true;
    p.mo=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER);p.mo.player=p;
    const sounds:{origin:mobj_t|null;sound:SFX}[]=[],tactile:number[][]=[];let automapStops=0;
    const context:interaction_context_t={gameskill:skill_t.sk_medium,gamemode:GameMode_t.commercial,netgame:false,deathmatch:0,players:g.players,consoleplayer:0,automapactive:false,
        S_StartSound:(origin,sound)=>sounds.push({origin,sound}),AM_Stop:()=>{automapStops++;},I_Tactile:(...v)=>tactile.push(v)};
    P_InitInteractionContext(context);P_InitEnemyContext({S_StartSound:context.S_StartSound,S_StartGlobalSound:sound=>context.S_StartSound(null,sound),gamemode:context.gamemode});
    I_LinkStateActions({...weaponStateActions,...reloadStateActions,...deathStateActions},false);
    P_InitMapContext({gamemap:1,P_DamageMobj,P_TouchSpecialThing,S_StartSound:context.S_StartSound,
        P_CrossSpecialLine:()=>assert.fail('no crossing'),P_UseSpecialLine:()=>assert.fail('no use'),P_ShootSpecialLine:()=>assert.fail('no shoot switch')});
    g.P_TryMove=P_TryMove;g.P_CheckPosition=P_CheckPosition;g.P_SlideMove=P_SlideMove;g.P_AimLineAttack=P_AimLineAttack;
    Object.defineProperties(g,{linetarget:{get:()=>mapclip.linetarget},ceilingline:{get:()=>mapclip.ceilingline},attackrange:{get:()=>mapclip.attackrange}});
    P_InitPspriteContext({gamemode:context.gamemode,get linetarget(){return mapclip.linetarget;},S_StartSound:context.S_StartSound,P_NoiseAlert,P_AimLineAttack,P_LineAttack,P_DamageMobj});
    return {...fixture,p,a:p.mo,context,sounds,tactile,get automapStops(){return automapStops;}};
}
