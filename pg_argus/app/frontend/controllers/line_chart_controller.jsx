import { Controller } from "@hotwired/stimulus";
import Chart from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-luxon";
import { Interaction } from "chart.js";
import { getRelativePosition, color } from "chart.js/helpers";
import React from "jsx-dom";
import autocolors from "chartjs-plugin-autocolors";

Chart.register(zoomPlugin);
Interaction.modes.xAxisNearest = function (
  chart,
  e,
  options,
  useFinalPosition
) {
  const position = getRelativePosition(e, chart);

  const items = [];
  Interaction.evaluateInteractionItems(
    chart,
    "x",
    position,
    (element, datasetIndex, index) => {
      if (element.inXRange(position.x, useFinalPosition)) {
        items.push({ element, datasetIndex, index });
      }
    }
  );

  items.sort((a, b) => {
    const aY = a.element.getCenterPoint().y;
    const bY = b.element.getCenterPoint().y;
    return Math.abs(aY - position.y) - Math.abs(bY - position.y);
  });
  return items;
};

// Connects to data-controller="line-chart"
export default class extends Controller {
  static targets = ["graph", "legend"];
  static values = { url: String, allVisible: Boolean, groupBy: String };

  connect() {
    this.load();
    this.startRefreshing();
  }

  disconnect() {
    this.chart.destroy();
    this.chart = undefined;
    this.stopRefreshing();
    // destroy legend and associated callbacks
    this.legendTarget.innerHTML = "";
  }

  startRefreshing() {
    this.interval = setInterval(() => {
      fetch(this.getUrlValue())
        .then((response) => response.json())
        .then((data) => {
          this.prepareDatasets(data);

          this.chart.data.labels = data.labels;
          // Update datasets in place as much as possible to keep current visibility options.
          // The datasets might not come in the same order, so compare based off of dataset names.
          this.chart.data.datasets.forEach((dataset, i) => {
            const newDataset = data.results.find(
              (d) => d.label === dataset.label
            );
            if (newDataset) {
              // Maintain visibility settings on the dataset
              if (dataset.hidden) {
                newDataset.hidden = true;
              }
              dataset.data = newDataset.data;
            }
          });
          // Add any new datasets that don't already exist
          data.results.forEach((newDataset) => {
            if (
              !this.chart.data.datasets.find(
                (d) => d.label === newDataset.label
              )
            ) {
              this.chart.data.datasets.push(newDataset);
            }
          });

          this.chart.update("none");
        }, true);
    }, 10000);
  }

  stopRefreshing() {
    if (this.refreshTimer) {
      clearInterval(this.interval);
    }
  }

  prepareDatasets(data) {
    data.results.forEach((dataset, i) => {
      dataset.order = 100;
    });
  }

  lineWidth = 1;
  pointSize = 2;

  getUrlValue() {
    // get "from" and "until" from the window query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get("from");
    const until = urlParams.get("until");
    const ago = urlParams.get("ago");

    let groupByArray = this.groupByValue.split(",");
    if (this.groupByValue.length === 0) {
      groupByArray = [];
    }

    let url = new URL(this.urlValue, window.location.origin);
    if (from && until) {
      url.searchParams.append("from", from);
      url.searchParams.append("until", until);
    }
    if (ago) {
      url.searchParams.append("ago", ago);
    }

    for (let i = 0; i < groupByArray.length; i++) {
      let groupBy = groupByArray[i];
      url.searchParams.append("group_by[]", groupBy);
    }
    return url;
  }

  load() {
    console.log(
      "Loading chart",
      this.graphTarget.id,
      this.urlValue,
      this.groupByValue
    );

    fetch(this.getUrlValue())
      .then((response) => response.json())
      .then((data) => {
        this.prepareDatasets(data);
        // Create the echarts instance
        let ctx = this.graphTarget;

        this.chart = new Chart(ctx, {
          type: "line",
          data: {
            labels: data.labels,
            datasets: data.results,
          },

          plugins: [this.getHTMLLegendPlugin()],
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "xAxisNearest",
            },
            fill: false,
            pointRadius: this.pointSize,
            pointHoverRadius: this.pointSize + 2,
            borderWidth: this.lineWidth,
            scales: {
              y: {
                beginAtZero: true,
              },
              x: {
                type: "time",
                time: {
                  ticks: "labels",
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
              autocolors: {},
              htmlLegend: {
                // ID of the container to put the legend in
                containerID: this.legendTarget.id,
              },
              tooltip: {
                enabled: false,
                position: "nearest",
                sort: function (a, b) {
                  return b.value - a.value;
                },
                external: externalTooltipHandler,
              },
              zoom: {
                zoom: {
                  drag: {
                    enabled: true,
                  },
                  pinch: {
                    enabled: true,
                  },
                  mode: "x",
                  onZoomComplete: ({ chart }) => {
                    const from = chart.options.scales.x.min;
                    const until = chart.options.scales.x.max;
                    // If from and until already match query parameters don't update the query params
                    if (
                      new URLSearchParams(window.location.search).get(
                        "from"
                      ) === from.toString() &&
                      new URLSearchParams(window.location.search).get(
                        "until"
                      ) === until.toString()
                    ) {
                      return;
                    }
                    history.pushState({}, "", `?from=${from}&until=${until}`);
                    // Send onZoomComplete event to window
                    var event = new CustomEvent("onZoomComplete", {
                      detail: { from, until },
                    });
                    window.dispatchEvent(event);
                  },
                },
              },
            },
          },
        });
        // Listen for the event.
        window.addEventListener(
          "onZoomComplete",
          (e) => {
            if (this.chart === undefined) {
              return;
            }
            this.chart.zoomScale(
              "x",
              { min: e.detail.from, max: e.detail.until },
              "default"
            );
          },
          false
        );
      });
  }
  getOrCreateLegendList() {
    let listContainer = this.legendTarget.querySelector("table");
    if (listContainer) {
      listContainer.remove();
    }
    listContainer = this.legendTarget.querySelector("table");

    if (!listContainer) {
      listContainer = (
        <table class="m-0 p-0 table-fixed table table-xs table-pin-rows table-pin-cols"></table>
      );
      this.legendTarget.appendChild(listContainer);
    }

    return listContainer;
  }
  getHTMLLegendPlugin() {
    var previousData = undefined;
    return {
      id: "htmlLegend",
      afterUpdate: function (chart, args, options) {
        if (chart.data.datasets == previousData) {
          return;
        }
        previousData = chart.data.datasets;
        const ul = this.getOrCreateLegendList();

        // Remove old legend items
        while (ul.firstChild) {
          ul.firstChild.remove();
        }

        ul.appendChild(
          <thead style={{ display: "table-header-group", position: "sticky" }}>
            <tr>
              <th class="w-6"></th>
              <th class="w-16">Total</th>
              <th>Label</th>
            </tr>
          </thead>
        );
        let tbody = <tbody />;
        // Reuse the built-in legendItems generator
        const items = chart.options.plugins.legend.labels.generateLabels(chart);
        // Sort items based on associated dataseries totals
        // Calculate per label totals
        let totals = items.reduce((map, item) => {
          const dataset = chart.data.datasets.find(
            (dataset) => dataset.label === item.text
          );

          const total = dataset.data.reduce((acc, point) => {
            let y = point[1];
            if (y === null || y === undefined || isNaN(y)) {
              return acc;
            }
            return acc + y;
          }, 0);
          map[item.text] = total;
          return map;
        }, {});

        items.sort((left, right) => {
          return totals[right.text] - totals[left.text];
        });

        items.forEach((item, i) => {
          let itemId = this.graphTarget.id + "-lgnd-item-text-" + i;
          let backgroundColor = color(item.fillStyle).alpha(1).rgbString();
          let borderColor = color(item.strokeStyle).alpha(1).rgbString();
          let fontColor = color(item.fontColor).alpha(1).rgbString();
          const li = (
            <tr class="items-center cursor-pointer ml-3.5 text-sm">
              <td>
                <span
                  class="inline-block flex-shrink-0 h-3 w-3 mr-1"
                  style={{
                    background: backgroundColor,
                    borderColor: borderColor,
                  }}
                />
              </td>
              <td>{totals[item.text]}</td>
              <td
                id={itemId}
                class="m-0 p-0"
                style={{
                  textDecoration: item.hidden ? "line-through" : "",
                  whiteSpace: "nowrap",
                }}
              >
                {item.text}
              </td>
            </tr>
          );
          var timer;
          var isDoubleClick = false;
          var toggleSeries = function (e) {
            if (isDoubleClick) {
              return;
            }
            chart.setDatasetVisibility(
              item.datasetIndex,
              !chart.isDatasetVisible(item.datasetIndex)
            );
            chart.update("none");
          };
          var focusSeries = function (e) {
            const { type } = chart.config;
            // Turn off visibility of all other elements
            chart.data.datasets.forEach((e, i) => {
              if (i !== item.datasetIndex) {
                chart.setDatasetVisibility(i, this.allVisibleValue);
              }
            });
            chart.setDatasetVisibility(item.datasetIndex, true);
            this.allVisibleValue = !this.allVisibleValue;
            chart.update("none");
          }.bind(this);

          li.addEventListener("mousedown", (e) => {
            // Don't do anything if it is a double click event.
            isDoubleClick = false;
            timer = setTimeout(() => {
              if (e.shiftKey) {
                e.preventDefault();
                focusSeries(e);
              } else {
                toggleSeries(e);
              }
            }, 250);
          });
          li.addEventListener("dblclick", (e) => {
            isDoubleClick = true;
            clearTimeout(timer);
            focusSeries();
          });

          let oldOrder = chart.data.datasets[item.datasetIndex].order;
          // Add an on hover to text container to turn it bold and off when hover ends
          li.onmouseover = function () {
            let itemElem = document.getElementById(itemId);
            itemElem.style.fontWeight = "bold";
            itemElem.style.whiteSpace = "normal";
            // Make the associated dataset have a larger borderwidth
            this.chart.data.datasets[item.datasetIndex].borderWidth =
              this.lineWidth + 2;
            this.chart.data.datasets[item.datasetIndex].order = 1;
            this.chart.update("none");
          }.bind(this);
          li.onmouseleave = function () {
            let itemElem = document.getElementById(itemId);
            itemElem.style.fontWeight = "normal";
            itemElem.style.whiteSpace = "nowrap";
            chart.data.datasets[item.datasetIndex].borderWidth = this.lineWidth;
            chart.data.datasets[item.datasetIndex].order = oldOrder;
            chart.update("none");
          }.bind(this);
          tbody.appendChild(li);
        });
        ul.appendChild(tbody);
      }.bind(this),
    };
  }
}

const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector("div");

  if (!tooltipEl) {
    tooltipEl = (
      <div class="dark:bg-slate-950 dark:text-slate-300 bg-slate-50 text-slate-950 rounded-lg absolute pointer-events-none z-50 w-96 max-h-60 overflow-hidden">
        <table class="m-0 p-0 table-auto table table-xs"></table>
      </div>
    );

    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

const externalTooltipHandler = (context) => {
  // Tooltip Element
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);

  // Hide if no tooltip
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Set Text
  if (tooltip.body) {
    const titleLines = tooltip.title || [];

    // Create new array that zips together datapoints and label colors
    let datapoints = tooltip.dataPoints.map((datapoint, i) => {
      return {
        datapoint: datapoint,
        color: tooltip.labelColors[i],
      };
    });

    // Sort from largest to smallest, keeping the first element first.
    let sortedDataPoints = datapoints.slice(1, undefined).sort((a, b) => {
      return b.datapoint.raw[1] - a.datapoint.raw[1];
    });
    sortedDataPoints.unshift(datapoints[0]);

    const tableHead = document.createElement("thead");

    titleLines.forEach((title) => {
      tableHead.appendChild(
        <tr class="border-0">
          <th></th>
          <th>Total</th>
          <th>{title}</th>
        </tr>
      );
    });

    const tableBody = document.createElement("tbody");
    sortedDataPoints.forEach((zipped, i) => {
      let datapoint = zipped.datapoint;
      let colors = zipped.color;

      let backgroundColor = color(colors.backgroundColor).alpha(1).rgbString();
      let borderColor = color(colors.borderColor).alpha(1).rgbString();

      const tr = (
        <tr
          class="border-0 text-sm"
          style={{ fontWeight: i == 0 ? "bold" : "normal" }}
        >
          <td class="border-0">
            <span
              class="inline-block flex-shrink-0 h-3 w-3 mr-1"
              style={{
                background: backgroundColor,
                borderColor: borderColor,
              }}
            />
          </td>
          <td>{datapoint.formattedValue}</td>
          <td>{datapoint.dataset.label}</td>
        </tr>
      );

      tableBody.appendChild(tr);
    });

    const tableRoot = tooltipEl.querySelector("table");

    // Remove old children
    while (tableRoot.firstChild) {
      tableRoot.firstChild.remove();
    }

    // Add new children
    tableRoot.appendChild(tableHead);
    tableRoot.appendChild(tableBody);
  }

  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

  // Display, position, and set styles for font
  tooltipEl.style.opacity = 1;

  const tooltipWidth = tooltipEl.offsetWidth; // Get actual width after styles are applied
  const windowWidth = window.innerWidth;

  let tooltipX = positionX + tooltip.caretX;

  // Check if the tooltip will go off the right edge, with some margin
  const marginRight = 10; // Adjust as needed
  if (tooltipX + tooltipWidth + marginRight > windowWidth) {
    tooltipX = windowWidth - tooltipWidth - marginRight;
  }

  // Check if the tooltip will go off the left edge
  const marginLeft = 10; // Adjust as needed
  if (tooltipX < marginLeft) {
    tooltipX = marginLeft;
  }

  tooltipEl.style.left = `${tooltipX}px`;
  tooltipEl.style.top = positionY + tooltip.caretY + "px";
  tooltipEl.style.font = tooltip.options.bodyFont.string;
  tooltipEl.style.padding =
    tooltip.options.padding + "px " + tooltip.options.padding + "px";
};

var mockData = `{
    "labels": [
        1717589505000,
        1717589520000,
        1717589535000,
        1717589550000,
        1717589565000,
        1717589580000,
        1717589595000,
        1717589610000,
        1717589625000,
        1717589655000,
        1717589775000,
        1717589880000,
        1717589895000,
        1717589910000,
        1717589925000,
        1717589940000,
        1717589955000,
        1717589970000,
        1717589985000,
        1717590000000,
        1717590015000,
        1717590030000,
        1717590045000,
        1717590060000,
        1717590075000,
        1717590090000,
        1717590105000,
        1717590120000,
        1717590135000,
        1717590165000,
        1717590180000
    ],
    "results": [
        {
            "label": "COMMIT",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    17.0
                ],
                [
                    1717589520000,
                    2.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589550000,
                    27.0
                ],
                [
                    1717589565000,
                    2.0
                ],
                [
                    1717589580000,
                    23.0
                ],
                [
                    1717589595000,
                    46.0
                ],
                [
                    1717589610000,
                    65.0
                ],
                [
                    1717589625000,
                    null
                ],
                [
                    1717589895000,
                    4.0
                ],
                [
                    1717589910000,
                    22.0
                ],
                [
                    1717589925000,
                    1.0
                ],
                [
                    1717589940000,
                    16.0
                ],
                [
                    1717589955000,
                    2.0
                ],
                [
                    1717589970000,
                    23.0
                ],
                [
                    1717589985000,
                    null
                ],
                [
                    1717590000000,
                    38.0
                ],
                [
                    1717590015000,
                    38.0
                ],
                [
                    1717590030000,
                    40.0
                ],
                [
                    1717590045000,
                    17.0
                ],
                [
                    1717590060000,
                    1.0
                ],
                [
                    1717590075000,
                    47.0
                ],
                [
                    1717590090000,
                    23.0
                ],
                [
                    1717590105000,
                    23.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "DELETE FROM new_order WHERE no_o_id = ? AND no_d_id = ? AND no_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    16.0
                ],
                [
                    1717589520000,
                    null
                ],
                [
                    1717589985000,
                    16.0
                ],
                [
                    1717590000000,
                    null
                ],
                [
                    1717590120000,
                    12.0
                ],
                [
                    1717590135000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO order_line (...) VALUES (many_lists)",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    21.0
                ],
                [
                    1717589520000,
                    22.0
                ],
                [
                    1717589535000,
                    21.0
                ],
                [
                    1717589550000,
                    22.0
                ],
                [
                    1717589565000,
                    22.0
                ],
                [
                    1717589580000,
                    22.0
                ],
                [
                    1717589595000,
                    22.0
                ],
                [
                    1717589610000,
                    22.0
                ],
                [
                    1717589625000,
                    null
                ],
                [
                    1717589880000,
                    19.0
                ],
                [
                    1717589895000,
                    20.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717589925000,
                    21.0
                ],
                [
                    1717589940000,
                    null
                ],
                [
                    1717589985000,
                    41.0
                ],
                [
                    1717590000000,
                    41.0
                ],
                [
                    1717590015000,
                    21.0
                ],
                [
                    1717590030000,
                    null
                ],
                [
                    1717590045000,
                    21.0
                ],
                [
                    1717590060000,
                    40.0
                ],
                [
                    1717590075000,
                    22.0
                ],
                [
                    1717590090000,
                    23.0
                ],
                [
                    1717590105000,
                    22.0
                ],
                [
                    1717590120000,
                    22.0
                ],
                [
                    1717590135000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM customer WHERE c_w_id = ? AND c_d_id = ? AND c_id = ?",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    4.0
                ],
                [
                    1717589520000,
                    null
                ],
                [
                    1717589595000,
                    7.0
                ],
                [
                    1717589610000,
                    null
                ],
                [
                    1717589880000,
                    5.0
                ],
                [
                    1717589895000,
                    null
                ],
                [
                    1717589910000,
                    7.0
                ],
                [
                    1717589925000,
                    null
                ],
                [
                    1717589940000,
                    4.0
                ],
                [
                    1717589955000,
                    null
                ],
                [
                    1717590090000,
                    10.0
                ],
                [
                    1717590105000,
                    5.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM district WHERE d_w_id = ? AND d_id = ? FOR UPDATE",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    7.0
                ],
                [
                    1717589520000,
                    null
                ],
                [
                    1717589580000,
                    10.0
                ],
                [
                    1717589595000,
                    null
                ],
                [
                    1717589610000,
                    20.0
                ],
                [
                    1717589625000,
                    null
                ],
                [
                    1717589880000,
                    7.0
                ],
                [
                    1717589895000,
                    null
                ],
                [
                    1717589910000,
                    7.0
                ],
                [
                    1717589925000,
                    9.0
                ],
                [
                    1717589940000,
                    null
                ],
                [
                    1717590000000,
                    8.0
                ],
                [
                    1717590015000,
                    null
                ],
                [
                    1717590105000,
                    10.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM item WHERE i_id = ?",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    19.0
                ],
                [
                    1717589520000,
                    39.0
                ],
                [
                    1717589535000,
                    80.0
                ],
                [
                    1717589550000,
                    20.0
                ],
                [
                    1717589565000,
                    60.0
                ],
                [
                    1717589580000,
                    22.0
                ],
                [
                    1717589595000,
                    40.0
                ],
                [
                    1717589610000,
                    60.0
                ],
                [
                    1717589625000,
                    60.0
                ],
                [
                    1717589655000,
                    null
                ],
                [
                    1717589880000,
                    20.0
                ],
                [
                    1717589895000,
                    19.0
                ],
                [
                    1717589910000,
                    95.0
                ],
                [
                    1717589925000,
                    19.0
                ],
                [
                    1717589940000,
                    19.0
                ],
                [
                    1717589955000,
                    38.0
                ],
                [
                    1717589970000,
                    38.0
                ],
                [
                    1717589985000,
                    19.0
                ],
                [
                    1717590000000,
                    19.0
                ],
                [
                    1717590015000,
                    19.0
                ],
                [
                    1717590030000,
                    19.0
                ],
                [
                    1717590045000,
                    19.0
                ],
                [
                    1717590060000,
                    57.0
                ],
                [
                    1717590075000,
                    38.0
                ],
                [
                    1717590090000,
                    80.0
                ],
                [
                    1717590105000,
                    60.0
                ],
                [
                    1717590120000,
                    20.0
                ],
                [
                    1717590135000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM new_order WHERE no_d_id = ? AND no_w_id = ? ORDER BY no_o_id ASC LIMIT ?",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    16.0
                ],
                [
                    1717589520000,
                    null
                ],
                [
                    1717589565000,
                    16.0
                ],
                [
                    1717589580000,
                    32.0
                ],
                [
                    1717589595000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM stock WHERE s_i_id = ? AND s_w_id = ? FOR UPDATE",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    95.0
                ],
                [
                    1717589520000,
                    20.0
                ],
                [
                    1717589535000,
                    80.0
                ],
                [
                    1717589550000,
                    80.0
                ],
                [
                    1717589565000,
                    40.0
                ],
                [
                    1717589580000,
                    40.0
                ],
                [
                    1717589595000,
                    81.0
                ],
                [
                    1717589610000,
                    null
                ],
                [
                    1717589625000,
                    20.0
                ],
                [
                    1717589655000,
                    null
                ],
                [
                    1717589880000,
                    18.0
                ],
                [
                    1717589895000,
                    55.0
                ],
                [
                    1717589910000,
                    76.0
                ],
                [
                    1717589925000,
                    19.0
                ],
                [
                    1717589940000,
                    57.0
                ],
                [
                    1717589955000,
                    60.0
                ],
                [
                    1717589970000,
                    76.0
                ],
                [
                    1717589985000,
                    58.0
                ],
                [
                    1717590000000,
                    57.0
                ],
                [
                    1717590015000,
                    38.0
                ],
                [
                    1717590030000,
                    57.0
                ],
                [
                    1717590045000,
                    97.0
                ],
                [
                    1717590060000,
                    57.0
                ],
                [
                    1717590075000,
                    19.0
                ],
                [
                    1717590090000,
                    100.0
                ],
                [
                    1717590105000,
                    20.0
                ],
                [
                    1717590120000,
                    20.0
                ],
                [
                    1717590135000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE district SET d_ytd = d_ytd + ? WHERE d_w_id = ? AND d_id = ?",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    6.0
                ],
                [
                    1717589520000,
                    8.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589895000,
                    8.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717589970000,
                    8.0
                ],
                [
                    1717589985000,
                    null
                ],
                [
                    1717590090000,
                    8.0
                ],
                [
                    1717590105000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM district WHERE d_w_id = ? AND d_id = ?",
            "fill": false,
            "data": [
                [
                    1717589520000,
                    10.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589565000,
                    12.0
                ],
                [
                    1717589580000,
                    null
                ],
                [
                    1717589610000,
                    19.0
                ],
                [
                    1717589625000,
                    null
                ],
                [
                    1717589880000,
                    10.0
                ],
                [
                    1717589895000,
                    null
                ],
                [
                    1717589910000,
                    8.0
                ],
                [
                    1717589925000,
                    null
                ],
                [
                    1717589940000,
                    10.0
                ],
                [
                    1717589955000,
                    null
                ],
                [
                    1717589970000,
                    17.0
                ],
                [
                    1717589985000,
                    10.0
                ],
                [
                    1717590000000,
                    null
                ],
                [
                    1717590030000,
                    9.0
                ],
                [
                    1717590045000,
                    8.0
                ],
                [
                    1717590060000,
                    null
                ],
                [
                    1717590090000,
                    12.0
                ],
                [
                    1717590105000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM order_line, stock WHERE ol_w_id = ? AND ol_d_id = ? AND ol_o_id \u003c ? AND ol_o_id \u003e= ? AND s_w_id = ? AND s_i_id = ol_i_id AND s_quantity \u003c ?",
            "fill": false,
            "data": [
                [
                    1717589520000,
                    3.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589565000,
                    1.0
                ],
                [
                    1717589580000,
                    null
                ],
                [
                    1717589925000,
                    7.0
                ],
                [
                    1717589940000,
                    null
                ],
                [
                    1717590045000,
                    7.0
                ],
                [
                    1717590060000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE stock SET s_quantity = ?, s_ytd = s_ytd + ?, s_order_cnt = s_order_cnt + ?, s_remote_cnt = s_remote_cnt + ? WHERE s_i_id = ? AND s_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589520000,
                    44.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589580000,
                    23.0
                ],
                [
                    1717589595000,
                    23.0
                ],
                [
                    1717589610000,
                    23.0
                ],
                [
                    1717589625000,
                    null
                ],
                [
                    1717589895000,
                    21.0
                ],
                [
                    1717589910000,
                    22.0
                ],
                [
                    1717589925000,
                    66.0
                ],
                [
                    1717589940000,
                    22.0
                ],
                [
                    1717589955000,
                    7.0
                ],
                [
                    1717589970000,
                    null
                ],
                [
                    1717590000000,
                    22.0
                ],
                [
                    1717590015000,
                    null
                ],
                [
                    1717590105000,
                    23.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE warehouse SET w_ytd = w_ytd + ? WHERE w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589520000,
                    8.0
                ],
                [
                    1717589535000,
                    16.0
                ],
                [
                    1717589550000,
                    null
                ],
                [
                    1717589565000,
                    6.0
                ],
                [
                    1717589580000,
                    null
                ],
                [
                    1717589955000,
                    8.0
                ],
                [
                    1717589970000,
                    null
                ],
                [
                    1717590000000,
                    4.0
                ],
                [
                    1717590015000,
                    null
                ],
                [
                    1717590060000,
                    7.0
                ],
                [
                    1717590075000,
                    null
                ]
            ]
        },
        {
            "label": "query_too_large_to_parse",
            "fill": false,
            "data": [
                [
                    1717589520000,
                    8.0
                ],
                [
                    1717589535000,
                    null
                ],
                [
                    1717589580000,
                    22.0
                ],
                [
                    1717589595000,
                    3.0
                ],
                [
                    1717589610000,
                    null
                ],
                [
                    1717589880000,
                    21.0
                ],
                [
                    1717589895000,
                    6.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717590015000,
                    18.0
                ],
                [
                    1717590030000,
                    17.0
                ],
                [
                    1717590045000,
                    null
                ],
                [
                    1717590075000,
                    7.0
                ],
                [
                    1717590090000,
                    null
                ],
                [
                    1717590135000,
                    15.0
                ],
                [
                    1717590165000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO oorder (...) VALUES (...)",
            "fill": false,
            "data": [
                [
                    1717589535000,
                    16.0
                ],
                [
                    1717589550000,
                    null
                ],
                [
                    1717589565000,
                    16.0
                ],
                [
                    1717589580000,
                    null
                ],
                [
                    1717589940000,
                    17.0
                ],
                [
                    1717589955000,
                    null
                ],
                [
                    1717590105000,
                    29.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM customer WHERE c_w_id = ? AND c_d_id = ? AND c_last = ? ORDER BY c_first",
            "fill": false,
            "data": [
                [
                    1717589535000,
                    14.0
                ],
                [
                    1717589550000,
                    null
                ],
                [
                    1717589580000,
                    14.0
                ],
                [
                    1717589595000,
                    null
                ],
                [
                    1717589895000,
                    16.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717589940000,
                    10.0
                ],
                [
                    1717589955000,
                    null
                ],
                [
                    1717590015000,
                    12.0
                ],
                [
                    1717590030000,
                    null
                ],
                [
                    1717590060000,
                    12.0
                ],
                [
                    1717590075000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM order_line WHERE ol_o_id = ? AND ol_d_id = ? AND ol_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589535000,
                    16.0
                ],
                [
                    1717589550000,
                    null
                ],
                [
                    1717589880000,
                    16.0
                ],
                [
                    1717589895000,
                    null
                ],
                [
                    1717589955000,
                    32.0
                ],
                [
                    1717589970000,
                    null
                ],
                [
                    1717590030000,
                    16.0
                ],
                [
                    1717590045000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE oorder SET o_carrier_id = ? WHERE o_id = ? AND o_d_id = ? AND o_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589535000,
                    16.0
                ],
                [
                    1717589550000,
                    null
                ],
                [
                    1717590015000,
                    32.0
                ],
                [
                    1717590030000,
                    null
                ],
                [
                    1717590045000,
                    16.0
                ],
                [
                    1717590060000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE customer SET c_balance = ?, c_ytd_payment = ?, c_payment_cnt = ? WHERE c_w_id = ? AND c_d_id = ? AND c_id = ?",
            "fill": false,
            "data": [
                [
                    1717589550000,
                    14.0
                ],
                [
                    1717589565000,
                    null
                ],
                [
                    1717589580000,
                    36.0
                ],
                [
                    1717589595000,
                    null
                ],
                [
                    1717589925000,
                    17.0
                ],
                [
                    1717589940000,
                    13.0
                ],
                [
                    1717589955000,
                    null
                ],
                [
                    1717589985000,
                    17.0
                ],
                [
                    1717590000000,
                    17.0
                ],
                [
                    1717590015000,
                    null
                ],
                [
                    1717590030000,
                    24.0
                ],
                [
                    1717590045000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE order_line SET ol_delivery_d = ? WHERE ol_o_id = ? AND ol_d_id = ? AND ol_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589550000,
                    32.0
                ],
                [
                    1717589565000,
                    null
                ],
                [
                    1717589910000,
                    16.0
                ],
                [
                    1717589925000,
                    16.0
                ],
                [
                    1717589940000,
                    12.0
                ],
                [
                    1717589955000,
                    16.0
                ],
                [
                    1717589970000,
                    15.0
                ],
                [
                    1717589985000,
                    null
                ],
                [
                    1717590060000,
                    16.0
                ],
                [
                    1717590075000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM warehouse WHERE w_id = ?",
            "fill": false,
            "data": [
                [
                    1717589565000,
                    8.0
                ],
                [
                    1717589580000,
                    null
                ],
                [
                    1717589925000,
                    7.0
                ],
                [
                    1717589940000,
                    null
                ],
                [
                    1717589970000,
                    7.0
                ],
                [
                    1717589985000,
                    null
                ],
                [
                    1717590000000,
                    4.0
                ],
                [
                    1717590015000,
                    null
                ],
                [
                    1717590105000,
                    5.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE district SET d_next_o_id = d_next_o_id + ? WHERE d_w_id = ? AND d_id = ?",
            "fill": false,
            "data": [
                [
                    1717589580000,
                    15.0
                ],
                [
                    1717589595000,
                    16.0
                ],
                [
                    1717589610000,
                    null
                ],
                [
                    1717589970000,
                    14.0
                ],
                [
                    1717589985000,
                    null
                ],
                [
                    1717590105000,
                    25.0
                ],
                [
                    1717590120000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO order_line (...) VALUES (...)",
            "fill": false,
            "data": [
                [
                    1717589595000,
                    21.0
                ],
                [
                    1717589610000,
                    null
                ],
                [
                    1717590030000,
                    22.0
                ],
                [
                    1717590045000,
                    null
                ],
                [
                    1717590075000,
                    21.0
                ],
                [
                    1717590090000,
                    null
                ]
            ]
        },
        {
            "label": "BEGIN",
            "fill": false,
            "data": [
                [
                    1717589655000,
                    3.0
                ],
                [
                    1717589775000,
                    null
                ],
                [
                    1717589985000,
                    3.0
                ],
                [
                    1717590000000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO stock VALUES (many_lists)",
            "fill": false,
            "data": [
                [
                    1717589775000,
                    44.0
                ],
                [
                    1717589880000,
                    null
                ],
                [
                    1717590180000,
                    31.0
                ]
            ]
        },
        {
            "label": "SELECT ... FROM (SELECT ... FROM pg_catalog.pg_class ct JOIN pg_catalog.pg_namespace n ON ct.relnamespace = n.oid JOIN pg_catalog.pg_index i ON ct.oid = i.indrelid JOIN pg_catalog.pg_class ci ON ci.oid = i.indexrelid JOIN pg_catalog.pg_am am ON ci.relam = am.oid WHERE ? AND n.nspname = ? AND ct.relname = ?) tmp ORDER BY non_unique, type, index_name, ordinal_position",
            "fill": false,
            "data": [
                [
                    1717589505000,
                    null
                ],
                [
                    1717589775000,
                    1.0
                ],
                [
                    1717589880000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO history (...) VALUES (...)",
            "fill": false,
            "data": [
                [
                    1717589895000,
                    17.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717589955000,
                    17.0
                ],
                [
                    1717589970000,
                    null
                ],
                [
                    1717589985000,
                    17.0
                ],
                [
                    1717590000000,
                    null
                ],
                [
                    1717590015000,
                    17.0
                ],
                [
                    1717590030000,
                    null
                ],
                [
                    1717590045000,
                    17.0
                ],
                [
                    1717590060000,
                    null
                ],
                [
                    1717590075000,
                    2.0
                ],
                [
                    1717590090000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO new_order (...) VALUES (...)",
            "fill": false,
            "data": [
                [
                    1717589895000,
                    32.0
                ],
                [
                    1717589910000,
                    null
                ],
                [
                    1717589940000,
                    17.0
                ],
                [
                    1717589955000,
                    15.0
                ],
                [
                    1717589970000,
                    null
                ],
                [
                    1717590015000,
                    32.0
                ],
                [
                    1717590030000,
                    17.0
                ],
                [
                    1717590045000,
                    null
                ],
                [
                    1717590105000,
                    18.0
                ],
                [
                    1717590120000,
                    18.0
                ],
                [
                    1717590135000,
                    null
                ]
            ]
        },
        {
            "label": "UPDATE customer SET c_balance = c_balance + ?, c_delivery_cnt = c_delivery_cnt + ? WHERE c_w_id = ? AND c_d_id = ? AND c_id = ?",
            "fill": false,
            "data": [
                [
                    1717589985000,
                    16.0
                ],
                [
                    1717590000000,
                    null
                ],
                [
                    1717590045000,
                    16.0
                ],
                [
                    1717590060000,
                    null
                ],
                [
                    1717590075000,
                    17.0
                ],
                [
                    1717590090000,
                    null
                ]
            ]
        },
        {
            "label": "SELECT ... FROM oorder WHERE o_id = ? AND o_d_id = ? AND o_w_id = ?",
            "fill": false,
            "data": [
                [
                    1717590015000,
                    16.0
                ],
                [
                    1717590030000,
                    16.0
                ],
                [
                    1717590045000,
                    null
                ],
                [
                    1717590075000,
                    16.0
                ],
                [
                    1717590090000,
                    null
                ]
            ]
        },
        {
            "label": "INSERT INTO item VALUES (many_lists)",
            "fill": false,
            "data": [
                [
                    1717590165000,
                    3.0
                ],
                [
                    1717590180000,
                    null
                ]
            ]
        }
    ]
}`;
