/* Homepage: renders leaderboard + weekly matchups (async Supabase) */
(async function () {
  const sortSelect = document.getElementById('sortBy');
  const lbHead = document.getElementById('leaderboardHead');
  const lbBody = document.getElementById('leaderboardBody');
  const matchupsWrap = document.getElementById('matchupsWrap');
  const weekLabel = document.getElementById('weekLabel');

  let data;
  try {
    data = await KRGolf.loadData();
  } catch (err) {
    console.error(err);
    lbBody.innerHTML = `<tr><td colspan="8" class="empty">Could not load league data. Please try again.</td></tr>`;
    matchupsWrap.innerHTML = '<p class="empty-msg">Could not load matchups.</p>';
    return;
  }

  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));

  function rankBadge(i) {
    const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    return `<span class="rank ${cls}">${i + 1}</span>`;
  }

  function columnsFor(sortKey) {
    const cols = [
      { key: 'best', label: 'Best', render: (r) => r.best ?? '—' },
      { key: 'avg', label: 'Avg', render: (r) => (r.avg != null ? r.avg.toFixed(1) : '—') },
      { key: 'birdies', label: 'Birdies', render: (r) => r.birdies },
      { key: 'pars', label: 'Pars', render: (r) => r.pars },
      { key: 'record', label: 'Record', render: (r) => KRGolf.formatRecord(r.recordObj) }
    ];
    if (sortKey === 'record') {
      const rec = cols.find((c) => c.key === 'record');
      const rest = cols.filter((c) => c.key !== 'record');
      return [rec, ...rest];
    }
    return cols;
  }

  function renderLeaderboard() {
    const stats = KRGolf.playerStats(data);
    const records = KRGolf.computeRecords(data);

    const rows = stats
      .filter((s) => s.rounds > 0 || (records[s.id] && (records[s.id].w + records[s.id].l + records[s.id].t) > 0))
      .map((s) => ({ ...s, recordObj: records[s.id] || { w: 0, l: 0, t: 0 } }));

    const sortKey = sortSelect.value;
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'best':
          return (a.best ?? 999) - (b.best ?? 999);
        case 'avg':
          return (a.avg ?? 999) - (b.avg ?? 999);
        case 'record':
        default:
          return KRGolf.recordSortValue(b.recordObj) - KRGolf.recordSortValue(a.recordObj);
      }
    });

    const cols = columnsFor(sortKey);
    lbHead.innerHTML = `
      <tr>
        <th>#</th>
        <th>Player</th>
        ${cols.map((c) => `<th class="num">${c.label}</th>`).join('')}
      </tr>`;

    if (!rows.length) {
      lbBody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="empty">No rounds posted yet. Check back soon.</td></tr>`;
      return;
    }

    lbBody.innerHTML = rows
      .map(
        (r, i) => `
        <tr>
          <td>${rankBadge(i)}</td>
          <td>${escapeHtml(r.name)}</td>
          ${cols.map((c) => `<td class="num">${c.render(r)}</td>`).join('')}
        </tr>`
      )
      .join('');
  }

  function renderMatchups() {
    const matchups = data.matchups || [];
    if (!matchups.length) {
      matchupsWrap.innerHTML = '<p class="empty-msg">No matchups scheduled yet.</p>';
      weekLabel.textContent = '';
      return;
    }
    const latest = matchups.map((m) => m.date).filter(Boolean).sort().pop();
    const thisWeek = matchups.filter((m) => m.date === latest);
    weekLabel.textContent = latest ? `Week of ${formatDate(latest)}` : '';

    const records = KRGolf.computeRecords(data);

    matchupsWrap.innerHTML = `<div class="matchups-grid">${thisWeek
      .map((m) => {
        const p1 = playersById[m.player1Id];
        const p2 = playersById[m.player2Id];
        if (!p1 || !p2) return '';
        const r1 = records[p1.id];
        const r2 = records[p2.id];
        const isTie = m.winnerId === 'tie';
        const cardCls = isTie ? 'matchup-card tie' : 'matchup-card';
        const leftWin = !isTie && m.winnerId === p1.id;
        const rightWin = !isTie && m.winnerId === p2.id;
        return `
          <div class="${cardCls}">
            <div class="matchup-side left ${leftWin ? 'winner' : ''}">
              <div class="player">${escapeHtml(p1.name)}</div>
              <div class="record">${KRGolf.formatRecord(r1)}</div>
            </div>
            <div class="matchup-vs">VS</div>
            <div class="matchup-side right ${rightWin ? 'winner' : ''}">
              <div class="player">${escapeHtml(p2.name)}</div>
              <div class="record">${KRGolf.formatRecord(r2)}</div>
            </div>
          </div>`;
      })
      .join('')}</div>`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  sortSelect.addEventListener('change', renderLeaderboard);
  renderLeaderboard();
  renderMatchups();
})();
