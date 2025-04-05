class CompanyBar {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      callbacks: _config.callbacks,
      containerWidth: _config.containerWidth,
      containerHeight: _config.containerHeight,
      margin: { top: 25, right: 70, bottom: 90, left: 60 },
    };
    this.sortValue = 0;
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
    vis.xScale = d3.scaleBand().range([0, vis.width]).padding(0.1);
    vis.yScale = d3.scaleLinear()
      .domain([0, 14]) // statically defined
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
      .attr("x", -40)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .text("Mines");

    let allCompanyCounts = {};
    vis.data.forEach((d) => {
      for (let i = 1; i <= 6; i++) {
        let company = d[`company${i}`];
        if (company && company !== "N/A") {
          if (!allCompanyCounts[company]) {
            allCompanyCounts[company] = 0;
          }
          allCompanyCounts[company]++;
        }
      }
    });

    let distributionData = Object.entries(allCompanyCounts)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);

    // Create the track with distribution visualization
    vis.track = vis.chart
      .append("rect")
      .attr("x", 0)
      .attr("y", vis.height + 60)
      .attr("width", vis.width)
      .attr("height", 15)
      .attr("fill", "#f0f0f0")
      .attr("rx", "7")
      .attr("ry", "7");

    // Draggable Window (Slider)
    vis.window = vis.chart
      .append("rect")
      .attr("class", "window")
      .attr("x", 0)
      .attr("y", vis.height + 60)
      .attr("width", vis.width * (10 / distributionData.length))
      .attr("height", 15)
      .attr("fill", "orange")
      .call(
        d3
          .drag()
          .on("drag", function (event) {
            let x = Math.max(
              0,
              Math.min(vis.width - d3.select(this).attr("width"), event.x)
            );
            d3.select(this).attr("x", x);
            vis.startIndex = Math.round((x / vis.width) * vis.data.length);
            vis.endIndex = vis.startIndex + 10;
            vis.updateVis();
          })
      );

    vis.startIndex = 0;
    vis.endIndex = 10;

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    // Process data to get mines per company
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

    vis.companyCountEntries = Object.entries(companyCounts)
    
    vis.dataProcessed = vis.companyCountEntries
      .map(([company, count]) => ({ company, count }))
      .toSorted((a, b) => {
        switch (vis.sortValue) {
          case 0:
            return b.count - a.count;
          case 1:
            return b.company > a.company ? -1 : 1;
          default:
            console.log("Invalid sort value");
        }})
      .slice(vis.startIndex, vis.endIndex);

    // Update domain of scales
    vis.xScale.domain(vis.dataProcessed.map((d) => d.company));

    vis.svg.select(".x-axis").transition().call(vis.xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");

    vis.svg.select(".y-axis").transition().call(vis.yAxis);

    // clear the track and draw the new bars
    vis.window
      .attr("x", (vis.startIndex / vis.data.length) * vis.width)
      .attr("width", (Math.min(10, vis.data.length) / vis.data.length) * vis.width);

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
      .attr("fill", "steelblue")
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("fill", "orange")
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
          .attr("fill", "steelblue")
          .style("cursor", "auto");

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

    vis.chart.selectAll(".bar")
      .classed("selected", (d) => selectedCompany === d.company)

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

}