// To'siq (Quoridor) o'yin mexanikasi — server va brauzer uchun umumiy
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const N = 9;
  const WALLS = 10;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function newState() {
    return { pawns: [{ r: 8, c: 4 }, { r: 0, c: 4 }], walls: [], wallsLeft: [WALLS, WALLS], turn: 0, winner: null, moves: 0 };
  }
  function clone(s) {
    return { pawns: s.pawns.map((p) => ({ r: p.r, c: p.c })), walls: s.walls.slice(), wallsLeft: s.wallsLeft.slice(), turn: s.turn, winner: s.winner, moves: s.moves };
  }
  const goalRow = (p) => (p === 0 ? 0 : N - 1);
  const ek = (r1, c1, r2, c2) => { const a = r1 * N + c1, b = r2 * N + c2; return a < b ? a * 128 + b : b * 128 + a; };

  function buildBlock(walls) {
    const s = new Set();
    for (const w of walls) {
      if (w.o === 'h') { s.add(ek(w.r, w.c, w.r + 1, w.c)); s.add(ek(w.r, w.c + 1, w.r + 1, w.c + 1)); }
      else { s.add(ek(w.r, w.c, w.r, w.c + 1)); s.add(ek(w.r + 1, w.c, w.r + 1, w.c + 1)); }
    }
    return s;
  }
  function canStep(block, r, c, dr, dc) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return false;
    return !block.has(ek(r, c, nr, nc));
  }

  // Eng qisqa yo'l uzunligi (BFS); path=true bo'lsa yo'lni ham qaytaradi
  function dist(block, r, c, goal, withPath) {
    const seen = new Int16Array(N * N).fill(-1);
    const q = [r * N + c];
    seen[r * N + c] = r * N + c;
    let head = 0;
    const d = new Int16Array(N * N);
    while (head < q.length) {
      const cur = q[head++];
      const cr = (cur / N) | 0, cc = cur % N;
      if (cr === goal) {
        if (!withPath) return d[cur];
        const path = [];
        let x = cur;
        while (x !== r * N + c) { path.push(x); x = seen[x]; }
        path.push(r * N + c);
        return { d: d[cur], path: path.reverse().map((v) => ({ r: (v / N) | 0, c: v % N })) };
      }
      for (const [dr, dc] of DIRS) {
        if (!canStep(block, cr, cc, dr, dc)) continue;
        const nx = (cr + dr) * N + cc + dc;
        if (seen[nx] !== -1) continue;
        seen[nx] = cur; d[nx] = d[cur] + 1; q.push(nx);
      }
    }
    return withPath ? { d: Infinity, path: [] } : Infinity;
  }

  function pawnMoves(st, p, block) {
    block = block || buildBlock(st.walls);
    const me = st.pawns[p], op = st.pawns[1 - p];
    const res = [];
    for (const [dr, dc] of DIRS) {
      if (!canStep(block, me.r, me.c, dr, dc)) continue;
      const nr = me.r + dr, nc = me.c + dc;
      if (nr === op.r && nc === op.c) {
        if (canStep(block, nr, nc, dr, dc)) res.push({ r: nr + dr, c: nc + dc, jump: true });
        else {
          const sides = dr !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
          for (const [sr, sc] of sides) if (canStep(block, nr, nc, sr, sc)) res.push({ r: nr + sr, c: nc + sc, jump: true });
        }
      } else res.push({ r: nr, c: nc });
    }
    return res;
  }

  function wallConflicts(walls, w) {
    for (const x of walls) {
      if (x.r === w.r && x.c === w.c) return true;
      if (x.o === w.o) {
        if (w.o === 'h' && x.r === w.r && Math.abs(x.c - w.c) === 1) return true;
        if (w.o === 'v' && x.c === w.c && Math.abs(x.r - w.r) === 1) return true;
      }
    }
    return false;
  }
  function wallInRange(w) { return w && (w.o === 'h' || w.o === 'v') && w.r >= 0 && w.r < N - 1 && w.c >= 0 && w.c < N - 1; }

  function canPlaceWall(st, p, w) {
    if (st.winner !== null || st.wallsLeft[p] <= 0) return false;
    if (!wallInRange(w) || wallConflicts(st.walls, w)) return false;
    const block = buildBlock(st.walls.concat([w]));
    return dist(block, st.pawns[0].r, st.pawns[0].c, goalRow(0)) < Infinity &&
      dist(block, st.pawns[1].r, st.pawns[1].c, goalRow(1)) < Infinity;
  }

  // mv: {t:'m', r, c} yoki {t:'w', r, c, o}
  function isLegal(st, p, mv) {
    if (st.winner !== null || st.turn !== p || !mv) return false;
    if (mv.t === 'm') return pawnMoves(st, p).some((m) => m.r === mv.r && m.c === mv.c);
    if (mv.t === 'w') return canPlaceWall(st, p, { r: mv.r, c: mv.c, o: mv.o });
    return false;
  }

  function apply(st, p, mv) {
    const s = clone(st);
    if (mv.t === 'm') {
      s.pawns[p] = { r: mv.r, c: mv.c };
      if (mv.r === goalRow(p)) s.winner = p;
    } else {
      s.walls.push({ r: mv.r, c: mv.c, o: mv.o, p });
      s.wallsLeft[p]--;
    }
    s.turn = 1 - p;
    s.moves++;
    return s;
  }

  function distances(st) {
    const block = buildBlock(st.walls);
    return [dist(block, st.pawns[0].r, st.pawns[0].c, 0), dist(block, st.pawns[1].r, st.pawns[1].c, N - 1)];
  }

  return { N, WALLS, newState, clone, goalRow, buildBlock, canStep, dist, pawnMoves, wallConflicts, canPlaceWall, isLegal, apply, distances };
});
