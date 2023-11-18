const RES = { width: 1600, heigth: 900}
const HALF_WIDTH = Math.floor( RES.width/2)
const HALF_HEIGHT = Math.floor(RES.heigth/2)
const FPS = 60

const PLAYER_POS = {x: 1.5, y: 5}
const PLAYER_ANGLE = 0
const PLAYER_SPEED = 0.004
const PLAYER_ROT_SPEED = 0.002

const FOV = Math.PI/3
const HALF_FOV = FOV/2
const NUM_RAYS = Math.floor(RES.width / 3)
const HALF_NUM_RAYS = Math.floor(NUM_RAYS/2)
const DELTA_ANGLE = FOV/NUM_RAYS
const MAX_DEPTH = 20


export { RES, FPS, PLAYER_POS, PLAYER_ANGLE, PLAYER_SPEED, PLAYER_ROT_SPEED, FOV, HALF_FOV, NUM_RAYS, HALF_NUM_RAYS, DELTA_ANGLE, MAX_DEPTH, HALF_HEIGHT }