import Image from "next/image";
import { Team } from "@/lib/types";
import { getTeamLogoUrl } from "@/lib/team-logos";

export const ChampionCard = ({
  team,
  width = 220,
}: {
  team: Team;
  width?: number;
}) => {
  const logoUrl = getTeamLogoUrl(team.name);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-center shadow-md"
      style={{ width }}
    >
      <div className="text-[22px] font-bold leading-7 text-blue-600">
        Champion
      </div>
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
