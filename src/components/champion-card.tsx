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
      className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 pb-4 pt-3 text-center shadow-lg"
      style={{ width, ...(teamColor ? { borderColor: teamColor } : {}) }}
    >
      <span className="text-xl font-black uppercase tracking-tight text-gray-900">
        Champion
      </span>
      {logoUrl && (
        <Image
          src={logoUrl}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 object-contain"
        />
      )}
      <span className="flex max-w-full items-baseline gap-1 text-base font-bold text-gray-900">
        {team.seed > 0 && (
          <span className="text-xs font-normal text-gray-400">{team.seed}</span>
        )}
        <span className="truncate">{team.name}</span>
      </span>
    </div>
  );
};
