"use client";

import Image from "next/image";
import s from "@/features/challenge/styles/mountainHero.module.css";

interface Props {
  dayNumber?: number;
  totalDays?: number;
}

export default function ChallengeMountainHero(_: Props) {
  return (
    <div className={s.root}>
      <Image
        src="/openthedesk-mountain-hero.svg"
        alt=""
        fill
        priority
        sizes="100vw"
        className={`${s.image} ${s.desktopImage}`}
      />

      <Image
        src="/openthedesk-mountain-hero-mobile.svg"
        alt=""
        fill
        priority
        sizes="100vw"
        className={`${s.image} ${s.mobileImage}`}
      />
    </div>
  );
}
