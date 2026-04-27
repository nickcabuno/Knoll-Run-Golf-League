/* Admin (Supabase-backed) — login + data management */
(async function () {
  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  let data = { players: [], rounds: [], matchups: [] };

  const $ = (id) => document.getElementById(id);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function setStatus(el, msg, cls) {
    el.textContent = msg;
    el.className = 'status' + (cls ? ' ' + cls : '');
    if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3500);
  }
  async function reload() {
    data = await KRGolf.loadData();
    renderAll();
  }

  async function showAdmin() {
    loginView.style.display = 'none';
    adminView.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    await reload();
  }
  function showLogin() {
    loginView.style.display = 'block';
    adminView.style.display = 'none';
    logoutBtn.style.display = 'none';
  }

  // Initial auth check
  try {
    if (await KRGolf.isAuthed()) await showAdmin();
    else showLogin();
  } catch (err) {
    console.error(err);
    showLogin();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const code = $('passcode').value;
    const ok = await KRGolf.signIn(code);
    if (ok) {
      $('passcode').value = '';
      await showAdmin();
    } else {
      loginError.textContent = 'Incorrect passcode.';
    }
  });

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await KRGolf.signOut();
    showLogin();
  });

  /* Tabs */
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.dataset.tab === t);
      });
    });
  });

  function renderAll() {
    renderPlayerSelect();
    renderPlayersTable();
    renderRoundsTable();
    renderMatchupSelects();
    renderMatchupsList();
    const today = new Date().toISOString().slice(0, 10);
    if (!$('roundDate').value) $('roundDate').value = today;
    if (!$('matchupDate').value) $('matchupDate').value = today;
  }

  function renderPlayerSelect() {
    const sel = $('roundPlayer');
    const prev = sel.value;
    sel.innerHTML = data.players.length
      ? data.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">-- add a player first --</option>';
    if (prev) sel.value = prev;
  }

  function renderMatchupSelects() {
    const opts = data.players.length
      ? data.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">-- add players first --</option>';
    ['matchupP1', 'matchupP2'].forEach((id) => {
      const el = $(id);
      const prev = el.value;
      el.innerHTML = opts;
      if (prev) el.value = prev;
    });
  }

  function renderPlayersTable() {
    const counts = {};
    data.rounds.forEach((r) => { counts[r.playerId] = (counts[r.playerId] || 0) + 1; });
    const body = $('playersBody');
    if (!data.players.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No players yet.</td></tr>';
      return;
    }
    body.innerHTML = data.players
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td class="num"><input type="number" step="0.1" min="0" class="hcp-input" data-hcp-player="${p.id}" value="${p.handicap == null ? '' : p.handicap}" style="width:80px;text-align:right" /></td>
          <td class="num">${counts[p.id] || 0}</td>
          <td class="num"><button class="btn small danger" data-del-player="${p.id}">Remove</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-hcp-player]').forEach((input) => {
      input.addEventListener('change', async () => {
        try {
          await KRGolf.updatePlayerHandicap(input.dataset.hcpPlayer, input.value);
          await reload();
        } catch (err) { alert('Update failed: ' + err.message); }
      });
    });
    body.querySelectorAll('[data-del-player]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.delPlayer;
        const p = data.players.find((x) => x.id === id);
        if (!p) return;
        const n = data.rounds.filter((r) => r.playerId === id).length;
        const msg = n
          ? `Remove ${p.name}? This will also delete ${n} round${n === 1 ? '' : 's'}.`
          : `Remove ${p.name}?`;
        if (!confirm(msg)) return;
        try {
          await KRGolf.deletePlayer(id);
          await reload();
        } catch (err) { alert('Delete failed: ' + err.message); }
      });
    });
  }

  function renderRoundsTable() {
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));
    const body = $('roundsBody');
    const rounds = data.rounds.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!rounds.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No rounds yet.</td></tr>';
      return;
    }
    body.innerHTML = rounds
      .map(
        (r) => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td>${escapeHtml((byId[r.playerId] || {}).name || '—')}</td>
          <td class="num">${r.score}</td>
          <td class="num">${r.birdies || 0}</td>
          <td class="num">${r.eagles || 0}</td>
          <td class="num">${r.holeInOnes || 0}</td>
          <td class="num"><button class="btn small danger" data-del-round="${r.id}">Delete</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-del-round]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this round?')) return;
        try {
          await KRGolf.deleteRound(b.dataset.delRound);
          await reload();
        } catch (err) { alert('Delete failed: ' + err.message); }
      });
    });
  }

  function renderMatchupsList() {
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));
    const list = $('matchupsList');
    const matchups = (data.matchups || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!matchups.length) {
      list.innerHTML = '<p class="empty-msg">No matchups yet.</p>';
      return;
    }
    list.innerHTML = matchups
      .map((m) => {
        const p1 = byId[m.player1Id];
        const p2 = byId[m.player2Id];
        if (!p1 || !p2) return '';
        const winBtn = (val, label) => {
          const active = m.winnerId === val || (val === null && !m.winnerId);
          return `<button class="winner-btn ${active ? 'active' : ''}" data-set-winner="${m.id}" data-value="${val == null ? '' : val}">${label}</button>`;
        };
        return `
          <div class="matchup-admin-row">
            <div>
              <div class="who">${escapeHtml(p1.name)} vs ${escapeHtml(p2.name)}</div>
              <div class="date-tag">${formatDate(m.date)}</div>
            </div>
            <div class="winner-group">
              ${winBtn(p1.id, p1.name + ' wins')}
              ${winBtn(p2.id, p2.name + ' wins')}
              ${winBtn('tie', 'Tie')}
              ${winBtn(null, 'Unplayed')}
            </div>
            <div></div>
            <button class="btn small danger" data-del-matchup="${m.id}">Delete</button>
          </div>`;
      })
      .join('');
    list.querySelectorAll('[data-set-winner]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.setWinner;
        const val = btn.dataset.value || null;
        try {
          await KRGolf.setMatchupWinner(id, val);
          await reload();
        } catch (err) { alert('Update failed: ' + err.message); }
      });
    });
    list.querySelectorAll('[data-del-matchup]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this matchup?')) return;
        try {
          await KRGolf.deleteMatchup(btn.dataset.delMatchup);
          await reload();
        } catch (err) { alert('Delete failed: ' + err.message); }
      });
    });
  }

  /* Add player */
  $('playerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('playerName').value.trim();
    if (!name) return;
    if (data.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('A player with that name already exists.');
      return;
    }
    try {
      await KRGolf.addPlayer(name, $('playerHandicap').value);
      $('playerName').value = '';
      $('playerHandicap').value = '';
      await reload();
    } catch (err) { alert('Add player failed: ' + err.message); }
  });

  /* Post a round */
  $('roundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const playerId = $('roundPlayer').value;
    if (!playerId) {
      alert('Add a player first in the Players tab.');
      return;
    }
    const round = {
      playerId,
      date: $('roundDate').value,
      score: Number($('roundScore').value),
      course: $('roundCourse').value.trim(),
      birdies: Number($('roundBirdies').value) || 0,
      eagles: Number($('roundEagles').value) || 0,
      holeInOnes: Number($('roundHIO').value) || 0,
      pars: Number($('roundPars').value) || 0,
      bogeys: Number($('roundBogeys').value) || 0,
      doubleBogeys: Number($('roundDoubleBogeys').value) || 0,
      fairways: Number($('roundFairways').value) || 0,
      gir: Number($('roundGIR').value) || 0,
      putts: Number($('roundPutts').value) || 0,
      drive: Number($('roundDrive').value) || 0,
      sandies: Number($('roundSandies').value) || 0
    };
    if (!round.date || !round.score) {
      setStatus($('roundStatus'), 'Date and score are required.', 'err');
      return;
    }
    try {
      await KRGolf.addRound(round);
      setStatus($('roundStatus'), 'Round saved ✓', 'ok');
      ['roundBirdies','roundEagles','roundHIO','roundPars','roundBogeys','roundDoubleBogeys','roundFairways','roundGIR','roundPutts','roundDrive','roundSandies']
        .forEach((id) => ($(id).value = 0));
      $('roundScore').value = '';
      await reload();
    } catch (err) {
      setStatus($('roundStatus'), 'Save failed: ' + err.message, 'err');
    }
  });

  /* Matchups */
  $('matchupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('matchupP1').value;
    const p2 = $('matchupP2').value;
    const date = $('matchupDate').value;
    if (!p1 || !p2 || !date) {
      setStatus($('matchupStatus'), 'All fields are required.', 'err');
      return;
    }
    if (p1 === p2) {
      setStatus($('matchupStatus'), 'Pick two different players.', 'err');
      return;
    }
    try {
      await KRGolf.addMatchup({ date, player1Id: p1, player2Id: p2 });
      setStatus($('matchupStatus'), 'Matchup added ✓', 'ok');
      await reload();
    } catch (err) {
      setStatus($('matchupStatus'), 'Save failed: ' + err.message, 'err');
    }
  });

  /* Data export/import/wipe */
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({
      version: 1,
      league: { name: 'Knoll Run Golf League' },
      players: data.players,
      rounds: data.rounds,
      matchups: data.matchups
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `knoll-run-league-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!confirm('Replace all current league data with this file? This cannot be undone.')) return;
        setStatus($('dataStatus'), 'Importing…', '');
        await KRGolf.importData(parsed);
        setStatus($('dataStatus'), 'Data imported ✓', 'ok');
        await reload();
      } catch (err) {
        setStatus($('dataStatus'), 'Import failed: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('wipeBtn').addEventListener('click', async () => {
    if (!confirm('Wipe ALL league data? This cannot be undone.')) return;
    if (!confirm('Really wipe everything? Consider exporting a backup first.')) return;
    try {
      await KRGolf.wipeAll();
      setStatus($('dataStatus'), 'All data cleared.', 'ok');
      await reload();
    } catch (err) {
      setStatus($('dataStatus'), 'Wipe failed: ' + err.message, 'err');
    }
  });

  /* Change passcode (= Supabase admin account password) */
  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nw = $('pwNew').value;
    const cf = $('pwConfirm').value;
    if (nw !== cf) return setStatus($('pwStatus'), 'New passcodes do not match.', 'err');
    try {
      await KRGolf.updatePasscode(nw);
      $('pwCurrent').value = $('pwNew').value = $('pwConfirm').value = '';
      setStatus($('pwStatus'), 'Passcode updated ✓', 'ok');
    } catch (err) {
      setStatus($('pwStatus'), 'Update failed: ' + err.message, 'err');
    }
  });
})();
