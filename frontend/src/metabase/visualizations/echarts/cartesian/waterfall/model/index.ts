import type { RawSeries } from "metabase-types/api";
import type {
  ComputedVisualizationSettings,
  RenderingContext,
} from "metabase/visualizations/types";
import type {
  BaseCartesianChartModel,
  ShowWarning,
} from "metabase/visualizations/echarts/cartesian/model/types";
import {
  getCardSeriesModels,
  getDimensionModel,
} from "metabase/visualizations/echarts/cartesian/model/series";
import { getCartesianChartColumns } from "metabase/visualizations/lib/graph/columns";
import {
  filterNullDimensionValues,
  getCardsColumnByDataKeyMap,
  getJoinedCardsDataset,
  sortDataset,
} from "metabase/visualizations/echarts/cartesian/model/dataset";
import { getYAxisModel } from "metabase/visualizations/echarts/cartesian/model/axis";
import { WATERFALL_END_KEY, WATERFALL_TOTAL_KEY } from "../constants";
import { getAxisTransforms } from "../../model/transforms";
import {
  extendOriginalDatasetWithTotalDatum,
  getWaterfallDataset,
} from "./dataset";
import { getWaterfallXAxisModel } from "./axis";

export const getWaterfallChartModel = (
  rawSeries: RawSeries,
  settings: ComputedVisualizationSettings,
  renderingContext: RenderingContext,
  showWarning?: ShowWarning,
): BaseCartesianChartModel => {
  // Waterfall chart support one card only
  const [singleRawSeries] = rawSeries;
  const { data } = singleRawSeries;

  const cardsColumns = [getCartesianChartColumns(data.cols, settings)];
  const columnByDataKey = getCardsColumnByDataKeyMap(rawSeries, cardsColumns);
  const dimensionModel = getDimensionModel(rawSeries, cardsColumns);
  const [seriesModel] = getCardSeriesModels(
    singleRawSeries,
    cardsColumns[0],
    false,
    true,
    settings,
    renderingContext,
  );

  let dataset = getJoinedCardsDataset(rawSeries, cardsColumns, showWarning);
  dataset = sortDataset(dataset, settings["graph.x_axis.scale"]);

  const xAxisModel = getWaterfallXAxisModel(
    dimensionModel,
    rawSeries,
    dataset,
    settings,
    renderingContext,
  );
  if (
    xAxisModel.axisType === "value" ||
    xAxisModel.axisType === "time" ||
    xAxisModel.isHistogram
  ) {
    dataset = filterNullDimensionValues(dataset, showWarning);
  }

  const yAxisScaleTransforms = getAxisTransforms(
    settings["graph.y_axis.scale"],
  );

  const transformedDataset = getWaterfallDataset(
    dataset,
    yAxisScaleTransforms,
    seriesModel.dataKey,
    settings,
    xAxisModel,
  );

  // Pass waterfall dataset and keys for correct extent computation
  const leftAxisModel = getYAxisModel(
    [WATERFALL_END_KEY],
    transformedDataset,
    settings,
    { [WATERFALL_END_KEY]: seriesModel.column },
    renderingContext,
  );

  // Extending the original dataset with total datum for tooltips
  const originalDatasetWithTotal = extendOriginalDatasetWithTotalDatum(
    dataset,
    transformedDataset[transformedDataset.length - 1],
    seriesModel.dataKey,
    settings,
  );

  return {
    dataset: originalDatasetWithTotal,
    transformedDataset,
    seriesModels: [seriesModel],
    yAxisScaleTransforms,
    columnByDataKey,
    dimensionModel,
    xAxisModel,
    leftAxisModel,
    rightAxisModel: null,
    seriesIdToDataKey: {
      [WATERFALL_TOTAL_KEY]: seriesModel.dataKey,
    },
  };
};
