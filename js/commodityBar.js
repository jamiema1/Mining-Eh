class CommodityBar {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      callbacks: _config.callbacks,
      containerWidth: _config.containerWidth,
      containerHeight: _config.containerHeight,
      margin: { top: 25, right: 55, bottom: 85, left: 45 },
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
    vis.xScale = d3.scaleBand().range([0, vis.width]).padding(0.1);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    // Initialize Axes
    vis.maxXAxisTicks = 20;
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
      .style("font-size", "14px");

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
      .text("Commodity");

    // Add y-axis label
    vis.chart
      .append("text")
      .attr("class", "y-axis-label axis-label")
      .attr("x", -30)
      .attr("y", -15)
      .attr("text-anchor", "start")
      .text("Mines");

    // Initialize start and end indices for slider
    vis.startIndex = 0;
    vis.endIndex = 10;

    // Initialize slider
    vis.slider = d3
      .sliderBottom()
      .min(0)
      .width(vis.width)
      .ticks(0)
      .step(1)
      .default([vis.startIndex, vis.endIndex])
      .fill(commodityBarSliderColour)
      .tickFormat((d) => "")
      .on("onchange", ([_startIndex, _endIndex]) => {
        if (!vis.updateSlider) {
          // prevent the user from moving the slider endpoints on top of each other
          if (_startIndex === _endIndex) {
            _startIndex > vis.startIndex ? _startIndex-- : _endIndex++;
            vis.slider.value([_startIndex, _endIndex])
          }

          vis.startIndex = _startIndex;
          vis.endIndex = _endIndex;
          vis.updateVis();
        }
      });

    // Append slider 
    vis.sliderGroup = vis.chart
      .append("g")
      .attr("class", "slider")
      .attr("transform", `translate(${0}, ${vis.height + 60})`);

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    const minesPerCommodity = vis.computeMinesPerCommodity();

    // update the slider min/max and values only once when an update is triggered by some other view
    // this must go first since vis.dataProcessed relies on the slider's values
    if (vis.updateSlider) {
      const maxIndexSlider = minesPerCommodity.length;

      let start = vis.startIndex;
      let end = vis.endIndex;
      
      // if the endIndex exceeds the maxIndex, try to maintain the window size relative to the end instead
      if (end > maxIndexSlider) {
        const diff = end - maxIndexSlider;
        start = Math.max(0, start - diff);
        end = maxIndexSlider;
      }
      
      vis.slider
        .max(maxIndexSlider)
        .value([start, end]);

      vis.updateSlider = false;
    }

    vis.dataProcessed = minesPerCommodity
      .toSorted((a, b) => {
        switch (vis.config.callbacks.getCommoditySortValue()) {
          case 0:
            return b.count - a.count;
          case 1:
            return b.commodity > a.commodity ? -1 : 1;
          default:
            console.log("Invalid sort value");
        }})
      .slice(vis.slider.value()[0], vis.slider.value()[1]);

    // Update domain of scales
    vis.xScale.domain(vis.dataProcessed.map((d) => d.commodity));
    vis.yScale.domain([0, d3.max(vis.dataProcessed, (d) => d.count)]);

    const commodityRange = vis.xScale.domain().length;
    const xTickModulus = Math.ceil(commodityRange / vis.maxXAxisTicks);

    const mineCountRange = vis.yScale.domain()[1] - vis.yScale.domain()[0];
    const yTicks = Math.min(mineCountRange, vis.maxYAxisTicks);

    // Update axes ticks
    vis.xAxis.tickValues(vis.xScale.domain().filter((_, i) => i % xTickModulus === 0))
    vis.yAxis.ticks(yTicks);

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
      .attr("x", (d) => vis.xScale(d.commodity))
      .attr("y", (d) => vis.yScale(d.count))
      .attr("width", vis.xScale.bandwidth())
      .attr("height", (d) => vis.height - vis.yScale(d.count))
      .attr("fill", commodityBarColour)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("fill", commodityBarHoverColour)
          .style("cursor", "pointer");

        const html = `
          <div class="tooltip-title">${d.commodity}</div>
          <div>${d.count} mines</div>
        `
        showTooltip(event, html);
      })
      .on("mousemove", updateTooltip)
      .on("mouseout", (event) => {
        d3.select(event.currentTarget)
          .attr("fill", commodityBarColour)
          .style("cursor", "default");

        hideTooltip();
      })
      .on("click", (event, d) => vis.config.callbacks.toggleCommodity(d.commodity));

    bars
      .transition()
      .attr("x", (d) => vis.xScale(d.commodity))
      .attr("y", (d) => vis.yScale(d.count))
      .attr("width", vis.xScale.bandwidth())
      .attr("height", (d) => vis.height - vis.yScale(d.count));

    bars.exit().remove();

    vis.chart.selectAll(".bar")
      .classed("selected", (d) => vis.config.callbacks.getSelectedCommodities().includes(d.commodity))

    // Update the axes
    vis.xAxisGroup.transition().call(vis.xAxis);
    vis.yAxisGroup.transition().call(vis.yAxis);

    // Rotate x-axis labels
    vis.svg.selectAll(".x-axis text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");

    // Update the slider
    vis.sliderGroup.call(vis.slider);
  }

  /**
   * Process data to get mines per commodity
   */
  computeMinesPerCommodity() {
    let vis = this;

    let commodityCounts = {};
    vis.data.forEach((d) => {
      for (let i = 1; i <= 8; i++) {
        let commodity = d[`commodity${i}`];
        if (commodity !== "N/A") {
          if (!commodityCounts[commodity]) {
            commodityCounts[commodity] = 0;
          }
          commodityCounts[commodity]++;
        }
      }
    });

    return Object.entries(commodityCounts)
      .map(([commodity, count]) => ({ commodity, count }))
  }
}
