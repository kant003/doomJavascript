import { playerstate_t, type player_t } from '../../src/linuxdoom-1.10/d_player.h';
import { weapontype_t } from '../../src/linuxdoom-1.10/doomdef.h';
import { VIEWHEIGHT } from '../../src/linuxdoom-1.10/p_local.h';

export function createPlayer(): player_t {
    return {mo:null,playerstate:playerstate_t.PST_LIVE,cmd:{forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons:0},
        viewz:1,viewheight:VIEWHEIGHT,deltaviewheight:0,bob:0,health:100,armorpoints:0,armortype:0,powers:new Int32Array(6),cards:Array(6).fill(false),backpack:false,
        frags:new Int32Array(4),readyweapon:weapontype_t.wp_pistol,pendingweapon:weapontype_t.wp_nochange,weaponowned:Array(9).fill(false),ammo:new Int32Array(4),maxammo:new Int32Array(4),
        attackdown:0,usedown:0,cheats:0,refire:0,killcount:0,itemcount:0,secretcount:0,message:null,damagecount:0,bonuscount:0,attacker:null,
        extralight:0,fixedcolormap:0,colormap:0,psprites:Array.from({length:2},()=>({state:null,tics:0,sx:0,sy:0})),didsecret:false};
}
