import { Suspense } from "react";
import StatsPageContent from "../stats";

export const dynamic = 'force-dynamic';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-textSecondary">Загрузка...</div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatsPageContent />
    </Suspense>
  );
}

