// Static inspection objects from the original actor/state tables. No game spawning or actions execute here.
import { mapstate } from '../linuxdoom-1.10/r_state.h';
import { mobjinfo,states } from '../linuxdoom-1.10/info';
import { mobjtype_t } from '../linuxdoom-1.10/info.h';
import { mobjflag_t } from '../linuxdoom-1.10/p_mobj.h';
import type { mobj_t } from '../linuxdoom-1.10/p_mobj.h';
import { spritesState } from '../linuxdoom-1.10/r_things';
import { FF_FRAMEMASK } from '../linuxdoom-1.10/p_pspr.h';
import { FRACUNIT } from '../linuxdoom-1.10/m_fixed.h';
import { ANG45 } from '../linuxdoom-1.10/tables.h';
import { R_PointInSubsector } from '../linuxdoom-1.10/r_main';
export function createStaticMapActors():mobj_t[]{
    for(const sector of mapstate.sectors)sector.thinglist=null;
    const actors:mobj_t[]=[];
    for(const thing of mapstate.things){
        const type=mobjinfo.findIndex(info=>info.doomednum===thing.type);if(type<0)continue;
        const info=mobjinfo[type],state=states[info.spawnstate];
        if(!spritesState.sprites[state.sprite]?.spriteframes[state.frame&FF_FRAMEMASK])continue;
        const subsector=R_PointInSubsector(thing.x*FRACUNIT,thing.y*FRACUNIT),sector=subsector.sector;if(!sector)throw new Error('Actor origin has no sector');
        const actor:mobj_t={thinker:{prev:null,next:null,function:null},x:thing.x*FRACUNIT,y:thing.y*FRACUNIT,
            z:info.flags&mobjflag_t.MF_SPAWNCEILING?sector.ceilingheight-info.height:sector.floorheight,
            snext:null,sprev:null,angle:(Math.trunc(thing.angle/45)*ANG45)>>>0,sprite:state.sprite,frame:state.frame,bnext:null,bprev:null,subsector,
            floorz:sector.floorheight,ceilingz:sector.ceilingheight,radius:info.radius,height:info.height,momx:0,momy:0,momz:0,validcount:0,
            type:type as mobjtype_t,info,tics:state.tics,state,flags:info.flags,health:info.spawnhealth,movedir:0,movecount:0,target:null,
            reactiontime:info.reactiontime,threshold:0,player:null,lastlook:0,spawnpoint:{...thing},tracer:null};
        if(!(actor.flags&mobjflag_t.MF_NOSECTOR)){actor.snext=sector.thinglist;if(actor.snext)actor.snext.sprev=actor;sector.thinglist=actor;}
        actors.push(actor);
    }return actors;
}
