/**
 * Default player-name generator.
 *
 * Used to auto-submit scores on WIN/LOST so players don't lose their
 * score by forgetting to type a name (or closing the tab mid-win).
 *
 * The result is:
 *   - always non-empty
 *   - ≤ 20 chars (leaderboard column constraint)
 *   - safe characters only (alphanumeric + space + `-` + `_`)
 *   - reasonably varied (10k+ combinations)
 *
 * Format: `<adjective>-<animal>-<4-digit>` where the four-digit suffix
 * disambiguates collisions on the same animal pair.
 *
 *   Examples:
 *     "Swift-Falcon-0429"
 *     "Brave-Otter-9182"
 *     "Clever-Panda-3331"
 */

const ADJECTIVES = [
  'Swift',
  'Brave',
  'Clever',
  'Lucky',
  'Bold',
  'Mighty',
  'Quick',
  'Calm',
  'Wise',
  'Nimble',
  'Bright',
  'Sharp',
  'Eager',
  'Fierce',
  'Gentle',
  'Royal',
  'Stark',
  'Sunny',
  'Stormy',
  'Shadow',
];

const ANIMALS = [
  'Otter',
  'Falcon',
  'Panda',
  'Tiger',
  'Wolf',
  'Eagle',
  'Hawk',
  'Fox',
  'Bear',
  'Lynx',
  'Raven',
  'Shark',
  'Lion',
  'Viper',
  'Heron',
  'Crane',
  'Bison',
  'Moose',
  'Whale',
  'Phoenix',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a generated player name. Pure modulo side-effects (uses Math.random).
 * @returns {string}
 */
export function generateDefaultName() {
  const adjective = pickRandom(ADJECTIVES);
  const animal = pickRandom(ANIMALS);
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  const name = `${adjective}-${animal}-${suffix}`;
  // Length sanity cap (defensive — all components are bounded).
  return name.length > 20 ? name.slice(0, 20) : name;
}
