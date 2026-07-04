import { WORLD, LEVEL_LAYOUT_KEYS, BRICK_TYPE } from './constants.js';

/**
 * Parse a level layout (array of single-character rows) into brick objects.
 *
 * Layout string example:
 *   [
 *     "RRRRRRRRRR",
 *     "BB..BB..BB",
 *     "UU....UUUU",
 *   ]
 *
 * Characters map to LEVEL_LAYOUT_KEYS. '.' or ' ' = empty cell.
 * Grid is centered horizontally; brick y is computed top-down.
 *
 * @param {string[]} rows
 * @returns {Array<{
 *   x:number, y:number, w:number, h:number,
 *   type:string, color:number, points:number, hp:number, broken:boolean
 * }>}
 */
export function parseLayout(rows) {
  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((r) => r.length));
  const cellW = WORLD.BRICK_WIDTH + WORLD.BRICK_GAP;
  const cellH = WORLD.BRICK_HEIGHT + WORLD.BRICK_GAP;
  const totalW = colCount * cellW;
  const bricks = [];

  for (let r = 0; r < rowCount; r++) {
    const row = rows[r].padEnd(colCount, '.');
    for (let c = 0; c < colCount; c++) {
      const ch = row[c];
      if (!ch || ch === '.' || ch === ' ') continue;
      const spec = LEVEL_LAYOUT_KEYS[ch];
      if (!spec) continue;

      const x = -totalW / 2 + cellW / 2 + c * cellW;
      // y: top row at BRICK_TOP_Y, subsequent rows below it
      const y = WORLD.BRICK_TOP_Y - r * cellH;

      bricks.push({
        x,
        y,
        w: WORLD.BRICK_WIDTH,
        h: WORLD.BRICK_HEIGHT,
        type: spec.type,
        color: spec.color,
        points: spec.points,
        hp: spec.hp,
        maxHp: spec.hp,
        broken: false,
        row: r,
        col: c,
      });
    }
  }
  return bricks;
}

export function countBreakable(bricks) {
  return bricks.filter((b) => !b.broken && b.type !== BRICK_TYPE.UNBREAKABLE).length;
}

export function allBricksBroken(bricks) {
  return countBreakable(bricks) === 0;
}
