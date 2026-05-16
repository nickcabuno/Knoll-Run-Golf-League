/* Homepage: renders leaderboard + weekly matchups (async Supabase) */
(async function () {
  const lbHead = document.getElementById('leaderboardHead');
  const lbBody = document.getElementById('leaderboardBody');
  const matchupsWrap = document.getElementById('matchupsWrap');
  const weekLabel = document.getElementById('weekLabel');

  const hasLeaderboard = !!(lbHead && lbBody);
  const hasMatchups = !!matchupsWrap;
  if (!hasLeaderboard && !hasMatchups) return;

  let data;
  try {
    data = await KRGolf.loadData();
  } catch (err) {
    console.error(err);
    if (hasLeaderboard) lbBody.innerHTML = `<tr><td colspan="8" class="empty">Could not load league data. Please try again.</td></tr>`;
    if (hasMatchups) matchupsWrap.innerHTML = '<p class="empty-msg">Could not load matchups.</p>';
    return;
  }

  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));

  function rankBadge(i) {
    const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    return `<span class="rank ${cls}">${i + 1}</span>`;
  }

  function renderLeaderboard() {
    const stats = KRGolf.playerStats(data);
    const records = KRGolf.computeRecords(data);

    const rows = stats
      .filter((s) => s.rounds > 0 || (records[s.id] && (records[s.id].w + records[s.id].l + records[s.id].t) > 0))
      .map((s) => ({ ...s, recordObj: records[s.id] || { w: 0, l: 0, t: 0 } }));

    rows.sort((a, b) => {
      const recDiff = KRGolf.recordSortValue(b.recordObj) - KRGolf.recordSortValue(a.recordObj);
      if (recDiff !== 0) return recDiff;
      const aAvg = a.avg == null ? Infinity : a.avg;
      const bAvg = b.avg == null ? Infinity : b.avg;
      return aAvg - bAvg;
    });

    const cols = [
      { key: 'record', label: 'Record', render: (r) => KRGolf.formatRecord(r.recordObj) },
      { key: 'hcp', label: 'HCP', render: (r) => (r.handicap != null ? r.handicap.toFixed(1) : '—') },
      { key: 'best', label: 'Best', render: (r) => r.best ?? '—' },
      { key: 'avg', label: 'Avg', render: (r) => (r.avg != null ? r.avg.toFixed(1) : '—') }
    ];
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
          <td><a class="player-link" href="player.html?id=${encodeURIComponent(r.id)}">${escapeHtml(r.name)}</a></td>
          ${cols.map((c) => `<td class="num">${c.render(r)}</td>`).join('')}
        </tr>`
      )
      .join('');
  }

  let weeks = [];
  let selectedWeekIdx = 0;

  function buildWeeks(matchups) {
    const dates = [...new Set(matchups.map((m) => m.date).filter(Boolean))].sort();
    return dates.map((date, i) => {
      const start = new Date(date + 'T00:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const monthShort = (dt) => dt.toLocaleDateString(undefined, { month: 'short' });
      const sameMonth = start.getMonth() === end.getMonth();
      const range = sameMonth
        ? `${monthShort(start)} ${start.getDate()} - ${end.getDate()}`
        : `${monthShort(start)} ${start.getDate()} - ${monthShort(end)} ${end.getDate()}`;
      return { date, label: `Week ${i + 1}`, range };
    });
  }

  function defaultWeekIdx(weeksArr) {
    const target = currentWeekMatchupDate(data.matchups || []);
    const idx = weeksArr.findIndex((w) => w.date === target);
    return idx >= 0 ? idx : weeksArr.length - 1;
  }

  function renderWeekPicker() {
    const wrap = document.getElementById('weekPicker');
    if (!wrap) return;
    if (!weeks.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <button class="wp-arrow wp-prev" aria-label="Previous week" type="button">&#x2039;</button>
      <div class="wp-viewport"><div class="wp-track">
        ${weeks.map((w, i) => `
          <button class="wp-item${i === selectedWeekIdx ? ' selected' : ''}" data-idx="${i}" type="button">
            <span class="wp-week">${escapeHtml(w.label.toUpperCase())}</span>
            <span class="wp-range">${escapeHtml(w.range)}</span>
          </button>`).join('')}
      </div></div>
      <button class="wp-arrow wp-next" aria-label="Next week" type="button">&#x203A;</button>`;
    const track = wrap.querySelector('.wp-track');
    const prevBtn = wrap.querySelector('.wp-prev');
    const nextBtn = wrap.querySelector('.wp-next');
    function updatePosition() {
      const itemsPerView = window.matchMedia('(max-width: 799px)').matches ? 3 : 7;
      const center = Math.floor(itemsPerView / 2);
      const maxLeft = Math.max(0, weeks.length - itemsPerView);
      const left = Math.min(Math.max(0, selectedWeekIdx - center), maxLeft);
      track.style.transform = `translateX(-${left * (100 / itemsPerView)}%)`;
      wrap.querySelectorAll('.wp-item').forEach((el, i) => {
        el.classList.toggle('selected', i === selectedWeekIdx);
      });
      prevBtn.disabled = selectedWeekIdx <= 0;
      nextBtn.disabled = selectedWeekIdx >= weeks.length - 1;
    }
    function selectIdx(idx) {
      if (idx < 0 || idx >= weeks.length || idx === selectedWeekIdx) return;
      selectedWeekIdx = idx;
      updatePosition();
      renderMatchupsBody();
    }
    prevBtn.addEventListener('click', () => selectIdx(selectedWeekIdx - 1));
    nextBtn.addEventListener('click', () => selectIdx(selectedWeekIdx + 1));
    wrap.querySelectorAll('.wp-item').forEach((el) => {
      el.addEventListener('click', () => selectIdx(Number(el.dataset.idx)));
    });
    if (!renderWeekPicker._bound) {
      window.addEventListener('resize', () => {
        const t = document.querySelector('#weekPicker .wp-track');
        if (!t || !weeks.length) return;
        const itemsPerView = window.matchMedia('(max-width: 799px)').matches ? 3 : 7;
        const center = Math.floor(itemsPerView / 2);
        const maxLeft = Math.max(0, weeks.length - itemsPerView);
        const left = Math.min(Math.max(0, selectedWeekIdx - center), maxLeft);
        t.style.transform = `translateX(-${left * (100 / itemsPerView)}%)`;
      });
      renderWeekPicker._bound = true;
    }
    updatePosition();
  }

  function renderMatchups() {
    const matchups = data.matchups || [];
    if (!matchups.length) {
      matchupsWrap.innerHTML = '<p class="empty-msg">No matchups scheduled yet.</p>';
      weekLabel.textContent = '';
      const wp = document.getElementById('weekPicker');
      if (wp) wp.innerHTML = '';
      return;
    }
    weeks = buildWeeks(matchups);
    selectedWeekIdx = defaultWeekIdx(weeks);
    renderWeekPicker();
    renderMatchupsBody();
  }

  function renderMatchupsBody() {
    const matchups = data.matchups || [];
    const target = weeks[selectedWeekIdx] ? weeks[selectedWeekIdx].date : null;
    const thisWeek = target ? matchups.filter((m) => m.date === target) : [];
    weekLabel.textContent = target ? `Week of ${formatDate(target)}` : '';
    if (!thisWeek.length) {
      matchupsWrap.innerHTML = '<p class="empty-msg">No matchups scheduled yet.</p>';
      return;
    }

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
        const hcp = (p) => (p.handicap != null ? `HCP ${Number(p.handicap).toFixed(1)}` : 'HCP —');
        const scoreFor = (pid) => {
          const round = (data.rounds || []).find((r) => r.playerId === pid && r.date === m.date);
          return round && round.score != null ? round.score : null;
        };
        const hcpAndScore = (p) => {
          const s = scoreFor(p.id);
          return s != null ? `${hcp(p)} &middot; ${s}` : hcp(p);
        };
        return `
          <div class="${cardCls}">
            <div class="matchup-side left ${leftWin ? 'winner' : ''}">
              <div class="player"><a class="player-link" href="player.html?id=${encodeURIComponent(p1.id)}">${escapeHtml(p1.name)}</a></div>
              <div class="record">${KRGolf.formatRecord(r1)}</div>
              <div class="record">${hcpAndScore(p1)}</div>
            </div>
            <div class="matchup-vs">VS</div>
            <div class="matchup-side right ${rightWin ? 'winner' : ''}">
              <div class="player"><a class="player-link" href="player.html?id=${encodeURIComponent(p2.id)}">${escapeHtml(p2.name)}</a></div>
              <div class="record">${KRGolf.formatRecord(r2)}</div>
              <div class="record">${hcpAndScore(p2)}</div>
            </div>
          </div>`;
      })
      .join('')}</div>`;
  }

  function toLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Returns the matchup date that represents "this week."
  // Week boundary is Tuesday 00:00 local time, so on Tuesday the page rolls
  // forward to the upcoming week's matchups. Falls back to the most recent
  // past date if nothing is scheduled for the current/upcoming week.
  function currentWeekMatchupDate(matchups) {
    const dates = [...new Set(matchups.map((m) => m.date).filter(Boolean))].sort();
    if (!dates.length) return null;
    const today = new Date();
    const sow = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    sow.setDate(sow.getDate() - ((sow.getDay() - 2 + 7) % 7));
    const sowISO = toLocalISO(sow);
    return dates.find((d) => d >= sowISO) || dates[dates.length - 1];
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

  if (hasLeaderboard) renderLeaderboard();
  if (hasMatchups) renderMatchups();
})();
