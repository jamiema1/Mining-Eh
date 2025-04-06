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
      .attr("font-size", 12)
      .attr("font-style", "italic")
      .attr("cursor", "default")
      .attr("text-anchor", "end")
      .text("Scroll to zoom, drag to pan")

    // Add explainer text for mine dots
    vis.svg
      .append("text")
      .attr("class", "explainer-text")
      .attr("y", vis.config.containerHeight - vis.config.margin.bottom)
      .attr("x", vis.config.margin.left)
      .attr("font-size", 12)
      .attr("font-style", "italic")
      .attr("cursor", "default")
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

    vis.chartArea
      .selectAll("path")
      .data(vis.config.geoJSONData)
      .join("path")
      .attr("id", "canada-path")
      .attr("d", vis.path)
      .attr("fill", (d) => vis.isProvinceSelected() ? selectedProvinceColour : vis.colorScale(getMineCount(d)))
      .attr("stroke", "#333")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("class", "province")
      .on("mouseover", (event, d) => {
        if (!vis.isProvinceSelected()) {
          d3.select(event.currentTarget)
            .attr("fill", hoverProvinceColour)
            .style("cursor", "pointer");

            const html = `
              <div class="tooltip-title">${d.properties.NAME}</div>
              <div>${getMineCount(d)} mines</div>
            `
            showTooltip(event, html);
        } else {
          d3.select(event.currentTarget)
            .style("cursor", "default");
        }
      })
      .on("mousemove", updateTooltip)
      .on("mouseout", (event, d) => {
        if (!vis.isProvinceSelected()) {
          d3.select(event.currentTarget)
            .attr("fill", vis.colorScale(getMineCount(d)))
            .style("cursor", "default");

          hideTooltip();
        }

      })
      .on("click", (_, d) => {
        if (!vis.isProvinceSelected()) {
          vis.config.callbacks.selectProvince(d.properties.NAME);
          vis.zoomToProvince(vis.config.geoJSONData[0]);
        }
      });

    vis.chartArea
      .selectAll("circle")
      .data(vis.data)
      .join("circle")
      .attr("cx", (d) => vis.projection([+d.longitude, +d.latitude])[0])
      .attr("cy", (d) => vis.projection([+d.longitude, +d.latitude])[1])
      .attr("r", Math.min(5, 5 / d3.zoomTransform(vis.svg.node()).k))
      .attr("fill", dotColour)
      .attr("cursor", "pointer")
      .style("opacity", 0.6)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("fill", dotHoverColour)
          .style("opacity", 1)
          .style("cursor", "pointer");

        const yearString = vis.getValidOpenCloseYears(d).map(({ open, close }, i, arr) => {
          if (i === arr.length - 1 && d["active_status"] === 'True') {
            return open + "-" + "present";
          } else {
            return open + "-" + close;
          }
        }).join(", ");

        const html = `
          <div class="tooltip-title">${d.namemine}</div>
          <div>${yearString}</div>
          <div style="font-style: italic">${d.latitude}° N, ${d.longitude}° W</div>
        `
        showTooltip(event, html);
      })
      .on("mousemove", updateTooltip)
      .on("mouseout", (event, d) => {
        if (d.id !== selectedMineId) {
          d3.select(event.currentTarget)
            .attr("fill", dotColour)
            .style("opacity", 0.6)
            .style("cursor", "default");
        }

        hideTooltip(event);
      })
      .on("click", (event, d) => {
        if (selectedMineId === undefined) {
          vis.zoomToMine(d.longitude, d.latitude)
        }
        vis.config.callbacks.toggleMine(d.id)
      });
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

    // Remove old legend count text and update if necessary
    vis.legend
      .select(".legend-count")
      .remove()

    if (vis.legendData.length === 0) {
      const [mineCount] = Array.from(vis.dataProcessed.values());
      vis.legend
        .append("text")
        .attr("x", 0)
        .attr("y", 25)
        .attr("class", "legend-count")
        .attr("font-size", "14px")
        .text(`${mineCount}`);
    }

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

  zoomToProvince(pathDatum) {
    let vis = this;

    // Get the bounds of the feature in projected space
    const [[x0, y0], [x1, y1]] = d3.geoPath().projection(vis.projection).bounds(pathDatum);
  
    const width = vis.config.containerWidth;
    const height = vis.config.containerHeight;
    const padding = 20;
  
    // Compute feature width
    const featureWidth = x1 - x0;
    const featureHeight = y1 - y0;
  
    // Compute scale to fit feature within the container including padding
    const scale = Math.min(
      (width - 2 * padding) / featureWidth,
      (height - 2 * padding) / featureHeight
    );
  
    // Compute center of the feature in projected space
    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;
  
    // Center the feature
    const translateX = width / 2 - centerX * scale;
    const translateY = height / 2 - centerY * scale;
    
    vis.zoomToPoint(translateX, translateY, scale)
  };

  zoomToMine(lon, lat, minScale = 16) {
    let vis = this;

    // only zoom/translate if the current zoom is less than the minimum scale factor
    if (d3.zoomTransform(vis.svg.node()).k < minScale) {
      const [x, y] = vis.projection([lon, lat]);
      const translateX = vis.config.containerWidth / 2 - x * minScale;
      const translateY = vis.config.containerHeight / 2 - y * minScale;

      vis.zoomToPoint(translateX, translateY, minScale);
    }
  }

  zoomToPoint(translateX, translateY, scale) {
    let vis = this;

    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);
  
    vis.svg.transition()
      .duration(750)
      .call(vis.zoom.transform, transform);
  }
}