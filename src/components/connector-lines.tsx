import React from "react";
import { roundLayout } from "@/lib/utils";
import {
  CARD_H,
  CARD_W,
  COL_LABEL_H,
  CONNECTOR_W,
  ROUND_INSETS,
} from "@/lib/types";

export const ConnectorLines = ({
  roundIndex,
  totalRounds = 4,
  mirrored = false,
}: {
  roundIndex: number;
  totalRounds?: number;
  mirrored?: boolean;
}) => {
  const { topPad: curTopPad, gap: curGap } = roundLayout(roundIndex);
  const { topPad: prevTopPad, gap: prevGap } = roundLayout(roundIndex - 1);
  const connectorWidth = CONNECTOR_W + (roundIndex >= 2 ? 12 : 0);
  const sourceX = ROUND_INSETS[roundIndex] ?? 0;
  const destinationX =
    roundIndex >= 2 ? connectorWidth + CARD_W : connectorWidth;
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
    const xMid = sourceX + CONNECTOR_W / 2;
    paths.push(
      <g key={i}>
        <path
          d={`M ${sourceX} ${yA} H ${xMid} V ${yDest} H ${destinationX}`}
          fill="none"
          stroke="#b8a48a"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        <path
          d={`M ${sourceX} ${yB} H ${xMid} V ${yDest} H ${destinationX}`}
          fill="none"
          stroke="#b8a48a"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      </g>,
    );
  }
  return (
    <svg
      width={connectorWidth}
      height={svgH}
      className="shrink-0 self-start overflow-visible"
    >
      <g
        transform={
          mirrored ? `translate(${connectorWidth} 0) scale(-1 1)` : undefined
        }
      >
        {paths}
      </g>
    </svg>
  );
};
