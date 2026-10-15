// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { floor_e as FT,stair_e,result_e as RES,FLOORSPEED,type floormove_t } from './p_spec.h';
import type { sector_t,line_t } from './r_defs.h';
import { FRACUNIT as F } from './m_fixed.h';
import { P_ChangeSector } from './p_map';
import { leveltime,P_RemoveThinker } from './p_tick';
import { sfxenum_t as SFX } from './sounds.h';
import { mapstate as m } from './r_state.h';
import { texturestate } from './r_data';
import { ML_TWOSIDED } from './doomdata.h';
import { P_AddSpecialThinker,P_SpecialForThinker,P_SectorSound,P_FindSectorFromLineTag,P_FindHighestFloorSurrounding,P_FindLowestFloorSurrounding,
    P_FindLowestCeilingSurrounding,P_FindNextHighestFloor,twoSided,getSide,getSector } from './p_spec';
export function T_MovePlane(sector:sector_t,speed:number,dest:number,crush:boolean,floorOrCeiling:number,direction:number):RES {
    if((floorOrCeiling!==0&&floorOrCeiling!==1)||(direction!==1&&direction!==-1))return RES.ok;
    const field=floorOrCeiling===0?'floorheight':'ceilingheight',lastpos=sector[field],next=(lastpos+Math.imul(speed,direction))|0;
    const past=direction===-1?next<dest:next>dest;
    sector[field]=past?dest:next;const blocked=P_ChangeSector(sector,crush);
    if(past){if(blocked){sector[field]=lastpos;P_ChangeSector(sector,crush);}return RES.pastdest;}
    if(blocked&&!(floorOrCeiling===1&&direction===1)) {
        if(!(crush&&direction===1&&floorOrCeiling===0)&&!(crush&&direction===-1&&floorOrCeiling===1)){sector[field]=lastpos;P_ChangeSector(sector,crush);}return RES.crushed;
    }return RES.ok;
}
function createFloor(sec:sector_t):floormove_t {
    const floor:floormove_t={thinker:{prev:null,next:null,function:null},type:FT.lowerFloor,crush:false,sector:sec,direction:0,newspecial:0,texture:0,floordestheight:0,speed:0};
    P_AddSpecialThinker(floor,T_MoveFloor);sec.specialdata=floor;return floor;
}
export function T_MoveFloor(argument:unknown):void {
    const floor=P_SpecialForThinker<floormove_t>(argument),sec=floor.sector;
    const res=T_MovePlane(sec,floor.speed,floor.floordestheight,floor.crush,0,floor.direction);
    if(!(leveltime&7))P_SectorSound(sec.soundorg,SFX.sfx_stnmov);
    if(res===RES.pastdest){sec.specialdata=null;if((floor.direction===1&&floor.type===FT.donutRaise)||(floor.direction===-1&&floor.type===FT.lowerAndChange)){sec.special=floor.newspecial;sec.floorpic=floor.texture;}
        P_RemoveThinker(floor.thinker);P_SectorSound(sec.soundorg,SFX.sfx_pstop);}
}
export function EV_DoFloor(line:Pick<line_t,'tag'>,type:FT):number {
    let rtn=0,secnum=-1;
    while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){let sec=m.sectors[secnum];if(sec.specialdata)continue;
        rtn=1;const floor=createFloor(sec);floor.type=type;floor.speed=FLOORSPEED;
        switch(type){
            case FT.lowerFloor:floor.direction=-1;floor.floordestheight=P_FindHighestFloorSurrounding(sec);break;
            case FT.lowerFloorToLowest:floor.direction=-1;floor.floordestheight=P_FindLowestFloorSurrounding(sec);break;
            case FT.turboLower:floor.direction=-1;floor.speed*=4;floor.floordestheight=P_FindHighestFloorSurrounding(sec);if(floor.floordestheight!==sec.floorheight)floor.floordestheight=(floor.floordestheight+8*F)|0;break;
            case FT.raiseFloorCrush:floor.crush=true;
            case FT.raiseFloor:floor.direction=1;floor.floordestheight=(Math.min(P_FindLowestCeilingSurrounding(sec),sec.ceilingheight)-(type===FT.raiseFloorCrush?8*F:0))|0;break;
            case FT.raiseFloorTurbo:floor.speed*=4;
            case FT.raiseFloorToNearest:floor.direction=1;floor.floordestheight=P_FindNextHighestFloor(sec,sec.floorheight);break;
            case FT.raiseFloor24:case FT.raiseFloor512:case FT.raiseFloor24AndChange:
                floor.direction=1;floor.floordestheight=(sec.floorheight+(type===FT.raiseFloor512?512:24)*F)|0;
                if(type===FT.raiseFloor24AndChange){const front=(line as line_t).frontsector;if(!front)throw new Error('Floor texture change needs a front sector');sec.floorpic=front.floorpic;sec.special=front.special;}break;
            case FT.raiseToTexture:{floor.direction=1;let minsize=0x7fffffff;
                for(let i=0;i<sec.linecount;i++)if(twoSided(secnum,i))for(const side of [0,1]){const texture=getSide(secnum,i,side).bottomtexture;if(texture>=0)minsize=Math.min(minsize,texturestate.textureheight[texture]);}
                floor.floordestheight=(sec.floorheight+minsize)|0;break;}
            case FT.lowerAndChange:floor.direction=-1;floor.floordestheight=P_FindLowestFloorSurrounding(sec);floor.texture=sec.floorpic;
                for(let i=0;i<sec.linecount;i++)if(twoSided(secnum,i)){sec=getSide(secnum,i,0).sector===m.sectors[secnum]?getSector(secnum,i,1):getSector(secnum,i,0);
                    if(sec.floorheight===floor.floordestheight){floor.texture=sec.floorpic;floor.newspecial=sec.special;break;}}
                break;
        }
    }return rtn;
}
export function EV_BuildStairs(line:Pick<line_t,'tag'>,type:stair_e):number {
    let rtn=0,secnum=-1;
    while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){let sec=m.sectors[secnum];if(sec.specialdata)continue;rtn=1;
        const speed=type===stair_e.build8?FLOORSPEED/4:FLOORSPEED*4,stairsize=type===stair_e.build8?8*F:16*F;
        let floor=createFloor(sec);floor.direction=1;floor.speed=speed;let height=(sec.floorheight+stairsize)|0;floor.floordestheight=height;const texture=sec.floorpic;
        for(;;){let found=false;for(const edge of sec.lines){if(!(edge.flags&ML_TWOSIDED)||edge.frontsector!==m.sectors[secnum])continue;
                const next=edge.backsector!;if(next.floorpic!==texture)continue;height=(height+stairsize)|0;if(next.specialdata)continue;
                sec=next;secnum=m.sectors.indexOf(sec);floor=createFloor(sec);floor.direction=1;floor.speed=speed;floor.floordestheight=height;found=true;break;}
            if(!found)break;}
    }return rtn;
}
