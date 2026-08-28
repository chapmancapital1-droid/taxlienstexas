/* Deal Dashboard — local property screening, CSV workflow, and transparent buy box */
'use strict';

(() => {
  const app = window.TXSF;
  if (!app) throw new Error('TXSF application shell is unavailable');
  const { $, $$, LS, esc, downloadText, statutorySaleDate } = app;

  const BUYBOX_DEFAULTS = Object.freeze({
    maxAllInPct: 65,
    minProfit: 15000,
    minRoiPct: 30,
    repairContingencyPct: 10
  });

  const NUMERIC_FIELDS = [
    'acres', 'minBid', 'plannedBid', 'cadValue', 'exitValue', 'postSaleTaxes',
    'repairs', 'titleClosing', 'liensAssessments', 'holdingCosts', 'otherCosts'
  ];
  const BOOLEAN_FIELDS = [
    'sourceVerified', 'parcelVerified', 'taxesVerified', 'titleReviewed',
    'accessVerified', 'floodChecked', 'utilitiesChecked', 'redemptionVerified'
  ];
  const RAW_EXPORT_FIELDS = [
    'property', 'account', 'legalDescription', 'countyId', 'propertyType', 'acres',
    'saleType', 'saleDate', 'sourceUrl', 'minBid', 'plannedBid', 'cadValue',
    'exitValue', 'postSaleTaxes', 'repairs', 'titleClosing', 'liensAssessments',
    'holdingCosts', 'otherCosts', 'redemptionClass', 'occupancy', 'accessStatus',
    'floodStatus', 'utilitiesStatus', 'buildabilityStatus', 'titleStatus',
    'federalLienStatus', 'poaStatus', ...BOOLEAN_FIELDS, 'call', 'notes'
  ];

  let counties = app.getCounties();
  let deals = [];
  let settings = normalizeSettings(LS.get('buybox', BUYBOX_DEFAULTS));
  let editingId = null;
  let draftId = null;
  let toastTimer = null;

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      maxAllInPct: clamp(numberOr(source.maxAllInPct, BUYBOX_DEFAULTS.maxAllInPct), 1, 100),
      minProfit: Math.max(0, numberOr(source.minProfit, BUYBOX_DEFAULTS.minProfit)),
      minRoiPct: Math.max(0, numberOr(source.minRoiPct, BUYBOX_DEFAULTS.minRoiPct)),
      repairContingencyPct: clamp(numberOr(source.repairContingencyPct, BUYBOX_DEFAULTS.repairContingencyPct), 0, 100)
    };
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `deal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isoDate(date) {
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, '0');
    const day = String(local.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateFromISO(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function blankDeal(overrides = {}) {
    return normalizeDeal({
      id: makeId(),
      property: '',
      account: '',
      legalDescription: '',
      countyId: '',
      propertyType: 'Vacant land',
      acres: 0,
      saleType: 'auction',
      saleDate: '',
      sourceUrl: '',
      minBid: 0,
      plannedBid: 0,
      cadValue: 0,
      exitValue: 0,
      postSaleTaxes: 0,
      repairs: 0,
      titleClosing: 0,
      liensAssessments: 0,
      holdingCosts: 0,
      otherCosts: 0,
      redemptionClass: 'unknown',
      occupancy: 'unknown',
      accessStatus: 'unknown',
      floodStatus: 'unknown',
      utilitiesStatus: 'unknown',
      buildabilityStatus: 'unknown',
      titleStatus: 'unknown',
      federalLienStatus: 'unknown',
      poaStatus: 'unknown',
      sourceVerified: false,
      parcelVerified: false,
      taxesVerified: false,
      titleReviewed: false,
      accessVerified: false,
      floodChecked: false,
      utilitiesChecked: false,
      redemptionVerified: false,
      call: 'undecided',
      notes: '',
      sample: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    });
  }

  function normalizeDeal(value) {
    const source = value && typeof value === 'object' ? value : {};
    const normalized = {
      id: String(source.id || makeId()),
      property: String(source.property || ''),
      account: String(source.account || ''),
      legalDescription: String(source.legalDescription || ''),
      countyId: String(source.countyId || ''),
      propertyType: String(source.propertyType || 'Vacant land'),
      saleType: ['auction', 'resale'].includes(source.saleType) ? source.saleType : 'auction',
      saleDate: String(source.saleDate || ''),
      sourceUrl: String(source.sourceUrl || ''),
      redemptionClass: ['unknown', '180', '2year', 'expired'].includes(source.redemptionClass) ? source.redemptionClass : 'unknown',
      occupancy: ['unknown', 'vacant', 'occupied'].includes(source.occupancy) ? source.occupancy : 'unknown',
      accessStatus: ['unknown', 'verified', 'no'].includes(source.accessStatus) ? source.accessStatus : 'unknown',
      floodStatus: ['unknown', 'clear', 'sfha', 'floodway'].includes(source.floodStatus) ? source.floodStatus : 'unknown',
      utilitiesStatus: ['unknown', 'verified', 'none'].includes(source.utilitiesStatus) ? source.utilitiesStatus : 'unknown',
      buildabilityStatus: ['unknown', 'verified', 'issue'].includes(source.buildabilityStatus) ? source.buildabilityStatus : 'unknown',
      titleStatus: ['unknown', 'reviewed', 'issue'].includes(source.titleStatus) ? source.titleStatus : 'unknown',
      federalLienStatus: ['unknown', 'none', 'found'].includes(source.federalLienStatus) ? source.federalLienStatus : 'unknown',
      poaStatus: ['unknown', 'none', 'found'].includes(source.poaStatus) ? source.poaStatus : 'unknown',
      call: ['bid', 'watch', 'pass', 'undecided'].includes(source.call) ? source.call : 'undecided',
      notes: String(source.notes || ''),
      sample: source.sample === true,
      createdAt: String(source.createdAt || new Date().toISOString()),
      updatedAt: String(source.updatedAt || new Date().toISOString())
    };
    NUMERIC_FIELDS.forEach(field => { normalized[field] = Math.max(0, numberOr(source[field], 0)); });
    BOOLEAN_FIELDS.forEach(field => { normalized[field] = source[field] === true; });
    return normalized;
  }

  function sampleDeals() {
    const nextSale = statutorySaleDate() || addDays(new Date(), 7);
    const recentlyClosed = addDays(new Date(), -5);
    return [
      blankDeal({
        id: 'sample-go', sample: true,
        property: '123 Demo Ranch Road', account: 'A-100',
        legalDescription: 'Example tract for dashboard orientation only',
        countyId: 'travis', propertyType: 'Vacant land', acres: 2.5,
        saleType: 'auction', saleDate: isoDate(nextSale),
        sourceUrl: 'https://example.com/demo-notice',
        minBid: 20000, plannedBid: 25000, cadValue: 80000, exitValue: 100000,
        postSaleTaxes: 3500, repairs: 5000, titleClosing: 2500,
        liensAssessments: 0, holdingCosts: 3000, otherCosts: 1000,
        redemptionClass: '180', occupancy: 'vacant', accessStatus: 'verified',
        floodStatus: 'clear', utilitiesStatus: 'verified', buildabilityStatus: 'verified',
        titleStatus: 'reviewed', federalLienStatus: 'none', poaStatus: 'none',
        sourceVerified: true, parcelVerified: true, taxesVerified: true,
        titleReviewed: true, accessVerified: true, floodChecked: true,
        utilitiesChecked: true, redemptionVerified: true, call: 'bid',
        notes: 'Demo record. Replace every assumption with verified property research.'
      }),
      blankDeal({
        id: 'sample-hold', sample: true,
        property: '456 Blocked Access Lane', account: 'H-200',
        legalDescription: 'Example risk-heavy property for dashboard orientation only',
        countyId: 'harris', propertyType: 'Residential', acres: 0,
        saleType: 'auction', saleDate: isoDate(recentlyClosed),
        sourceUrl: 'https://example.com/demo-notice',
        minBid: 35000, plannedBid: 40000, cadValue: 85000, exitValue: 70000,
        postSaleTaxes: 3000, repairs: 15000, titleClosing: 4000,
        liensAssessments: 2500, holdingCosts: 3000, otherCosts: 1200,
        redemptionClass: '180', occupancy: 'vacant', accessStatus: 'no',
        floodStatus: 'clear', utilitiesStatus: 'verified', buildabilityStatus: 'verified',
        titleStatus: 'issue', federalLienStatus: 'none', poaStatus: 'none',
        sourceVerified: true, parcelVerified: true, taxesVerified: true,
        titleReviewed: true, accessVerified: true, floodChecked: true,
        utilitiesChecked: true, redemptionVerified: true, call: 'pass',
        notes: 'Demo record showing how access and title issues block a purchase decision.'
      }),
      blankDeal({
        id: 'sample-needs-data', sample: true,
        property: 'Lot 3, Sample Addition', account: 'B-300',
        legalDescription: 'Example incomplete parcel record', countyId: 'bexar',
        propertyType: 'Vacant land', acres: 0, saleType: 'resale', saleDate: '',
        sourceUrl: '', minBid: 8000, plannedBid: 0, cadValue: 30000, exitValue: 0,
        redemptionClass: 'unknown', occupancy: 'unknown', accessStatus: 'unknown',
        floodStatus: 'unknown', utilitiesStatus: 'unknown', buildabilityStatus: 'unknown',
        titleStatus: 'unknown', federalLienStatus: 'unknown', poaStatus: 'unknown',
        sourceVerified: false, parcelVerified: true, taxesVerified: false,
        titleReviewed: false, accessVerified: false, floodChecked: false,
        utilitiesChecked: false, redemptionVerified: false, call: 'watch',
        notes: 'Demo record with missing exit value and open diligence.'
      })
    ];
  }

  function loadDeals() {
    const stored = LS.get('deals', null);
    if (stored === null) {
      deals = sampleDeals();
      persistDeals();
    } else {
      deals = Array.isArray(stored) ? stored.map(normalizeDeal) : [];
    }
  }

  function persistDeals() {
    LS.set('deals', deals);
  }

  function countyFor(deal) {
    return counties.find(county => county.id === deal.countyId) || null;
  }

  function countyName(deal) {
    const county = countyFor(deal);
    return county ? county.county : (deal.countyId ? deal.countyId.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'County needed');
  }

  function analyze(deal) {
    const repairContingency = deal.repairs * settings.repairContingencyPct / 100;
    const nonBidCosts = deal.postSaleTaxes + deal.repairs + repairContingency +
      deal.titleClosing + deal.liensAssessments + deal.holdingCosts + deal.otherCosts;
    const plannedBidValid = !(deal.plannedBid > 0 && deal.minBid > 0 && deal.plannedBid < deal.minBid);
    const bidUsed = deal.plannedBid > 0 ? Math.max(deal.plannedBid, deal.minBid) : deal.minBid;
    const allIn = bidUsed + nonBidCosts;
    const exitValue = deal.exitValue;
    const profit = exitValue > 0 ? exitValue - allIn : null;
    const roiPct = profit !== null && allIn > 0 ? profit / allIn * 100 : null;
    const allInPct = exitValue > 0 ? allIn / exitValue * 100 : null;

    let maxBid = null;
    if (exitValue > 0) {
      const allInLimit = exitValue * settings.maxAllInPct / 100 - nonBidCosts;
      const profitLimit = exitValue - settings.minProfit - nonBidCosts;
      const roiLimit = exitValue / (1 + settings.minRoiPct / 100) - nonBidCosts;
      maxBid = Math.max(0, Math.min(allInLimit, profitLimit, roiLimit));
    }
    const headroom = maxBid === null ? null : maxBid - bidUsed;

    const diligenceChecks = [
      Boolean(deal.countyId), Boolean(deal.saleType), deal.minBid > 0, deal.exitValue > 0,
      deal.sourceVerified, deal.parcelVerified, deal.taxesVerified, deal.titleReviewed,
      deal.accessVerified, deal.floodChecked, deal.utilitiesChecked, deal.redemptionVerified
    ];
    const completeCount = diligenceChecks.filter(Boolean).length;
    const completeness = Math.round(completeCount / diligenceChecks.length * 100);
    const openItems = diligenceChecks.length - completeCount;

    const missingCore = [];
    if (!deal.countyId) missingCore.push('county');
    if (!deal.saleType) missingCore.push('sale type');
    if (!(deal.minBid > 0)) missingCore.push('minimum bid');
    if (!(deal.exitValue > 0)) missingCore.push('exit value');

    const flags = [];
    const flag = (label, severity) => flags.push({ label, severity });
    if (deal.accessStatus === 'no') flag('No verified legal access', 'critical');
    if (deal.titleStatus === 'issue') flag('Title/deed issue found', 'critical');
    if (deal.buildabilityStatus === 'issue') flag('Buildability issue found', 'critical');
    if (deal.floodStatus === 'floodway') flag('Mapped floodway', 'high');
    if (deal.floodStatus === 'sfha') flag('Special flood hazard area', 'high');
    if (deal.utilitiesStatus === 'none') flag('No verified utility path', 'high');
    if (deal.occupancy === 'occupied') flag('Occupied / possession risk', 'high');
    if (deal.federalLienStatus === 'found') flag('Federal interest found', 'high');
    if (deal.poaStatus === 'found') flag('POA/restriction issue found', 'high');
    if (!deal.sourceUrl || !deal.sourceVerified) flag('Source link missing/unverified', 'unverified');
    if (deal.accessStatus === 'unknown') flag('Access unverified', 'unverified');
    if (deal.titleStatus === 'unknown') flag('Title status unverified', 'unverified');
    if (deal.redemptionClass === 'unknown') flag('Redemption class unverified', 'unverified');
    if (deal.floodStatus === 'unknown') flag('Flood status unverified', 'unverified');
    if (deal.plannedBid > 0 && deal.minBid > 0 && deal.plannedBid < deal.minBid) flag('Planned bid below minimum', 'moderate');
    if (deal.cadValue > 0 && deal.exitValue > deal.cadValue * 2.5) flag('Exit far above CAD reference', 'moderate');

    const criticalCount = flags.filter(item => item.severity === 'critical').length;
    const highCount = flags.filter(item => item.severity === 'high').length;
    const moderateCount = flags.filter(item => item.severity === 'moderate').length;
    const unverifiedCount = flags.filter(item => item.severity === 'unverified').length;
    let riskLevel = 'low';
    if (criticalCount) riskLevel = 'critical';
    else if (highCount) riskLevel = 'high';
    else if (missingCore.length || unverifiedCount >= 2) riskLevel = 'unverified';
    else if (moderateCount || unverifiedCount) riskLevel = 'moderate';

    const economicsReady = deal.minBid > 0 && exitValue > 0;
    const meetsEconomics = economicsReady && profit >= settings.minProfit &&
      roiPct >= settings.minRoiPct && allInPct <= settings.maxAllInPct &&
      maxBid !== null && bidUsed <= maxBid && plannedBidValid;

    let recommendation = 'go';
    if (missingCore.length) recommendation = 'needs-data';
    else if (criticalCount || highCount || completeness < 75) recommendation = 'hold';
    else if (!meetsEconomics) recommendation = 'pass';

    let score = null;
    if (economicsReady) {
      const economicsScore =
        (profit >= settings.minProfit ? 15 : 0) +
        (roiPct >= settings.minRoiPct ? 15 : 0) +
        (allInPct <= settings.maxAllInPct ? 10 : 0) +
        (headroom >= 0 ? 5 : 0);
      const diligenceScore = Math.round(completeness * 0.30);
      const riskScore = Math.max(0, 25 - criticalCount * 8 - highCount * 5 - moderateCount * 3 - unverifiedCount * 2);
      score = clamp(economicsScore + diligenceScore + riskScore, 0, 100);
    }

    return {
      bidUsed, repairContingency, nonBidCosts, allIn, profit, roiPct, allInPct,
      maxBid, headroom, plannedBidValid, completeness, completeCount, openItems, missingCore, flags,
      riskLevel, recommendation, meetsEconomics, score
    };
  }

  function money(value, fallback = '—') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(Number(value));
  }

  function percent(value, fallback = '—') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
    return `${Math.round(Number(value))}%`;
  }

  function formatSaleDate(value) {
    const date = dateFromISO(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function relativeSaleDate(value) {
    const date = dateFromISO(value);
    if (!date) return 'date needed';
    const today = new Date();
    const floorToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const floorDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const difference = Math.round((floorDate - floorToday) / 86400000);
    if (difference === 0) return 'today';
    if (difference > 0) return `in ${difference}d`;
    return `${Math.abs(difference)}d ago`;
  }

  function recommendationLabel(value) {
    return {
      go: 'GO', hold: 'HOLD', pass: 'PASS', 'needs-data': 'NEEDS DATA'
    }[value] || value;
  }

  function titleCase(value) {
    return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function readFilters() {
    return {
      query: $('#deal-q').value.trim().toLowerCase(),
      countyId: $('#deal-county').value,
      recommendation: $('#deal-rec').value,
      risk: $('#deal-risk').value,
      call: $('#deal-call').value,
      sort: $('#deal-sort').value
    };
  }

  function getFilteredRecords() {
    const filters = readFilters();
    const records = deals.map(deal => ({ deal, analysis: analyze(deal) })).filter(record => {
      const { deal, analysis } = record;
      if (filters.countyId && deal.countyId !== filters.countyId) return false;
      if (filters.recommendation && analysis.recommendation !== filters.recommendation) return false;
      if (filters.risk && analysis.riskLevel !== filters.risk) return false;
      if (filters.call && deal.call !== filters.call) return false;
      if (filters.query) {
        const haystack = [
          deal.property, deal.account, deal.legalDescription, deal.propertyType,
          countyName(deal), deal.notes
        ].join(' ').toLowerCase();
        if (!haystack.includes(filters.query)) return false;
      }
      return true;
    });

    const descending = (getter, nullValue = -Infinity) => (a, b) => {
      const av = getter(a);
      const bv = getter(b);
      const aa = Number.isFinite(av) ? av : nullValue;
      const bb = Number.isFinite(bv) ? bv : nullValue;
      return bb - aa || a.deal.property.localeCompare(b.deal.property);
    };
    const sorters = {
      score: descending(record => record.analysis.score),
      profit: descending(record => record.analysis.profit),
      roi: descending(record => record.analysis.roiPct),
      'max-bid': descending(record => record.analysis.maxBid),
      diligence: descending(record => record.analysis.completeness),
      'sale-date': (a, b) => {
        const ad = dateFromISO(a.deal.saleDate);
        const bd = dateFromISO(b.deal.saleDate);
        return (ad ? ad.getTime() : Number.MAX_SAFE_INTEGER) -
          (bd ? bd.getTime() : Number.MAX_SAFE_INTEGER) ||
          a.deal.property.localeCompare(b.deal.property);
      }
    };
    records.sort(sorters[filters.sort] || sorters.score);
    return records;
  }

  function callOptions(selected) {
    return ['bid', 'watch', 'pass', 'undecided'].map(value =>
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${titleCase(value)}</option>`
    ).join('');
  }

  function renderRow(record) {
    const { deal, analysis } = record;
    const scoreClass = analysis.score === null ? 'empty' : analysis.score >= 75 ? 'strong' : analysis.score >= 45 ? 'mid' : 'weak';
    const maxBidClass = analysis.headroom !== null && analysis.headroom < 0 ? 'negative' : 'positive';
    const profitClass = analysis.profit !== null && analysis.profit < 0 ? 'negative' : 'positive';
    const flags = analysis.flags.length
      ? analysis.flags.slice(0, 3).map(item => `<span class="risk-flag ${esc(item.severity)}">${esc(item.label)}</span>`).join('')
      : '<span class="no-flags">No current red flags</span>';
    const bidBasis = deal.plannedBid > 0
      ? (analysis.plannedBidValid ? `plan · min ${money(deal.minBid)}` : `plan ${money(deal.plannedBid)} below min; using min`)
      : 'minimum / current';
    const saleType = deal.saleType === 'resale' ? 'Resale / struck-off' : 'Auction';
    const acres = deal.acres > 0 ? ` · ${deal.acres.toLocaleString('en-US', { maximumFractionDigits: 3 })} ac` : '';
    const gapText = analysis.openItems === 0 ? 'core data in' : `${analysis.openItems} core gap${analysis.openItems === 1 ? '' : 's'}`;

    return `<tr data-deal-id="${esc(deal.id)}" tabindex="0">
      <td class="rank-cell">
        <div class="rank-score ${scoreClass}">${analysis.score === null ? '—' : analysis.score}</div>
        <span class="rec-pill rec-${analysis.recommendation}">${recommendationLabel(analysis.recommendation)}</span>
      </td>
      <td class="property-cell">
        <button type="button" class="property-open" data-open-deal="${esc(deal.id)}">${esc(deal.property || 'Untitled property')}</button>
        <div class="deal-sub">Acct ${esc(deal.account || '—')} · ${esc(deal.propertyType || 'type needed')}${acres}${deal.sample ? ' · <span class="sample-tag">demo</span>' : ''}</div>
      </td>
      <td>
        <span class="county-pill">${esc(countyName(deal))} County</span>
        <div class="deal-sub">${saleType} · ${formatSaleDate(deal.saleDate)} · ${relativeSaleDate(deal.saleDate)}</div>
      </td>
      <td class="numeric-cell"><b>${money(analysis.bidUsed)}</b><div class="deal-sub">${bidBasis}</div></td>
      <td class="numeric-cell"><b class="${maxBidClass}">${money(analysis.maxBid)}</b><div class="deal-sub ${maxBidClass}">${analysis.headroom === null ? 'need exit value' : `${money(analysis.headroom)} headroom`}</div></td>
      <td class="numeric-cell"><b>${deal.exitValue > 0 ? money(deal.exitValue) : '—'}</b><div class="deal-sub">CAD ${deal.cadValue > 0 ? money(deal.cadValue) : '—'}</div></td>
      <td class="numeric-cell"><b class="${profitClass}">${money(analysis.profit)}</b><div class="deal-sub ${profitClass}">${percent(analysis.roiPct)} ROI · ${percent(analysis.allInPct)} all-in</div></td>
      <td class="risk-cell"><span class="risk-level risk-${analysis.riskLevel}">${titleCase(analysis.riskLevel)}</span><div class="risk-flags">${flags}</div></td>
      <td class="diligence-cell"><div class="diligence-meta"><b>${analysis.completeness}%</b><span>${gapText}</span></div><div class="meter"><i style="width:${analysis.completeness}%"></i></div></td>
      <td><select class="call-select" data-call-id="${esc(deal.id)}" aria-label="Decision for ${esc(deal.property || 'property')}">${callOptions(deal.call)}</select></td>
    </tr>`;
  }

  function renderKPIs(records) {
    const goRecords = records.filter(record => record.analysis.recommendation === 'go');
    const capital = goRecords.reduce((sum, record) => sum + record.analysis.allIn, 0);
    const spread = goRecords.reduce((sum, record) => sum + (record.analysis.profit || 0), 0);
    const open = records.filter(record => record.analysis.completeness < 75 || record.analysis.missingCore.length).length;
    $('#kpi-properties').textContent = String(records.length);
    $('#kpi-go').textContent = String(goRecords.length);
    $('#kpi-capital').textContent = money(capital, '$0');
    $('#kpi-spread').textContent = money(spread, '$0');
    $('#kpi-open').textContent = String(open);
  }

  function render() {
    const records = getFilteredRecords();
    $('#deal-tbody').innerHTML = records.map(renderRow).join('');
    $('#deal-empty').hidden = records.length > 0;
    $('#deal-shown').textContent = `${records.length} of ${deals.length} ${deals.length === 1 ? 'property' : 'properties'}`;
    $('#deal-tab-count').textContent = String(deals.length);
    $('#sample-banner').hidden = !deals.some(deal => deal.sample);
    renderKPIs(records);
  }

  function populateCountyOptions() {
    const filter = $('#deal-county');
    const current = filter.value;
    filter.innerHTML = '<option value="">All counties</option>' + counties.map(county =>
      `<option value="${esc(county.id)}">${esc(county.county)} County</option>`
    ).join('');
    filter.value = current;
    render();
  }

  function renderBuyBox() {
    $('#bb-allin').value = String(settings.maxAllInPct);
    $('#bb-profit').value = String(settings.minProfit);
    $('#bb-roi').value = String(settings.minRoiPct);
    $('#bb-contingency').value = String(settings.repairContingencyPct);
  }

  function updateBuyBox() {
    settings = normalizeSettings({
      maxAllInPct: $('#bb-allin').value,
      minProfit: $('#bb-profit').value,
      minRoiPct: $('#bb-roi').value,
      repairContingencyPct: $('#bb-contingency').value
    });
    LS.set('buybox', settings);
    render();
    if ($('#deal-form')) updateEditorPreview();
  }

  function showToast(message, tone = 'ok') {
    const toast = $('#deal-toast');
    toast.textContent = message;
    toast.className = `toast on ${tone}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2600);
  }

  function selectedOption(value, expected) {
    return value === expected ? 'selected' : '';
  }

  function checked(value) {
    return value ? 'checked' : '';
  }

  function countyOptions(selectedId) {
    const found = counties.some(county => county.id === selectedId);
    const missing = selectedId && !found ? `<option value="${esc(selectedId)}" selected>${esc(countyName({ countyId: selectedId }))} County (unmatched)</option>` : '';
    return '<option value="">Select county…</option>' + missing + counties.map(county =>
      `<option value="${esc(county.id)}" ${selectedOption(selectedId, county.id)}>${esc(county.county)} County</option>`
    ).join('');
  }

  function researchLinks(deal) {
    const county = countyFor(deal);
    const query = encodeURIComponent([deal.property, deal.legalDescription, county ? county.county + ' County Texas' : 'Texas'].filter(Boolean).join(' '));
    const mapQuery = encodeURIComponent([deal.property, county ? county.county + ' County Texas' : 'Texas'].filter(Boolean).join(', '));
    const links = [];
    if (deal.sourceUrl && /^https?:\/\//i.test(deal.sourceUrl)) links.push(['Current source', deal.sourceUrl, 'grn']);
    if (county && county.website) links.push(['County website', county.website, '']);
    if (county && county.search && county.search.cad) links.push(['CAD search', county.search.cad, '']);
    links.push(['Clerk / deed search', `https://www.google.com/search?q=${query}+county+clerk+official+public+records`, '']);
    links.push(['Map / drive-by', `https://www.google.com/maps/search/?api=1&query=${mapQuery}`, '']);
    links.push(['FEMA flood map', 'https://msc.fema.gov/portal/search', '']);
    links.push(['Texas RRC map', 'https://gis.rrc.texas.gov/GISViewer/', '']);
    return links.map(([label, href, cls]) => `<a class="abtn ${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`).join('');
  }

  function openEditor(id = null) {
    const existing = id ? deals.find(deal => deal.id === id) : null;
    editingId = existing ? existing.id : null;
    const deal = existing ? normalizeDeal(existing) : blankDeal();
    draftId = deal.id;
    const title = existing ? 'Edit property screen' : 'Add property screen';
    const drawer = $('#deal-drawer');

    $('#deal-drawer-body').innerHTML = `
      <form id="deal-form" novalidate>
        <div class="deal-editor-head">
          <div><span class="eyebrow">Decision record</span><h2>${title}</h2><p>Use conservative inputs and mark checks complete only after verification.</p></div>
          <button class="editor-close" type="button" data-close-editor aria-label="Close property editor">×</button>
        </div>

        <div class="editor-preview" id="editor-preview"></div>

        <section class="editor-section">
          <h3>Property and sale</h3>
          <div class="form-grid">
            <label class="span-2">Property / situs / short name *<input name="property" required maxlength="180" value="${esc(deal.property)}" placeholder="123 County Road 100"></label>
            <label>County *<select name="countyId" required>${countyOptions(deal.countyId)}</select></label>
            <label>Account number<input name="account" maxlength="100" value="${esc(deal.account)}"></label>
            <label>Property type<input name="propertyType" maxlength="100" value="${esc(deal.propertyType)}" placeholder="Vacant land"></label>
            <label>Acres<input name="acres" type="number" min="0" step="0.001" inputmode="decimal" value="${deal.acres || ''}"></label>
            <label>Sale type<select name="saleType"><option value="auction" ${selectedOption(deal.saleType, 'auction')}>Auction</option><option value="resale" ${selectedOption(deal.saleType, 'resale')}>Resale / struck-off</option></select></label>
            <label>Sale / offer date<input name="saleDate" type="date" value="${esc(deal.saleDate)}"></label>
            <label class="span-2">Source URL<input name="sourceUrl" type="url" maxlength="1000" value="${esc(deal.sourceUrl)}" placeholder="https://official-notice-or-list.example"></label>
            <label class="span-2">Legal description<textarea name="legalDescription" rows="3" maxlength="2000" placeholder="Paste and reconcile the full legal description">${esc(deal.legalDescription)}</textarea></label>
          </div>
          <div class="research-links">${researchLinks(deal)}</div>
        </section>

        <section class="editor-section">
          <h3>Bid, value, and cost assumptions</h3>
          <div class="form-grid money-grid">
            <label>Minimum bid<input name="minBid" type="number" min="0" step="100" inputmode="decimal" value="${deal.minBid || ''}"></label>
            <label>Planned bid<input name="plannedBid" type="number" min="0" step="100" inputmode="decimal" value="${deal.plannedBid || ''}" placeholder="Uses minimum when blank"></label>
            <label>CAD reference value<input name="cadValue" type="number" min="0" step="500" inputmode="decimal" value="${deal.cadValue || ''}"></label>
            <label>Verified exit value<input name="exitValue" type="number" min="0" step="500" inputmode="decimal" value="${deal.exitValue || ''}"></label>
            <label>Post-sale / current taxes<input name="postSaleTaxes" type="number" min="0" step="100" inputmode="decimal" value="${deal.postSaleTaxes || ''}"></label>
            <label>Repairs / cleanup<input name="repairs" type="number" min="0" step="100" inputmode="decimal" value="${deal.repairs || ''}"></label>
            <label>Title / closing / resale<input name="titleClosing" type="number" min="0" step="100" inputmode="decimal" value="${deal.titleClosing || ''}"></label>
            <label>Liens / assessments allowance<input name="liensAssessments" type="number" min="0" step="100" inputmode="decimal" value="${deal.liensAssessments || ''}"></label>
            <label>Holding / insurance<input name="holdingCosts" type="number" min="0" step="100" inputmode="decimal" value="${deal.holdingCosts || ''}"></label>
            <label>Other costs<input name="otherCosts" type="number" min="0" step="100" inputmode="decimal" value="${deal.otherCosts || ''}"></label>
          </div>
          <p class="form-hint">Repair contingency (${settings.repairContingencyPct}%) is calculated automatically on top of the repair/cleanup estimate.</p>
        </section>

        <section class="editor-section">
          <h3>Legal and physical risk screen</h3>
          <div class="form-grid">
            <label>Redemption class<select name="redemptionClass">
              <option value="unknown" ${selectedOption(deal.redemptionClass, 'unknown')}>Unverified</option>
              <option value="180" ${selectedOption(deal.redemptionClass, '180')}>General 180-day class</option>
              <option value="2year" ${selectedOption(deal.redemptionClass, '2year')}>General 2-year class</option>
              <option value="expired" ${selectedOption(deal.redemptionClass, 'expired')}>Verified expired / not applicable</option>
            </select></label>
            <label>Occupancy<select name="occupancy">
              <option value="unknown" ${selectedOption(deal.occupancy, 'unknown')}>Unverified</option>
              <option value="vacant" ${selectedOption(deal.occupancy, 'vacant')}>Verified vacant</option>
              <option value="occupied" ${selectedOption(deal.occupancy, 'occupied')}>Occupied / possession issue</option>
            </select></label>
            <label>Legal access<select name="accessStatus">
              <option value="unknown" ${selectedOption(deal.accessStatus, 'unknown')}>Unverified</option>
              <option value="verified" ${selectedOption(deal.accessStatus, 'verified')}>Verified</option>
              <option value="no" ${selectedOption(deal.accessStatus, 'no')}>No verified legal access</option>
            </select></label>
            <label>Flood mapping<select name="floodStatus">
              <option value="unknown" ${selectedOption(deal.floodStatus, 'unknown')}>Unverified</option>
              <option value="clear" ${selectedOption(deal.floodStatus, 'clear')}>Checked / no mapped SFHA</option>
              <option value="sfha" ${selectedOption(deal.floodStatus, 'sfha')}>Special flood hazard area</option>
              <option value="floodway" ${selectedOption(deal.floodStatus, 'floodway')}>Mapped floodway</option>
            </select></label>
            <label>Utilities path<select name="utilitiesStatus">
              <option value="unknown" ${selectedOption(deal.utilitiesStatus, 'unknown')}>Unverified</option>
              <option value="verified" ${selectedOption(deal.utilitiesStatus, 'verified')}>Verified feasible</option>
              <option value="none" ${selectedOption(deal.utilitiesStatus, 'none')}>No verified feasible path</option>
            </select></label>
            <label>Buildability / use<select name="buildabilityStatus">
              <option value="unknown" ${selectedOption(deal.buildabilityStatus, 'unknown')}>Unverified</option>
              <option value="verified" ${selectedOption(deal.buildabilityStatus, 'verified')}>Verified for intended use</option>
              <option value="issue" ${selectedOption(deal.buildabilityStatus, 'issue')}>Issue found</option>
            </select></label>
            <label>Title / deed review<select name="titleStatus">
              <option value="unknown" ${selectedOption(deal.titleStatus, 'unknown')}>Unverified</option>
              <option value="reviewed" ${selectedOption(deal.titleStatus, 'reviewed')}>Reviewed / no screen blocker</option>
              <option value="issue" ${selectedOption(deal.titleStatus, 'issue')}>Issue found</option>
            </select></label>
            <label>Federal interest<select name="federalLienStatus">
              <option value="unknown" ${selectedOption(deal.federalLienStatus, 'unknown')}>Unverified</option>
              <option value="none" ${selectedOption(deal.federalLienStatus, 'none')}>None found in screen</option>
              <option value="found" ${selectedOption(deal.federalLienStatus, 'found')}>Federal interest found</option>
            </select></label>
            <label>POA / restrictions<select name="poaStatus">
              <option value="unknown" ${selectedOption(deal.poaStatus, 'unknown')}>Unverified</option>
              <option value="none" ${selectedOption(deal.poaStatus, 'none')}>No screen blocker found</option>
              <option value="found" ${selectedOption(deal.poaStatus, 'found')}>Issue / claim found</option>
            </select></label>
          </div>
        </section>

        <section class="editor-section">
          <h3>Core diligence gate</h3>
          <div class="check-grid">
            <label><input type="checkbox" name="sourceVerified" ${checked(deal.sourceVerified)}> Active source / sale status verified</label>
            <label><input type="checkbox" name="parcelVerified" ${checked(deal.parcelVerified)}> Parcel identity reconciled</label>
            <label><input type="checkbox" name="taxesVerified" ${checked(deal.taxesVerified)}> Taxes / charges verified</label>
            <label><input type="checkbox" name="titleReviewed" ${checked(deal.titleReviewed)}> Court file / title reviewed</label>
            <label><input type="checkbox" name="accessVerified" ${checked(deal.accessVerified)}> Legal access verified</label>
            <label><input type="checkbox" name="floodChecked" ${checked(deal.floodChecked)}> Flood mapping checked</label>
            <label><input type="checkbox" name="utilitiesChecked" ${checked(deal.utilitiesChecked)}> Utilities / wastewater checked</label>
            <label><input type="checkbox" name="redemptionVerified" ${checked(deal.redemptionVerified)}> Redemption class verified</label>
          </div>
        </section>

        <section class="editor-section">
          <h3>Decision and notes</h3>
          <div class="form-grid">
            <label>My call<select name="call">${callOptions(deal.call)}</select></label>
            <label class="span-2">Notes<textarea name="notes" rows="5" maxlength="5000" placeholder="Open questions, contact log, comps, title notes, bid rationale…">${esc(deal.notes)}</textarea></label>
          </div>
        </section>

        <div class="editor-actions">
          ${existing ? '<button class="btn danger" type="button" id="deal-delete">Delete</button>' : ''}
          ${existing ? '<button class="btn" type="button" id="deal-duplicate">Duplicate</button>' : ''}
          <span class="editor-spacer"></span>
          <button class="btn" type="button" data-close-editor>Cancel</button>
          <button class="btn primary" type="submit">Save property</button>
        </div>
      </form>`;

    drawer.classList.add('on');
    drawer.setAttribute('aria-hidden', 'false');
    $('#deal-backdrop').hidden = false;
    document.body.classList.add('deal-editor-open');
    $$('[data-close-editor]', drawer).forEach(button => button.addEventListener('click', closeEditor));

    const form = $('#deal-form');
    form.addEventListener('input', updateEditorPreview);
    form.addEventListener('change', updateEditorPreview);
    form.addEventListener('submit', saveEditor);
    if (existing) {
      $('#deal-delete').addEventListener('click', deleteEditorDeal);
      $('#deal-duplicate').addEventListener('click', duplicateEditorDeal);
    }
    updateEditorPreview();
    setTimeout(() => $('[name="property"]', form).focus(), 50);
  }

  function formToDeal() {
    const form = $('#deal-form');
    if (!form) return null;
    const formData = new FormData(form);
    const existing = editingId ? deals.find(deal => deal.id === editingId) : null;
    const value = {
      ...(existing || {}),
      id: draftId || makeId(),
      sample: existing ? existing.sample : false,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    [
      'property', 'account', 'legalDescription', 'countyId', 'propertyType', 'saleType',
      'saleDate', 'sourceUrl', 'redemptionClass', 'occupancy', 'accessStatus',
      'floodStatus', 'utilitiesStatus', 'buildabilityStatus', 'titleStatus',
      'federalLienStatus', 'poaStatus', 'call', 'notes'
    ].forEach(field => { value[field] = String(formData.get(field) || '').trim(); });
    NUMERIC_FIELDS.forEach(field => { value[field] = Math.max(0, numberOr(formData.get(field), 0)); });
    BOOLEAN_FIELDS.forEach(field => { value[field] = formData.has(field); });
    return normalizeDeal(value);
  }

  function updateEditorPreview() {
    const deal = formToDeal();
    if (!deal) return;
    const analysis = analyze(deal);
    const flags = analysis.flags.slice(0, 2).map(item => esc(item.label)).join(' · ') || 'No current screen flags';
    $('#editor-preview').innerHTML = `
      <div><span>Recommendation</span><b class="preview-rec rec-text-${analysis.recommendation}">${recommendationLabel(analysis.recommendation)}</b></div>
      <div><span>Calculated max bid</span><b>${money(analysis.maxBid)}</b></div>
      <div><span>All-in at bid used</span><b>${money(analysis.allIn)}</b></div>
      <div><span>Projected profit / ROI</span><b>${money(analysis.profit)} · ${percent(analysis.roiPct)}</b></div>
      <div class="preview-wide"><span>Diligence ${analysis.completeness}% · Risk ${titleCase(analysis.riskLevel)}</span><small>${flags}</small></div>`;
  }

  function saveEditor(event) {
    event.preventDefault();
    const form = $('#deal-form');
    if (!form.reportValidity()) return;
    const deal = formToDeal();
    if (!deal.property) {
      showToast('Property name is required.', 'error');
      return;
    }
    const index = deals.findIndex(item => item.id === editingId);
    if (index >= 0) deals[index] = deal;
    else deals.push(deal);
    persistDeals();
    closeEditor();
    render();
    showToast(index >= 0 ? 'Property screen updated.' : 'Property screen added.');
  }

  function deleteEditorDeal() {
    const deal = deals.find(item => item.id === editingId);
    if (!deal) return;
    if (!window.confirm(`Delete “${deal.property || 'this property'}”? This cannot be undone unless you exported a CSV.`)) return;
    deals = deals.filter(item => item.id !== editingId);
    persistDeals();
    closeEditor();
    render();
    showToast('Property screen deleted.');
  }

  function duplicateEditorDeal() {
    const source = formToDeal();
    if (!source) return;
    const copy = normalizeDeal({
      ...source,
      id: makeId(),
      property: `${source.property || 'Untitled property'} (copy)`,
      sample: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    deals.push(copy);
    persistDeals();
    render();
    openEditor(copy.id);
    showToast('Duplicate created.');
  }

  function closeEditor() {
    const drawer = $('#deal-drawer');
    drawer.classList.remove('on');
    drawer.setAttribute('aria-hidden', 'true');
    $('#deal-backdrop').hidden = true;
    document.body.classList.remove('deal-editor-open');
    editingId = null;
    draftId = null;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n') {
        row.push(cell.replace(/\r$/, ''));
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.some(value => value !== '')) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function parseBoolean(value) {
    return ['1', 'true', 'yes', 'y', 'checked', 'complete'].includes(String(value || '').trim().toLowerCase());
  }

  function importRow(headers, row) {
    const source = {};
    headers.forEach((header, index) => { source[header] = row[index] ?? ''; });
    const alias = (...names) => {
      for (const name of names) {
        const value = source[normalizeHeader(name)];
        if (value !== undefined && String(value).trim() !== '') return String(value).trim();
      }
      return '';
    };

    const property = alias('property', 'address', 'situs', 'propertyname');
    if (!property) return null;
    const countyRaw = alias('countyId', 'county', 'countyname').replace(/\s+county$/i, '');
    const county = counties.find(item => item.id.toLowerCase() === countyRaw.toLowerCase() || item.county.toLowerCase() === countyRaw.toLowerCase());
    const deal = blankDeal({
      property,
      account: alias('account', 'accountnumber', 'parcelid'),
      legalDescription: alias('legalDescription', 'legal', 'legaldesc'),
      countyId: county ? county.id : countyRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      propertyType: alias('propertyType', 'type') || 'Vacant land',
      saleType: /resale|struck|otc/i.test(alias('saleType')) ? 'resale' : 'auction',
      saleDate: alias('saleDate', 'date'),
      sourceUrl: alias('sourceUrl', 'source', 'noticeUrl'),
      redemptionClass: alias('redemptionClass') || 'unknown',
      occupancy: alias('occupancy') || 'unknown',
      accessStatus: alias('accessStatus', 'access') || 'unknown',
      floodStatus: alias('floodStatus', 'flood') || 'unknown',
      utilitiesStatus: alias('utilitiesStatus', 'utilities') || 'unknown',
      buildabilityStatus: alias('buildabilityStatus', 'buildability') || 'unknown',
      titleStatus: alias('titleStatus', 'title') || 'unknown',
      federalLienStatus: alias('federalLienStatus', 'federalLien') || 'unknown',
      poaStatus: alias('poaStatus', 'poa') || 'unknown',
      call: alias('call', 'decision') || 'undecided',
      notes: alias('notes'),
      sample: false
    });
    NUMERIC_FIELDS.forEach(field => {
      const raw = alias(field);
      deal[field] = Math.max(0, numberOr(String(raw).replace(/[$,%\s]/g, ''), 0));
    });
    BOOLEAN_FIELDS.forEach(field => { deal[field] = parseBoolean(alias(field)); });
    return normalizeDeal(deal);
  }

  async function importCSV(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('CSV needs a header row and at least one property row');
      const headers = rows[0].map(normalizeHeader);
      const imported = rows.slice(1, 10001).map(row => importRow(headers, row)).filter(Boolean);
      const skipped = Math.max(0, rows.length - 1 - imported.length);
      if (!imported.length) throw new Error('No rows contained a property/address value');
      deals.push(...imported);
      persistDeals();
      render();
      showToast(`Imported ${imported.length} ${imported.length === 1 ? 'property' : 'properties'}${skipped ? `; skipped ${skipped}` : ''}.`);
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error');
    } finally {
      $('#deal-file').value = '';
    }
  }

  function exportCSV() {
    const records = getFilteredRecords();
    if (!records.length) {
      showToast('No properties in the current view to export.', 'error');
      return;
    }
    const computed = [
      'recommendation', 'score', 'riskLevel', 'diligencePct', 'bidUsed',
      'repairContingency', 'nonBidCosts', 'allIn', 'calculatedMaxBid',
      'headroom', 'projectedProfit', 'projectedRoiPct', 'allInPct', 'riskFlags'
    ];
    const headers = [...RAW_EXPORT_FIELDS, ...computed];
    const lines = records.map(({ deal, analysis }) => {
      const raw = RAW_EXPORT_FIELDS.map(field => deal[field]);
      const calculated = [
        recommendationLabel(analysis.recommendation), analysis.score ?? '',
        titleCase(analysis.riskLevel), analysis.completeness, analysis.bidUsed,
        analysis.repairContingency, analysis.nonBidCosts, analysis.allIn,
        analysis.maxBid ?? '', analysis.headroom ?? '', analysis.profit ?? '',
        analysis.roiPct ?? '', analysis.allInPct ?? '',
        analysis.flags.map(item => item.label).join(' | ')
      ];
      return [...raw, ...calculated].map(app.csvValue).join(',');
    });
    downloadText('texas-property-decision-view.csv', headers.map(app.csvValue).join(',') + '\n' + lines.join('\n'), 'text/csv;charset=utf-8');
    showToast(`Exported ${records.length} property ${records.length === 1 ? 'record' : 'records'}.`);
  }

  function downloadTemplate() {
    const sample = blankDeal({
      property: 'Example Only - Replace Me', account: 'ABC-123', countyId: 'travis',
      propertyType: 'Vacant land', acres: 1.25, saleType: 'auction',
      saleDate: isoDate(statutorySaleDate() || addDays(new Date(), 7)),
      sourceUrl: 'https://official-source.example/current-notice', minBid: 10000,
      plannedBid: 12000, cadValue: 35000, exitValue: 45000,
      postSaleTaxes: 1500, repairs: 2000, titleClosing: 2500,
      liensAssessments: 0, holdingCosts: 1500, otherCosts: 500,
      redemptionClass: '180', occupancy: 'vacant', accessStatus: 'verified',
      floodStatus: 'clear', utilitiesStatus: 'verified', buildabilityStatus: 'verified',
      titleStatus: 'reviewed', federalLienStatus: 'none', poaStatus: 'none',
      sourceVerified: true, parcelVerified: true, taxesVerified: true,
      titleReviewed: true, accessVerified: true, floodChecked: true,
      utilitiesChecked: true, redemptionVerified: true, call: 'watch',
      notes: 'Template row only. Replace with verified research.'
    });
    const row = RAW_EXPORT_FIELDS.map(field => sample[field]).map(app.csvValue).join(',');
    downloadText('texas-property-screen-template.csv', RAW_EXPORT_FIELDS.map(app.csvValue).join(',') + '\n' + row + '\n', 'text/csv;charset=utf-8');
    showToast('CSV template downloaded.');
  }

  function resetFilters() {
    $('#deal-q').value = '';
    $('#deal-county').value = '';
    $('#deal-rec').value = '';
    $('#deal-risk').value = '';
    $('#deal-call').value = '';
    $('#deal-sort').value = 'score';
    render();
  }

  function wireEvents() {
    ['#deal-q', '#deal-county', '#deal-rec', '#deal-risk', '#deal-call', '#deal-sort'].forEach(selector => {
      $(selector).addEventListener(selector === '#deal-q' ? 'input' : 'change', render);
    });
    ['#bb-allin', '#bb-profit', '#bb-roi', '#bb-contingency'].forEach(selector => {
      $(selector).addEventListener('input', updateBuyBox);
    });
    $('#bb-reset').addEventListener('click', () => {
      settings = { ...BUYBOX_DEFAULTS };
      LS.set('buybox', settings);
      renderBuyBox();
      render();
      showToast('Buy box reset to defaults.');
    });
    $('#deal-add').addEventListener('click', () => openEditor());
    $('#deal-import').addEventListener('click', () => $('#deal-file').click());
    $('#deal-file').addEventListener('change', event => importCSV(event.target.files[0]));
    $('#deal-export').addEventListener('click', exportCSV);
    $('#deal-template').addEventListener('click', downloadTemplate);
    $('#deal-reset-filters').addEventListener('click', resetFilters);
    $('#deal-backdrop').addEventListener('click', closeEditor);
    $('#remove-samples').addEventListener('click', () => {
      const count = deals.filter(deal => deal.sample).length;
      if (!count) return;
      if (!window.confirm(`Remove ${count} demo ${count === 1 ? 'record' : 'records'}?`)) return;
      deals = deals.filter(deal => !deal.sample);
      persistDeals();
      render();
      showToast('Demo records removed.');
    });

    $('#deal-tbody').addEventListener('click', event => {
      const callSelect = event.target.closest('[data-call-id]');
      if (callSelect) {
        event.stopPropagation();
        return;
      }
      const opener = event.target.closest('[data-open-deal]');
      const row = event.target.closest('tr[data-deal-id]');
      const id = opener ? opener.dataset.openDeal : row ? row.dataset.dealId : null;
      if (id) openEditor(id);
    });
    $('#deal-tbody').addEventListener('change', event => {
      const select = event.target.closest('[data-call-id]');
      if (!select) return;
      const deal = deals.find(item => item.id === select.dataset.callId);
      if (!deal) return;
      deal.call = select.value;
      deal.updatedAt = new Date().toISOString();
      persistDeals();
      render();
    });
    $('#deal-tbody').addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, select, a, input')) {
        const row = event.target.closest('tr[data-deal-id]');
        if (row) {
          event.preventDefault();
          openEditor(row.dataset.dealId);
        }
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && $('#deal-drawer').classList.contains('on')) closeEditor();
    });
  }

  function init() {
    loadDeals();
    renderBuyBox();
    wireEvents();
    populateCountyOptions();
    render();
  }

  window.addEventListener('txsf:dataready', event => {
    counties = event.detail.counties || [];
    populateCountyOptions();
  });
  window.addEventListener('txsf:deals-view', render);

  window.TXSFDealDashboard = { closeEditor, render, analyze };
  init();
})();
