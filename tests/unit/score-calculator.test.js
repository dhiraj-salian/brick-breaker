import { describe, it, expect } from 'vitest';

// TDD red phase — this test must FAIL until score-calculator.js is implemented.
describe('score-calculator', () => {
  async function getCalculateScore() {
    const { calculateScore } = await import('../../src/core/score-calculator.js');
    return calculateScore;
  }

  it('base score, no combo, no bonuses → returns base', async () => {
    const calculateScore = await getCalculateScore();
    expect(calculateScore({ base: 100, combo: 1, bonuses: 0 })).toBe(100);
  });

  it('combo multiplier x2 → doubles base', async () => {
    const calculateScore = await getCalculateScore();
    expect(calculateScore({ base: 100, combo: 2, bonuses: 0 })).toBe(200);
  });

  it('combo multiplier x3 → triples base', async () => {
    const calculateScore = await getCalculateScore();
    expect(calculateScore({ base: 100, combo: 3, bonuses: 0 })).toBe(300);
  });

  it('bonuses add to total', async () => {
    const calculateScore = await getCalculateScore();
    expect(calculateScore({ base: 100, combo: 1, bonuses: 50 })).toBe(150);
  });

  it('combo + bonuses stack', async () => {
    const calculateScore = await getCalculateScore();
    // (100 * 2) + 50 = 250
    expect(calculateScore({ base: 100, combo: 2, bonuses: 50 })).toBe(250);
  });

  it('combo clamps to max 8', async () => {
    const calculateScore = await getCalculateScore();
    expect(calculateScore({ base: 100, combo: 100, bonuses: 0 })).toBe(800);
  });
});
