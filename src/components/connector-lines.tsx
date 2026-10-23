import React from "react";
import { roundLayout } from "@/lib/utils";
import { CARD_H, COL_LABEL_H, CONNECTOR_W } from "@/lib/types";

export const ConnectorLines = ({
  roundIndex,
  totalRounds = 4,
}: {
  roundIndex: number;
  totalRounds?: number;
}) => {
  const { topPad: curTopPad, gap: curGap } = roundLayout(roundIndex);
  const { topPad: prevTopPad, gap: prevGap } = roundLayout(roundIndex - 1);
  const matchCount = Math.pow(2, totalRounds - 1 - roundIndex);
  const prevMatchCount = matchCount * 2;
  const svgH =
    COL_LABEL_H +
    prevTopPad +
    prevMatchCount * CARD_H +
    (prevMatchCount - 1) * prevGap +
    8;

  const paths: React.ReactNode[] = [];
  for (let i = 0; i < matchCount; i++) {
    const yA =
      COL_LABEL_H + prevTopPad + i * 2 * (CARD_H + prevGap) + CARD_H / 2;
    const yB =
      COL_LABEL_H + prevTopPad + (i * 2 + 1) * (CARD_H + prevGap) + CARD_H / 2;
    const yDest = COL_LABEL_H + curTopPad + i * (CARD_H + curGap) + CARD_H / 2;
    const xMid = CONNECTOR_W / 2;
    paths.push(
      <g key={i}>
        <path
          d={`M 0 ${yA} H ${xMid} V ${yDest} H ${CONNECTOR_W}`}
          fill="none"
          stroke="#9ca3af"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        <path
          d={`M 0 ${yB} H ${xMid} V ${yDest} H ${CONNECTOR_W}`}
          fill="none"
          stroke="#9ca3af"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      </g>,
    );
  }
  return (
    <svg
      width={CONNECTOR_W}
      height={svgH}
      className="shrink-0 self-start overflow-visible"
    >
      {paths}
    </svg>
  );
};
