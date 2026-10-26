import Image from "next/image";
import { Team } from "@/lib/types";
import { getTeamLogoUrl, getTeamPrimaryColor } from "@/lib/team-logos";

export const ChampionCard = ({
  team,
  width = 220,
}: {
  team: Team;
  width?: number | string;
}) => {
  const logoUrl = team.logo || getTeamLogoUrl(team.name);
  const teamColor = team.color || getTeamPrimaryColor(team.name);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-3 py-4 text-center shadow-md"
      style={{ width, ...(teamColor ? { borderColor: teamColor } : {}) }}
    >
      <div className="flex min-w-0 items-center justify-center gap-2">
        {logoUrl && (
          <Image
            src={logoUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
        )}
        <span className="truncate text-base font-semibold text-gray-800">
          {team.name}
        </span>
      </div>
    </div>
  );
};
