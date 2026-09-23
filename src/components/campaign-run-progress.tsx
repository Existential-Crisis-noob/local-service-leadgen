"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface RunProgress {
  id: string;
  connector: string;
  progress: number;
  stage: string;
  message: string | null;
  finished: boolean;
  failed: boolean;
}

export function CampaignRunProgress({ runs }: { runs: RunProgress[] }) {
  const router = useRouter();
  const hasActiveRun = runs.some((run) => !run.finished);

  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = window.setInterval(() => router.refresh(), 2200);
    return () => window.clearInterval(timer);
  }, [hasActiveRun, router]);

  if (runs.length === 0) return null;

  return (
    <div className="run-stack" aria-live="polite">
      {runs.map((run) => (
        <div className={`run-progress ${run.failed ? "failed" : run.finished ? "done" : "active"}`} key={run.id}>
          <div className="run-progress-head">
            <div>
              <strong>{run.connector}</strong>
              <span>{run.message ?? run.stage}</span>
            </div>
            <b>{run.failed ? "Failed" : run.finished ? "Complete" : `${run.progress}%`}</b>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={run.progress}
          >
            <i style={{ width: `${run.progress}%` }} />
          </div>
          {!run.finished && (
            <p>Discovery continues in the background. This page updates automatically.</p>
          )}
        </div>
      ))}
    </div>
  );
}
