"use client";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "../components/Header";
import ChallengeLanding from "@/features/challenge/components/ChallengeLanding";
import ChallengeDashboard from "@/features/challenge/components/ChallengeDashboard";
import StartChallengeModal from "@/features/challenge/components/StartChallengeModal";
import styles from "@/features/challenge/styles/challengePage.module.css";
import type {
  StatsResponse,
  PastChallenge,
} from "@/features/challenge/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChallengePage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [past, setPast] = useState<PastChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const [statsRes, allRes] = await Promise.all([
        fetch(`${API}/challenge/stats`, { headers }),
        fetch(`${API}/challenge/all`, { headers }),
      ]);
      if (statsRes.ok) setData(await statsRes.json());
      if (allRes.ok) {
        const allData = await allRes.json();
        setPast(
          (allData.challenges ?? []).filter(
            (c: PastChallenge) => c.status !== "active",
          ),
        );
      }
    } catch {}
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.page}>
        <Header
          deskOpen={false}
          refreshing={false}
          onRefresh={() => {}}
          onClearSession={() => {}}
          marketData={null}
          activePage="challenge"
        />
        <div className={styles.loadingState}>Loading…</div>
      </div>
    );
  }

  if (data?.active !== true) {
    return (
      <>
        <ChallengeLanding past={past} onStart={() => setShowModal(true)} />
        {showModal && (
          <StartChallengeModal
            onStarted={() => {
              setShowModal(false);
              load();
            }}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return <ChallengeDashboard data={data} past={past} onRefresh={load} />;
}
