/* Player profile page */
(async function () {
  const nameEl = document.getElementById('playerName');
  const summaryEl = document.getElementById('playerSummary');
  const head = document.getElementById('roundsHead');
  const body = document.getElementById('roundsBody');

  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('id');

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

  if (!playerId) {
    nameEl.textContent = 'Player not found';
    summaryEl.textContent = '';
    body.innerHTML = '<tr><td colspan="7" class="empty">No player selected.</td></tr>';
    return;
  }

  let data;
  try {
    data = await KRGolf.loadData();
  } catch (err) {
    console.error(err);
    nameEl.textContent = 'Error';
    summaryEl.textContent = 'Could not load league data.';
    body.innerHTML = '<tr><td colspan="7" class="empty">Could not load rounds.</td></tr>';
    return;
  }

  const player = data.players.find((p) => p.id === playerId);
  if (!player) {
    nameEl.textContent = 'Player not found';
    summaryEl.textContent = '';
    body.innerHTML = '<tr><td colspan="7" class="empty">This player no longer exists.</td></tr>';
    return;
  }

  document.title = `${player.name} — Knoll Run Golf League`;
  nameEl.textContent = player.name;

  const stats = KRGolf.playerStats(data).find((s) => s.id === playerId);
  const records = KRGolf.computeRecords(data);
  const rec = records[playerId] || { w: 0, l: 0, t: 0 };
  const recordStr = KRGolf.formatRecord(rec);
  const avgStr = stats && stats.avg != null ? stats.avg.toFixed(1) : '—';
  const hcpStr = player.handicap != null ? Number(player.handicap).toFixed(1) : '—';

  summaryEl.innerHTML = `Record <strong>${recordStr}</strong> &middot; Avg Score <strong>${avgStr}</strong> &middot; HCP <strong>${hcpStr}</strong>`;

  const rounds = data.rounds
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  head.innerHTML = `
    <tr>
      <th>Date</th>
      <th class="num">Score</th>
      <th class="num">Birdies</th>
      <th class="num">Eagles</th>
      <th class="num">Pars</th>
      <th class="num">Bogeys</th>
    </tr>`;

  if (!rounds.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No rounds posted yet.</td></tr>';
    return;
  }

  body.innerHTML = rounds
    .map(
      (r) => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td class="num">${r.score}</td>
        <td class="num">${r.birdies || 0}</td>
        <td class="num">${r.eagles || 0}</td>
        <td class="num">${r.pars || 0}</td>
        <td class="num">${r.bogeys || 0}</td>
      </tr>`
    )
    .join('');
})();
