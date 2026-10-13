// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { ammotype_t as AM, weapontype_t as WP, card_t as CARD, powertype_t as PW, powerduration_t as DURATION, skill_t, GameMode_t } from './doomdef.h';
import { playerstate_t as PST, cheat_t as CF, type player_t } from './d_player.h';
import { mobjflag_t as MF, type mobj_t } from './p_mobj.h';
import { spritenum_t as SPR, mobjtype_t as MT, statenum_t as S } from './info.h';
import { states } from './info';
import { weaponinfo } from './d_items';
import { P_SetMobjState, P_RemoveMobj, P_SpawnMobj } from './p_mobj';
import { P_DropWeapon } from './p_pspr';
import { FRACUNIT as F } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { P_Random } from './m_random';
import { R_PointToAngle2 } from './r_main';
import { ANG180, ANGLETOFINESHIFT, finecosine, finesine } from './tables.h';
import { MAXHEALTH, BASETHRESHOLD, ONFLOORZ } from './p_local.h';
import { sfxenum_t as SFX } from './sounds.h';
import * as TEXT from './d_englsh.h';

export interface interaction_context_t {
    gameskill:skill_t; gamemode:GameMode_t; netgame:boolean; deathmatch:number;
    players:player_t[]; consoleplayer:number; automapactive:boolean;
    S_StartSound(origin:mobj_t|null,sound:SFX):void;
    AM_Stop():void;
    I_Tactile(on:number,off:number,total:number):void;
}
let context:interaction_context_t|null=null;
export function P_InitInteractionContext(game:interaction_context_t):void {context=game;}
function game():interaction_context_t {if(!context)throw new Error('P_InitInteractionContext: gameplay dependencies are not linked');return context;}
const BONUSADD=6;
export const maxammo=new Int32Array([200,50,300,50]),clipammo=new Int32Array([10,4,20,1]);
export function P_GiveAmmo(player:player_t,ammo:AM,num:number):boolean {
    if(ammo===AM.am_noammo)return false;
    if(ammo<0||ammo>=AM.NUMAMMO)throw new Error(`P_GiveAmmo: bad type ${ammo}`);
    if(player.ammo[ammo]===player.maxammo[ammo])return false;
    num=num?Math.imul(num,clipammo[ammo]):Math.trunc(clipammo[ammo]/2);
    const g=game();if(g.gameskill===skill_t.sk_baby||g.gameskill===skill_t.sk_nightmare)num<<=1;
    const oldammo=player.ammo[ammo];player.ammo[ammo]+=num;if(player.ammo[ammo]>player.maxammo[ammo])player.ammo[ammo]=player.maxammo[ammo];
    if(oldammo)return true;
    switch(ammo) {
        case AM.am_clip:if(player.readyweapon===WP.wp_fist)player.pendingweapon=player.weaponowned[WP.wp_chaingun]?WP.wp_chaingun:WP.wp_pistol;break;
        case AM.am_shell:if((player.readyweapon===WP.wp_fist||player.readyweapon===WP.wp_pistol)&&player.weaponowned[WP.wp_shotgun])player.pendingweapon=WP.wp_shotgun;break;
        case AM.am_cell:if((player.readyweapon===WP.wp_fist||player.readyweapon===WP.wp_pistol)&&player.weaponowned[WP.wp_plasma])player.pendingweapon=WP.wp_plasma;break;
        case AM.am_misl:if(player.readyweapon===WP.wp_fist&&player.weaponowned[WP.wp_missile])player.pendingweapon=WP.wp_missile;break;
    }return true;
}
export function P_GiveWeapon(player:player_t,weapon:WP,dropped:boolean):boolean {
    const g=game();
    if(g.netgame&&g.deathmatch!==2&&!dropped) {
        if(player.weaponowned[weapon])return false;
        player.bonuscount+=BONUSADD;player.weaponowned[weapon]=true;P_GiveAmmo(player,weaponinfo[weapon].ammo,g.deathmatch?5:2);player.pendingweapon=weapon;
        if(player===g.players[g.consoleplayer])g.S_StartSound(null,SFX.sfx_wpnup);return false;
    }
    const gaveammo=weaponinfo[weapon].ammo!==AM.am_noammo?P_GiveAmmo(player,weaponinfo[weapon].ammo,dropped?1:2):false;
    const gaveweapon=!player.weaponowned[weapon];if(gaveweapon){player.weaponowned[weapon]=true;player.pendingweapon=weapon;}
    return gaveweapon||gaveammo;
}
export function P_GiveBody(player:player_t,num:number):boolean {
    if(player.health>=MAXHEALTH)return false;player.health=Math.min(MAXHEALTH,(player.health+num)|0);player.mo!.health=player.health;return true;
}
export function P_GiveArmor(player:player_t,armortype:number):boolean {
    const hits=Math.imul(armortype,100);if(player.armorpoints>=hits)return false;player.armortype=armortype;player.armorpoints=hits;return true;
}
export function P_GiveCard(player:player_t,card:CARD):void {if(player.cards[card])return;player.bonuscount=BONUSADD;player.cards[card]=true;}
export function P_GivePower(player:player_t,power:PW):boolean {
    switch(power) {
        case PW.pw_invulnerability:player.powers[power]=DURATION.INVULNTICS;return true;
        case PW.pw_invisibility:player.powers[power]=DURATION.INVISTICS;player.mo!.flags|=MF.MF_SHADOW;return true;
        case PW.pw_infrared:player.powers[power]=DURATION.INFRATICS;return true;
        case PW.pw_ironfeet:player.powers[power]=DURATION.IRONTICS;return true;
        case PW.pw_strength:P_GiveBody(player,100);player.powers[power]=1;return true;
    }
    if(player.powers[power])return false;player.powers[power]=1;return true;
}
export function P_TouchSpecialThing(special:mobj_t,toucher:mobj_t):void {
    const delta=(special.z-toucher.z)|0;if(delta>toucher.height||delta< -8*F||toucher.health<=0)return;
    const p=toucher.player;if(!p)throw new Error('P_TouchSpecialThing: toucher is not a player');
    const g=game();let sound=SFX.sfx_itemup;
    switch(special.sprite) {
        case SPR.SPR_ARM1:if(!P_GiveArmor(p,1))return;p.message=TEXT.GOTARMOR;break;
        case SPR.SPR_ARM2:if(!P_GiveArmor(p,2))return;p.message=TEXT.GOTMEGA;break;
        case SPR.SPR_BON1:p.health=Math.min(200,p.health+1);p.mo!.health=p.health;p.message=TEXT.GOTHTHBONUS;break;
        case SPR.SPR_BON2:p.armorpoints=Math.min(200,p.armorpoints+1);if(!p.armortype)p.armortype=1;p.message=TEXT.GOTARMBONUS;break;
        case SPR.SPR_SOUL:p.health=Math.min(200,p.health+100);p.mo!.health=p.health;p.message=TEXT.GOTSUPER;sound=SFX.sfx_getpow;break;
        case SPR.SPR_MEGA:if(g.gamemode!==GameMode_t.commercial)return;p.health=p.mo!.health=200;P_GiveArmor(p,2);p.message=TEXT.GOTMSPHERE;sound=SFX.sfx_getpow;break;
        case SPR.SPR_BKEY:if(!p.cards[CARD.it_bluecard])p.message=TEXT.GOTBLUECARD;P_GiveCard(p,CARD.it_bluecard);if(g.netgame)return;break;
        case SPR.SPR_YKEY:if(!p.cards[CARD.it_yellowcard])p.message=TEXT.GOTYELWCARD;P_GiveCard(p,CARD.it_yellowcard);if(g.netgame)return;break;
        case SPR.SPR_RKEY:if(!p.cards[CARD.it_redcard])p.message=TEXT.GOTREDCARD;P_GiveCard(p,CARD.it_redcard);if(g.netgame)return;break;
        case SPR.SPR_BSKU:if(!p.cards[CARD.it_blueskull])p.message=TEXT.GOTBLUESKUL;P_GiveCard(p,CARD.it_blueskull);if(g.netgame)return;break;
        case SPR.SPR_YSKU:if(!p.cards[CARD.it_yellowskull])p.message=TEXT.GOTYELWSKUL;P_GiveCard(p,CARD.it_yellowskull);if(g.netgame)return;break;
        case SPR.SPR_RSKU:if(!p.cards[CARD.it_redskull])p.message=TEXT.GOTREDSKULL;P_GiveCard(p,CARD.it_redskull);if(g.netgame)return;break;
        case SPR.SPR_STIM:if(!P_GiveBody(p,10))return;p.message=TEXT.GOTSTIM;break;
        case SPR.SPR_MEDI:if(!P_GiveBody(p,25))return;p.message=p.health<25?TEXT.GOTMEDINEED:TEXT.GOTMEDIKIT;break;
        case SPR.SPR_PINV:if(!P_GivePower(p,PW.pw_invulnerability))return;p.message=TEXT.GOTINVUL;sound=SFX.sfx_getpow;break;
        case SPR.SPR_PSTR:if(!P_GivePower(p,PW.pw_strength))return;p.message=TEXT.GOTBERSERK;if(p.readyweapon!==WP.wp_fist)p.pendingweapon=WP.wp_fist;sound=SFX.sfx_getpow;break;
        case SPR.SPR_PINS:if(!P_GivePower(p,PW.pw_invisibility))return;p.message=TEXT.GOTINVIS;sound=SFX.sfx_getpow;break;
        case SPR.SPR_SUIT:if(!P_GivePower(p,PW.pw_ironfeet))return;p.message=TEXT.GOTSUIT;sound=SFX.sfx_getpow;break;
        case SPR.SPR_PMAP:if(!P_GivePower(p,PW.pw_allmap))return;p.message=TEXT.GOTMAP;sound=SFX.sfx_getpow;break;
        case SPR.SPR_PVIS:if(!P_GivePower(p,PW.pw_infrared))return;p.message=TEXT.GOTVISOR;sound=SFX.sfx_getpow;break;
        case SPR.SPR_CLIP:if(!P_GiveAmmo(p,AM.am_clip,special.flags&MF.MF_DROPPED?0:1))return;p.message=TEXT.GOTCLIP;break;
        case SPR.SPR_AMMO:if(!P_GiveAmmo(p,AM.am_clip,5))return;p.message=TEXT.GOTCLIPBOX;break;
        case SPR.SPR_ROCK:if(!P_GiveAmmo(p,AM.am_misl,1))return;p.message=TEXT.GOTROCKET;break;
        case SPR.SPR_BROK:if(!P_GiveAmmo(p,AM.am_misl,5))return;p.message=TEXT.GOTROCKBOX;break;
        case SPR.SPR_CELL:if(!P_GiveAmmo(p,AM.am_cell,1))return;p.message=TEXT.GOTCELL;break;
        case SPR.SPR_CELP:if(!P_GiveAmmo(p,AM.am_cell,5))return;p.message=TEXT.GOTCELLBOX;break;
        case SPR.SPR_SHEL:if(!P_GiveAmmo(p,AM.am_shell,1))return;p.message=TEXT.GOTSHELLS;break;
        case SPR.SPR_SBOX:if(!P_GiveAmmo(p,AM.am_shell,5))return;p.message=TEXT.GOTSHELLBOX;break;
        case SPR.SPR_BPAK:if(!p.backpack){for(let i=0;i<AM.NUMAMMO;i++)p.maxammo[i]*=2;p.backpack=true;}for(let i=0;i<AM.NUMAMMO;i++)P_GiveAmmo(p,i,1);p.message=TEXT.GOTBACKPACK;break;
        case SPR.SPR_BFUG:if(!P_GiveWeapon(p,WP.wp_bfg,false))return;p.message=TEXT.GOTBFG9000;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_MGUN:if(!P_GiveWeapon(p,WP.wp_chaingun,!!(special.flags&MF.MF_DROPPED)))return;p.message=TEXT.GOTCHAINGUN;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_CSAW:if(!P_GiveWeapon(p,WP.wp_chainsaw,false))return;p.message=TEXT.GOTCHAINSAW;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_LAUN:if(!P_GiveWeapon(p,WP.wp_missile,false))return;p.message=TEXT.GOTLAUNCHER;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_PLAS:if(!P_GiveWeapon(p,WP.wp_plasma,false))return;p.message=TEXT.GOTPLASMA;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_SHOT:if(!P_GiveWeapon(p,WP.wp_shotgun,!!(special.flags&MF.MF_DROPPED)))return;p.message=TEXT.GOTSHOTGUN;sound=SFX.sfx_wpnup;break;
        case SPR.SPR_SGN2:if(!P_GiveWeapon(p,WP.wp_supershotgun,!!(special.flags&MF.MF_DROPPED)))return;p.message=TEXT.GOTSHOTGUN2;sound=SFX.sfx_wpnup;break;
        default:throw new Error('P_SpecialThing: Unknown gettable thing');
    }
    if(special.flags&MF.MF_COUNTITEM)p.itemcount++;P_RemoveMobj(special);p.bonuscount+=BONUSADD;
    if(p===g.players[g.consoleplayer])g.S_StartSound(null,sound);
}
export function P_KillMobj(source:mobj_t|null,target:mobj_t):void {
    const g=game();target.flags&=~(MF.MF_SHOOTABLE|MF.MF_FLOAT|MF.MF_SKULLFLY);if(target.type!==MT.MT_SKULL)target.flags&=~MF.MF_NOGRAVITY;
    target.flags|=MF.MF_CORPSE|MF.MF_DROPOFF;target.height>>=2;
    if(source?.player){if(target.flags&MF.MF_COUNTKILL)source.player.killcount++;if(target.player)source.player.frags[g.players.indexOf(target.player)]++;}
    else if(!g.netgame&&(target.flags&MF.MF_COUNTKILL))g.players[0].killcount++;
    if(target.player) {
        if(!source)target.player.frags[g.players.indexOf(target.player)]++;
        target.flags&=~MF.MF_SOLID;target.player.playerstate=PST.PST_DEAD;P_DropWeapon(target.player);
        if(target.player===g.players[g.consoleplayer]&&g.automapactive)g.AM_Stop();
    }
    P_SetMobjState(target,target.health< -target.info!.spawnhealth&&target.info!.xdeathstate?target.info!.xdeathstate:target.info!.deathstate);
    target.tics-=P_Random()&3;if(target.tics<1)target.tics=1;
    let item:MT;
    switch(target.type){case MT.MT_WOLFSS:case MT.MT_POSSESSED:item=MT.MT_CLIP;break;case MT.MT_SHOTGUY:item=MT.MT_SHOTGUN;break;case MT.MT_CHAINGUY:item=MT.MT_CHAINGUN;break;default:return;}
    const mo=P_SpawnMobj(target.x,target.y,ONFLOORZ,item);mo.flags|=MF.MF_DROPPED;
}
export function P_DamageMobj(target:mobj_t,inflictor:mobj_t|null,source:mobj_t|null,damage:number):void {
    if(!(target.flags&MF.MF_SHOOTABLE)||target.health<=0)return;
    if(target.flags&MF.MF_SKULLFLY)target.momx=target.momy=target.momz=0;
    const g=game(),player=target.player;if(player&&g.gameskill===skill_t.sk_baby)damage>>=1;
    if(inflictor&&!(target.flags&MF.MF_NOCLIP)&&(!source?.player||source.player.readyweapon!==WP.wp_chainsaw)) {
        let ang=R_PointToAngle2(inflictor.x,inflictor.y,target.x,target.y);
        let thrust=Math.trunc(Math.imul(Math.imul(damage,F>>3),100)/target.info!.mass)|0;
        if(damage<40&&damage>target.health&&((target.z-inflictor.z)|0)>64*F&&(P_Random()&1)){ang=(ang+ANG180)>>>0;thrust=Math.imul(thrust,4);}
        ang>>>=ANGLETOFINESHIFT;target.momx=(target.momx+FixedMul(thrust,finecosine[ang]))|0;target.momy=(target.momy+FixedMul(thrust,finesine[ang]))|0;
    }
    if(player) {
        if(target.subsector!.sector!.special===11&&damage>=target.health)damage=target.health-1;
        if(damage<1000&&((player.cheats&CF.CF_GODMODE)||player.powers[PW.pw_invulnerability]))return;
        if(player.armortype){let saved=Math.trunc(damage/(player.armortype===1?3:2));if(player.armorpoints<=saved){saved=player.armorpoints;player.armortype=0;}player.armorpoints-=saved;damage-=saved;}
        player.health=Math.max(0,player.health-damage);player.attacker=source;player.damagecount=Math.min(100,player.damagecount+damage);
        if(player===g.players[g.consoleplayer])g.I_Tactile(40,10,40+Math.min(damage,100)*2);
    }
    target.health=(target.health-damage)|0;if(target.health<=0){P_KillMobj(source,target);return;}
    if(P_Random()<target.info!.painchance&&!(target.flags&MF.MF_SKULLFLY)){target.flags|=MF.MF_JUSTHIT;P_SetMobjState(target,target.info!.painstate);}
    target.reactiontime=0;
    if((!target.threshold||target.type===MT.MT_VILE)&&source&&source!==target&&source.type!==MT.MT_VILE) {
        target.target=source;target.threshold=BASETHRESHOLD;
        if(target.state===states[target.info!.spawnstate]&&target.info!.seestate!==S.S_NULL)P_SetMobjState(target,target.info!.seestate);
    }
}
