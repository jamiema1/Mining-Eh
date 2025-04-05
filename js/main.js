const commoditySelect = d3
  .select("#select-order-commodity");

const companySelect = d3
  .select("#select-order-company");

const colourPalette = d3.schemeGreens[7];
const sliderColour = "#3b8bba"

/**
 * Data
 */
let data;
let geoJSONData;

/**
 * Views
 */
let choropleth;
let areaMap;
let commodityBar;
let companyBar;

/**
 * State
 */
let selectedStartYear;
let selectedEndYear;
let selectedProvince;
let selectedCommodities = [];
let selectedCompany;
let selectedMineId;
let commoditySort = 0;
let companySort = 0;

Promise.all([
  d3.csv("./data/mines.csv"),
  d3.json("./data/canada.geo.json"),
]).then(([_data, _geoJSONData]) => {
  data = _data;
  geoJSONData = _geoJSONData.features;

  initializeViews();
  updateData();
});

function initializeViews() {
  // TODO: jma - needs to be updated to support bootstrap breakpoints

  const borderSize = 1;

  const windowWidth = window.innerWidth;
  const paddingMarginWidth = 12
  const usableVizWidth = windowWidth -  2 * (2 * paddingMarginWidth + 2 * borderSize);

  const viewWidth = usableVizWidth / 2;

  const windowHeight = window.innerHeight;
  const marginWidth = 8;
  const titleHeight = 40 + 2 * marginWidth;
  const viewTitleHeight = 24 + 2 * marginWidth + 1;
  const footerHeight = 12;
  const usableVizHeight = windowHeight - 2 * (2 * marginWidth + 2 * borderSize + viewTitleHeight) - titleHeight - footerHeight;

  const mapHeight = usableVizHeight * 2/3;
  const areaMapHeight = usableVizHeight * 1/3;

  const barTokenHeight = 36.5;
  const barHeight = (usableVizHeight - 2 * barTokenHeight) / 2;

  choropleth = new ChoroplethMap(
    {
      parentElement: "#map-container",
      geoJSONData: geoJSONData,
      callbacks: { 
        selectProvince: selectProvince,
        deselectProvince: deselectProvince,
        toggleMine: toggleMine,
      },
      containerWidth: viewWidth,
      containerHeight: mapHeight,
    },
    data
  );

  areaMap = new AreaMap(
    {
      parentElement: "#area-map-container",
      callbacks: { selectTime: selectTime },
      containerWidth: viewWidth,
      containerHeight: areaMapHeight,
      sliderColour: sliderColour,
    },
    data
  );

  commodityBar = new CommodityBar(
    {
      parentElement: "#commodity-bar-container",
      callbacks: { toggleCommodity: toggleCommodity },
      containerWidth: viewWidth,
      containerHeight: barHeight,
      sliderColour: sliderColour,
    },
    data
  );

  companyBar = new CompanyBar(
    {
      parentElement: "#company-bar-container",
      callbacks: { toggleCompany: toggleCompany },
      containerWidth: viewWidth,
      containerHeight: barHeight,
    },
    data
  );
}



/**
 * Returns data based on current filters
 */
function getFilteredData({ ignoreCommodityFilter = false} = {}) {
  return data.filter((d) => {
    const mineIdFilter = selectedMineId === undefined || d.id === selectedMineId;

    const yearFilter = selectedStartYear === undefined || selectedEndYear === undefined || (
      (d.open1 <= selectedEndYear && d.close1 >= selectedStartYear) ||
      (d.open2 <= selectedEndYear && d.close2 >= selectedStartYear) ||
      (d.open3 <= selectedEndYear && d.close3 >= selectedStartYear)
    );

    const provinceFilter = selectedProvince === undefined || (
      d.province === selectedProvince
    );

    const commodityFilter = ignoreCommodityFilter || 
      selectedCommodities.length === 0 || (
      selectedCommodities.includes(d.commodity1) ||
      selectedCommodities.includes(d.commodity2) ||
      selectedCommodities.includes(d.commodity3) ||
      selectedCommodities.includes(d.commodity4) ||
      selectedCommodities.includes(d.commodity5) ||
      selectedCommodities.includes(d.commodity6)
    );

    const companyFilter = selectedCompany === undefined || (
      d.company1 === selectedCompany ||
      d.company2 === selectedCompany ||
      d.company3 === selectedCompany ||
      d.company4 === selectedCompany ||
      d.company5 === selectedCompany ||
      d.company6 === selectedCompany
    );

    return mineIdFilter && yearFilter && provinceFilter && commodityFilter && companyFilter;
  });
}


function validateFilters(filteredData) {
  validateCommodityFilter(filteredData);
  validateCompanyFilter(filteredData);
}

function validateCommodityFilter(filteredData) {
  const commoditySet = filteredData.reduce((set, d) => {
    for (let i = 1; i <= 8; i++) {
      let commodity = d[`commodity${i}`];
      set.add(commodity);
    }
    return set;
  }, new Set());

  const selectedCommoditySet = new Set(selectedCommodities)

  // remove invalid commodity filter pills
  selectedCommoditySet.difference(commoditySet).forEach(commodity => {
    document.getElementById(commodity).remove();
  })

  selectedCommodities = Array.from(new Set(selectedCommodities).intersection(commoditySet))
}


function validateCompanyFilter(filteredData) {
  const companySet = filteredData.reduce((set, d) => {
    for (let i = 1; i <= 6; i++) {
      let commodity = d[`company${i}`];
      set.add(commodity);
    }
    return set;
  }, new Set());

  // remove invalid company filter pills
  if (selectedCompany !== undefined && !companySet.has(selectedCompany)) {
    deselectCompany();
  }
}



/**
 * Updates data in all views based on current filters
 */
function updateData({
  updateTimeSlider = true,
} = {}) {
  const initialFilteredData = getFilteredData();
  validateFilters(initialFilteredData);
  
  // compute filteredData after validating filters
  const filteredData = getFilteredData();

  // Update choropleth map
  choropleth.data = filteredData;
  choropleth.updateVis();

  // Update area map
  areaMap.data = filteredData;
  areaMap.updateSlider = updateTimeSlider;
  areaMap.updateVis();

  // Update commodity bar chart
  commodityBar.data = getFilteredData({ ignoreCommodityFilter : true });
  commodityBar.updateVis();

  // Update company bar chart
  companyBar.data = filteredData;
  companyBar.updateVis();
}

/**
 * Callback Functions
 */

function toggleMine(mineId) {
  if (selectedMineId === mineId) {
    deselectMine(selectedMineId);
  } else {
    if (selectedMineId !== undefined) {
      deselectMine(mineId);
    }
    selectMine(mineId);
  }
}

function selectMine(mineId) {
  selectedMineId = mineId;
  updateData();
}

function deselectMine(mineId) {
  selectedMineId = undefined;
  updateData();
}


function selectTime(startYear, endYear) {
  selectedStartYear = startYear
  selectedEndYear = endYear
  updateData({ updateTimeSlider : false });
}

function selectProvince(province) {
  selectedProvince = province;
  choropleth.config.geoJSONData = [
    geoJSONData.find((feature) => feature.properties.NAME === selectedProvince),
  ];
  updateData();

  hideTooltip();
  d3.select("#map-back-button").style("display", "block");
}

function deselectProvince() {
  selectedProvince = undefined;
  choropleth.config.geoJSONData = geoJSONData;
  choropleth.selectedProvince = undefined;
  updateData();

  d3.select("#map-back-button").style("display", "none");
}



function toggleCommodity(commodity) {
  if (!selectedCommodities.includes(commodity)) {
    selectCommodity(commodity);
  } else {
    deselectCommodity(commodity);
  }
}

function selectCommodity(commodity) {
  selectedCommodities.push(commodity);
  updateData();

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "btn-close filter-list-button";
  closeButton.addEventListener("click", (e) => deselectCommodity(commodity));


  const newFilterItem = document.createElement("div");
  newFilterItem.innerHTML = commodity;
  newFilterItem.id = commodity;
  newFilterItem.className = "filter-list-item px-1 m-1 border rounded-pill";
  newFilterItem.appendChild(closeButton);

  document.getElementById("commodity-filter-list")
    .appendChild(newFilterItem);
}

function deselectCommodity(commodity) {
  selectedCommodities.splice(selectedCommodities.indexOf(commodity), 1);
  updateData();

  document.getElementById(commodity).remove();
}


function toggleCompany(company) {
  if (company === selectedCompany) {
    deselectCompany();
  } else {
    if (selectedCompany !== undefined) {
      deselectCompany();
    }
    selectCompany(company);
  }
}

function selectCompany(company) {
  selectedCompany = company;
  updateData();

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "btn-close filter-list-button";
  closeButton.addEventListener("click", (e) => deselectCompany(company));


  const newFilterItem = document.createElement("div");
  newFilterItem.innerHTML = company;
  newFilterItem.id = company;
  newFilterItem.className = "filter-list-item px-1 m-1 border rounded-pill";
  newFilterItem.appendChild(closeButton);

  document.getElementById("company-filter-list")
    .appendChild(newFilterItem);
}

function deselectCompany() {
  document.getElementById(selectedCompany).remove();
  selectedCompany = undefined;
  updateData();
}



/**
 * Sort Handlers
 */

commoditySelect.on("change", (e) => {
  const sortValue = e.target.value;
  commodityBar.sortValue = +sortValue;
  commodityBar.updateVis();
});

companySelect.on("change", (e) => {
  const sortValue = e.target.value;
  companyBar.sortValue = +sortValue;
  companyBar.updateVis();
});



/**
 * Tooltip Handlers
 */

const tooltipPadding = 20;

function showTooltip(event, html) {
  d3.select("#tooltip")
    .transition()
    .duration(200)
    .style("display", "block")

  d3.select("#tooltip")
    .style("left", `${event.pageX + tooltipPadding}px`)
    .style("top", `${event.pageY + tooltipPadding}px`)
    .html(html);
}

function updateTooltip(event) {
  d3.select("#tooltip")
    .style("left", `${event.pageX + tooltipPadding}px`)
    .style("top", `${event.pageY + tooltipPadding}px`);
}

function hideTooltip() {
  d3.select("#tooltip")
    .transition()
    .duration(500)
    .style("display", "none");
}



/**
 * Resize Handler
 */
window.addEventListener("resize", () => {
  d3.selectAll("svg").remove();
  initializeViews();
});