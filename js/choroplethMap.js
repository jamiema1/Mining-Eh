class ChoroplethMap {

  /**
   * Class constructor with initial configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      geoJSONData: _config.geoJSONData,
      callbacks: _config.callbacks,
      containerWidth: _config.containerWidth,
      containerHeight: _config.containerHeight,
      margin: {top: 15, right: 15, bottom: 15, left: 15},
    }
    this.data = _data;
    this.initVis();
  }

  /**
   * Initialize the scales, axes, and append static elements
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Initialize Scales
    vis.colorScale = d3.scaleThreshold();

    // Define dimensions of svg
    vis.svg = d3.select(vis.config.parentElement)
      .append('svg')
      .attr("id", "svg-canada-map")
      .attr("class", "view-container")
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    // Define and position chart area
    vis.chartArea = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Initialize projection
    vis.projection = d3
      .geoMercator()
      .center([-98, 59])
      .scale(300)
      .translate([vis.config.containerWidth / 2, vis.config.containerHeight / 2]);

    // Initialize path
    vis.path = d3.geoPath().projection(vis.projection);

    // Add legend
    vis.legend = vis.svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${vis.config.margin.left}, ${vis.config.margin.top + 10})`);

    // Add legend title
    vis.legend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("class", "legend-title")
      .attr("font-weight", "500")
      .attr("font-size", "14px")
      .text("Mines");

    // Add zoom functionality
    vis.zoom = d3.zoom()
      .scaleExtent([0.5, 200])
      .on("zoom", (event) => {
        const scale = event.transform.k
        // rescale dots
        vis.chartArea
          .selectAll("circle")
          .attr("r", Math.min(5, 5 / scale));

        vis.chartArea.attr("transform", event.transform);
      });

    vis.svg.call(vis.zoom)

    // Add back button
    vis.svg
      .append("text")
      .attr("id", "map-back-button")
      .attr("y", vis.config.margin.top + 10)
      .attr("x", vis.config.containerWidth - vis.config.margin.right)
      .attr("text-anchor", "end")
      .attr("cursor", "pointer")
      .attr("display", "none")
      .attr("font-size", 14)
      .attr("font-style", "italic")
      .text("Go Back")
      .on("click", vis.config.callbacks.deselectProvince)

    // Add explainer text for zoom/pan
    vis.svg
      .append("text")
      .attr("class", "explainer-text")
      .attr("y", vis.config.containerHeight - vis.config.margin.bottom)
      .attr("x", vis.config.containerWidth - vis.config.margin.right)
      .attr("text-anchor", "end")
      .text("Scroll to zoom, drag to pan")

    // Add explainer text for mine dots
    vis.svg
      .append("text")
      .attr("class", "explainer-text")
      .attr("y", vis.config.containerHeight - vis.config.margin.bottom)
      .attr("x", vis.config.margin.left)
      .text("Each dot represents a mine")

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;
    
    // Process data to get mines per province
    vis.dataProcessed = d3.rollup(
      vis.data,
      (v) => v.length,
      (d) => d.province
    );

    const mineCounts = Array.from(vis.dataProcessed.values());
    const maxMineCount = d3.max(mineCounts);
    const thresholds = d3.range(1, maxMineCount, maxMineCount / 6);

    // Update domain and range of scales
    vis.colorScale
      .domain(thresholds)
      .range(colourPalette);

    vis.updateLegend();

    vis.renderVis();
  }

  /**
   * Bind data to visual elements (enter-update-exit) and update axes
   */
  renderVis() {
    let vis = this;

    const getMineCount = (d) => vis.dataProcessed.get(d.properties.NAME) || 0;

    const provinces = vis.chartArea
      .selectAll("path")
      .data(vis.config.geoJSONData)
      .join("path")
      .attr("id", "canada-path")
      .attr("d", vis.path)
      .attr("fill", (d) => vis.isProvinceSelected() ? colourPalette[0] : vis.colorScale(getMineCount(d)))
      .attr("stroke", "#333")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("class", "province")
      .on("mouseover", (event, d) => {
        if (!vis.isProvinceSelected()) {
          d3.select(event.currentTarget)
            .attr("fill", "#6497b1")
            .style("cursor", "pointer");
        }

        const html = `
          <div class="tooltip-title">${d.properties.NAME}</div>
          <div>${getMineCount(d)} mines</div>
        `
        showTooltip(event, html);
      })
      .on("mousemove", updateTooltip)
      .on("mouseout", (event, d) => {
        if (!vis.isProvinceSelected()) {
          d3.select(event.currentTarget)
            .attr("fill", vis.colorScale(getMineCount(d)))
            .style("cursor", "auto");
        }

        hideTooltip();
      })
      .on("click", (_, d) => {
        vis.config.callbacks.selectProvince(d.properties.NAME);
      });

    // if (vis.selectedProvince !== undefined) {
    //   // use setTimeout to allow the path to initialize before we access it
    //   setTimeout(() => {
    //     const svg = document.getElementById("svg-canada-map");
    //     const provincePath = document.getElementById("canada-path");

    //     // Get bounding box of path
    //     const bbox = provincePath.getBBox();

    //     const scale = Math.min(vis.width / bbox.width, vis.height / bbox.height)

    //     // Compute translation to center the path
    //     // const translateX = (vis.width - scale * (bbox.x + bbox.width / 2)) / scale;
    //     // const translateY = (vis.height - scale * (bbox.y + bbox.height / 2)) / scale;

    //     // vis.svg.transition().duration(500).call(
    //     //   vis.zoom.transform,
    //     //   d3.zoomIdentity
    //     //     .translate(translateX, translateY)
    //     //     .scale(scale)
    //     // );


    //     const circles = vis.svg
    //       .selectAll("circle")
    //       .data(vis.data)
    //       .join("circle")
    //       .attr("cx", (d) => vis.projection([+d.longitude, +d.latitude])[0])
    //       .attr("cy", (d) => vis.projection([+d.longitude, +d.latitude])[1])
    //       .attr("r", Math.min(5, 5 / scale))
    //       .attr("fill", "red")
    //       .attr("cursor", "pointer")
    //       .style("opacity", 0.6)
    //       .on("mouseover", (event, d) => {
    //         const html = `
    //           <div class="tooltip-title">${d.namemine}</div>
    //           <div>${d.latitude}° N, ${d.longitude}° W</div>
    //         `
    //         showTooltip(event, html);
    //       })
    //       .on("mousemove", updateTooltip)
    //       .on("mouseout", hideTooltip);
    //   }, 100)
    // } else {
      const scale = d3.zoomTransform(vis.svg.node()).k;

      const circles = vis.chartArea
        .selectAll("circle")
        .data(vis.data)
        .join("circle")
        .attr("cx", (d) => vis.projection([+d.longitude, +d.latitude])[0])
        .attr("cy", (d) => vis.projection([+d.longitude, +d.latitude])[1])
        .attr("r", Math.min(5, 5 / scale))
        .attr("fill", "red")
        .attr("cursor", "pointer")
        .style("opacity", 0.6)
        .on("mouseover", (event, d) => {
          d3.select(event.currentTarget)
            .attr("fill", "orange")
            .style("opacity", 1)
            .style("cursor", "pointer");

          const html = `
            <div class="tooltip-title">${d.namemine}</div>
            <div>${d.latitude}° N, ${d.longitude}° W</div>
          `
          showTooltip(event, html);
        })
        .on("mousemove", updateTooltip)
        .on("mouseout", (event) => {
          d3.select(event.currentTarget)
            .attr("fill", "red")
            .style("opacity", 0.6)
            .style("cursor", "auto");

          hideTooltip(event);
        })
        .on("click", (event, d) => vis.config.callbacks.toggleMine(d.id)); 
      
    // }
  }



  updateLegend() {
    let vis = this;

    vis.legendData = vis.isProvinceSelected() ? [] : vis.colorScale.range()
      .map((color) => {
        const d = vis.colorScale.invertExtent(color);
        if (!d[0]) d[0] = 0;
        if (!d[1]) d[1] = d3.max(vis.colorScale.domain());
        return { color, range: d };
      })
      .filter((d, i) => d.range[0] < d.range[1] && (i === 0 || d.range[0] > 0));

    vis.renderLegend();
  }

  renderLegend() {
    let vis = this;

    // Remove old items
    vis.legend
      .selectAll(".item")
      .remove();

    vis.legendData.forEach((d, i) => {
      const legendItem = vis.legend
        .append("g")
        .attr("class", "item")
        .attr("transform", `translate(0, ${i * 25})`);

      legendItem
        .append("rect")
        .attr("y", 10)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", d.color)

      legendItem
        .append("text")
        .attr("y", 25)
        .attr("x", 30)
        .attr("font-size", 12)
        .text(`${d.range[0].toFixed(0)} - ${d.range[1].toFixed(0)}`);
    });
  }

  removeDots() {
    let vis = this;

    vis.chartArea
      .selectAll("circle")
      .remove();
  }

  isProvinceSelected() {
    let vis = this;

    return vis.config.callbacks.getSelectedProvince() !== undefined;
  }
}