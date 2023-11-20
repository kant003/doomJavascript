import type p5 from 'p5'

const _ = null

const miniMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, _, _, 3, 3, 3, 3, _, _, _, 2, 2, 2, _, _, 1],
  [1, _, _, _, _, _, 4, _, _, _, _, _, 2, _, _, 1],
  [1, _, _, _, _, _, 4, _, _, _, _, _, 2, _, _, 1],
  [1, _, _, 3, 3, 3, 3, _, _, _, _, _, _, _, _, 1],
  [1, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, _, _, _, 4, _, _, _, 4, _, _, _, _, _, _, 1],
  [1, 1, 1, 3, 1, 3, 1, 1, 1, 3, _, _, 3, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, _, _, 3, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, _, _, 3, 1, 1, 1],
  [1, 1, 3, 1, 1, 1, 1, 1, 1, 3, _, _, 3, 1, 1, 1],
  [1, 4, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, _, _, 2, _, _, _, _, _, 3, 4, _, 4, 3, _, 1],
  [1, _, _, 5, _, _, _, _, _, _, 3, _, 3, _, _, 1],
  [1, _, _, 2, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 1],
  [1, 4, _, _, _, _, _, _, 4, _, _, 4, _, _, _, 1],
  [1, 1, 3, 3, _, _, 3, 3, 1, 3, 3, 1, 3, 1, 1, 1],
  [1, 1, 1, 3, _, _, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 3, 3, 4, _, _, 4, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, _, _, 5, _, _, _, 5, _, _, _, 5, _, _, _, 3],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 3],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
]

const scale = 100
class Mapa {
  worldMap: Array<Array<number | null>>
  ctx: p5.p5InstanceExtensions
  constructor (ctx: p5.p5InstanceExtensions) {
    this.worldMap = []
    this.ctx = ctx
    this.getMap()
  }

  getMap (): void {
    for (let i = 0; i < miniMap.length; i++) {
      this.worldMap[i] = []
      for (let j = 0; j < miniMap[0].length; j++) {
        this.worldMap[i][j] = null
      }
    }

    miniMap.forEach((col, i) => {
      col.forEach((row, j: number) => {
        if (row !== 0 && row !== null) {
          this.worldMap[i][j] = row
          // sthis.worldMap["d"] = col
        }
      })
    })
    // console.log(this.worldMap)

    // console.log(this.worldMap)
  }

  getValue (x: number, y: number): number | null {
    if (x < 0 || x >= this.worldMap[0].length || y < 0 || y >= this.worldMap.length) {
      return null
    }
    return this.worldMap[y][x]
  }

  drawMap (): void {
    this.worldMap.forEach((row, i) => {
      row.forEach((col, j) => {
        if (col !== null) {
          this.ctx.fill(45, 80)
          /* if(col == 1){ this.ctx.fill(255,0,0)}
                    if(col == 2){ this.ctx.fill(0,255,0)}
                    if(col == 3){ this.ctx.fill(0,0,255)}
                    if(col == 4){ this.ctx.fill(255,255,0)} */

          this.ctx.rect(j * scale, i * scale, scale, scale)
        }
      })
    })
  }
}

export default Mapa
