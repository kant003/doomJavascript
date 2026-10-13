import { W_InitFile, W_GetNumForName } from '../../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../../src/linuxdoom-1.10/r_data';
import { P_LoadMapData } from '../../src/linuxdoom-1.10/p_setup';
import { demoWad } from '../../src/web/demo';
import { P_InitThinkers, P_ResetLevelTime } from '../../src/linuxdoom-1.10/p_tick';
import { P_InitMobjContext, P_ResetItemRespawnQueue, type mobj_context_t } from '../../src/linuxdoom-1.10/p_mobj';
import { M_ClearRandom } from '../../src/linuxdoom-1.10/m_random';
import { I_LinkStateActions } from '../../src/linuxdoom-1.10/info';
import { skill_t } from '../../src/linuxdoom-1.10/doomdef.h';
import type { mobj_t } from '../../src/linuxdoom-1.10/p_mobj.h';
import type { sfxenum_t } from '../../src/linuxdoom-1.10/sounds.h';
import { createPlayer } from './player';

export function createMobjWorld() {
    W_InitFile({name:'demo.wad',data:demoWad()});R_InitData();P_LoadMapData(W_GetNumForName('E1M1'));
    P_InitThinkers();P_ResetLevelTime();P_ResetItemRespawnQueue();M_ClearRandom();I_LinkStateActions({},false);
    const sounds:{origin:mobj_t;sound:sfxenum_t}[]=[],stopped:mobj_t[]=[],calls:string[]=[];
    const missing=(name:string):never=>{throw new Error(`Test dependency not configured: ${name}`);};
    const g:mobj_context_t={gameskill:skill_t.sk_medium,deathmatch:0,netgame:false,nomonsters:false,respawnmonsters:false,players:Array.from({length:4},createPlayer),
        playeringame:[false,false,false,false],consoleplayer:0,playerstarts:[],deathmatchstarts:[],totalkills:0,totalitems:0,ceilingline:null,linetarget:null,attackrange:0,
        P_TryMove:()=>missing('P_TryMove'),P_CheckPosition:()=>missing('P_CheckPosition'),P_SlideMove:()=>missing('P_SlideMove'),P_AimLineAttack:()=>missing('P_AimLineAttack'),
        S_StartSound:(origin,sound)=>sounds.push({origin,sound}),S_StopSound:origin=>stopped.push(origin),
        G_PlayerReborn:()=>missing('G_PlayerReborn'),P_SetupPsprites:()=>missing('P_SetupPsprites'),ST_Start:()=>calls.push('status'),HU_Start:()=>calls.push('hud')};
    P_InitMobjContext(g);return {g,sounds,stopped,calls};
}
