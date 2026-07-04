import { describe, it, expect } from 'vitest';
import { parseLayout, countBreakable, allBricksBroken } from '../../src/core/brick-grid.js';
import { BRICK_TYPE } from '../../src/core/constants.js';

describe('brick-grid', () => {
  it('parseLayout creates bricks from layout rows', () => {
    const bricks = parseLayout(['RRRR', 'BBBB']);
    expect(bricks.length).toBe(8);
  });

  it('parseLayout respects brick type mapping', () => {
    const bricks = parseLayout(['R', 'B', 'U']);
    expect(bricks[0].type).toBe(BRICK_TYPE.NORMAL);
    expect(bricks[1].type).toBe(BRICK_TYPE.ARMORED);
    expect(bricks[2].type).toBe(BRICK_TYPE.UNBREAKABLE);
  });

  it('parseLayout skips dots and spaces', () => {
    // 'R.R' = 3 cols, 2 bricks (positions 0, 2).
    // '   ' = 3 cols, 0 bricks.
    // 'B.B' = 3 cols, 2 bricks.
    // Total = 4.
    const bricks = parseLayout(['R.R', '   ', 'B.B']);
    expect(bricks.length).toBe(4);
  });

  it('parseLayout assigns positions symmetrically around x=0', () => {
    const bricks = parseLayout(['RR']);
    const xs = bricks.map((b) => b.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[xs.length - 1]).toBeGreaterThan(0);
    // Symmetric: distance from 0 should match
    expect(Math.abs(xs[0])).toBeCloseTo(xs[xs.length - 1], 5);
  });

  it('ARMORED bricks have hp > 1', () => {
    const bricks = parseLayout(['B']);
    expect(bricks[0].hp).toBeGreaterThan(1);
  });

  it('UNBREAKABLE bricks have Infinity hp', () => {
    const bricks = parseLayout(['U']);
    expect(bricks[0].hp).toBe(Infinity);
  });

  it('countBreakable excludes UNBREAKABLE', () => {
    const bricks = parseLayout(['RR', 'UU']);
    expect(countBreakable(bricks)).toBe(2);
  });

  it('countBreakable excludes broken bricks', () => {
    const bricks = parseLayout(['RR']);
    bricks[0].broken = true;
    expect(countBreakable(bricks)).toBe(1);
  });

  it('allBricksBroken returns true when only UNBREAKABLE remain', () => {
    const bricks = parseLayout(['R', 'U']);
    bricks[0].broken = true;
    expect(allBricksBroken(bricks)).toBe(true);
  });

  it('allBricksBroken returns false when breakable remain', () => {
    const bricks = parseLayout(['RR', 'UU']);
    expect(allBricksBroken(bricks)).toBe(false);
  });
});
