// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
// Sorting, filters and the detail view all run in the page. The initial state
// can come from the query string (?detail=<slug>, ?category=<name>,
// ?watchlist=1, ?q=<text>) so each screenshot shows the view it is named for.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.textContent = 'No radar data.'; return; }
  var rows = R.rows, live = R.live;
  var watchlist = {};
  R.rows.forEach(function (r) { watchlist[r.slug] = false; });
  (R.watchlist || []).forEach(function (s) { watchlist[s] = true; });
  // The watchlist slugs are the snapshot's own list; the board carries them all.
  var params = new URLSearchParams(location.search);

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function age(n) { return n === null || n === undefined ? '—' : (n >= 365 ? (n / 365).toFixed(1) + 'y' : n + 'd'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---- header stats ----
  var top = rows[0];
  $('stats').innerHTML =
    '<div><dt>Board</dt><dd>' + rows.length + ' <span>protocols</span></dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + R.watchlist_size + ' <span>covered</span></dd></div>' +
    '<div><dt>Early finds</dt><dd>' + R.early_size + ' <span>below the floor</span></dd></div>' +
    '<div><dt>Top implied value</dt><dd>' + money(top.implied_value_usd) + ' <span>' + esc(top.name) + '</span></dd></div>';
  $('fine').textContent = 'Snapshot as of ' + R.as_of + ' · ' + R.source + ' · floor $' +
    (R.floor_usd / 1e6) + 'M TVL · model ' + R.model_version;

  // ---- top 10 bars ----
  var max = rows[0].implied_value_usd;
  $('top10').innerHTML = rows.slice(0, 10).map(function (r, i) {
    var w = Math.max(2, Math.round(r.implied_value_usd / max * 100));
    return '<li><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(r.name) +
      '</span><span class="bar"><i style="width:' + w + '%"></i></span><span class="v">' +
      money(r.implied_value_usd) + '</span></li>';
  }).join('');

  // ---- filter options ----
  var cats = {}, chains = {};
  rows.forEach(function (r) { if (r.category) cats[r.category] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('category').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('chain').appendChild(o);
  });

  var state = { q: '', category: '', chain: '', minTvl: 0, watchlistOnly: false, earlyOnly: false, sort: 'rank', dir: 1 };
  function applyParams() {
    if (params.get('q')) { state.q = params.get('q'); $('q').value = state.q; }
    if (params.get('category')) { state.category = params.get('category'); $('category').value = state.category; }
    if (params.get('chain')) { state.chain = params.get('chain'); $('chain').value = state.chain; }
    if (params.get('watchlist') === '1') { state.watchlistOnly = true; $('watchlistOnly').checked = true; }
    if (params.get('early') === '1') { state.earlyOnly = true; $('earlyOnly').checked = true; }
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.watchlistOnly && !watchlist[r.slug]) return false;
      if (state.earlyOnly && watchlist[r.slug]) return false;
      return true;
    });
  }
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; },
    category: function (a, b) { return (a.category || '') < (b.category || '') ? -1 : 1; },
    chains: function (a, b) {
      if (a.chains.length !== b.chains.length) return a.chains.length - b.chains.length;
      var x = a.chains[0] || '', y = b.chains[0] || '';
      return x < y ? -1 : x > y ? 1 : 0;
    },
    tvl_usd: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    change_7d: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    age_days: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    implied_value_usd: function (a, b) { return b.implied_value_usd - a.implied_value_usd; }
  };
  function render() {
    var list = filtered();
    var sort = SORTS[state.sort] || SORTS.rank;
    list.sort(function (a, b) { return sort(a, b) * state.dir; });
    var shown = list.slice(0, 100);
    $('rows').innerHTML = shown.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td>' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (watchlist[r.slug] ? '<span class="tag">WATCHLIST</span>' : '') +
        '<span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
    $('count').textContent = list.length + ' of ' + rows.length + ' protocols match' +
      (list.length > 100 ? ' — showing the first 100' : '') + '.';
    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
    });
  }

  // ---- detail view ----
  var selected = null;
  function showDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = $('detail');
    if (!r) { box.hidden = true; selected = null; return; }
    selected = slug;
    var base = Math.round(r.tvl_usd * r.multiple);
    var srcNote = r.multiple_source === 'global median'
      ? 'the global median multiple of ' + r.multiple.toFixed(3) + ' (this category has fewer than three live comparables in this snapshot)'
      : 'the ' + esc(r.multiple_source) + ' multiple of ' + r.multiple.toFixed(3);
    var baseNote = r.multiple_source === 'global median'
      ? 'Base ' + money(base) + ' from ' + srcNote + ' — the median market-cap / TVL across all live-token protocols in this snapshot.'
      : 'Base ' + money(base) + ' from ' + srcNote + ' — the median market-cap / TVL of live ' +
        esc(r.category || 'uncategorised') + ' protocols in this snapshot.';
    box.innerHTML =
      '<h2>#' + r.rank + ' · ' + esc(r.name) + (watchlist[r.slug] ? '<span class="tag">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) +
      ' · listed ' + (r.listed_at || 'unknown') + ' · records no token</p>' +
      '<dl class="kv">' +
      '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day growth</dt><dd>' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + age(r.age_days) + '</dd></div>' +
      '</dl>' +
      '<p class="formula">implied = ' + money(r.tvl_usd) + ' TVL × ' + r.multiple.toFixed(3) +
      ' multiple × ' + r.growth_multiplier.toFixed(3) + ' growth × ' + r.age_multiplier.toFixed(3) +
      ' age × ' + r.breadth_multiplier.toFixed(3) + ' breadth = ' + money(r.implied_value_usd) + '</p>' +
      '<p>' + baseNote + '</p>' +
      '<h3>How to farm it</h3><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    box.hidden = false;
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.classList.toggle('selected', tr.getAttribute('data-slug') === slug);
    });
  }

  // ---- events ----
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = 1; }
      render();
    });
  });
  function bind(id, fn) { $(id).addEventListener('input', fn); $(id).addEventListener('change', fn); }
  bind('q', function () { state.q = $('q').value; render(); });
  bind('category', function () { state.category = $('category').value; render(); });
  bind('chain', function () { state.chain = $('chain').value; render(); });
  bind('minTvl', function () { state.minTvl = Number($('minTvl').value); render(); });
  bind('watchlistOnly', function () { state.watchlistOnly = $('watchlistOnly').checked; render(); });
  bind('earlyOnly', function () { state.earlyOnly = $('earlyOnly').checked; render(); });
  $('reset').addEventListener('click', function () {
    state = { q: '', category: '', chain: '', minTvl: 0, watchlistOnly: false, earlyOnly: false, sort: 'rank', dir: 1 };
    $('q').value = ''; $('category').value = ''; $('chain').value = ''; $('minTvl').value = '0';
    $('watchlistOnly').checked = false; $('earlyOnly').checked = false;
    render();
  });

  // ---- methodology + live tables ----
  $('multipleRows').innerHTML = R.category_multiples.map(function (m) {
    return '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.comparables + '</td><td class="num">' +
      m.multiple.toFixed(3) + (m.fallback ? ' <span class="sub">fallback</span>' : '') + '</td></tr>';
  }).join('');
  $('globalMultiple').textContent = R.global_multiple.toFixed(3) + ' (median across ' +
    R.live_size + ' live-token protocols shown below)';
  $('liveRows').innerHTML = live.map(function (p) {
    return '<tr><td><strong>' + esc(p.name) + '</strong><span class="sub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + (p.mcap_tvl === null ? '—' : p.mcap_tvl.toFixed(3)) + '</td></tr>';
  }).join('');

  applyParams();
  render();
  if (params.get('detail')) showDetail(params.get('detail'));
})();
