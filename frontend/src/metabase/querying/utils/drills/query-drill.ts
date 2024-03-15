import type { ClickAction } from "metabase/visualizations/types";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";

import { DRILLS } from "./constants";

const EXCLUDED_DRILLS: Lib.DrillThruType[] = [
  "drill-thru/column-extract",
  "drill-thru/combine-columns",
];

export function queryDrill(
  question: Question,
  clicked: Lib.ClickObject,
): ClickAction[] {
  const query = question.query();
  const stageIndex = -1;
  const drills = Lib.availableDrillThrus(
    query,
    stageIndex,
    clicked.column,
    clicked.value,
    clicked.data,
    clicked.dimensions,
  ).filter(drill => {
    const info = Lib.displayInfo(query, stageIndex, drill);
    return !EXCLUDED_DRILLS.includes(info.type);
  });

  const applyDrill = (drill: Lib.DrillThru, ...args: unknown[]) => {
    const newQuery = Lib.drillThru(query, stageIndex, drill, ...args);
    return question.setQuery(newQuery);
  };

  return drills.flatMap(drill => {
    const drillInfo = Lib.displayInfo(query, stageIndex, drill);
    const drillHandler = DRILLS[drillInfo.type];
    return drillHandler({
      question,
      query,
      stageIndex,
      drill,
      drillInfo,
      clicked,
      applyDrill,
    });
  });
}
