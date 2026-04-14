/* Admin page — login + data management */
(function () {
  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  function showAdmin() {
    loginView.style.display = 'none';
    adminView.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    renderAll();
  }
  function showLogin() {
    loginView.style.display = 'block';
    adminView.style.display = 'none';
    logoutBtn.style.display = 'none';
  }

  if (KRGolf.isAuthed()) showAdmin();
  else showLogin();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const code = document.getElementById('passcode').value;
    const ok = await KRGolf.verifyPasscode(code);
    if (ok) {
      KRGolf.setAuthed(true);
      document.getElementById('passcode').value = '';
      showAdmin();
    } else {
      loginError.textContent = 'Incorrect passcode.';
    }
  });

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    KRGolf.setAuthed(false);
    showLogin();
  });

  /* --- Tabs --- */
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.dataset.tab === t);
      });
    });
  });

  /* --- Helpers --- */
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

  function renderAll() {
    renderPlayerSelect();
    renderPlayersTable();
    renderRoundsTable();
    renderMatchupSelects();
    renderMatchupsList();
    // default date to today
    const d = new Date().toISOString().slice(0, 10);
    if (!$('roundDate').value) $('roundDate').value = d;
    if (!$('matchupDate').value) $('matchupDate').value = d;
  }

  function renderMatchupSelects() {
    const data = KRGolf.load();
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

  function renderMatchupsList() {
    const data = KRGolf.load();
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
      btn.addEventListener('click', () => {
        const id = btn.dataset.setWinner;
        const val = btn.dataset.value || null;
        const d = KRGolf.load();
        const m = (d.matchups || []).find((x) => x.id === id);
        if (!m) return;
        m.winnerId = val || null;
        KRGolf.save(d);
        renderMatchupsList();
      });
    });
    list.querySelectorAll('[data-del-matchup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this matchup?')) return;
        const d = KRGolf.load();
        d.matchups = (d.matchups || []).filter((m) => m.id !== btn.dataset.delMatchup);
        KRGolf.save(d);
        renderMatchupsList();
      });
    });
  }

  function renderPlayerSelect() {
    const data = KRGolf.load();
    const sel = $('roundPlayer');
    const prev = sel.value;
    sel.innerHTML = data.players.length
      ? data.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">-- add a player first --</option>';
    if (prev) sel.value = prev;
  }

  function renderPlayersTable() {
    const data = KRGolf.load();
    const counts = {};
    data.rounds.forEach((r) => { counts[r.playerId] = (counts[r.playerId] || 0) + 1; });
    const body = $('playersBody');
    if (!data.players.length) {
      body.innerHTML = '<tr><td colspan="3" class="empty">No players yet.</td></tr>';
      return;
    }
    body.innerHTML = data.players
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td class="num">${counts[p.id] || 0}</td>
          <td class="num"><button class="btn small danger" data-del-player="${p.id}">Remove</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-del-player]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.delPlayer;
        const d = KRGolf.load();
        const p = d.players.find((x) => x.id === id);
        if (!p) return;
        const n = d.rounds.filter((r) => r.playerId === id).length;
        const msg = n
          ? `Remove ${p.name}? This will also delete ${n} round${n === 1 ? '' : 's'}.`
          : `Remove ${p.name}?`;
        if (!confirm(msg)) return;
        d.players = d.players.filter((x) => x.id !== id);
        d.rounds = d.rounds.filter((r) => r.playerId !== id);
        KRGolf.save(d);
        renderAll();
      });
    });
  }

  function renderRoundsTable() {
    const data = KRGolf.load();
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
      b.addEventListener('click', () => {
        if (!confirm('Delete this round?')) return;
        const d = KRGolf.load();
        d.rounds = d.rounds.filter((r) => r.id !== b.dataset.delRound);
        KRGolf.save(d);
        renderAll();
      });
    });
  }

  /* --- Add player --- */
  $('playerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('playerName').value.trim();
    if (!name) return;
    const d = KRGolf.load();
    if (d.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('A player with that name already exists.');
      return;
    }
    d.players.push({ id: KRGolf.uid(), name });
    KRGolf.save(d);
    $('playerName').value = '';
    renderAll();
  });

  /* --- Post a round --- */
  $('roundForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = KRGolf.load();
    const playerId = $('roundPlayer').value;
    if (!playerId) {
      alert('Add a player first in the Players tab.');
      return;
    }
    const round = {
      id: KRGolf.uid(),
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
    d.rounds.push(round);
    KRGolf.save(d);
    setStatus($('roundStatus'), 'Round saved ✓', 'ok');
    // clear stat fields
    ['roundBirdies','roundEagles','roundHIO','roundPars','roundBogeys','roundDoubleBogeys','roundFairways','roundGIR','roundPutts','roundDrive','roundSandies']
      .forEach((id) => ($(id).value = 0));
    $('roundScore').value = '';
    renderAll();
  });

  /* --- Matchups --- */
  $('matchupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = KRGolf.load();
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
    if (!Array.isArray(d.matchups)) d.matchups = [];
    d.matchups.push({
      id: KRGolf.uid(),
      date,
      player1Id: p1,
      player2Id: p2,
      winnerId: null
    });
    KRGolf.save(d);
    setStatus($('matchupStatus'), 'Matchup added ✓', 'ok');
    renderMatchupsList();
  });

  /* --- Data export/import/wipe --- */
  $('exportBtn').addEventListener('click', () => {
    const d = KRGolf.load();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
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
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.rounds)) {
          throw new Error('Invalid file format.');
        }
        if (!confirm('Replace all current league data with this file?')) return;
        KRGolf.save(Object.assign(KRGolf.emptyData(), parsed));
        setStatus($('dataStatus'), 'Data imported ✓', 'ok');
        renderAll();
      } catch (err) {
        setStatus($('dataStatus'), 'Import failed: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('wipeBtn').addEventListener('click', () => {
    if (!confirm('Wipe ALL league data? This cannot be undone.')) return;
    if (!confirm('Really wipe everything? Consider exporting a backup first.')) return;
    KRGolf.save(KRGolf.emptyData());
    setStatus($('dataStatus'), 'All data cleared.', 'ok');
    renderAll();
  });

  /* --- Change passcode --- */
  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur = $('pwCurrent').value;
    const nw = $('pwNew').value;
    const cf = $('pwConfirm').value;
    if (nw !== cf) return setStatus($('pwStatus'), 'New passcodes do not match.', 'err');
    const ok = await KRGolf.verifyPasscode(cur);
    if (!ok) return setStatus($('pwStatus'), 'Current passcode is incorrect.', 'err');
    await KRGolf.setPasscode(nw);
    $('pwCurrent').value = $('pwNew').value = $('pwConfirm').value = '';
    setStatus($('pwStatus'), 'Passcode updated ✓', 'ok');
  });
})();
