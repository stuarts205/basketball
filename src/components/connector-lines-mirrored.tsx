import { ConnectorLines } from "./connector-lines";

export const ConnectorLinesMirrored = ({
  roundIndex,
  totalRounds = 4,
}: {
  roundIndex: number;
  totalRounds?: number;
}) => {
  return (
    <ConnectorLines
      roundIndex={roundIndex}
      totalRounds={totalRounds}
      mirrored
    />
  );
};
