"use client";

import Image from "next/image";
import s from "@/features/challenge/styles/mountainHero.module.css";

export default function ChallengeMountainHero() {
  return (
    <div className={s.root}>
      <Image
        src="/openthedesk-mountain-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className={s.image}
      />
    </div>
  );
}
