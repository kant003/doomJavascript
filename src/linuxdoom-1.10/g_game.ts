// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial g_game.c: rebirth; the browser session owns new-game/level lifecycle for now.
import { playerstate_t as PST,type player_t } from './d_player.h';
import { weapontype_t as WP,ammotype_t as AM,MAXPLAYERS } from './doomdef.h';
import { maxammo } from './p_inter';
import { MAXHEALTH } from './p_local.h';
// Zero-initialized storage with the new-game reborn marker; original rebirth fills gameplay defaults.
export function G_CreatePlayer():player_t {
    return {mo:null,playerstate:PST.PST_REBORN,cmd:{forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons:0},
        viewz:0,viewheight:0,deltaviewheight:0,bob:0,health:0,armorpoints:0,armortype:0,powers:new Int32Array(6),cards:Array(6).fill(false),backpack:false,
        frags:new Int32Array(MAXPLAYERS),readyweapon:WP.wp_fist,pendingweapon:WP.wp_fist,weaponowned:Array(9).fill(false),ammo:new Int32Array(4),maxammo:new Int32Array(4),
        attackdown:0,usedown:0,cheats:0,refire:0,killcount:0,itemcount:0,secretcount:0,message:null,damagecount:0,bonuscount:0,attacker:null,
        extralight:0,fixedcolormap:0,colormap:0,psprites:Array.from({length:2},()=>({state:null,tics:0,sx:0,sy:0})),didsecret:false};
}
let players:player_t[]|null=null;
export function G_InitGameContext(context:{players:player_t[]}):void {players=context.players;}
export function G_PlayerReborn(index:number):void {
    const p=players?.[index];if(!p)throw new Error('G_PlayerReborn: invalid player or missing context');
    const frags=p.frags.slice(),killcount=p.killcount,itemcount=p.itemcount,secretcount=p.secretcount;
    Object.assign(p,G_CreatePlayer());p.frags.set(frags);p.killcount=killcount;p.itemcount=itemcount;p.secretcount=secretcount;
    p.usedown=p.attackdown=1;p.playerstate=PST.PST_LIVE;p.health=MAXHEALTH;
    p.readyweapon=p.pendingweapon=WP.wp_pistol;p.weaponowned[WP.wp_fist]=p.weaponowned[WP.wp_pistol]=true;
    p.ammo[AM.am_clip]=50;p.maxammo.set(maxammo);
}
