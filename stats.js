/* Stat leaders page (async Supabase) */
(async function () {
  const grid = document.getElementById('statsGrid');
  const fun = document.getElementById('funGrid');

  let data;
  try {
    data = await KRGolf.loadData();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="empty-msg">Could not load stats.</p>';
    return;
  }

  const stats = KRGolf.playerStats(data);

  const categories = [
    { title: '🐦 Birdies',       key: 'birdies',      dir: 'desc', min: 1, sub: 'Most birdies this season' },
    { title: '🦅 Eagles',        key: 'eagles',       dir: 'desc', min: 1, sub: 'Most eagles this season' },
    { title: '🎯 Pars',          key: 'pars',         dir: 'desc', min: 1, sub: 'Steady as she goes' },
    { title: '🎖️ Handicap',      key: 'handicap',     dir: 'asc',  min: 0, sub: 'Lowest handicap index', fmt: (v) => v == null ? '—' : Number(v).toFixed(1) },
    { title: '⛳ Best Round',     key: 'best',         dir: 'asc',  min: 1, sub: 'Single lowest round' },
    { title: '🏆 Lowest Average',key: 'avg',          dir: 'asc',  min: 1, sub: 'Scoring average (min 1 round)', fmt: (v) => v == null ? '—' : v.toFixed(1) }
  ];

  function rank(list, key, dir, min, fmt) {
    const cleaned = list.filter((s) => s.rounds >= min && s[key] != null && !(typeof s[key] === 'number' && isNaN(s[key])));
    const isCounting = !['avg', 'best', 'puttsPerRound', 'handicap'].includes(key);
    const usable = cleaned.filter((s) => (isCounting ? s[key] > 0 : true));
    usable.sort((a, b) => (dir === 'asc' ? a[key] - b[key] : b[key] - a[key]));
    return usable.slice(0, 5).map((s) => ({ name: s.name, val: fmt ? fmt(s[key]) : s[key] }));
  }

  grid.innerHTML = categories
    .map((c) => {
      const top = rank(stats, c.key, c.dir, c.min || 1, c.fmt);
      const body = top.length
        ? `<ol class="stat-list">${top
            .map(
              (t, i) => `<li><span class="name"><span class="pos">${i + 1}.</span>${escapeHtml(t.name)}</span><span class="val">${t.val}</span></li>`
            )
            .join('')}</ol>`
        : `<p class="none">No data yet</p>`;
      return `
        <div class="stat-card">
          <h3>${c.title}</h3>
          <p class="sub">${c.sub}</p>
          ${body}
        </div>`;
    })
    .join('');

  const funStats = computeFunStats(data);
  fun.innerHTML = funStats
    .map(
      (f) => `
      <div class="fun-card">
        <div class="label">${f.label}</div>
        <div class="value">${f.value}</div>
        <div class="who">${escapeHtml(f.who || '')}</div>
      </div>`
    )
    .join('');

  function computeFunStats(data) {
    const sum = (key) => data.rounds.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const totalRounds = data.rounds.length;
    const totalScore = data.rounds.reduce((s, r) => s + (Number(r.score) || 0), 0);
    const leagueAvg = totalRounds ? (totalScore / totalRounds) : null;

    return [
      { label: 'Eagles', value: sum('eagles'), who: 'league-wide' },
      { label: 'Birdies', value: sum('birdies'), who: 'collectively made' },
      { label: 'Pars', value: sum('pars'), who: 'steady as she goes' },
      { label: 'Bogeys', value: sum('bogeys'), who: 'we all have them' },
      { label: 'Double Bogeys', value: sum('doubleBogeys'), who: 'shake it off' },
      { label: 'League Average Score', value: leagueAvg != null ? leagueAvg.toFixed(1) : '—', who: totalRounds ? `across ${totalRounds} round${totalRounds === 1 ? '' : 's'}` : 'no rounds yet' }
    ];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
