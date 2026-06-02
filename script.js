// ---------------------- Global state ---------------------- //

const scenarios = [
  { id: "SSP1-2.6", color: "#22c55e" },
  { id: "SSP2-4.5", color: "#eab308" },
  { id: "SSP3-7.0", color: "#f97316" },
  { id: "SSP5-8.5", color: "#ef4444" }
];

const years = d3.range(2015, 2101);

// Selected region (country name or "Global")
let selectedRegion = "Global";

// DOM references
const globalSlider = document.getElementById("global-year-slider");
const globalYearLabel = document.getElementById("global-year-label");
const globalPlayButton = document.getElementById("global-play-button");
const globalResetButton = document.getElementById("global-reset-button");

const comparisonToggle = document.getElementById("comparison-toggle");
const tooltip = d3.select("#tooltip");
const scrollToMapButton = document.getElementById("scroll-to-map");
const selectedRegionLabel = document.getElementById("selected-region-label");
const resetRegionButton = document.getElementById("reset-region-button");
const thermoRegionText = document.getElementById("thermo-region-text");
const lineRegionText = document.getElementById("line-region-text");
const riskNarrativeContainer = d3.select("#risk-narrative");

// Map controls
const mapScenarioSelect = document.getElementById("map-scenario-select");
const mapRiskSelect = document.getElementById("map-risk-select");

// Global year state
let currentYear = 2015;
let mapCurrentYear = 2015;
let playing = false;
let playTimer = null;

// =============================================================
//  LOAD CSV
// =============================================================

let dataByCountry = {}; // dataByCountry[country][scenario][year] = value

d3.csv("data.csv").then(raw => {
  raw.forEach(d => {
    d.year = +d.year;
    d.value = +d.value;

    if (!dataByCountry[d.country]) dataByCountry[d.country] = {};
    if (!dataByCountry[d.country][d.scenario]) dataByCountry[d.country][d.scenario] = {};

    dataByCountry[d.country][d.scenario][d.year] = d.value;
  });

  // After loading real data, initialize everything at currentYear
  if (globalSlider) {
    globalSlider.value = currentYear;
  }
  if (globalYearLabel) {
    globalYearLabel.textContent = `Year: ${currentYear}`;
  }

  updateThermometers(currentYear);
  updateLines();
  updateMapHighlight(currentYear);
});

function syntheticTemp(year, scenarioId, countryName) {
  const c = dataByCountry[countryName] || dataByCountry["Global"];
  if (!c) return 0;

  const s = c[scenarioId];
  if (!s) return 0;

  return s[year] ?? 0;
}

// Precompute global data for scales
const globalData = [];
years.forEach((year) => {
  scenarios.forEach((s) => {
    globalData.push({
      year,
      scenario: s.id,
      temp: syntheticTemp(year, s.id, "Global")
    });
  });
});

const maxTemp = 11;


// ---------------------- Thermometer visualization ---------------------- //

const thermoSvg = d3.select("#thermo-svg");
const thermoWidth = +thermoSvg.attr("width");
const thermoHeight = +thermoSvg.attr("height");
const margin = { top: 30, right: 60, bottom: 70, left: 60 };

const innerWidth = thermoWidth - margin.left - margin.right;
const innerHeight = thermoHeight - margin.top - margin.bottom;

const thermoG = thermoSvg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const yScale = d3
  .scaleLinear()
  .domain([0, Math.max(4.5, maxTemp)])
  .range([innerHeight, 0])
  .nice();

const xScaleThermo = d3
  .scaleBand()
  .domain(scenarios.map((d) => d.id))
  .range([0, innerWidth])
  .padding(0.35);

// Thresholds (Risks)
const thresholds = [
  { value: 2.0, label: "Local Stress", display: "(+2.0°C)" },
  { value: 4.0, label: "National Pressure", display: "(+4.0°C)" },
  { value: 6.0, label: "Societal Instability", display: "(+6.0°C)" },
  { value: 8.0, label: "Transformation Zone", display: "(+8.0°C)" }
];

// Threshold lines
thermoG
  .selectAll(".threshold-line")
  .data(thresholds)
  .enter()
  .append("line")
  .attr("class", "threshold-line")
  .attr("x1", 0)
  .attr("x2", innerWidth)
  .attr("y1", (d) => yScale(d.value))
  .attr("y2", (d) => yScale(d.value))
  .style("stroke", "#9ca3af")
  .style("stroke-dasharray", "3 3")
  .style("opacity", 0.6);

// Threshold labels
thermoG
  .selectAll(".threshold-label")
  .data(thresholds)
  .enter()
  .append("text")
  .attr("class", "threshold-label")
  .attr("x", innerWidth + 6)
  .attr("y", (d) => yScale(d.value) + 3)
  .style("font-size", "10px")
  .style("fill", "#9ca3af")
  .text((d) => d.display);

// Threshold hover interaction
thermoG
  .selectAll(".threshold-line")
  .on("mousemove", (event, d) => {
    tooltip
      .style("display", "block")
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 10}px`)
      .html(`<strong>${d.display}</strong>`);
  })
  .on("mouseleave", () => {
    tooltip.style("display", "none");
  });

// Thermometer groups
const thermoGroups = thermoG
  .selectAll(".thermo-group")
  .data(scenarios)
  .enter()
  .append("g")
  .attr("class", "thermo-group")
  .attr("data-id", (d) => d.id)
  .attr("transform", (d) => `translate(${xScaleThermo(d.id)},0)`);

const thermoWidthBand = xScaleThermo.bandwidth();
const bulbRadius = thermoWidthBand * 0.35;

// Background tube
thermoGroups
  .append("rect")
  .attr("x", thermoWidthBand / 2 - bulbRadius / 2)
  .attr("y", 0)
  .attr("width", bulbRadius)
  .attr("height", innerHeight)
  .attr("fill", "#020617")
  .attr("stroke", "#1f2937")
  .attr("rx", bulbRadius / 2);

// Fill (dynamic)
const thermoFill = thermoGroups
  .append("rect")
  .attr("class", "thermo-fill")
  .attr("x", thermoWidthBand / 2 - bulbRadius / 2 + 2)
  .attr("width", bulbRadius - 4)
  .attr("y", yScale(0))
  .attr("height", innerHeight - yScale(0))
  .attr("fill", (d) => d3.color(d.color).copy({ opacity: 0.9 }));

// Bulb outer
thermoGroups
  .append("circle")
  .attr("cx", thermoWidthBand / 2)
  .attr("cy", innerHeight + bulbRadius * 0.4)
  .attr("r", bulbRadius)
  .attr("fill", "#020617")
  .attr("stroke", "#1f2937");

// Bulb inner
thermoGroups
  .append("circle")
  .attr("cx", thermoWidthBand / 2)
  .attr("cy", innerHeight + bulbRadius * 0.4)
  .attr("r", bulbRadius - 4)
  .attr("fill", (d) => d3.color(d.color).copy({ opacity: 0.9 }));

// Temperature label inside bulb
thermoGroups
  .append("text")
  .attr("class", "thermo-temp-label")
  .attr("x", thermoWidthBand / 2)
  .attr("y", innerHeight + bulbRadius * 0.4 + 4)
  .attr("text-anchor", "middle")
  .style("font-size", "11px")
  .style("fill", "#e5e7eb")
  .text("0.0°C");

// Scenario labels
thermoGroups
  .append("text")
  .attr("class", "thermometer-label")
  .attr("x", thermoWidthBand / 2)
  .attr("y", innerHeight + bulbRadius * 2.1)
  .attr("text-anchor", "middle")
  .style("font-size", "11px")
  .style("fill", "#e5e7eb")
  .text((d) => d.id);

// y-axis
const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}°C`);
thermoG
  .append("g")
  .attr("class", "y-axis")
  .call(yAxis)
  .selectAll("text")
  .style("font-size", "10px")
  .style("fill", "#9ca3af");

thermoG
  .selectAll(".y-axis line, .y-axis path")
  .style("stroke", "#374151");


// ---------------------- Scenario Focus Mode ---------------------- //

let focusedScenario = null;

// Click handler
thermoGroups.on("click", (event, d) => enterScenarioFocus(d.id));

function enterScenarioFocus(scenarioId) {
  if (focusedScenario) return;
  focusedScenario = scenarioId;

  const overlay = d3.select("#scenario-focus-overlay");
  const overlaySvg = d3.select("#scenario-focus-svg");
  overlay
    .style("display", "flex")
    .style("visibility", "visible")
    .style("pointer-events", "auto");

  // Hide original thermometers
  thermoGroups.style("opacity", 0.15);

  // Remove previous clone
  overlaySvg.selectAll("*").remove();

  // Clone thermometer
  const original = d3.select(`.thermo-group[data-id="${scenarioId}"]`);
  const clone = original.node().cloneNode(true);
  const cloneSel = d3.select(overlaySvg.node().appendChild(clone));

  // Make clone fully opaque
  cloneSel.style("opacity", 1);

  // Overlay SVG size
  const svgW = +overlaySvg.attr("width");
  const svgH = +overlaySvg.attr("height");

  // Start + end positions
  const startX = svgW * 0.25;
  const startY = svgH * 0.65;
  const endX = svgW * 0.25;
  const endY = svgH * 0.40;

  // Animate
  cloneSel
    .attr("transform", `translate(${startX},${startY}) scale(1)`)
    .transition()
    .duration(450)
    .ease(d3.easeCubicOut)
    .attr("transform", `translate(${endX},${endY}) scale(2)`);

  // Populate panel
  showScenarioPanel(scenarioId);
}

// Exit focus mode
document
  .getElementById("scenario-focus-exit")
  .addEventListener("click", exitScenarioFocus);

function exitScenarioFocus() {
  if (!focusedScenario) return;

  focusedScenario = null;

  const overlay = d3.select("#scenario-focus-overlay");
  overlay
    .style("display", "none")
    .style("visibility", "hidden")
    .style("pointer-events", "none");

  // Restore original thermometers
  thermoGroups
    .transition()
    .duration(300)
    .style("opacity", 1);
}

// Compute crossing year for a single scenario
function crossingYearSingleScenario(scenarioId, thresholdValue) {
  for (let y = 2020; y <= 2100; y++) {
    if (getTemp(y, scenarioId, selectedRegion) >= thresholdValue) return y;
  }
  return null;
}

// Populate the panel
function showScenarioPanel(scenarioId) {
  const panel = d3.select("#scenario-focus-panel");
  panel.html("");

  panel
    .append("div")
    .style("font-size", "16px")
    .style("margin-bottom", "10px")
    .style("font-weight", "600")
    .text(`${scenarioId} — Threshold Crossings`);

  thresholds.forEach((t) => {
    const year = crossingYearSingleScenario(scenarioId, t.value);
    panel.append("p").html(
      `<strong>${t.display}</strong>: ${
        year
          ? `<span style="color:#fca5a5">${year}</span>`
          : "Not reached by 2100"
      }`
    );
  });
}


// ---------------------- Line chart ---------------------- //

const lineSvg = d3.select("#line-svg");
const lineWidth = +lineSvg.attr("width");
const lineHeight = +lineSvg.attr("height");
const lineMargin = { top: 28, right: 80, bottom: 40, left: 60 };
const lineInnerWidth = lineWidth - lineMargin.left - lineMargin.right;
const lineInnerHeight = lineHeight - lineMargin.top - lineMargin.bottom;

const lineG = lineSvg
  .append("g")
  .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

const xScaleLine = d3
  .scaleLinear()
  .domain(d3.extent(years))
  .range([0, lineInnerWidth]);

const yScaleLine = d3
  .scaleLinear()
  .domain([0, Math.max(4.5, maxTemp)])
  .range([lineInnerHeight, 0])
  .nice();

const xAxisLine = d3.axisBottom(xScaleLine).ticks(8).tickFormat(d3.format("d"));
const yAxisLine = d3.axisLeft(yScaleLine).ticks(6).tickFormat((d) => `${d}°C`);

lineG
  .append("g")
  .attr("transform", `translate(0,${lineInnerHeight})`)
  .call(xAxisLine)
  .selectAll("text")
  .style("font-size", "10px")
  .style("fill", "#9ca3af");

lineG
  .append("g")
  .call(yAxisLine)
  .selectAll("text")
  .style("font-size", "10px")
  .style("fill", "#9ca3af");

lineG
  .selectAll("line,path")
  .style("stroke", "#374151");

// Y‑axis label
lineG.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -lineInnerHeight / 2)
  .attr("y", -46)
  .attr("text-anchor", "middle")
  .style("fill", "#cbd5e1")
  .style("font-size", "12px")
  .text("Temperature Anomaly (°C)");


// Line generator
const lineGen = d3
  .line()
  .x((d) => xScaleLine(d.year))
  .y((d) => yScaleLine(d.temp))
  .curve(d3.curveMonotoneX);

// Draw lines (initially global)
let scenarioLines = lineG
  .selectAll(".scenario-line")
  .data(scenarios)
  .enter()
  .append("path")
  .attr("class", "scenario-line")
  .attr("fill", "none")
  .attr("stroke-width", 2)
  .attr("stroke", (d) => d.color)
  .attr("d", (d) =>
    lineGen(
      years.map((year) => ({
        year,
        temp: syntheticTemp(year, d.id, selectedRegion)
      }))
    )
  );

// Vertical year marker
const yearMarker = lineG
  .append("line")
  .attr("x1", xScaleLine(currentYear))
  .attr("x2", xScaleLine(currentYear))
  .attr("y1", 0)
  .attr("y2", lineInnerHeight)
  .attr("stroke", "#e5e7eb")
  .attr("stroke-width", 1.2)
  .attr("stroke-dasharray", "4 3")
  .attr("opacity", 0.9);


// ---------------------- Scenario checkboxes ---------------------- //

const checkboxContainer = d3.select("#scenario-checkboxes");

scenarios.forEach((s) => {
  const label = checkboxContainer
    .append("label")
    .attr("class", "legend-item-label");

  label
    .append("input")
    .attr("type", "checkbox")
    .attr("checked", true)
    .on("change", function () {
      const visible = this.checked;
      scenarioLines
        .filter((d) => d.id === s.id)
        .transition()
        .style("opacity", visible ? 1 : 0);
    });

  label
    .append("span")
    .text(s.id)
    .style("color", s.color);
});


// ---------------------- Interaction logic ---------------------- //

function getTemp(year, scenarioId, region = selectedRegion) {
  return syntheticTemp(year, scenarioId, region);
}

function updateYearMarker(year) {
  yearMarker
    .transition()
    .duration(200)
    .attr("x1", xScaleLine(year))
    .attr("x2", xScaleLine(year));
}

function updateThermometers(year) {
  currentYear = year;

  if (globalYearLabel) {
    globalYearLabel.textContent = `Year: ${year}`;
  }
  if (globalSlider && +globalSlider.value !== year) {
    globalSlider.value = year;
  }

  thermoFill
    .transition()
    .duration(220)
    .attr("y", (d) => {
      const temp = getTemp(year, d.id);
      return yScale(temp);
    })
    .attr("height", (d) => {
      const temp = getTemp(year, d.id);
      return innerHeight - yScale(temp);
    });

  // Update bulb temperature labels
  thermoGroups
    .selectAll(".thermo-temp-label")
    .text((d) => `${getTemp(year, d.id).toFixed(2)}°C`);

  updateYearMarker(year);
  updateMapHighlight(year);
}

function updateLines() {
  scenarioLines
    .data(scenarios)
    .transition()
    .duration(350)
    .attr("d", (d) =>
      lineGen(
        years.map((year) => ({
          year,
          temp: syntheticTemp(year, d.id, selectedRegion)
        }))
      )
    );
}


// Comparison mode
if (comparisonToggle) {
  comparisonToggle.addEventListener("change", (e) => {
    const on = e.target.checked;
    if (on) {
      thermoGroups.transition().style("opacity", 1);
    } else {
      thermoGroups.transition().style("opacity", (d) =>
        d.id === "SSP2-4.5" ? 1 : 0.25
      );
    }
  });
}

// Scroll to map button
if (scrollToMapButton) {
  scrollToMapButton.addEventListener("click", () => {
    const target = document.getElementById("map-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// ---------------------- World map ---------------------- //

const mapSvg = d3.select("#world-map-svg");
const mapWidth = +mapSvg.attr("width");
const mapHeight = +mapSvg.attr("height");

const projection = d3
  .geoMercator()
  .scale((mapWidth / (2 * Math.PI)) * 0.9)
  .translate([mapWidth / 2, mapHeight / 2]);

const path = d3.geoPath().projection(projection);

let countryPaths;

// Load Natural Earth countries
d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(
  (world) => {
    const countries = topojson.feature(world, world.objects.countries).features;

    countryPaths = mapSvg
      .append("g")
      .selectAll("path")
      .data(countries)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path)
      .on("mousemove", (event, d) => {
        const name = d.properties.name || "Unknown";
        tooltip
          .style("display", "block")
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 10}px`)
          .html(name);
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
      })
      .on("click", (event, d) => {
        const name = d.properties.name || "Unknown";
        selectedRegion = name;
        updateRegionUI();
        updateThermometers(currentYear);
        updateLines();
        highlightSelectedCountry(name);
        updateRiskNarrative(name);

        const thermoSection = document.getElementById("thermo-section");
        if (thermoSection) {
          thermoSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

    // Initial map highlight state
    updateMapHighlight(currentYear);
  }
);

function highlightSelectedCountry(name) {
  if (!countryPaths) return;
  countryPaths.classed("selected", (d) => d.properties.name === name);
}

function updateRegionUI() {
  if (selectedRegion === "Global") {
    selectedRegionLabel.textContent = "Global average";
    resetRegionButton.disabled = true;
    thermoRegionText.innerHTML =
      'Each thermometer represents a CMIP6-style scenario (SSP1–2.6, SSP2–4.5, SSP3–7.0, SSP5–8.5) for the <strong>global average</strong>. Use the year slider or play button to watch how they rise together at first, then split apart as the century unfolds. The number inside each bulb shows the temperature anomaly for that scenario and year.';
    lineRegionText.innerHTML =
      'This line chart shows the same CMIP6 data as the thermometers, currently for the <strong>global average</strong>. The vertical line tracks the current year from the slider above. You can toggle scenarios on and off to focus on specific futures.';
    // Reset risk narrative to placeholder
    riskNarrativeContainer.html(`
      <div class="risk-narrative-title">When does this place cross each risk?</div>
      <p class="risk-narrative-placeholder">
        Select a country on the map above to see when it crosses each risk level in a high‑emissions future
        (SSP5‑8.5) compared to a low‑emissions future (SSP1‑2.6).
      </p>
    `);
  } else {
    selectedRegionLabel.textContent = selectedRegion;
    resetRegionButton.disabled = false;
    thermoRegionText.innerHTML =
      `Each thermometer represents a CMIP6-style scenario (SSP1–2.6, SSP2–4.5, SSP3–7.0, SSP5–8.5) for <strong>${selectedRegion}</strong>. Use the year slider or play button to watch how this country's climate futures diverge over the century. The number inside each bulb shows the temperature anomaly for that scenario and year.`;
    lineRegionText.innerHTML =
      `This linked line chart shows the same CMIP6 data as the thermometers, currently for <strong>${selectedRegion}</strong>. The vertical line tracks the current year from the slider above. You can toggle scenarios on and off to focus on specific futures.`;
  }
}

// Reset region to global
resetRegionButton.addEventListener("click", () => {
  selectedRegion = "Global";
  updateRegionUI();
  updateThermometers(currentYear);
  updateLines();
  highlightSelectedCountry(null);
});

// ---------------------- Map threshold highlighting ---------------------- //

function updateMapHighlight(year) {
  mapCurrentYear = year;

  const scenarioId = mapScenarioSelect.value;
  const thresholdValue = parseFloat(mapRiskSelect.value);

  if (!countryPaths) return;

  countryPaths.classed("risk-highlight", (d) => {
    const name = d.properties.name || "Unknown";
    const temp = syntheticTemp(year, scenarioId, name);
    return temp >= thresholdValue;
  });
}

// Scenario / risk change should recompute highlight
mapScenarioSelect.addEventListener("change", () => {
  updateMapHighlight(currentYear);
});
mapRiskSelect.addEventListener("change", () => {
  updateMapHighlight(currentYear);
});

// ---------------------- Risk narrative ---------------------- //

function crossingYear(country, scenarioId, thresholdValue) {
  for (let y = 2020; y <= 2100; y++) {
    if (syntheticTemp(y, scenarioId, country) >= thresholdValue) return y;
  }
  return null;
}

function updateRiskNarrative(country) {
  riskNarrativeContainer.html("");
  riskNarrativeContainer
    .append("div")
    .attr("class", "risk-narrative-title")
    .text(`When does ${country} cross each risk?`);

  thresholds.forEach((t, i) => {
    const highYear = crossingYear(country, "SSP5-8.5", t.value);
    const lowYear = crossingYear(country, "SSP1-2.6", t.value);

    const p = riskNarrativeContainer.append("p");
    p.html(`
      <strong>${t.display}</strong><br>
      In an extreme emissions future (SSP5‑8.5), ${country} ${
      highYear
        ? `crosses this risk level starting in <strong>${highYear}</strong>.`
        : `never crosses this risk level before 2100.`
    }<br>
      In a low‑emissions future (SSP1‑2.6), ${country} ${
      lowYear
        ? `crosses it in <strong>${lowYear}</strong>.`
        : `never crosses it before 2100.`
    }
    `);
  });
}

// ---------------------- Scroll-triggered section animation ---------------------- //

const observedSections = document.querySelectorAll(".observe");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.15
  }
);

observedSections.forEach((section) => observer.observe(section));


// ---------------------- Global year controls (slider + play + reset) ---------------------- //

if (globalSlider) {
  globalSlider.min = 2015;
  globalSlider.max = 2100;
  globalSlider.value = currentYear;

  globalSlider.addEventListener("input", (e) => {
    const year = +e.target.value;
    updateThermometers(year);
    updateLines();
  });
}

if (globalResetButton) {
  globalResetButton.addEventListener("click", () => {
    if (playTimer) {
      playTimer.stop();
      playTimer = null;
    }
    playing = false;
    if (globalPlayButton) {
      globalPlayButton.textContent = "Play";
    }

    currentYear = 2015;
    if (globalSlider) {
      globalSlider.value = currentYear;
    }
    updateThermometers(currentYear);
    updateLines();
  });
}

if (globalPlayButton) {
  globalPlayButton.addEventListener("click", () => {
    playing = !playing;
    globalPlayButton.textContent = playing ? "Pause" : "Play";

    if (playing) {
      if (playTimer) playTimer.stop();

      playTimer = d3.interval(() => {
        let nextYear = currentYear + 1;

        // Stop at 2100
        if (nextYear > 2100) {
          playing = false;
          globalPlayButton.textContent = "Play";
          if (playTimer) {
            playTimer.stop();
            playTimer = null;
          }
          return;
        }

        currentYear = nextYear;
        if (globalSlider) {
          globalSlider.value = currentYear;
        }
        updateThermometers(currentYear);
        updateLines();
      }, 420);
    } else {
      if (playTimer) {
        playTimer.stop();
        playTimer = null;
      }
    }
  });
}

// Initialize once (in case data is zeroed before CSV load)
updateThermometers(currentYear);
updateLines();
updateMapHighlight(currentYear);
