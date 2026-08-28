/* Texas Land & Tax Sale Finder — county research shell */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const LS = {
  get(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem('txsf_' + key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('txsf_' + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

let COUNTIES = [];
let CITIES = [];
let favs = LS.get('favs', []);
let checks = LS.get('checks', {}); // county id -> last probe result
let notes = LS.get('notes', {});
let selectedCountyId = null;

/* ---------- helpers ---------- */
function startOfToday(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function statutorySaleDate(from = new Date()) {
  const floor = startOfToday(from);
  for (let add = 0; add < 15; add += 1) {
    const first = new Date(floor.getFullYear(), floor.getMonth() + add, 1);
    const candidate = new Date(first);
    while (candidate.getDay() !== 2) candidate.setDate(candidate.getDate() + 1);

    // Texas Tax Code §34.01: when the first Tuesday is Jan. 1 or July 4,
    // the statutory sale day moves to the first Wednesday of that month.
    if ((candidate.getMonth() === 0 && candidate.getDate() === 1) ||
        (candidate.getMonth() === 6 && candidate.getDate() === 4)) {
      candidate.setDate(candidate.getDate() + 1);
    }
    if (candidate >= floor) return candidate;
  }
  return null;
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function daysUntil(date) {
  return Math.round((startOfToday(date) - startOfToday()) / 86400000);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function fmtPop(value) {
  return value ? Number(value).toLocaleString('en-US') : '—';
}

function telLink(value) {
  const text = String(value || '');
  const match = text.match(/(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/);
  if (!match) return '';
  let digits = match[0].replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  if (digits.length !== 11 || digits[0] !== '1') return '';
  return 'tel:+' + digits;
}

function csvValue(value) {
  let text = String(value ?? '');
  // Protect text cells from formula execution while preserving genuine numeric
  // values (including negative projected-profit/headroom fields) as numbers.
  const numericValue = typeof value === 'number' && Number.isFinite(value);
  if (!numericValue && /^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- tabs ---------- */
function activateView(viewName) {
  $$('.tab').forEach(tab => {
    const active = tab.dataset.view === viewName;
    tab.classList.toggle('on', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.view').forEach(view => view.classList.toggle('on', view.id === 'view-' + viewName));

  if (viewName !== 'counties') closeDrawer(false);
  if (viewName !== 'deals' && window.TXSFDealDashboard) {
    window.TXSFDealDashboard.closeEditor();
  }
  if (viewName === 'deals') {
    window.dispatchEvent(new CustomEvent('txsf:deals-view'));
  }
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => activateView(tab.dataset.view)));

/* ---------- counties view ---------- */
function filteredCounties() {
  const query = $('#q').value.trim().toLowerCase();
  const region = $('#f-region').value;
  const metro = $('#f-metro').value;
  const favoriteOnly = $('#f-fav').classList.contains('on');
  const sort = $('#f-sort').value;

  const rows = COUNTIES.filter(county => {
    if (region && county.region !== region) return false;
    if (metro && county.metro !== metro) return false;
    if (favoriteOnly && !favs.includes(county.id)) return false;
    if (query) {
      const haystack = [
        county.county, county.seat, county.region, county.metro,
        county.tax && county.tax.officer, county.tax && county.tax.address
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const comparator = {
    name: (a, b) => a.county.localeCompare(b.county),
    pop: (a, b) => (b.pop || 0) - (a.pop || 0),
    region: (a, b) => a.region.localeCompare(b.region) || a.county.localeCompare(b.county)
  }[sort] || (() => 0);
  return rows.sort(comparator);
}

function statusCell(county) {
  const status = checks[county.id];
  if (!status) return '<span class="status none">not checked</span>';
  if (status.pending) return '<span class="status wait">checking…</span>';
  if (status.ok) {
    const title = status.error || ('HTTP ' + (status.code || 'reachable'));
    return `<span class="status ok" title="${esc(title)}">● reachable ${esc(status.code || '')}</span>`;
  }
  const label = esc(status.error || 'unreachable').slice(0, 30);
  return `<span class="status bad" title="${esc(status.error || '')}">● ${label}</span>`;
}

function renderCounties() {
  const rows = filteredCounties();
  $('#shown').textContent = `${rows.length} of ${COUNTIES.length} counties`;
  $('#tbody').innerHTML = rows.map(county => {
    const favorite = favs.includes(county.id);
    const phoneHref = telLink(county.tax.phone);
    return `
      <tr data-id="${esc(county.id)}" class="${county.id === selectedCountyId ? 'sel' : ''}" tabindex="0">
        <td><button class="st ${favorite ? 'on' : ''}" type="button" data-fav="${esc(county.id)}" title="${favorite ? 'Remove favorite' : 'Add favorite'}" aria-label="${favorite ? 'Remove' : 'Add'} ${esc(county.county)} County favorite" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button></td>
        <td><div class="cname">${esc(county.county)} County</div><div class="seat">Seat: ${esc(county.seat || '—')}</div></td>
        <td><span class="badge">${esc(county.region)}</span></td>
        <td>${county.metro ? `<span class="badge metro">${esc(county.metro)}</span>` : '<span class="mono">—</span>'}</td>
        <td class="mono">${fmtPop(county.pop)}</td>
        <td class="mono">${county.tax.phone ? (phoneHref ? `<a class="tlink" href="${phoneHref}" onclick="event.stopPropagation()">${esc(county.tax.phone)}</a>` : esc(county.tax.phone)) : '—'}</td>
        <td>${county.website ? `<a class="tlink" href="${esc(county.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">site ↗</a>` : '—'}</td>
        <td data-status="${esc(county.id)}">${statusCell(county)}</td>
      </tr>`;
  }).join('');
}

function refreshStatuses() {
  $$('[data-status]').forEach(cell => {
    const county = COUNTIES.find(item => item.id === cell.dataset.status);
    if (county) cell.innerHTML = statusCell(county);
  });
}

$('#tbody').addEventListener('click', event => {
  const favoriteButton = event.target.closest('[data-fav]');
  if (favoriteButton) {
    event.stopPropagation();
    const id = favoriteButton.dataset.fav;
    favs = favs.includes(id) ? favs.filter(item => item !== id) : [...favs, id];
    LS.set('favs', favs);
    renderCounties();
    return;
  }
  const row = event.target.closest('tr[data-id]');
  if (row) openDrawer(row.dataset.id);
});

$('#tbody').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    const row = event.target.closest('tr[data-id]');
    if (row && !event.target.closest('button, a')) {
      event.preventDefault();
      openDrawer(row.dataset.id);
    }
  }
});

['#q', '#f-region', '#f-metro', '#f-sort'].forEach(selector => {
  $(selector).addEventListener('input', renderCounties);
});

$('#f-fav').addEventListener('click', event => {
  const active = event.currentTarget.classList.toggle('on');
  event.currentTarget.setAttribute('aria-pressed', active ? 'true' : 'false');
  renderCounties();
});

/* ---------- link verification ---------- */
async function checkOne(county) {
  checks[county.id] = { pending: true };
  refreshStatuses();
  try {
    const response = await fetch('/api/check?id=' + encodeURIComponent(county.id));
    const payload = await response.json();
    checks[county.id] = {
      ok: Boolean(payload.ok),
      code: payload.code || '',
      error: payload.error || '',
      checked: payload.checked || ''
    };
  } catch {
    checks[county.id] = { ok: false, error: 'verification request failed' };
  }
  LS.set('checks', checks);
  refreshStatuses();
}

$('#btn-check').addEventListener('click', async () => {
  const rows = filteredCounties();
  const button = $('#btn-check');
  if (!rows.length) {
    button.textContent = 'No counties in current view';
    setTimeout(() => { button.textContent = '✓ Verify county websites'; }, 1600);
    return;
  }

  button.disabled = true;
  button.textContent = `Verifying… 0/${rows.length}`;
  const bar = $('#prog i');
  $('#prog').style.display = 'block';
  let done = 0;
  const queue = [...rows];
  const concurrency = Math.min(8, rows.length);

  async function worker() {
    while (queue.length) {
      const county = queue.shift();
      await checkOne(county);
      done += 1;
      button.textContent = `Verifying… ${done}/${rows.length}`;
      bar.style.width = `${(done / rows.length) * 100}%`;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  button.disabled = false;
  const bad = rows.filter(county => checks[county.id] && !checks[county.id].ok).length;
  button.textContent = bad ? `✓ Verify county websites (${bad} not confirmed)` : '✓ Verify county websites';
  setTimeout(() => {
    $('#prog').style.display = 'none';
    bar.style.width = '0';
  }, 1500);
});

/* ---------- county CSV export ---------- */
$('#btn-csv').addEventListener('click', () => {
  const rows = filteredCounties();
  const headers = [
    'County', 'Seat', 'Region', 'Metro', 'Population', 'Tax Office Title', 'Officer',
    'Address', 'Phone', 'Fax', 'Website', 'TaxSaleSearch', 'StruckOffSearch'
  ];
  const lines = rows.map(county => [
    county.county + ' County', county.seat, county.region, county.metro, county.pop,
    county.tax.title, county.tax.officer, county.tax.address, county.tax.phone,
    county.tax.fax, county.website, county.search.sale, county.search.struck
  ].map(csvValue).join(','));
  downloadText('texas-tax-sale-counties.csv', headers.map(csvValue).join(',') + '\n' + lines.join('\n'), 'text/csv;charset=utf-8');
});

/* ---------- county drawer ---------- */
function countyChecklist(county) {
  const phone = county.tax.phone || 'the contact shown on the official county site';
  return `
    <ol class="steps">
      <li><b>Confirm the controlling sale material</b>
        <span class="hint">Ask ${esc(phone)} who currently handles delinquent-tax sales for the relevant taxing units and where the judgment, order, notice, active list, cancellations, and resale inventory are posted.</span></li>
      <li><b>Reconcile the exact property</b>
        <span class="hint">Match the cause number, account number, legal description, CAD parcel, map, acreage, minimum bid, parties, and sale status. Do not rely on a street address alone.</span></li>
      <li><b>Verify bidder and payment rules</b>
        <span class="hint">A county may adopt bidder registration under Tax Code §34.011. Confirm the local certificate/form, deadline, buyer/agent requirements, sale format, accepted funds, payment deadline, and deed process from the current notice.</span></li>
      <li><b>Complete title and site diligence</b>
        <span class="hint">Review the court file and recorded instruments; verify taxes, assessments, surviving interests, access, flood risk, utilities, restrictions, buildability, occupancy, environmental issues, and title-insurance requirements.</span></li>
      <li><b>Price before bidding</b>
        <span class="hint">Use a conservative independently supported exit value. Enter the minimum/planned bid and every expected cost in the Deal Dashboard, then set a hard maximum bid.</span></li>
      <li><b>Track deed and redemption milestones</b>
        <span class="hint">Confirm when the purchaser's or taxing unit's deed is filed for record because that filing starts the Chapter 34 redemption period. Get advice before possession, improvements, resale, or title-curative work.</span></li>
    </ol>`;
}

function openDrawer(id) {
  const county = COUNTIES.find(item => item.id === id);
  if (!county) return;
  selectedCountyId = id;
  $$('#tbody tr').forEach(row => row.classList.toggle('sel', row.dataset.id === id));

  const sale = statutorySaleDate();
  const days = sale ? daysUntil(sale) : null;
  const favorite = favs.includes(county.id);
  const phoneHref = telLink(county.tax.phone);
  const when = days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)} days ago`;
  const saleDayLabel = sale && sale.getDay() === 3 ? 'Wednesday holiday exception' : 'first-Tuesday rule';

  $('#drawer-body').innerHTML = `
    <div class="dhead">
      <button class="dclose" type="button" data-close-county aria-label="Close county details">×</button>
      <h2>${esc(county.county)} County</h2>
      <div class="dmeta">Seat: ${esc(county.seat || '—')} · ${esc(county.region)}${county.metro ? ' · ' + esc(county.metro) : ''} · Pop. ${fmtPop(county.pop)}</div>
      <div class="rowbtns">
        <button class="st ${favorite ? 'on' : ''}" type="button" id="dfav" aria-pressed="${favorite}" title="Favorite">${favorite ? '★' : '☆'}</button>
        ${county.website ? `<a class="abtn grn" href="${esc(county.website)}" target="_blank" rel="noopener">County website ↗</a>` : ''}
        ${county.tax.phone && phoneHref ? `<a class="abtn" href="${phoneHref}">Call ${esc(county.tax.phone)}</a>` : ''}
        <button class="abtn gold" type="button" id="dcopy">Copy contact block</button>
      </div>
    </div>
    <div class="sect">
      <div class="sale-date"><span aria-hidden="true">▣</span><div><b>Next statutory sale day: ${sale ? fmtDate(sale) : '—'}</b>
      <span>${saleDayLabel} · ${when}. Confirm that this county has an active sale and verify its designated location or online method and exact time.</span></div></div>
    </div>
    <div class="sect">
      <h3>Who to contact</h3>
      <div class="card">
        <div class="role">${esc(county.tax.title || 'Tax Assessor-Collector')}</div>
        <div class="off">${esc(county.tax.officer || 'See official county directory')}</div>
        <div class="line">Address: ${esc(county.tax.address || 'See county website')}</div>
        ${county.tax.phone ? `<div class="line">Phone: ${phoneHref ? `<a class="tlink" href="${phoneHref}">${esc(county.tax.phone)}</a>` : esc(county.tax.phone)}</div>` : ''}
        ${county.tax.fax ? `<div class="line">Fax: ${esc(county.tax.fax)}</div>` : ''}
        <div class="line mt">Ask which taxing unit, attorney, constable/sheriff, or online host controls the specific property and current sale notice.</div>
      </div>
    </div>
    <div class="sect">
      <h3>Research links — ${esc(county.county)} County</h3>
      <div class="rowbtns">
        <a class="abtn" target="_blank" rel="noopener" href="${esc(county.search.sale)}">Search current tax-sale material</a>
        <a class="abtn" target="_blank" rel="noopener" href="${esc(county.search.struck)}">Search resale / struck-off material</a>
        <a class="abtn" target="_blank" rel="noopener" href="${esc(county.search.constable)}">Search sale officer / host</a>
        <a class="abtn" target="_blank" rel="noopener" href="${esc(county.search.cad)}">Search appraisal district</a>
        <a class="abtn grn" target="_blank" rel="noopener" href="https://taxsales.lgbs.com">Linebarger portal ↗</a>
        <a class="abtn grn" target="_blank" rel="noopener" href="https://www.mvbalaw.com">MVBA portal ↗</a>
        <a class="abtn grn" target="_blank" rel="noopener" href="https://www.pbfcm.com">Perdue portal ↗</a>
      </div>
    </div>
    <div class="sect">
      <h3>Research sequence</h3>
      ${countyChecklist(county)}
    </div>
    <div class="sect">
      <h3>Copy / paste contact block</h3>
      <textarea class="copybox" id="copybox" readonly>${esc(county.county)} County ${esc(county.tax.title)}\n${esc(county.tax.officer)}\n${esc(county.tax.address)}\nPhone: ${esc(county.tax.phone)}${county.tax.fax ? '\nFax: ' + esc(county.tax.fax) : ''}\nWebsite: ${esc(county.website)}\n\nResearch purpose: current delinquent-tax sale notice/order, sale status, bidder rules, payment terms, and resale inventory contacts.\nNext statutory sale day candidate: ${sale ? fmtDate(sale) : '—'} — verify an active sale and local/online details.</textarea>
      <div class="saved" id="copymsg"></div>
    </div>
    <div class="sect">
      <h3>My notes — ${esc(county.county)} County</h3>
      <textarea class="notearea" id="notearea" placeholder="Contact names, dates called, source URLs, registration rules, property leads…">${esc(notes[county.id] || '')}</textarea>
      <div class="saved" id="savemsg"></div>
    </div>`;

  const drawer = $('#drawer');
  drawer.classList.add('on');
  drawer.setAttribute('aria-hidden', 'false');
  $('[data-close-county]').onclick = () => closeDrawer();
  $('#dfav').onclick = () => {
    favs = favs.includes(county.id) ? favs.filter(item => item !== county.id) : [...favs, county.id];
    LS.set('favs', favs);
    renderCounties();
    openDrawer(county.id);
  };
  $('#dcopy').onclick = async () => {
    const textArea = $('#copybox');
    try {
      await navigator.clipboard.writeText(textArea.value);
    } catch {
      textArea.select();
      document.execCommand('copy');
    }
    $('#copymsg').textContent = 'Copied to clipboard ✓';
    setTimeout(() => { if ($('#copymsg')) $('#copymsg').textContent = ''; }, 1800);
  };
  const noteArea = $('#notearea');
  noteArea.addEventListener('input', () => {
    notes[county.id] = noteArea.value;
    LS.set('notes', notes);
    $('#savemsg').textContent = 'Saved ✓';
    clearTimeout(noteArea._saveTimer);
    noteArea._saveTimer = setTimeout(() => {
      if ($('#savemsg')) $('#savemsg').textContent = '';
    }, 1200);
  });
}

function closeDrawer(rerender = true) {
  const drawer = $('#drawer');
  drawer.classList.remove('on');
  drawer.setAttribute('aria-hidden', 'true');
  selectedCountyId = null;
  if (rerender && COUNTIES.length) renderCounties();
}
window.closeDrawer = closeDrawer;

/* ---------- cities view ---------- */
function renderCities() {
  $('#city-tbody').innerHTML = CITIES.map(item => {
    const county = COUNTIES.find(candidate => candidate.county === item.county);
    return `<tr data-id="${county ? esc(county.id) : ''}">
      <td><div class="cname">${esc(item.city)}</div></td>
      <td><span class="badge">${esc(item.county)} County</span></td>
      <td><div class="seat city-note">${esc(item.note)} Verify the specific parcel and current notice.</div></td>
      <td>${county ? `<button class="abtn grn" type="button" data-open="${esc(county.id)}">Open county →</button>` : ''}</td>
    </tr>`;
  }).join('');
}

$('#city-tbody').addEventListener('click', event => {
  const button = event.target.closest('[data-open]');
  if (!button) return;
  activateView('counties');
  openDrawer(button.dataset.open);
});

/* ---------- shared surface for dashboard ---------- */
window.TXSF = {
  $, $$, LS, esc, csvValue, downloadText, fmtDate, daysUntil, statutorySaleDate,
  activateView,
  getCounties: () => COUNTIES,
  getCities: () => CITIES
};

/* ---------- init ---------- */
(async function init() {
  try {
    const [countyResponse, cityResponse] = await Promise.all([
      fetch('/api/counties'), fetch('/api/cities')
    ]);
    if (!countyResponse.ok || !cityResponse.ok) throw new Error('Data endpoint returned an error');
    COUNTIES = await countyResponse.json();
    CITIES = await cityResponse.json();

    const regions = [...new Set(COUNTIES.map(county => county.region))].sort();
    $('#f-region').innerHTML = '<option value="">All regions</option>' + regions.map(region => `<option value="${esc(region)}">${esc(region)}</option>`).join('');
    const metros = [...new Set(COUNTIES.map(county => county.metro).filter(Boolean))].sort();
    $('#f-metro').innerHTML = '<option value="">All metros / rural</option>' + metros.map(metro => `<option value="${esc(metro)}">${esc(metro)}</option>`).join('');

    renderCounties();
    renderCities();
    const sale = statutorySaleDate();
    if (sale) {
      $('#stat-date').textContent = sale.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const days = daysUntil(sale);
      $('#stat-days').textContent = days === 0 ? 'Today' : `${days} days`;
    }
    window.dispatchEvent(new CustomEvent('txsf:dataready', {
      detail: { counties: COUNTIES, cities: CITIES }
    }));
  } catch (error) {
    console.error(error);
    $('#tbody').innerHTML = `<tr><td colspan="8"><div class="load-error"><b>County data could not be loaded.</b><br>${esc(error.message)}</div></td></tr>`;
    $('#shown').textContent = 'data unavailable';
    window.dispatchEvent(new CustomEvent('txsf:dataerror', { detail: { message: error.message } }));
  }
})();
