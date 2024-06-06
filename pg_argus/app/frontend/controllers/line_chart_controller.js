import { Controller } from "@hotwired/stimulus";
import Chart from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-luxon";
Chart.register(zoomPlugin);

// Connects to data-controller="line-chart"
export default class extends Controller {
  static targets = ["graph", "legend"];
  static values = { url: String, allVisible: Boolean };

  connect() {
    this.load();
    this.startRefreshing();
  }

  disconnect() {
    this.chart.destroy();
    this.chart = undefined;
    this.stopRefreshing();
  }

  startRefreshing() {
    this.interval = setInterval(() => {
      fetch(this.urlValue)
        .then((response) => response.json())
        .then((data) => {
          if (this.chart === undefined) {
            return;
          }

          data = JSON.parse(mockData);
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
    }, 4000);
  }

  stopRefreshing() {
    if (this.refreshTimer) {
      clearInterval(this.interval);
    }
  }

  prepareDatasets(data) {
    data.results.forEach((dataset, i) => {});
  }

  load() {
    console.log(
      "Loading chart",
      this.graphTarget.id,
      this.urlValue,
      this.groupValue
    );

    fetch(this.urlValue)
      .then((response) => response.json())
      .then((data) => {
        data = JSON.parse(mockData);
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
              mode: "index",
              intersect: false,
            },
            fill: false,
            pointRadius: 1,
            pointHoverRadius: 5,
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
              htmlLegend: {
                // ID of the container to put the legend in
                containerID: this.legendTarget.id,
              },
              tooltip: {
                enabled: false,
                position: "nearest",
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
                    console.log("Zoomed from", from, "to", until);
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
            console.log("Zooming to", e.detail.from, e.detail.until);
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
    let listContainer = this.legendTarget.querySelector("ul");

    if (!listContainer) {
      listContainer = document.createElement("ul");
      listContainer.style.margin = 0;
      listContainer.style.padding = 0;

      this.legendTarget.appendChild(listContainer);
    }

    return listContainer;
  }
  getHTMLLegendPlugin() {
    return {
      id: "htmlLegend",
      afterUpdate: function (chart, args, options) {
        if (args.mode === "none") {
          return;
        }
        const ul = this.getOrCreateLegendList();
        ul.style.height = "8rem";
        ul.style.overflow = "scroll";
        ul.style.overflowX = "scroll";
        ul.style.width = "100%";

        // Remove old legend items
        while (ul.firstChild) {
          ul.firstChild.remove();
        }
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

        items.forEach((item) => {
          const li = document.createElement("li");
          li.style.alignItems = "center";
          li.style.cursor = "pointer";
          li.style.marginLeft = "0.875rem";
          li.style.whiteSpace = "nowrap";

          var timer;
          var isDoubleClick = false;
          li.addEventListener("click", (e) => {
            // Don't do anything if it is a double click event.
            isDoubleClick = false;
            timer = setTimeout(() => {
              if (isDoubleClick) {
                return;
              }
              const { type } = chart.config;
              if (type === "pie" || type === "doughnut") {
                // Pie and doughnut charts only have a single dataset and visibility is per item
                chart.toggleDataVisibility(item.index);
              } else {
                chart.setDatasetVisibility(
                  item.datasetIndex,
                  !chart.isDatasetVisible(item.datasetIndex)
                );
              }
              chart.update();
            }, 250);
          });
          li.ondblclick = () => {
            isDoubleClick = true;
            clearTimeout(timer);
            const { type } = chart.config;
            if (type === "pie" || type === "doughnut") {
              // Pie and doughnut charts only have a single dataset and visibility is per item
              chart.toggleDataVisibility(item.index);
            } else {
              // Turn off visibility of all other elements
              chart.data.datasets.forEach((e, i) => {
                if (i !== item.datasetIndex) {
                  chart.setDatasetVisibility(i, this.allVisibleValue);
                }
              });
              chart.setDatasetVisibility(item.datasetIndex, true);
              this.allVisibleValue = !this.allVisibleValue;
              chart.update();
              return;
            }
            chart.update();
          };

          // Color box
          const boxSpan = document.createElement("span");
          boxSpan.style.background = item.fillStyle;
          boxSpan.style.borderColor = item.strokeStyle;
          boxSpan.style.borderWidth = item.lineWidth + "px";
          boxSpan.style.display = "inline-block";
          boxSpan.style.flexShrink = 0;
          boxSpan.style.height = "0.875rem";
          boxSpan.style.marginRight = "0.875rem";
          boxSpan.style.width = "0.875rem";

          // Text
          const textContainer = document.createElement("p");
          textContainer.style.color = item.fontColor;
          textContainer.style.margin = 0;
          textContainer.style.padding = 0;
          textContainer.style.textDecoration = item.hidden
            ? "line-through"
            : "";
          textContainer.style.display = "inline";
          textContainer.style.fontSize = "0.875rem";

          // Make the text contain the item text and the total
          const text = document.createTextNode(
            `[${totals[item.text]}] ${item.text}`
          );
          textContainer.appendChild(text);

          // Add an on hover to text container to turn it bold and off when hover ends
          li.onmouseover = () => {
            console.log("on mouse over");
            textContainer.style.fontWeight = "bold";
            // Make the associated dataset have a larger borderwidth
            chart.data.datasets[item.datasetIndex].borderWidth = 5;
            chart.update("none");
          };
          li.onmouseleave = () => {
            console.log("on mouse out");
            textContainer.style.fontWeight = "normal";
            chart.data.datasets[item.datasetIndex].borderWidth = 3;
            chart.update("none");
          };

          const line = document.createElement("div");
          line.appendChild(boxSpan);
          line.appendChild(textContainer);
          li.appendChild(line);
          ul.appendChild(li);
        });
      }.bind(this),
    };
  }
}

const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector("div");

  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.style.background = "rgba(0, 0, 0, 0.7)";
    tooltipEl.style.borderRadius = "3px";
    tooltipEl.style.color = "white";
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = "none";
    tooltipEl.style.position = "absolute";
    tooltipEl.style.transform = "translate(-50%, 0)";
    tooltipEl.style.transition = "all .1s ease";

    const table = document.createElement("table");
    table.style.margin = "0px";

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

const externalTooltipHandler = (context) => {
  // Tooltip Element
  const { chart, tooltip } = context;
  console.log("tooltip", tooltip);
  const tooltipEl = getOrCreateTooltip(chart);

  // Hide if no tooltip
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Set Text
  if (tooltip.body) {
    const titleLines = tooltip.title || [];
    const bodyLines = tooltip.body.map((b) => b.lines);

    const tableHead = document.createElement("thead");

    titleLines.forEach((title) => {
      const tr = document.createElement("tr");
      tr.style.borderWidth = 0;

      const th = document.createElement("th");
      th.style.borderWidth = 0;
      const text = document.createTextNode(title);

      th.appendChild(text);
      tr.appendChild(th);
      tableHead.appendChild(tr);
    });

    const tableBody = document.createElement("tbody");
    bodyLines.forEach((body, i) => {
      const colors = tooltip.labelColors[i];

      const span = document.createElement("span");
      span.style.background = colors.backgroundColor;
      span.style.borderColor = colors.borderColor;
      span.style.borderWidth = "2px";
      span.style.marginRight = "10px";
      span.style.height = "10px";
      span.style.width = "10px";
      span.style.display = "inline-block";

      const tr = document.createElement("tr");
      tr.style.backgroundColor = "inherit";
      tr.style.borderWidth = 0;

      const td = document.createElement("td");
      td.style.borderWidth = 0;

      const text = document.createTextNode(body);

      td.appendChild(span);
      td.appendChild(text);
      tr.appendChild(td);
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
  tooltipEl.style.left = positionX + tooltip.caretX + "px";
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
