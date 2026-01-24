const DATASETS = [
  {
    id: "austin",
    label: "Austin",
    city: "Austin",
    datasetId: "fdj4-gpfu",
    datasetName: "Crime Reports",
    endpoint: "https://datahub.austintexas.gov/api/v3/views/fdj4-gpfu/query.json",
    description:
      "Crime Reports (Austin Police) dataset with live rows and monthly comparisons.",
    compareDescription: "2024 vs 2025 incident counts from Occurred Date.",
    dateField: "occ_date",
    compareStart: "2024-01-01T00:00:00.000",
    compareEnd: "2026-01-01T00:00:00.000",
    categoryFields: ["crime_type", "category_description", "ucr_category"],
    locationFields: ["location_type"],
    addressFields: [],
    geoField: null,
    latField: null,
    lonField: null,
    mapCenter: null,
    mapZoom: null,
  },
  {
    id: "dallas",
    label: "Dallas",
    city: "Dallas",
    datasetId: "qv6i-rri7",
    datasetName: "Police Incidents",
    endpoint: "https://www.dallasopendata.com/api/v3/views/qv6i-rri7/query.json",
    description:
      "Police Incidents dataset from Dallas Open Data with live rows and monthly comparisons.",
    compareDescription: "2024 vs 2025 incident counts from Date1 of Occurrence.",
    dateField: "date1",
    dateFieldCast: "floating_timestamp",
    compareStart: "2024-01-01",
    compareEnd: "2026-01-01",
    categoryFields: ["offincident", "signal", "offense"],
    locationFields: ["premise", "location_type", "type_location"],
    addressFields: ["incident_address", "address"],
    geoField: "geocoded_column",
    latField: null,
    lonField: null,
    mapCenter: [32.7767, -96.797],
    mapZoom: 10,
  },
  {
    id: "chicago",
    label: "Chicago",
    city: "Chicago",
    datasetId: "ijzp-q8t2",
    datasetName: "Crimes - 2001 to Present",
    endpoint: "https://data.cityofchicago.org/api/v3/views/ijzp-q8t2/query.json",
    description:
      "Crimes - 2001 to Present dataset from Chicago Data Portal with live rows and monthly comparisons.",
    compareDescription: "2024 vs 2025 incident counts from the Date field.",
    dateField: "date",
    compareStart: "2024-01-01",
    compareEnd: "2026-01-01",
    categoryFields: ["primary_type", "description", "iucr"],
    locationFields: ["location_description"],
    addressFields: ["block"],
    geoField: "location",
    latField: "latitude",
    lonField: "longitude",
    mapCenter: [41.8781, -87.6298],
    mapZoom: 10,
  },
];

const ACTIVE_DATASET_KEY = "activeOpenDataDataset";
const TOKEN_STORAGE_PREFIX = "openDataToken:";
const LEGACY_TOKEN_KEYS = {
  austin: "austinOpenDataToken",
  dallas: "dallasOpenDataToken",
  chicago: "chicagoOpenDataToken",
};

const limitInput = document.getElementById("limitInput");
const searchInput = document.getElementById("searchInput");
const tokenInput = document.getElementById("tokenInput");
const viewSelect = document.getElementById("viewSelect");
const refreshButton = document.getElementById("refreshButton");
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");
const tableWrapper = document.getElementById("tableWrapper");
const tableCard = document.getElementById("tableCard");
const statsSection = document.getElementById("statsSection");
const statsSub = document.getElementById("statsSub");
const dataSpan = document.getElementById("dataSpan");
const latestDate = document.getElementById("latestDate");
const kpiGrid = document.getElementById("kpiGrid");
const trendChart = document.getElementById("trendChart");
const topCategories = document.getElementById("topCategories");
const topLocations = document.getElementById("topLocations");
const topAddresses = document.getElementById("topAddresses");
const topCategoriesCard = document.getElementById("topCategoriesCard");
const topLocationsCard = document.getElementById("topLocationsCard");
const topAddressesCard = document.getElementById("topAddressesCard");
const mapCard = document.getElementById("mapCard");
const mapContainer = document.getElementById("map");
const mapEmpty = document.getElementById("mapEmpty");
const mapSub = document.getElementById("mapSub");
const chartSection = document.getElementById("chartSection");
const chartWrapper = document.getElementById("chartWrapper");
const datasetTabs = document.getElementById("datasetTabs");
const datasetEyebrow = document.getElementById("datasetEyebrow");
const datasetTitle = document.getElementById("datasetTitle");
const datasetSub = document.getElementById("datasetSub");
const datasetEndpoint = document.getElementById("datasetEndpoint");
const datasetMode = document.getElementById("datasetMode");
const chartTitle = document.getElementById("chartTitle");
const chartSub = document.getElementById("chartSub");

const VIEW_MODES = {
  ROWS: "rows",
  MONTHLY: "monthly",
  STATS: "stats",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DEFAULT_COMPARE_START = "2024-01-01T00:00:00.000";
const DEFAULT_COMPARE_END = "2026-01-01T00:00:00.000";

const state = {
  columns: [],
  rows: [],
  activeDatasetId: null,
};

let mapInstance = null;
let mapMarkers = null;

const LEGACY_FALLBACK_TOKENS = {
  austin: typeof window.AUSTIN_APP_TOKEN === "string" ? window.AUSTIN_APP_TOKEN.trim() : "",
  dallas: typeof window.DALLAS_APP_TOKEN === "string" ? window.DALLAS_APP_TOKEN.trim() : "",
  chicago: typeof window.CHICAGO_APP_TOKEN === "string" ? window.CHICAGO_APP_TOKEN.trim() : "",
};

const FALLBACK_TOKENS =
  window.OPEN_DATA_TOKENS && typeof window.OPEN_DATA_TOKENS === "object"
    ? { ...LEGACY_FALLBACK_TOKENS, ...window.OPEN_DATA_TOKENS }
    : { ...LEGACY_FALLBACK_TOKENS };

function tokenStorageKey(datasetId) {
  return `${TOKEN_STORAGE_PREFIX}${datasetId}`;
}

function getStoredToken(datasetId) {
  if (!datasetId) {
    return "";
  }
  const key = tokenStorageKey(datasetId);
  let token = localStorage.getItem(key);

  if (!token && LEGACY_TOKEN_KEYS[datasetId]) {
    token = localStorage.getItem(LEGACY_TOKEN_KEYS[datasetId]);
    if (token) {
      localStorage.setItem(key, token);
    }
  }

  if (!token && FALLBACK_TOKENS[datasetId]) {
    token = String(FALLBACK_TOKENS[datasetId]).trim();
    if (token) {
      localStorage.setItem(key, token);
    }
  }

  return token || "";
}

function setStoredToken(datasetId, token) {
  const key = tokenStorageKey(datasetId);
  if (token) {
    localStorage.setItem(key, token);
  } else {
    localStorage.removeItem(key);
  }
}

function getDatasetById(datasetId) {
  return DATASETS.find((dataset) => dataset.id === datasetId) || DATASETS[0];
}

function getActiveDataset() {
  return getDatasetById(state.activeDatasetId);
}

function syncTokenInput(datasetId) {
  const token = getStoredToken(datasetId);
  tokenInput.value = token;
  const dataset = getDatasetById(datasetId);
  tokenInput.placeholder = dataset
    ? `${dataset.label} app token`
    : "Socrata app token";
}

function updateDatasetUI() {
  const dataset = getActiveDataset();
  if (!dataset) {
    return;
  }

  if (datasetEyebrow) {
    datasetEyebrow.textContent = `City of ${dataset.city} Open Data`;
  }
  if (datasetTitle) {
    datasetTitle.textContent = `${dataset.datasetName} (${dataset.datasetId})`;
  }
  if (datasetSub) {
    datasetSub.textContent = dataset.description;
  }
  if (datasetEndpoint) {
    datasetEndpoint.textContent = `Endpoint: ${dataset.endpoint}`;
  }
  if (datasetMode) {
    datasetMode.textContent = "Mode: Live query";
  }
  if (chartTitle) {
    chartTitle.textContent = `Monthly comparison - ${dataset.label}`;
  }
  if (chartSub) {
    chartSub.textContent = dataset.compareDescription;
  }
}

function renderDatasetTabs() {
  if (!datasetTabs) {
    return;
  }

  datasetTabs.innerHTML = "";
  DATASETS.forEach((dataset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dataset-tab";
    button.textContent = dataset.label;
    button.setAttribute("role", "tab");
    const isActive = dataset.id === state.activeDatasetId;
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      setActiveDataset(dataset.id);
    });
    datasetTabs.appendChild(button);
  });
}

function setActiveDataset(datasetId) {
  const dataset = getDatasetById(datasetId);
  if (state.activeDatasetId === dataset.id) {
    return;
  }
  state.activeDatasetId = dataset.id;
  state.columns = [];
  state.rows = [];
  localStorage.setItem(ACTIVE_DATASET_KEY, dataset.id);
  syncTokenInput(dataset.id);
  updateDatasetUI();
  renderDatasetTabs();
  updateViewMode();
  loadData();
}

function initializeDataset() {
  const storedDatasetId = localStorage.getItem(ACTIVE_DATASET_KEY);
  const initialDatasetId = DATASETS.some((dataset) => dataset.id === storedDatasetId)
    ? storedDatasetId
    : DATASETS[0]?.id;

  state.activeDatasetId = initialDatasetId;
  syncTokenInput(initialDatasetId);
  updateDatasetUI();
  renderDatasetTabs();
}

viewSelect.addEventListener("change", () => {
  updateViewMode();
  loadData();
});

tokenInput.addEventListener("input", () => {
  const token = tokenInput.value.trim();
  setStoredToken(state.activeDatasetId, token);
});

refreshButton.addEventListener("click", () => {
  loadData();
});

searchInput.addEventListener("input", () => {
  if (isRowView()) {
    applyFilters();
  }
});

limitInput.addEventListener("change", () => {
  if (isRowView()) {
    loadData();
  }
});

function isMonthlyCompare() {
  return viewSelect.value === VIEW_MODES.MONTHLY;
}

function isStatsView() {
  return viewSelect.value === VIEW_MODES.STATS;
}

function isRowView() {
  return viewSelect.value === VIEW_MODES.ROWS;
}

function updateViewMode() {
  const monthly = isMonthlyCompare();
  const statsView = isStatsView();
  const rowsView = isRowView();
  limitInput.disabled = !rowsView;
  searchInput.disabled = !rowsView;
  if (chartSection) {
    chartSection.hidden = !monthly;
  }
  if (statsSection) {
    statsSection.hidden = !statsView;
  }
  if (tableCard) {
    tableCard.hidden = !rowsView;
  }
  if (statsView && mapInstance) {
    setTimeout(() => mapInstance.invalidateSize(), 50);
  }
}

function buildRowQuery() {
  let limit = parseInt(limitInput.value, 10);
  if (Number.isNaN(limit) || limit <= 0) {
    limit = 200;
  }
  return `select * limit ${limit}`;
}

function getDateExpression(dataset) {
  const dateField = dataset.dateField;
  return dataset.dateFieldCast ? `${dateField}::${dataset.dateFieldCast}` : dateField;
}

function buildMonthlyQuery(dataset) {
  const dateField = dataset.dateField;
  const dateExpression = getDateExpression(dataset);
  const start = dataset.compareStart || DEFAULT_COMPARE_START;
  const end = dataset.compareEnd || DEFAULT_COMPARE_END;

  return [
    `select date_trunc_ym(${dateExpression}) as month_start, count(*) as count`,
    `where ${dateField} >= '${start}' and ${dateField} < '${end}'`,
    "group by month_start",
    "order by month_start",
  ].join(" ");
}

function buildUrl(dataset, query) {
  const url = new URL(dataset.endpoint);
  url.searchParams.set("query", query);
  const token = tokenInput.value.trim();
  if (token) {
    url.searchParams.set("$$app_token", token);
  }
  return url.toString();
}

function formatDateForSoql(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  let text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.includes(" ") && !text.includes("T")) {
    text = text.replace(" ", "T");
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDisplayDate(date) {
  if (!(date instanceof Date)) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(date) {
  if (!(date instanceof Date)) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function normalizePayload(payload) {
  if (!payload) {
    return { columns: [], rows: [] };
  }

  const metaColumns =
    payload?.data?.columns ||
    payload?.meta?.view?.columns ||
    payload?.columns ||
    [];

  if (Array.isArray(payload?.data?.rows)) {
    const columns = buildColumns(metaColumns, payload.data.rows[0]);
    return { columns, rows: payload.data.rows };
  }

  if (Array.isArray(payload?.rows)) {
    const columns = buildColumns(metaColumns, payload.rows[0]);
    return { columns, rows: payload.rows };
  }

  if (Array.isArray(payload?.data)) {
    const columns = buildColumns(metaColumns, payload.data[0]);
    return { columns, rows: payload.data };
  }

  if (Array.isArray(payload?.results)) {
    const columns = buildColumns(metaColumns, payload.results[0]);
    return { columns, rows: payload.results };
  }

  if (Array.isArray(payload)) {
    const columns = buildColumns(metaColumns, payload[0]);
    return { columns, rows: payload };
  }

  return {
    columns: buildColumns(metaColumns, payload),
    rows: [payload],
  };
}

async function fetchQuery(dataset, query) {
  const response = await fetch(buildUrl(dataset, query), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return normalizePayload(payload);
}

function resolveField(dataset, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const available = new Set(state.columns.map((column) => column.key));
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!available.size || available.has(candidate)) {
      return candidate;
    }
  }
  return candidates[0] || null;
}

function buildColumns(metaColumns, sampleRow) {
  if (Array.isArray(metaColumns) && metaColumns.length > 0) {
    return metaColumns.map((column, index) => ({
      label: column.name || column.fieldName || column.id || `Column ${index + 1}`,
      key: column.fieldName || column.name || column.id || String(index),
      index,
    }));
  }

  if (Array.isArray(sampleRow)) {
    return sampleRow.map((_, index) => ({
      label: `Column ${index + 1}`,
      key: String(index),
      index,
    }));
  }

  if (sampleRow && typeof sampleRow === "object") {
    return Object.keys(sampleRow).map((key, index) => ({
      label: formatLabel(key),
      key,
      index,
    }));
  }

  return [{ label: "Value", key: "value", index: 0 }];
}

function formatLabel(value) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toLocaleString();
}

function parseMonthlyRow(row) {
  if (!row) {
    return null;
  }

  let monthValue;
  let countValue;

  if (Array.isArray(row)) {
    [monthValue, countValue] = row;
  } else if (typeof row === "object") {
    monthValue = row.month_start ?? row.month ?? row.monthStart;
    countValue = row.count ?? row.total;
  }

  if (!monthValue) {
    return null;
  }

  const text = String(monthValue);
  const parts = text.split("-");
  if (parts.length < 2) {
    return null;
  }

  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const count = Number(countValue) || 0;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return null;
  }

  return { year, monthIndex, count };
}

function buildMonthlyComparison(rows) {
  const countsByYear = {
    2024: Array(12).fill(0),
    2025: Array(12).fill(0),
  };

  rows.forEach((row) => {
    const parsed = parseMonthlyRow(row);
    if (!parsed) {
      return;
    }
    const { year, monthIndex, count } = parsed;
    if (year in countsByYear && monthIndex >= 0 && monthIndex < 12) {
      countsByYear[year][monthIndex] = count;
    }
  });

  const comparisonRows = MONTH_LABELS.map((label, index) => {
    const count2024 = countsByYear[2024][index] || 0;
    const count2025 = countsByYear[2025][index] || 0;
    return {
      month: label,
      count2024,
      count2025,
      change: count2025 - count2024,
    };
  });

  const total2024 = countsByYear[2024].reduce((sum, value) => sum + value, 0);
  const total2025 = countsByYear[2025].reduce((sum, value) => sum + value, 0);
  const maxCount = Math.max(...countsByYear[2024], ...countsByYear[2025], 0);

  const totalsRow = {
    month: "Total",
    count2024: total2024,
    count2025: total2025,
    change: total2025 - total2024,
    isTotal: true,
  };

  return {
    columns: [
      { label: "Month", key: "month" },
      { label: "2024", key: "count2024" },
      { label: "2025", key: "count2025" },
      { label: "Change", key: "change" },
    ],
    rows: [...comparisonRows, totalsRow],
    maxCount,
    totals: {
      total2024,
      total2025,
      change: total2025 - total2024,
    },
  };
}

function buildChartSeries(label, value, maxValue, barClass) {
  const series = document.createElement("div");
  series.className = "chart-series";

  const labelEl = document.createElement("span");
  labelEl.className = "chart-series-label";
  labelEl.textContent = label;

  const track = document.createElement("div");
  track.className = "chart-track";

  const bar = document.createElement("div");
  bar.className = `chart-bar ${barClass}`;
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
  bar.style.width = `${width}%`;
  track.appendChild(bar);

  const valueEl = document.createElement("span");
  valueEl.className = "chart-value";
  valueEl.textContent = formatNumber(value);

  series.append(labelEl, track, valueEl);
  return series;
}

function renderMonthlyChart(comparison) {
  if (!chartWrapper) {
    return;
  }

  chartWrapper.innerHTML = "";
  const rows = comparison.rows.filter((row) => !(row && row.isTotal));
  if (!rows.length || comparison.maxCount <= 0) {
    chartWrapper.innerHTML = '<div class="empty-state">No chart data for this range.</div>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "chart-grid";

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "chart-row";

    const label = document.createElement("div");
    label.className = "chart-label";
    label.textContent = row.month;

    const bars = document.createElement("div");
    bars.className = "chart-bars";
    bars.appendChild(buildChartSeries("2024", row.count2024, comparison.maxCount, "chart-bar-2024"));
    bars.appendChild(buildChartSeries("2025", row.count2025, comparison.maxCount, "chart-bar-2025"));

    rowEl.append(label, bars);
    grid.appendChild(rowEl);
  });

  chartWrapper.appendChild(grid);
}

async function ensureColumnsLoaded(dataset) {
  if (state.columns.length) {
    return;
  }
  const { columns } = await fetchQuery(dataset, "select * limit 1");
  state.columns = columns;
}

async function fetchDateRange(dataset, dateExpression) {
  const query = `select min(${dateExpression}) as min_date, max(${dateExpression}) as max_date where ${dateExpression} is not null`;
  const { rows } = await fetchQuery(dataset, query);
  if (!rows.length) {
    return { minDate: null, maxDate: null };
  }
  const row = rows[0];
  const minValue = row.min_date ?? row.min ?? row[0];
  const maxValue = row.max_date ?? row.max ?? row[1];
  return {
    minDate: parseDateValue(minValue),
    maxDate: parseDateValue(maxValue),
  };
}

async function fetchCount(dataset, dateExpression, start, end) {
  const whereParts = [];
  if (start instanceof Date) {
    whereParts.push(`${dateExpression} >= '${formatDateForSoql(start)}'`);
  }
  if (end instanceof Date) {
    whereParts.push(`${dateExpression} < '${formatDateForSoql(end)}'`);
  }
  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";
  const query = `select count(*) as count ${whereClause}`;
  const { rows } = await fetchQuery(dataset, query);
  if (!rows.length) {
    return 0;
  }
  const row = rows[0];
  const value = row.count ?? row.value ?? row[0];
  return Number(value) || 0;
}

async function fetchGroupCounts(dataset, dateExpression, start, end, field, limit = 8) {
  if (!field) {
    return [];
  }
  const whereParts = [
    `${dateExpression} >= '${formatDateForSoql(start)}'`,
    `${dateExpression} < '${formatDateForSoql(end)}'`,
    `${field} is not null`,
    `${field} != ''`,
  ];
  const query = [
    `select ${field} as label, count(*) as count`,
    `where ${whereParts.join(" and ")}`,
    `group by ${field}`,
    "order by count desc",
    `limit ${limit}`,
  ].join(" ");
  const { rows } = await fetchQuery(dataset, query);
  return rows.map((row) => ({
    label: row.label ?? row[0],
    count: Number(row.count ?? row[1] ?? 0) || 0,
  }));
}

async function fetchDailyCounts(dataset, dateExpression, start, end) {
  const query = [
    `select date_trunc_ymd(${dateExpression}) as day, count(*) as count`,
    `where ${dateExpression} >= '${formatDateForSoql(start)}' and ${dateExpression} < '${formatDateForSoql(end)}'`,
    "group by day",
    "order by day",
  ].join(" ");
  const { rows } = await fetchQuery(dataset, query);
  return rows.map((row) => ({
    day: row.day ?? row[0],
    count: Number(row.count ?? row[1] ?? 0) || 0,
  }));
}

function getWeekStart(date) {
  const day = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -day);
}

function buildWeeklyTrend(rows, endExclusive, weeks = 26) {
  if (!(endExclusive instanceof Date)) {
    return [];
  }
  const weekCounts = new Map();
  rows.forEach((row) => {
    const parsed = parseDateValue(row.day ?? row[0]);
    if (!parsed) {
      return;
    }
    const weekStart = getWeekStart(parsed);
    const key = formatDateForSoql(weekStart);
    const current = weekCounts.get(key) || 0;
    weekCounts.set(key, current + (Number(row.count ?? row[1] ?? 0) || 0));
  });

  const endWeekStart = getWeekStart(addDays(endExclusive, -1));
  const startWeekStart = addDays(endWeekStart, -(weeks - 1) * 7);
  const trend = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = addDays(startWeekStart, index * 7);
    const key = formatDateForSoql(weekStart);
    trend.push({
      weekStart,
      label: formatShortDate(weekStart),
      count: weekCounts.get(key) || 0,
    });
  }
  return trend;
}

function renderTrendChart(trend) {
  if (!trendChart) {
    return;
  }
  trendChart.innerHTML = "";
  if (!trend.length) {
    trendChart.innerHTML = '<div class="empty-state">No trend data available.</div>';
    return;
  }
  const maxCount = Math.max(...trend.map((item) => item.count), 0);
  trend.forEach((item) => {
    const row = document.createElement("div");
    row.className = "trend-row";

    const label = document.createElement("span");
    label.className = "trend-label";
    label.textContent = item.label;

    const track = document.createElement("div");
    track.className = "trend-track";

    const bar = document.createElement("div");
    bar.className = "trend-bar";
    const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
    bar.style.width = `${width}%`;
    track.appendChild(bar);

    const value = document.createElement("span");
    value.className = "trend-value";
    value.textContent = formatNumber(item.count);

    row.append(label, track, value);
    trendChart.appendChild(row);
  });
}

function renderKpis(kpis) {
  if (!kpiGrid) {
    return;
  }
  kpiGrid.innerHTML = "";
  if (!kpis.length) {
    kpiGrid.innerHTML = '<div class="empty-state">No summary data available.</div>';
    return;
  }
  kpis.forEach((kpi) => {
    const card = document.createElement("div");
    card.className = "kpi-card";

    const label = document.createElement("div");
    label.className = "kpi-label";
    label.textContent = kpi.label;

    const value = document.createElement("div");
    value.className = "kpi-value";
    value.textContent = formatNumber(kpi.value);

    const meta = document.createElement("div");
    meta.className = "kpi-meta";
    meta.textContent = kpi.meta || "";

    card.append(label, value, meta);
    kpiGrid.appendChild(card);
  });
}

function renderTopList(container, rows) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No data available for this range.</div>';
    return;
  }
  const maxCount = Math.max(...rows.map((row) => row.count), 0);
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "stats-item";

    const label = document.createElement("div");
    label.className = "stats-item-label";
    const labelText = row.label ? String(row.label) : "Not specified";
    label.textContent = truncate(labelText, 48);
    if (labelText.length > 48) {
      label.title = labelText;
    }

    const count = document.createElement("div");
    count.className = "stats-item-count";
    count.textContent = formatNumber(row.count);

    const barTrack = document.createElement("div");
    barTrack.className = "stats-item-bar";
    const barFill = document.createElement("div");
    barFill.className = "stats-item-fill";
    const width = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
    barFill.style.width = `${width}%`;
    barTrack.appendChild(barFill);

    item.append(label, count, barTrack);
    container.appendChild(item);
  });
}

function formatChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) {
    return "n/a";
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${formatNumber(diff)} (${sign}${pct.toFixed(1)}%)`;
}

function hasGeoSupport(dataset) {
  return Boolean(dataset.geoField || (dataset.latField && dataset.lonField));
}

function setMapMessage(message) {
  if (mapEmpty) {
    mapEmpty.textContent = message || "";
    mapEmpty.hidden = !message;
  }
}

function ensureMap(dataset) {
  if (!mapContainer || typeof window.L === "undefined") {
    return null;
  }
  if (!mapInstance) {
    mapInstance = window.L.map(mapContainer, { zoomControl: true, attributionControl: true });
    window.L
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      })
      .addTo(mapInstance);
    mapMarkers = window.L.layerGroup().addTo(mapInstance);
  }

  if (dataset?.mapCenter) {
    mapInstance.setView(dataset.mapCenter, dataset.mapZoom || 10);
  }
  return mapInstance;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseCoordinatePair(text) {
  if (!text) {
    return null;
  }
  const match = String(text).match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (!match) {
    return null;
  }
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  if (Math.abs(a) > 90 || String(text).toUpperCase().includes("POINT")) {
    return { lat: b, lon: a };
  }
  return { lat: a, lon: b };
}

function extractLatLng(row, dataset) {
  if (!row) {
    return null;
  }

  if (dataset.latField && dataset.lonField) {
    const lat = toNumber(row[dataset.latField] ?? row.lat ?? row.latitude);
    const lon = toNumber(row[dataset.lonField] ?? row.lon ?? row.longitude);
    if (lat !== null && lon !== null) {
      return { lat, lon };
    }
  }

  if (dataset.geoField) {
    let value = row[dataset.geoField] ?? row.location ?? row.geo;
    if (!value && Array.isArray(row)) {
      value = row[0];
    }
    if (typeof value === "string") {
      const pair = parseCoordinatePair(value);
      if (pair) {
        return pair;
      }
      try {
        value = JSON.parse(value);
      } catch (error) {
        value = null;
      }
    }
    if (value && typeof value === "object") {
      const lat = toNumber(value.latitude ?? value.lat ?? value.y);
      const lon = toNumber(value.longitude ?? value.lon ?? value.lng ?? value.x);
      if (lat !== null && lon !== null) {
        return { lat, lon };
      }
      if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
        const lonValue = toNumber(value.coordinates[0]);
        const latValue = toNumber(value.coordinates[1]);
        if (latValue !== null && lonValue !== null) {
          return { lat: latValue, lon: lonValue };
        }
      }
    }
  }

  return null;
}

async function fetchMapPoints(dataset, dateExpression, start, end, limit = 800) {
  if (!hasGeoSupport(dataset)) {
    return [];
  }

  const whereParts = [
    `${dateExpression} >= '${formatDateForSoql(start)}'`,
    `${dateExpression} < '${formatDateForSoql(end)}'`,
  ];

  let query = "";
  if (dataset.latField && dataset.lonField) {
    whereParts.push(`${dataset.latField} is not null`);
    whereParts.push(`${dataset.lonField} is not null`);
    query = [
      `select ${dataset.latField} as latitude, ${dataset.lonField} as longitude`,
      `where ${whereParts.join(" and ")}`,
      `limit ${limit}`,
    ].join(" ");
  } else if (dataset.geoField) {
    whereParts.push(`${dataset.geoField} is not null`);
    query = [
      `select ${dataset.geoField} as location`,
      `where ${whereParts.join(" and ")}`,
      `limit ${limit}`,
    ].join(" ");
  }

  if (!query) {
    return [];
  }

  const { rows } = await fetchQuery(dataset, query);
  return rows
    .map((row) => extractLatLng(row, dataset))
    .filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function renderMap(points, dataset) {
  if (!mapCard) {
    return;
  }

  if (!hasGeoSupport(dataset)) {
    mapCard.hidden = true;
    setMapMessage("This dataset does not include location coordinates.");
    return;
  }

  mapCard.hidden = false;
  const map = ensureMap(dataset);
  if (!map) {
    setMapMessage("Map failed to load.");
    return;
  }

  if (!mapMarkers) {
    mapMarkers = window.L.layerGroup().addTo(map);
  } else {
    mapMarkers.clearLayers();
  }

  if (!points.length) {
    setMapMessage("No mapped incidents found for the last 30 days.");
    if (dataset.mapCenter) {
      map.setView(dataset.mapCenter, dataset.mapZoom || 10);
    }
    setTimeout(() => map.invalidateSize(), 50);
    return;
  }

  setMapMessage(`Plotted ${formatNumber(points.length)} incidents in the last 30 days.`);
  points.forEach((point) => {
    window.L.circleMarker([point.lat, point.lon], {
      radius: 4,
      weight: 1,
      color: "#0f766e",
      fillColor: "#0f766e",
      fillOpacity: 0.5,
    }).addTo(mapMarkers);
  });

  const bounds = window.L.latLngBounds(points.map((point) => [point.lat, point.lon]));
  map.fitBounds(bounds, { padding: [24, 24] });
  setTimeout(() => map.invalidateSize(), 50);
}

function getCellValue(row, column) {
  if (Array.isArray(row)) {
    return row[column.index];
  }

  if (row && typeof row === "object") {
    if (column.key in row) {
      return row[column.key];
    }
    if (column.label in row) {
      return row[column.label];
    }
  }

  return row;
}

function formatCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function truncate(value, maxLength = 160) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function rowMatches(row, query) {
  if (!query) {
    return true;
  }
  const normalized = query.toLowerCase();
  return state.columns.some((column) => {
    const value = getCellValue(row, column);
    if (value === null || value === undefined) {
      return false;
    }
    return String(value).toLowerCase().includes(normalized);
  });
}

function renderTable(columns, rows) {
  if (!columns.length || !rows.length) {
    tableWrapper.innerHTML = '<div class="empty-state">No rows found for this query.</div>';
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row && typeof row === "object" && row.isTotal) {
      tr.classList.add("total-row");
    }
    columns.forEach((column) => {
      const td = document.createElement("td");
      const value = formatCell(getCellValue(row, column));
      const displayValue = truncate(value);
      td.textContent = displayValue;
      if (displayValue !== value) {
        td.title = value;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  tableWrapper.innerHTML = "";
  tableWrapper.appendChild(table);
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", type === "error");
}

function applyFilters() {
  if (!state.rows.length || isMonthlyCompare()) {
    return;
  }
  const limit = parseInt(limitInput.value, 10) || 200;
  const search = searchInput.value.trim();
  const filtered = state.rows.filter((row) => rowMatches(row, search));
  const limited = filtered.slice(0, limit);
  renderTable(state.columns, limited);
  statsEl.textContent = `Showing ${limited.length} of ${filtered.length} rows, ${state.columns.length} columns.`;
}

async function loadStats() {
  const dataset = getActiveDataset();
  setStatus("Loading high-level stats...");
  statsEl.textContent = "";

  if (statsSub) {
    statsSub.textContent = `${dataset.datasetName} from ${dataset.city} open data.`;
  }

  if (topCategoriesCard) {
    topCategoriesCard.hidden = true;
  }
  if (topLocationsCard) {
    topLocationsCard.hidden = true;
  }
  if (topAddressesCard) {
    topAddressesCard.hidden = true;
  }
  if (mapCard) {
    mapCard.hidden = !hasGeoSupport(dataset);
  }
  setMapMessage(hasGeoSupport(dataset) ? "Loading map..." : "This dataset does not include location coordinates.");
  if (mapMarkers) {
    mapMarkers.clearLayers();
  }

  try {
    await ensureColumnsLoaded(dataset);

    const dateExpression = getDateExpression(dataset);
    const { minDate, maxDate } = await fetchDateRange(dataset, dateExpression);
    const latestDay = startOfDay(maxDate || new Date());
    const rangeEnd = addDays(latestDay, 1);

    const last7Start = addDays(rangeEnd, -7);
    const last30Start = addDays(rangeEnd, -30);
    const prev30Start = addDays(rangeEnd, -60);
    const prev30End = addDays(rangeEnd, -30);

    const yearStart = new Date(latestDay.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((latestDay - yearStart) / (24 * 60 * 60 * 1000)) + 1;
    const prevYearStart = new Date(latestDay.getFullYear() - 1, 0, 1);
    const prevYearEnd = addDays(prevYearStart, dayOfYear);

    const trendStart = addDays(rangeEnd, -182);

    const categoryField = resolveField(dataset, dataset.categoryFields);
    const locationField = resolveField(dataset, dataset.locationFields);
    const addressField = resolveField(dataset, dataset.addressFields);

    if (mapSub) {
      mapSub.textContent = `Last 30 days: ${formatDisplayDate(last30Start)} → ${formatDisplayDate(
        latestDay
      )}`;
    }

    const [
      last7,
      last30,
      prev30,
      ytd,
      prevYtd,
      allTime,
      dailyCounts,
      categoryRows,
      locationRows,
      addressRows,
      mapPoints,
    ] = await Promise.all([
      fetchCount(dataset, dateExpression, last7Start, rangeEnd),
      fetchCount(dataset, dateExpression, last30Start, rangeEnd),
      fetchCount(dataset, dateExpression, prev30Start, prev30End),
      fetchCount(dataset, dateExpression, yearStart, rangeEnd),
      fetchCount(dataset, dateExpression, prevYearStart, prevYearEnd),
      fetchCount(dataset, dateExpression, null, null),
      fetchDailyCounts(dataset, dateExpression, trendStart, rangeEnd),
      categoryField
        ? fetchGroupCounts(dataset, dateExpression, last30Start, rangeEnd, categoryField, 8)
        : Promise.resolve([]),
      locationField
        ? fetchGroupCounts(dataset, dateExpression, last30Start, rangeEnd, locationField, 8)
        : Promise.resolve([]),
      addressField
        ? fetchGroupCounts(dataset, dateExpression, last30Start, rangeEnd, addressField, 10)
        : Promise.resolve([]),
      hasGeoSupport(dataset)
        ? fetchMapPoints(dataset, dateExpression, last30Start, rangeEnd, 900)
        : Promise.resolve([]),
    ]);

    if (topCategoriesCard) {
      topCategoriesCard.hidden = !categoryField;
    }
    if (topLocationsCard) {
      topLocationsCard.hidden = !locationField;
    }
    if (topAddressesCard) {
      topAddressesCard.hidden = !addressField;
    }

    const trend = buildWeeklyTrend(dailyCounts, rangeEnd, 26);
    renderTrendChart(trend);
    renderTopList(topCategories, categoryRows);
    renderTopList(topLocations, locationRows);
    renderTopList(topAddresses, addressRows);
    renderMap(mapPoints, dataset);

    const last30Change = formatChange(last30, prev30);
    const ytdChange = formatChange(ytd, prevYtd);

    renderKpis([
      { label: "Last 7 days", value: last7, meta: "Latest week" },
      { label: "Last 30 days", value: last30, meta: `vs prior 30 days: ${last30Change}` },
      { label: "Year to date", value: ytd, meta: `vs prior year: ${ytdChange}` },
      { label: "All time", value: allTime, meta: "All recorded incidents" },
    ]);

    if (dataSpan) {
      dataSpan.textContent = minDate
        ? `${formatDisplayDate(minDate)} → ${formatDisplayDate(latestDay)}`
        : "—";
    }

    if (latestDate) {
      const ageDays = Math.round((startOfDay(new Date()) - latestDay) / (24 * 60 * 60 * 1000));
      const freshness =
        ageDays <= 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`;
      latestDate.textContent = `${formatDisplayDate(latestDay)} (${freshness})`;
    }

    setStatus("High-level stats loaded.");
    statsEl.textContent = `Data through ${formatDisplayDate(
      latestDay
    )} · Last 30 days: ${formatNumber(last30)} incidents.`;
  } catch (error) {
    setStatus("Unable to load high-level stats. Add an app token if the API blocks the request.", "error");
    renderKpis([]);
    renderTrendChart([]);
    renderTopList(topCategories, []);
    renderTopList(topLocations, []);
    renderTopList(topAddresses, []);
    setMapMessage("Map unavailable due to an API error.");
    if (mapMarkers) {
      mapMarkers.clearLayers();
    }
  }
}

async function loadData() {
  const dataset = getActiveDataset();
  if (isStatsView()) {
    await loadStats();
    return;
  }

  const monthly = isMonthlyCompare();
  setStatus(monthly ? "Loading monthly comparison..." : "Loading data...");
  statsEl.textContent = "";

  try {
    const query = monthly ? buildMonthlyQuery(dataset) : buildRowQuery();
    const { columns, rows } = await fetchQuery(dataset, query);

    if (monthly) {
      const comparison = buildMonthlyComparison(rows);
      state.columns = comparison.columns;
      state.rows = comparison.rows;

      if (!comparison.rows.length) {
        setStatus("No rows returned from the API.");
        renderTable(comparison.columns, []);
        return;
      }

      setStatus("Monthly comparison loaded.");
      renderTable(comparison.columns, comparison.rows);
      renderMonthlyChart(comparison);
      statsEl.textContent = `2024 total: ${formatNumber(
        comparison.totals.total2024
      )} | 2025 total: ${formatNumber(comparison.totals.total2025)} | Change: ${formatNumber(
        comparison.totals.change
      )}`;
      return;
    }

    state.columns = columns;
    state.rows = rows;

    if (!rows.length) {
      setStatus("No rows returned from the API.");
      renderTable(columns, []);
      return;
    }

    setStatus("Data loaded.");
    applyFilters();
  } catch (error) {
    setStatus("Unable to load data. Add an app token if the API blocks the request.", "error");
    tableWrapper.innerHTML =
      '<div class="empty-state">Request failed. Check the endpoint or provide a token.</div>';
  }
}

initializeDataset();
updateViewMode();
loadData();
