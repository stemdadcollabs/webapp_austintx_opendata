const API_URL = "https://datahub.austintexas.gov/api/v3/views/fdj4-gpfu/query.json";
const STORAGE_KEY = "austinOpenDataToken";

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

const COMPARE_START = "2024-01-01T00:00:00.000";
const COMPARE_END = "2026-01-01T00:00:00.000";

const state = {
  columns: [],
  rows: [],
};

const storedToken = localStorage.getItem(STORAGE_KEY);
const fallbackToken =
  typeof window.AUSTIN_APP_TOKEN === "string" ? window.AUSTIN_APP_TOKEN.trim() : "";

if (storedToken) {
  tokenInput.value = storedToken;
} else if (fallbackToken) {
  tokenInput.value = fallbackToken;
  localStorage.setItem(STORAGE_KEY, fallbackToken);
}

tokenInput.addEventListener("change", () => {
  const token = tokenInput.value.trim();
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
});

viewSelect.addEventListener("change", () => {
  updateViewMode();
  loadData();
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

function buildMonthlyQuery() {
  return [
    "select date_trunc_ym(occ_date) as month_start, count(*) as count",
    `where occ_date >= '${COMPARE_START}' and occ_date < '${COMPARE_END}'`,
    "group by month_start",
    "order by month_start",
  ].join(" ");
}

function buildUrl(query) {
  const url = new URL(API_URL);
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
  setStatus(monthly ? "Loading monthly comparison..." : "Loading data...");
  statsEl.textContent = "";

  try {
    const query = monthly ? buildMonthlyQuery() : buildRowQuery();
    const response = await fetch(buildUrl(query), {
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
      statsEl.textContent = `2024 total: ${comparison.totals.total2024} | 2025 total: ${comparison.totals.total2025} | Change: ${comparison.totals.change}`;
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

updateViewMode();
loadData();
