// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import type { line_t } from './r_defs.h';
import { mobjflag_t as MF,type mobj_t } from './p_mobj.h';
import { mapstate as m } from './r_state.h';
import { thinkercap } from './p_tick';
import { P_MobjThinker,P_MobjForThinker,P_SpawnMobj } from './p_mobj';
import { P_TeleportMove } from './p_map';
import { P_SectorSound } from './p_spec';
import { mobjtype_t as MT } from './info.h';
import { sfxenum_t as SFX } from './sounds.h';
import { ANGLETOFINESHIFT,finecosine,finesine } from './tables.h';

export function EV_Teleport(line:Pick<line_t,'tag'>,side:number,thing:mobj_t):number {
    if((thing.flags&MF.MF_MISSILE)||side===1)return 0;
    for(const sector of m.sectors)if(sector.tag===line.tag){
        for(let thinker=thinkercap.next;thinker&&thinker!==thinkercap;thinker=thinker.next){
            if(thinker.function!==P_MobjThinker)continue;
            const dest=P_MobjForThinker(thinker);
            if(!dest||dest.type!==MT.MT_TELEPORTMAN||dest.subsector!.sector!==sector)continue;
            const oldx=thing.x,oldy=thing.y,oldz=thing.z;
            if(!P_TeleportMove(thing,dest.x,dest.y))return 0;
            thing.z=thing.floorz;
            if(thing.player)thing.player.viewz=(thing.z+thing.player.viewheight)|0;
            P_SectorSound(P_SpawnMobj(oldx,oldy,oldz,MT.MT_TFOG),SFX.sfx_telept);
            const an=dest.angle>>>ANGLETOFINESHIFT;
            P_SectorSound(P_SpawnMobj((dest.x+20*finecosine[an])|0,(dest.y+20*finesine[an])|0,thing.z,MT.MT_TFOG),SFX.sfx_telept);
            if(thing.player)thing.reactiontime=18;
            thing.angle=dest.angle;thing.momx=thing.momy=thing.momz=0;
            return 1;
        }
    }
    return 0;
}
