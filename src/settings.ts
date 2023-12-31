const RES = { width: 1600, heigth: 900 }
const HALF_WIDTH = Math.floor(RES.width / 2)
const HALF_HEIGHT = Math.floor(RES.heigth / 2)
const FPS = 120

const PLAYER_POS = { x: 1.5, y: 5 }
const PLAYER_ANGLE = 0
const PLAYER_SPEED = 0.004
const PLAYER_ROT_SPEED = 0.0007
const PLAYER_SIZE_SCALE = 60

const MOUSE_SENSIBILITY = 0.00008
const MOUSE_MAX_REL = 40
const MOUSE_BORDER_LEFT = 100
const MOUSE_BORDER_RIGHT = RES.width - MOUSE_BORDER_LEFT

const FOV = Math.PI / 3
const HALF_FOV = FOV / 2
const NUM_RAYS = Math.floor(RES.width / 8)
const HALF_NUM_RAYS = Math.floor(NUM_RAYS / 2)
const DELTA_ANGLE = FOV / NUM_RAYS
const MAX_DEPTH = 20

const SCREEN_DIST = HALF_WIDTH / Math.tan(HALF_FOV)
const SCALE = Math.floor(RES.width / NUM_RAYS)

const TEXTURE_SIZE = 256
const HALF_TEXTURE_SIZE = Math.floor(TEXTURE_SIZE / 2)

export {
  RES,
  FPS,
  PLAYER_POS,
  PLAYER_ANGLE,
  PLAYER_SPEED,
  PLAYER_ROT_SPEED,
  FOV,
  HALF_FOV,
  NUM_RAYS,
  HALF_NUM_RAYS,
  DELTA_ANGLE,
  MAX_DEPTH,
  SCREEN_DIST,
  SCALE,
  HALF_WIDTH,
  HALF_HEIGHT,
  TEXTURE_SIZE,
  HALF_TEXTURE_SIZE,
  PLAYER_SIZE_SCALE,
  MOUSE_SENSIBILITY,
  MOUSE_MAX_REL,
  MOUSE_BORDER_LEFT,
  MOUSE_BORDER_RIGHT

}
