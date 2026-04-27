/* Knoll Run Golf League — shared data layer (Supabase-backed)
 *
 * Public reads use the anon key; writes require a signed-in session via
 * Supabase Auth (shared admin account). RLS policies enforce this server-side.
 */
(function (global) {
  const cfg = global.KR_CONFIG || {};
  if (!global.supabase || !cfg.SUPABASE_URL) {
    console.error('Supabase SDK or config missing.');
    return;
  }
  const sb = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Row <-> object mapping ---------- */
  function roundRowToObj(r) {
    return {
      id: r.id,
      playerId: r.player_id,
      date: r.date,
      score: r.score,
      course: r.course || '',
      birdies: r.birdies || 0,
      eagles: r.eagles || 0,
      holeInOnes: r.hole_in_ones || 0,
      pars: r.pars || 0,
      bogeys: r.bogeys || 0,
      doubleBogeys: r.double_bogeys || 0,
      fairways: r.fairways || 0,
      gir: r.gir || 0,
      putts: r.putts || 0,
      drive: r.drive || 0,
      sandies: r.sandies || 0
    };
  }
  function roundObjToRow(r) {
    return {
      id: r.id || uid(),
      player_id: r.playerId,
      date: r.date,
      score: Number(r.score),
      course: r.course || null,
      birdies: Number(r.birdies) || 0,
      eagles: Number(r.eagles) || 0,
      hole_in_ones: Number(r.holeInOnes) || 0,
      pars: Number(r.pars) || 0,
      bogeys: Number(r.bogeys) || 0,
      double_bogeys: Number(r.doubleBogeys) || 0,
      fairways: Number(r.fairways) || 0,
      gir: Number(r.gir) || 0,
      putts: Number(r.putts) || 0,
      drive: Number(r.drive) || 0,
      sandies: Number(r.sandies) || 0
    };
  }
  function matchupRowToObj(m) {
    return {
      id: m.id,
      date: m.date,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      winnerId: m.winner_id
    };
  }

  /* ---------- Reads ---------- */
  async function loadData() {
    const [p, r, m] = await Promise.all([
      sb.from('players').select('*').order('name'),
      sb.from('rounds').select('*').order('date', { ascending: false }),
      sb.from('matchups').select('*').order('date', { ascending: false })
    ]);
    if (p.error) throw p.error;
    if (r.error) throw r.error;
    if (m.error) throw m.error;
    return {
      players: (p.data || []).map((x) => ({
        id: x.id,
        name: x.name,
        handicap: x.handicap == null ? null : Number(x.handicap)
      })),
      rounds: (r.data || []).map(roundRowToObj),
      matchups: (m.data || []).map(matchupRowToObj)
    };
  }

  /* ---------- Auth ---------- */
  async function signIn(passcode) {
    const { error } = await sb.auth.signInWithPassword({
      email: cfg.ADMIN_EMAIL,
      password: passcode
    });
    return !error;
  }
  async function signOut() {
    await sb.auth.signOut();
  }
  async function isAuthed() {
    const { data } = await sb.auth.getSession();
    return !!(data && data.session);
  }
  async function updatePasscode(newPasscode) {
    const { error } = await sb.auth.updateUser({ password: newPasscode });
    if (error) throw error;
  }

  /* ---------- Writes ---------- */
  async function addPlayer(name, handicap) {
    const id = uid();
    const row = { id, name };
    if (handicap != null && handicap !== '' && !isNaN(Number(handicap))) {
      row.handicap = Number(handicap);
    }
    const { error } = await sb.from('players').insert(row);
    if (error) throw error;
    return id;
  }
  async function updatePlayerHandicap(id, handicap) {
    const value = (handicap === '' || handicap == null || isNaN(Number(handicap))) ? null : Number(handicap);
    const { error } = await sb.from('players').update({ handicap: value }).eq('id', id);
    if (error) throw error;
  }
  async function deletePlayer(id) {
    const { error } = await sb.from('players').delete().eq('id', id);
    if (error) throw error;
  }

  async function addRound(round) {
    const { error } = await sb.from('rounds').insert(roundObjToRow(round));
    if (error) throw error;
  }
  async function deleteRound(id) {
    const { error } = await sb.from('rounds').delete().eq('id', id);
    if (error) throw error;
  }

  async function addMatchup(m) {
    const row = {
      id: uid(),
      date: m.date,
      player1_id: m.player1Id,
      player2_id: m.player2Id,
      winner_id: null
    };
    const { error } = await sb.from('matchups').insert(row);
    if (error) throw error;
  }
  async function setMatchupWinner(id, winnerId) {
    const { error } = await sb
      .from('matchups')
      .update({ winner_id: winnerId })
      .eq('id', id);
    if (error) throw error;
  }
  async function deleteMatchup(id) {
    const { error } = await sb.from('matchups').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------- Bulk import / wipe (admin only) ---------- */
  async function wipeAll() {
    // Order matters: rounds/matchups FK to players.
    const { error: e1 } = await sb.from('rounds').delete().neq('id', '');
    if (e1) throw e1;
    const { error: e2 } = await sb.from('matchups').delete().neq('id', '');
    if (e2) throw e2;
    const { error: e3 } = await sb.from('players').delete().neq('id', '');
    if (e3) throw e3;
  }

  async function importData(json) {
    if (!json || !Array.isArray(json.players)) {
      throw new Error('Invalid data file: missing players array.');
    }
    await wipeAll();
    if (json.players.length) {
      const { error } = await sb
        .from('players')
        .insert(json.players.map((p) => ({
          id: p.id,
          name: p.name,
          handicap: p.handicap == null ? null : Number(p.handicap)
        })));
      if (error) throw error;
    }
    if (Array.isArray(json.rounds) && json.rounds.length) {
      const { error } = await sb.from('rounds').insert(json.rounds.map(roundObjToRow));
      if (error) throw error;
    }
    if (Array.isArray(json.matchups) && json.matchups.length) {
      const rows = json.matchups.map((m) => ({
        id: m.id || uid(),
        date: m.date,
        player1_id: m.player1Id,
        player2_id: m.player2Id,
        winner_id: m.winnerId || null
      }));
      const { error } = await sb.from('matchups').insert(rows);
      if (error) throw error;
    }
  }

  /* ---------- Stats (pure functions, same as before) ---------- */
  function playerStats(data) {
    const agg = {};
    data.players.forEach((p) => {
      agg[p.id] = {
        id: p.id,
        name: p.name,
        handicap: p.handicap == null ? null : Number(p.handicap),
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

  function computeRecords(data) {
    const rec = {};
    data.players.forEach((p) => (rec[p.id] = { w: 0, l: 0, t: 0 }));
    (data.matchups || []).forEach((m) => {
      if (!m.winnerId) return;
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
    if (!r) return 0;
    const played = r.w + r.l + r.t;
    if (!played) return -1;
    return (r.w + r.t * 0.5) / played + r.w * 0.0001;
  }

  global.KRGolf = {
    uid,
    loadData,
    signIn,
    signOut,
    isAuthed,
    updatePasscode,
    addPlayer,
    updatePlayerHandicap,
    deletePlayer,
    addRound,
    deleteRound,
    addMatchup,
    setMatchupWinner,
    deleteMatchup,
    wipeAll,
    importData,
    playerStats,
    computeRecords,
    formatRecord,
    recordSortValue
  };
})(window);
