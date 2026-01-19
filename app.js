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
  if (!isMonthlyCompare()) {
    applyFilters();
  }
});

limitInput.addEventListener("change", () => {
  if (!isMonthlyCompare()) {
    loadData();
  }
});

function isMonthlyCompare() {
  return viewSelect.value === VIEW_MODES.MONTHLY;
}

function updateViewMode() {
  const monthly = isMonthlyCompare();
  limitInput.disabled = monthly;
  searchInput.disabled = monthly;
  if (chartSection) {
    chartSection.hidden = !monthly;
  }
}

function buildRowQuery() {
  let limit = parseInt(limitInput.value, 10);
  if (Number.isNaN(limit) || limit <= 0) {
    limit = 200;
  }
  return `select * limit ${limit}`;
}

function buildMonthlyQuery(dataset) {
  const dateField = dataset.dateField;
  const dateExpression = dataset.dateFieldCast
    ? `${dateField}::${dataset.dateFieldCast}`
    : dateField;
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

async function loadData() {
  const monthly = isMonthlyCompare();
  const dataset = getActiveDataset();
  setStatus(monthly ? "Loading monthly comparison..." : "Loading data...");
  statsEl.textContent = "";

  try {
    const query = monthly ? buildMonthlyQuery(dataset) : buildRowQuery();
    const response = await fetch(buildUrl(dataset, query), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (monthly) {
      const { rows } = normalizePayload(payload);
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

    const { columns, rows } = normalizePayload(payload);
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
