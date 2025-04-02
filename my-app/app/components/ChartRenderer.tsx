"use client";
import React from "react";
import PropTypes from "prop-types";

import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import { ChartCanvas, Chart } from "react-stockcharts";
import {
  LineSeries,
  ScatterSeries,
  CircleMarker,
} from "react-stockcharts/lib/series";
import { XAxis, YAxis } from "react-stockcharts/lib/axes";
import {
  CrossHairCursor,
  MouseCoordinateX,
  MouseCoordinateY,
} from "react-stockcharts/lib/coordinates";
import { discontinuousTimeScaleProvider } from "react-stockcharts/lib/scale";
import { fitWidth } from "react-stockcharts/lib/helper";
import { last } from "react-stockcharts/lib/utils";

type Props = {
  chartData: {
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
  width: number;
  ratio: number;
};

class StockChart extends React.Component<Props> {
  render() {
    const { chartData, width, ratio } = this.props;

    // Build data in required shape
    const data = chartData.labels.map((label, i) => ({
      date: new Date(label),
      close: chartData.datasets[0].data[i] || 0,
    }));

    const xScaleProvider = discontinuousTimeScaleProvider.inputDateAccessor((d) => d.date);
    const { data: processedData, xScale, xAccessor, displayXAccessor } = xScaleProvider(data);

    const xExtents = [xAccessor(last(processedData)), xAccessor(processedData[0])];

    return (
      <ChartCanvas
        height={400}
        width={width}
        ratio={ratio}
        margin={{ left: 50, right: 50, top: 10, bottom: 30 }}
        type="svg"
        seriesName="Series"
        data={processedData}
        xScale={xScale}
        xAccessor={xAccessor}
        displayXAccessor={displayXAccessor}
        xExtents={xExtents}
      >
        <Chart id={1} yExtents={(d) => d.close}>
          <XAxis axisAt="bottom" orient="bottom" />
          <YAxis axisAt="left" orient="left" ticks={5} />
          <MouseCoordinateX displayFormat={timeFormat("%Y-%m-%d %H:%M")} />
          <MouseCoordinateY displayFormat={format(".2f")} />

          <LineSeries yAccessor={(d) => d.close} stroke="#2ca02c" />
          <ScatterSeries
            yAccessor={(d) => d.close}
            marker={CircleMarker}
            markerProps={{ r: 3 }}
          />
        </Chart>
        <CrossHairCursor />
      </ChartCanvas>
    );
  }
}

export default fitWidth(StockChart);
