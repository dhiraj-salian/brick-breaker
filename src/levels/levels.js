/**
 * Level definitions — exported as objects so we can include score/ball speed per level.
 */

export const LEVELS = [
  {
    name: 'Level 1',
    ballSpeed: 12,
    layout: ['RRRRRRRRRR', 'YYYYYYYYYY', 'GGGGGGGGGG', '..........', '..........'],
  },
  {
    name: 'Level 2',
    ballSpeed: 13,
    layout: ['BBBBBBBBBB', 'BBBBBBBBBB', 'RRRRRRRRRR', 'YYYYYYYYYY', 'GGGGGGGGGG'],
  },
  {
    name: 'Level 3',
    ballSpeed: 14,
    layout: ['U...RR...U', '.BB....BB.', '..RRRRRR..', '.BB....BB.', 'U...PP...U'],
  },
];
