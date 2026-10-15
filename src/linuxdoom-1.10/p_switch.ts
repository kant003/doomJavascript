// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import type { line_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
import { GameMode_t } from './doomdef.h';
import { ML_SECRET } from './doomdata.h';
import { mapstate as m } from './r_state.h';
import { R_TextureNumForName } from './r_data';
import { P_SectorSound,P_SpecialsGame,EV_DoDonut } from './p_spec';
import { EV_DoDoor,EV_DoLockedDoor,EV_VerticalDoor } from './p_doors';
import { EV_DoFloor,EV_BuildStairs } from './p_floor';
import { EV_DoCeiling } from './p_ceilng';
import { EV_DoPlat } from './p_plats';
import { EV_LightTurnOn } from './p_lights';
import { sfxenum_t as SFX } from './sounds.h';
import { MAXSWITCHES,MAXBUTTONS,BUTTONTIME,bwhere_e as BW,vldoor_e as DT,floor_e as FT,ceiling_e as CT,plattype_e as PT,stair_e as ST,type button_t,type switchlist_t } from './p_spec.h';
export const alphSwitchList:switchlist_t[] = [
    {"name1": "SW1BRCOM", "name2": "SW2BRCOM", "episode": 1},
    {"name1": "SW1BRN1", "name2": "SW2BRN1", "episode": 1},
    {"name1": "SW1BRN2", "name2": "SW2BRN2", "episode": 1},
    {"name1": "SW1BRNGN", "name2": "SW2BRNGN", "episode": 1},
    {"name1": "SW1BROWN", "name2": "SW2BROWN", "episode": 1},
    {"name1": "SW1COMM", "name2": "SW2COMM", "episode": 1},
    {"name1": "SW1COMP", "name2": "SW2COMP", "episode": 1},
    {"name1": "SW1DIRT", "name2": "SW2DIRT", "episode": 1},
    {"name1": "SW1EXIT", "name2": "SW2EXIT", "episode": 1},
    {"name1": "SW1GRAY", "name2": "SW2GRAY", "episode": 1},
    {"name1": "SW1GRAY1", "name2": "SW2GRAY1", "episode": 1},
    {"name1": "SW1METAL", "name2": "SW2METAL", "episode": 1},
    {"name1": "SW1PIPE", "name2": "SW2PIPE", "episode": 1},
    {"name1": "SW1SLAD", "name2": "SW2SLAD", "episode": 1},
    {"name1": "SW1STARG", "name2": "SW2STARG", "episode": 1},
    {"name1": "SW1STON1", "name2": "SW2STON1", "episode": 1},
    {"name1": "SW1STON2", "name2": "SW2STON2", "episode": 1},
    {"name1": "SW1STONE", "name2": "SW2STONE", "episode": 1},
    {"name1": "SW1STRTN", "name2": "SW2STRTN", "episode": 1},
    {"name1": "SW1BLUE", "name2": "SW2BLUE", "episode": 2},
    {"name1": "SW1CMT", "name2": "SW2CMT", "episode": 2},
    {"name1": "SW1GARG", "name2": "SW2GARG", "episode": 2},
    {"name1": "SW1GSTON", "name2": "SW2GSTON", "episode": 2},
    {"name1": "SW1HOT", "name2": "SW2HOT", "episode": 2},
    {"name1": "SW1LION", "name2": "SW2LION", "episode": 2},
    {"name1": "SW1SATYR", "name2": "SW2SATYR", "episode": 2},
    {"name1": "SW1SKIN", "name2": "SW2SKIN", "episode": 2},
    {"name1": "SW1VINE", "name2": "SW2VINE", "episode": 2},
    {"name1": "SW1WOOD", "name2": "SW2WOOD", "episode": 2},
    {"name1": "SW1PANEL", "name2": "SW2PANEL", "episode": 3},
    {"name1": "SW1ROCK", "name2": "SW2ROCK", "episode": 3},
    {"name1": "SW1MET2", "name2": "SW2MET2", "episode": 3},
    {"name1": "SW1WDMET", "name2": "SW2WDMET", "episode": 3},
    {"name1": "SW1BRIK", "name2": "SW2BRIK", "episode": 3},
    {"name1": "SW1MOD1", "name2": "SW2MOD1", "episode": 3},
    {"name1": "SW1ZIM", "name2": "SW2ZIM", "episode": 3},
    {"name1": "SW1STON6", "name2": "SW2STON6", "episode": 3},
    {"name1": "SW1TEK", "name2": "SW2TEK", "episode": 3},
    {"name1": "SW1MARB", "name2": "SW2MARB", "episode": 3},
    {"name1": "SW1SKULL", "name2": "SW2SKULL", "episode": 3},
    {name1:"\0",name2:"\0",episode:0}
];
export const switchlist=new Int32Array(MAXSWITCHES*2);
export let numswitches=0;
export const buttonlist:button_t[]=Array.from({length:MAXBUTTONS},()=>({line:null,where:BW.top,btexture:0,btimer:0,soundorg:null}));
export function P_InitSwitchList():void {
    const mode=P_SpecialsGame().gamemode;
    const episode=mode===GameMode_t.registered?2:mode===GameMode_t.commercial?3:1;
    let index=0;
    for(const pair of alphSwitchList){
        if(!pair.episode){numswitches=index/2;switchlist[index]=-1;break;}
        if(pair.episode<=episode){switchlist[index++]=R_TextureNumForName(pair.name1);switchlist[index++]=R_TextureNumForName(pair.name2);}
    }
}
export function P_StartButton(line:line_t,where:BW,texture:number,time:number):void {
    if(buttonlist.some(b=>b.btimer&&b.line===line))return;
    const b=buttonlist.find(b=>!b.btimer);
    if(!b)throw new Error('P_StartButton: no button slots left!');
    Object.assign(b,{line,where,btexture:texture,btimer:time,soundorg:line.frontsector!.soundorg});
}
export function P_ChangeSwitchTexture(line:line_t,useAgain:number):void {
    if(!useAgain)line.special=0;
    const side=m.sides[line.sidenum[0]],sound=line.special===11?SFX.sfx_swtchx:SFX.sfx_swtchn;
    const fields=['toptexture','midtexture','bottomtexture'] as const;
    for(let i=0;i<numswitches*2;i++)for(let where=0;where<fields.length;where++){
        const field=fields[where];
        if(switchlist[i]!==side[field])continue;
        // Preserve the original use of buttonlist[0].soundorg, including NULL.
        P_SectorSound(buttonlist[0].soundorg,sound);side[field]=switchlist[i^1];
        if(useAgain)P_StartButton(line,where,switchlist[i],BUTTONTIME);
        return;
    }
}
export function P_UseSpecialLine(thing:mobj_t,line:line_t,side:number):boolean {


    // Err...
    // Use the back sides of VERY SPECIAL lines...
    if (side)
    {
	switch(line.special)
	{
	  case 124:
	    // Sliding door open&close
	    // UNUSED?
	    break;

	  default:
	    return false;
	    break;
	}
    }


    // Switches that other things can activate.
    if (!thing.player)
    {
	// never open secret doors
	if (line.flags & ML_SECRET)
	    return false;

	switch(line.special)
	{
	  case 1: 	// MANUAL DOOR RAISE
	  case 32:	// MANUAL BLUE
	  case 33:	// MANUAL RED
	  case 34:	// MANUAL YELLOW
	    break;

	  default:
	    return false;
	    break;
	}
    }


    // do something
    switch (line.special)
    {
	// MANUALS
      case 1:		// Vertical Door
      case 26:		// Blue Door/Locked
      case 27:		// Yellow Door /Locked
      case 28:		// Red Door /Locked

      case 31:		// Manual door open
      case 32:		// Blue locked door open
      case 33:		// Red locked door open
      case 34:		// Yellow locked door open

      case 117:		// Blazing door raise
      case 118:		// Blazing door open
	EV_VerticalDoor (line, thing);
	break;

	//UNUSED - Door Slide Open&Close
	// case 124:
	// EV_SlidingDoor (line, thing);
	// break;

	// SWITCHES
      case 7:
	// Build Stairs
	if (EV_BuildStairs(line,ST.build8))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 9:
	// Change Donut
	if (EV_DoDonut(line))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 11:
	// Exit level
	P_ChangeSwitchTexture(line,0);
	P_SpecialsGame().G_ExitLevel();
	break;

      case 14:
	// Raise Floor 32 and change texture
	if (EV_DoPlat(line,PT.raiseAndChange,32))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 15:
	// Raise Floor 24 and change texture
	if (EV_DoPlat(line,PT.raiseAndChange,24))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 18:
	// Raise Floor to next highest floor
	if (EV_DoFloor(line, FT.raiseFloorToNearest))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 20:
	// Raise Plat next highest floor and change texture
	if (EV_DoPlat(line,PT.raiseToNearestAndChange,0))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 21:
	// PlatDownWaitUpStay
	if (EV_DoPlat(line,PT.downWaitUpStay,0))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 23:
	// Lower Floor to Lowest
	if (EV_DoFloor(line,FT.lowerFloorToLowest))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 29:
	// Raise Door
	if (EV_DoDoor(line,DT.normal))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 41:
	// Lower Ceiling to Floor
	if (EV_DoCeiling(line,CT.lowerToFloor))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 71:
	// Turbo Lower Floor
	if (EV_DoFloor(line,FT.turboLower))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 49:
	// Ceiling Crush And Raise
	if (EV_DoCeiling(line,CT.crushAndRaise))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 50:
	// Close Door
	if (EV_DoDoor(line,DT.close))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 51:
	// Secret EXIT
	P_ChangeSwitchTexture(line,0);
	P_SpecialsGame().G_SecretExitLevel();
	break;

      case 55:
	// Raise Floor Crush
	if (EV_DoFloor(line,FT.raiseFloorCrush))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 101:
	// Raise Floor
	if (EV_DoFloor(line,FT.raiseFloor))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 102:
	// Lower Floor to Surrounding floor height
	if (EV_DoFloor(line,FT.lowerFloor))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 103:
	// Open Door
	if (EV_DoDoor(line,DT.open))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 111:
	// Blazing Door Raise (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeRaise))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 112:
	// Blazing Door Open (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeOpen))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 113:
	// Blazing Door Close (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeClose))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 122:
	// Blazing PlatDownWaitUpStay
	if (EV_DoPlat(line,PT.blazeDWUS,0))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 127:
	// Build Stairs Turbo 16
	if (EV_BuildStairs(line,ST.turbo16))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 131:
	// Raise Floor Turbo
	if (EV_DoFloor(line,FT.raiseFloorTurbo))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 133:
	// BlzOpenDoor BLUE
      case 135:
	// BlzOpenDoor RED
      case 137:
	// BlzOpenDoor YELLOW
	if (EV_DoLockedDoor (line,DT.blazeOpen,thing))
	    P_ChangeSwitchTexture(line,0);
	break;

      case 140:
	// Raise Floor 512
	if (EV_DoFloor(line,FT.raiseFloor512))
	    P_ChangeSwitchTexture(line,0);
	break;

	// BUTTONS
      case 42:
	// Close Door
	if (EV_DoDoor(line,DT.close))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 43:
	// Lower Ceiling to Floor
	if (EV_DoCeiling(line,CT.lowerToFloor))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 45:
	// Lower Floor to Surrounding floor height
	if (EV_DoFloor(line,FT.lowerFloor))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 60:
	// Lower Floor to Lowest
	if (EV_DoFloor(line,FT.lowerFloorToLowest))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 61:
	// Open Door
	if (EV_DoDoor(line,DT.open))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 62:
	// PlatDownWaitUpStay
	if (EV_DoPlat(line,PT.downWaitUpStay,1))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 63:
	// Raise Door
	if (EV_DoDoor(line,DT.normal))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 64:
	// Raise Floor to ceiling
	if (EV_DoFloor(line,FT.raiseFloor))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 66:
	// Raise Floor 24 and change texture
	if (EV_DoPlat(line,PT.raiseAndChange,24))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 67:
	// Raise Floor 32 and change texture
	if (EV_DoPlat(line,PT.raiseAndChange,32))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 65:
	// Raise Floor Crush
	if (EV_DoFloor(line,FT.raiseFloorCrush))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 68:
	// Raise Plat to next highest floor and change texture
	if (EV_DoPlat(line,PT.raiseToNearestAndChange,0))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 69:
	// Raise Floor to next highest floor
	if (EV_DoFloor(line, FT.raiseFloorToNearest))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 70:
	// Turbo Lower Floor
	if (EV_DoFloor(line,FT.turboLower))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 114:
	// Blazing Door Raise (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeRaise))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 115:
	// Blazing Door Open (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeOpen))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 116:
	// Blazing Door Close (faster than TURBO!)
	if (EV_DoDoor (line,DT.blazeClose))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 123:
	// Blazing PlatDownWaitUpStay
	if (EV_DoPlat(line,PT.blazeDWUS,0))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 132:
	// Raise Floor Turbo
	if (EV_DoFloor(line,FT.raiseFloorTurbo))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 99:
	// BlzOpenDoor BLUE
      case 134:
	// BlzOpenDoor RED
      case 136:
	// BlzOpenDoor YELLOW
	if (EV_DoLockedDoor (line,DT.blazeOpen,thing))
	    P_ChangeSwitchTexture(line,1);
	break;

      case 138:
	// Light Turn On
	EV_LightTurnOn(line,255);
	P_ChangeSwitchTexture(line,1);
	break;

      case 139:
	// Light Turn Off
	EV_LightTurnOn(line,35);
	P_ChangeSwitchTexture(line,1);
	break;

    }

    return true;
}
