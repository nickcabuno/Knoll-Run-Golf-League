/* Shared data layer for Knoll Run Golf League
 * Uses localStorage. Admins can export/import JSON to share data across devices.
 */
(function (global) {
  const STORAGE_KEY = 'knollRunGolfData_v1';
  const AUTH_KEY = 'knollRunGolfAuth_v1';

  // Default passcode — change it from the Settings tab after first login.
  const DEFAULT_PASSCODE = 'knollrun2026';

  function emptyData() {
    return {
      version: 1,
      league: { name: 'Knoll Run Golf League', season: new Date().getFullYear() },
      players: [],
      rounds: [],
      matchups: [],
      settings: { pwHash: null } // null means use default
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      return Object.assign(emptyData(), parsed);
    } catch (e) {
      console.warn('Failed to load league data', e);
      return emptyData();
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function verifyPasscode(input) {
    const data = load();
    if (!data.settings.pwHash) {
      // No custom passcode set — compare against default plaintext.
      return input === DEFAULT_PASSCODE;
    }
    const hash = await sha256(input);
    return hash === data.settings.pwHash;
  }

  async function setPasscode(newCode) {
    const data = load();
    data.settings.pwHash = await sha256(newCode);
    save(data);
  }

  function isAuthed() {
    try {
      const v = sessionStorage.getItem(AUTH_KEY);
      return v === '1';
    } catch {
      return false;
    }
  }
  function setAuthed(on) {
    if (on) sessionStorage.setItem(AUTH_KEY, '1');
    else sessionStorage.removeItem(AUTH_KEY);
  }

  /* ---------- Stats helpers ---------- */

  function playerStats(data) {
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));
    const agg = {};
    data.players.forEach((p) => {
      agg[p.id] = {
        id: p.id,
        name: p.name,
        rounds: 0,
        totalScore: 0,
        best: null,
        worst: null,
        birdies: 0,
        eagles: 0,
        holeInOnes: 0,
        pars: 0,
        bogeys: 0,
        doubleBogeys: 0,
        fairways: 0,
        gir: 0,
        putts: 0,
        drive: 0,
        sandies: 0
      };
    });

    data.rounds.forEach((r) => {
      const a = agg[r.playerId];
      if (!a) return;
      a.rounds += 1;
      a.totalScore += Number(r.score) || 0;
      if (a.best === null || r.score < a.best) a.best = r.score;
      if (a.worst === null || r.score > a.worst) a.worst = r.score;
      a.birdies += Number(r.birdies) || 0;
      a.eagles += Number(r.eagles) || 0;
      a.holeInOnes += Number(r.holeInOnes) || 0;
      a.pars += Number(r.pars) || 0;
      a.bogeys += Number(r.bogeys) || 0;
      a.doubleBogeys += Number(r.doubleBogeys) || 0;
      a.fairways += Number(r.fairways) || 0;
      a.gir += Number(r.gir) || 0;
      a.putts += Number(r.putts) || 0;
      a.sandies += Number(r.sandies) || 0;
      if ((Number(r.drive) || 0) > a.drive) a.drive = Number(r.drive) || 0;
    });

    Object.values(agg).forEach((a) => {
      a.avg = a.rounds ? a.totalScore / a.rounds : null;
      a.puttsPerRound = a.rounds ? a.putts / a.rounds : null;
    });

    return Object.values(agg);
  }

  /* Weekly league points:
   * For each distinct round date, rank players by score (lower better).
   * Points: 10, 8, 6, 5, 4, 3, 2, 1 for positions 1..8. Ties share the sum evenly.
   */
  function computeLeaguePoints(data) {
    const pointsTable = [10, 8, 6, 5, 4, 3, 2, 1];
    const pts = {};
    data.players.forEach((p) => (pts[p.id] = 0));

    const byDate = {};
    data.rounds.forEach((r) => {
      (byDate[r.date] = byDate[r.date] || []).push(r);
    });

    Object.values(byDate).forEach((rounds) => {
      const sorted = rounds.slice().sort((a, b) => a.score - b.score);
      // group ties
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j < sorted.length && sorted[j].score === sorted[i].score) j++;
        let sum = 0;
        for (let k = i; k < j && k < pointsTable.length; k++) sum += pointsTable[k];
        const share = (j - i) > 0 ? sum / (j - i) : 0;
        for (let k = i; k < j; k++) {
          if (pts[sorted[k].playerId] !== undefined) {
            pts[sorted[k].playerId] += share;
          }
        }
        i = j;
      }
    });
    return pts;
  }

  function computeRecords(data) {
    const rec = {};
    data.players.forEach((p) => (rec[p.id] = { w: 0, l: 0, t: 0 }));
    (data.matchups || []).forEach((m) => {
      if (!m.winnerId) return; // unplayed / not yet decided
      if (m.winnerId === 'tie') {
        if (rec[m.player1Id]) rec[m.player1Id].t++;
        if (rec[m.player2Id]) rec[m.player2Id].t++;
        return;
      }
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      if (rec[m.winnerId]) rec[m.winnerId].w++;
      if (rec[loserId]) rec[loserId].l++;
    });
    return rec;
  }

  function formatRecord(r) {
    if (!r) return '0-0';
    return r.t > 0 ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`;
  }

  function recordSortValue(r) {
    // Higher is better: wins weighted, ties as half
    if (!r) return 0;
    const played = r.w + r.l + r.t;
    if (!played) return -1; // unplayed sorts below played records
    return (r.w + r.t * 0.5) / played + r.w * 0.0001; // tiebreak by raw wins
  }

  global.KRGolf = {
    STORAGE_KEY,
    load,
    save,
    emptyData,
    uid,
    sha256,
    verifyPasscode,
    setPasscode,
    isAuthed,
    setAuthed,
    playerStats,
    computeLeaguePoints,
    computeRecords,
    formatRecord,
    recordSortValue
  };
})(window);
