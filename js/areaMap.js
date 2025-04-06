class AreaMap {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      callbacks: { selectTime: selectTime },
      containerWidth: _config.containerWidth,
      containerHeight: _config.containerHeight,
      margin: { top: 35, right: 25, bottom: 65, left: 45 },
    };
    this.data = _data;
    this.initVis();
  }
  
  /**
   * Initialize the scales, axes, and append static elements
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size excluding margin
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Initialize Scales
    vis.xScale = d3.scaleLinear().range([0, vis.width]);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    // Initialize Axes
    vis.maxXAxisTicks = 10;
    vis.xAxis = d3.axisBottom(vis.xScale)
      .ticks(vis.maxXAxisTicks)
      .tickSizeOuter(0)
      .tickFormat(d3.format("d"));

    vis.maxYAxisTicks = 4;
    vis.yAxis = d3.axisLeft(vis.yScale)
      .ticks(vis.maxYAxisTicks)
      .tickSizeOuter(0)
      .tickFormat(d3.format("d"));

    // Define dimensions of svg
    vis.svg = d3.select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

      
    // Define and position chart area
    vis.chart = vis.svg.append("g")
      .attr("transform", `translate(${vis.config.margin.left}, ${vis.config.margin.top})`);

    // Append axes groups
    vis.xAxisGroup = vis.chart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${vis.height})`)
      .style("font-size", "12px");

    vis.yAxisGroup = vis.chart
      .append("g")
      .attr("class", "y-axis")
      .style("font-size", "12px");

    // Add y-axis label
    vis.chart
      .append("text")
      .attr("class", "y-axis-label axis-label")
      .attr("x", -30)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .text("Mines");

    // Initialize area
    vis.area = d3
      .area()
      .x((d) => vis.xScale(d.year))
      .y0(vis.height)
      .y1((d) => vis.yScale(d.count));

    // Initialize start and end years for slider
    vis.startYear = 1810
    vis.endYear = 2022

    // Initialize slider
    vis.slider = d3
      .sliderBottom()
      .min(vis.startYear)
      .max(vis.endYear)
      .width(vis.width)
      .tickFormat(d3.format("d"))
      .ticks(0)
      .step(1)
      .default([vis.startYear, vis.endYear])
      .fill(areaMapSliderColour)
      .on("onchange", ([startYear, endYear]) => {
        // do not update start/end years if we are updating slider
        // this allows us to revert back to the previously selected endpoints if no further selection is made
        if (!vis.updateSlider) {
          vis.startYear = startYear;
          vis.endYear = endYear;
          vis.config.callbacks.selectTime(startYear, endYear);
        }
      });

    // Append slider 
    vis.sliderGroup = vis.chart
      .append("g")
      .attr("class", "slider")
      .attr("transform", `translate(0, ${vis.height + 35})`);

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;
    
    // update the slider min/max and values only once when an update is triggered by some other view
    // this must go first since vis.dataProcessed relies on the slider's values
    if (vis.updateSlider) {
      const [minYearSlider, maxYearSlider] = vis.computeMinMaxSliderYears(vis.data);

      vis.slider
        .min(minYearSlider)
        .max(maxYearSlider)
        .value([
          Math.max(Math.min(vis.slider.value()[0], vis.startYear), minYearSlider), 
          Math.min(Math.max(vis.slider.value()[1], vis.endYear), maxYearSlider)
        ]);
      vis.updateSlider = false;
    }

    // Process data to get mines per year
    vis.dataProcessed = vis.computeMinesPerYear()
      .toSorted((a, b) => a.year - b.year);
    
    // Update domain of scales
    vis.xScale.domain(d3.extent(vis.dataProcessed, (d) => d.year));
    vis.yScale.domain([0, d3.max(vis.dataProcessed, (d) => d.count)]);

    const minYear = vis.xScale.domain()[0];
    const maxYear = vis.xScale.domain()[1];
    const yearRange = maxYear - minYear;
    const xTicks = Math.min(yearRange, vis.maxXAxisTicks);

    const mineCountRange = vis.yScale.domain()[1] - vis.yScale.domain()[0];
    const yTicks = Math.min(mineCountRange, vis.maxYAxisTicks);

    // Update axes ticks
    vis.xAxis.ticks(xTicks);
    vis.yAxis.ticks(yTicks);

    vis.renderVis();
  }

  /**
   * Bind data to visual elements (enter-update-exit) and update axes
   */
  renderVis() {
    let vis = this;
    
    // Remove old path and draw new path
    vis.chart.selectAll(".area-path").remove();
    vis.chart
      .append("path")
      .datum(vis.dataProcessed)
      .attr("class", "area-path")
      .attr("fill", areaMapColour)
      .attr("d", vis.area);
    
    // Update the axes
    vis.xAxisGroup.transition().call(vis.xAxis);
    vis.yAxisGroup.transition().call(vis.yAxis);

    // Update the slider
    vis.sliderGroup.call(vis.slider);
    
    vis.sliderGroup
      .selectAll(".parameter-value text")
      .style("font-size", "11px")
      .attr("y", 15)
      .style("font-weight", "500");
  }

  /**
   * Computes the number of mines per year
   */
  computeMinesPerYear() {
    let vis = this;

    const yearCounts = new Map();

    // initialize counts to zero so the path properly draws any
    // un-updated values at 0 rather than interpolating the values 
    for (let year = vis.slider.value()[0]; year <= vis.slider.value()[1]; year++) {
      yearCounts.set(year, 0);
    }

    vis.data.forEach((d) => vis.getValidOpenCloseYears(d)
      .forEach(({ open, close }) => {
        const startYear = Math.max(+open, vis.slider.value()[0]);
        const endYear = Math.min(+close, vis.slider.value()[1]);

        for (let year = startYear; year <= endYear; year++) {
          yearCounts.set(year, yearCounts.get(year) + 1);
        }
      })
    );

    return Array.from(yearCounts, ([year, count]) => ({ year, count }));
  }

  /**
   * Computes the min and max years for the entire dataset
   */
  computeMinMaxSliderYears(data) {
    let vis = this;

    let minYear = 2022;
    let maxYear = 1810;

    data.forEach((d) => vis.getValidOpenCloseYears(d)
      .forEach(({ open, close }) => {
        minYear = Math.min(minYear, +open)
        maxYear = Math.max(maxYear, +close)
      })
    );

    return [minYear, maxYear]
  }

  /**
   * Computes the list of valid open/close year pairs
   */
  getValidOpenCloseYears(d) {
    const yearPairs = [
      { open: d.open1, close: d.close1 },
      { open: d.open2, close: d.close2 },
      { open: d.open3, close: d.close3 },
    ]
    return yearPairs.filter(({ open, close }) => open !== "N/A" && close !== "N/A")
  }
}
