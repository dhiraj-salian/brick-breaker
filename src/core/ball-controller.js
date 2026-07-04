/**
 * Ball controller — pure functions for multi-ball, paddle re-attach.
 */

export function splitBall(ball, count = 2) {
  // Returns N balls spawned from the given ball, fanned out.
  const out = [ball];
  for (let i = 0; i < count; i++) {
    const angleDeg = -90 + (i + 1) * (60 / (count + 1)); // symmetric fan upward
    const rad = (angleDeg * Math.PI) / 180;
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    out.push({
      ...ball,
      vx: Math.cos(rad) * speed,
      vy: Math.abs(Math.sin(rad)) * speed,
    });
  }
  return out;
}

export function reattachLostBalls(state) {
  if (state.balls.length > 0) return state;
  return {
    ...state,
    balls: [
      {
        x: state.paddle.x,
        y: state.paddle.y + 0.4 / 2 + 0.3 + 0.2,
        vx: 0,
        vy: 0,
        r: 0.3,
        attached: true,
      },
    ],
  };
}
