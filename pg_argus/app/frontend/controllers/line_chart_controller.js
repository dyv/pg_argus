import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="line-chart"
export default class extends Controller {
  static targets = ["graph"];
  static values = { url: String, group: String };
  static colors = ["#008FFB", "#00E396", "#FEB019", "#FF4560", "#775DD0"];

  connect() {
    this.load();
    this.startRefreshing();
  }

  disconnect() {
    this.stopRefreshing();
  }

  startRefreshing() {
    this.interval = setInterval(() => {
      fetch(this.urlValue)
        .then((response) => response.json())
        .then((data) => {
          console.log("updating chart data");
          this.chart.setOption({
            xAxis: {
              data: data.labels,
            },
            series: data.series,
          });
        }, true);
    }, 4000);
  }

  stopRefreshing() {
    if (this.refreshTimer) {
      clearInterval(this.interval);
    }
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
        // Create the echarts instance
        console.log("Creating echarts instance");
        this.chart = echarts.init(this.graphTarget);

        console.log("Setting options");
        // Draw the chart
        this.chart.setOption({
          title: {
            text: data.name,
          },
          animation: true,
          dataZoom: [
            {
              id: "dataZoomX",
              type: "select",
              xAxisIndex: [0],
              filterMode: "filter",
            },
          ],
          tooltip: {
            show: "true",
            confine: true,
            trigger: "item",
            /*formatter: function (params) {
              params.sort((a, b) => a.value - b.value);
              params.reverse();
              params = params.slice(0, 5);
              let result = "";
              for (const param of params) {
                result += `${param.value}: ${param.seriesName}\n`;
              }
              return result;
            },*/

            extraCssText:
              "width:auto; white-space:pre-wrap; font-size: 0.5em; line-height: 1.25em",
          },
          toolbox: {
            orient: "horizontal",
            right: 10,
            feature: {
              saveAsImage: {},
              dataZoom: {
                yAxisIndex: "none",
                icon: {
                  zoom: "path://", // hack to remove zoom button
                },
              },
            },
          },
          xAxis: {
            name: "time",
            type: "time",
            axisLabel: {
              interval: "auto",
              // rotate: 45,
              // formatter: "{HH}-{mm}-{ss}",
            },
          },
          yAxis: {
            type: "value",
          },
          series: data.series,
        });
        this.chart.dispatchAction({
          type: "takeGlobalCursor",
          key: "dataZoomSelect",
          dataZoomSelectActive: true,
        });
        this.chart.on("datazoom", function (notification) {
          let params = notification.batch[0];

          const query_params = new Proxy(
            new URLSearchParams(window.location.search),
            {
              get: (searchParams, prop) => searchParams.get(prop),
            }
          );
          if (
            query_params.start === params.startValue &&
            query_params.end === params.endValue
          ) {
            return;
          }
          var url = new URL(window.location);
          url.searchParams.set("start", params.startValue);
          url.searchParams.set("end", params.endValue);
          window.history.pushState({}, "", url);
          console.log(params);
        });
        this.chart.group = this.groupValue;
        echarts.connect(this.groupValue);
        console.log("Rendering");
      });
  }
}
