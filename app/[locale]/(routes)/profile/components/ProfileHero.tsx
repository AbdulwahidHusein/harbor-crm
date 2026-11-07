// app/[locale]/(routes)/profile/components/ProfileHero.tsx
import { Users } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { ProfileHeroAvatar } from "./ProfileHeroAvatar";

type Props = {
  data: Users;
};

export async function ProfileHero({ data }: Props) {
  const t = await getTranslations("ProfilePage");

  return (
    <div className="flex items-center gap-4 border-b border-border px-7 py-6">
      <ProfileHeroAvatar avatar={data.avatar} name={data.name} />
      <div>
        <div className="text-lg font-semibold leading-tight text-foreground">
          {data.name}
        </div>
        <div className="text-sm text-muted-foreground">{data.email}</div>
        <span className="mt-1.5 inline-block rounded-[5px] bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t("hero.role")}
        </span>
      </div>
    </div>
  );
}
