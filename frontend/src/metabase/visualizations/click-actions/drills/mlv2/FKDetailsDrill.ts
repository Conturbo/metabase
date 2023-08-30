import { t } from "ttag";
import type { DrillMLv2 } from "metabase/visualizations/types/click-actions";
import type * as Lib from "metabase-lib";

export const FKDetailsDrill: DrillMLv2<Lib.FKDetailsDrillThruInfo> = ({
  drill,
  drillDisplayInfo,
  applyDrill,
}) => {
  if (!drill) {
    return [];
  }

  const { objectId } = drillDisplayInfo;

  return [
    {
      name: "object-detail",
      section: "details",
      title: t`View details`,
      buttonType: "horizontal",
      icon: "expand",
      default: true,
      question: () => applyDrill(drill, objectId),
    },
  ];
};
