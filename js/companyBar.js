class CompanyBar {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      callbacks: _config.callbacks,
      containerWidth: _config.containerWidth,
      containerHeight: _config.containerHeight,
      margin: { top: 25, right: 55, bottom: 90, left: 45 },
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

    const companyCounts = vis.computeMinesPerCompany();
    const maxCompanyCount = d3.max(companyCounts.map(entry => entry.count))

    // Initialize Scales
    vis.xScale = d3.scaleBand().range([0, vis.width]).padding(0.1);
    vis.yScale = d3.scaleLinear()
      .domain([0, maxCompanyCount])
      .range([vis.height, 0]);

    // Initialize Axes
    vis.maxTickValueLength = 15;
    vis.xAxis = d3.axisBottom(vis.xScale)
      .tickSizeOuter(0)
      .tickFormat(d => d.length > vis.maxTickValueLength ? d.slice(0, vis.maxTickValueLength - 3) + '...' : d);

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
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Append axes groups
    vis.xAxisGroup = vis.chart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${vis.height})`)
      .style("font-size", "14px")
      .call(vis.xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end")

    vis.yAxisGroup = vis.chart
      .append("g")
      .attr("class", "y-axis")
      .style("font-size", "14px");

    // Add x-axis label
    vis.chart
      .append("text")
      .attr("class", "x-axis-label axis-label")
      .attr("x", vis.width + vis.config.margin.left - 5)
      .attr("y", vis.height + 45)
      .attr("text-anchor", "end")
      .text("Company");

    // Add y-axis label
    vis.chart
      .append("text")
      .attr("class", "y-axis-label axis-label")
      .attr("x", -30)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .text("Mines");

    // Create the track with distribution visualization
    vis.track = vis.chart
      .append("rect")
      .attr("x", 0)
      .attr("y", vis.height + 60)
      .attr("width", vis.width)
      .attr("height", 12)
      .attr("fill", "#f0f0f0")
      .attr("rx", "7")
      .attr("ry", "7");

    vis.maxSliderWindowSize = 10;
    vis.startIndex = 0;

    // Draggable Window (Slider)
    vis.window = vis.chart
      .append("rect")
      .attr("class", "window")
      .attr("x", 0)
      .attr("y", vis.height + 60)
      .attr("width", vis.width * (vis.maxSliderWindowSize / companyCounts.length))
      .attr("height", 12)
      .attr("fill", companyBarSliderColour)
      .call(
        d3
          .drag()
          .on("drag", function (event) {
            let x = Math.max(
              0,
              Math.min(vis.width - d3.select(this).attr("width"), event.x)
            );
            d3.select(this).attr("x", x);
            vis.startIndex = Math.round((x / vis.width) * vis.totalCompanies);
            vis.updateVis();
          })
      );

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    const minesPerCompany = vis.computeMinesPerCompany();
    vis.totalCompanies = minesPerCompany.length;

    // update the slider min/max and values only once when an update is triggered by some other view
    // this must go first since vis.dataProcessed relies on the slider's values
    if (vis.updateSlider) {
      let start = vis.startIndex;
      let end = vis.startIndex + vis.maxSliderWindowSize;

      // if the endIndex exceeds the maxIndex, try to maintain the window size relative to the end instead
      if (end > vis.totalCompanies) {
        const diff = end - vis.totalCompanies;
        start = Math.max(0, start - diff);
      }

      vis.startIndex = start;
      
      vis.window
        .attr("width", (Math.min(vis.maxSliderWindowSize, vis.totalCompanies) / vis.totalCompanies) * vis.width);

      vis.updateSlider = false;
    }

    vis.dataProcessed = minesPerCompany
      .toSorted((a, b) => {
        switch (vis.config.callbacks.getCompanySortValue()) {
          case 0:
            return b.count - a.count;
          case 1:
            return b.company > a.company ? -1 : 1;
          default:
            console.log("Invalid sort value");
        }})
      .slice(vis.startIndex, vis.startIndex + vis.maxSliderWindowSize);

    // Update domain of scales
    vis.xScale.domain(vis.dataProcessed.map((d) => d.company));

    vis.svg.select(".x-axis").transition().call(vis.xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");

    vis.svg.select(".y-axis").transition().call(vis.yAxis);

    // Update slider position
    vis.window
      .attr("x", (vis.startIndex / vis.totalCompanies) * vis.width);

    vis.renderVis();
  }

  /**
   * Bind data to visual elements (enter-update-exit) and update axes
   */
  renderVis() {
    let vis = this;

    const bars = vis.chart.selectAll(".bar").data(vis.dataProcessed);

    // Add bars
    bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .merge(bars)
      .attr("x", (d) => vis.xScale(d.company))
      .attr("y", (d) => vis.yScale(d.count))
      .attr("width", vis.xScale.bandwidth())
      .attr("height", (d) => vis.height - vis.yScale(d.count))
      .attr("fill", companyBarColour)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("fill", companyBarHoverColour)
          .style("cursor", "pointer");

        const html = `
          <div class="tooltip-title">${d.company}</div>
          <div>${d.count} mines</div>
        `
        showTooltip(event, html);
      })
      .on("mousemove", updateTooltip)
      .on("mouseout", (event) => {
        d3.select(event.currentTarget)
          .attr("fill", companyBarColour)
          .style("cursor", "default");

        hideTooltip();
      })
      .on("click", (event, d) => vis.config.callbacks.toggleCompany(d.company));

    bars
      .transition()
      .attr("x", (d) => vis.xScale(d.company))
      .attr("y", (d) => vis.yScale(d.count))
      .attr("width", vis.xScale.bandwidth())
      .attr("height", (d) => vis.height - vis.yScale(d.count));

    bars.exit().remove();

    // Add the "selected" class to appropriate bars
    vis.chart.selectAll(".bar")
      .classed("selected", (d) => vis.config.callbacks.getSelectedCompany() === d.company)

    // Update the axes
    vis.xAxisGroup.transition().call(vis.xAxis);
    vis.yAxisGroup.transition().call(vis.yAxis);

    // Rotate x-axis labels
    vis.svg.selectAll(".x-axis text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");
  }

  /** 
   * Updates the viewable companies based on input from the slider
   */
  updateCompanies(_startIndex, vis) {
    vis.startIndex = _startIndex;
    vis.updateVis();
  }

  /**
   * Processes data to get mines per company
   */
  computeMinesPerCompany() {
    let vis = this;

    let companyCounts = {};
    vis.data.forEach((d) => {
      for (let i = 1; i <= 6; i++) {
        let company = d[`company${i}`];
        if (company && company !== "N/A") {
          if (!companyCounts[company]) {
            companyCounts[company] = 0;
          }
          companyCounts[company]++;
        }
      }
    });
    
    return Object.entries(companyCounts)
      .map(([company, count]) => ({ company, count }))
  }

}