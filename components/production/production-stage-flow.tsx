import {
  PRODUCTION_STAGES,
  STAGE_LABELS,
  type ProductionStage,
} from "@/lib/production/stages";
import { cn } from "@/lib/utils";

interface ProductionStageFlowProps {
  currentStage: string;
  className?: string;
}

export function ProductionStageFlow({
  currentStage,
  className,
}: ProductionStageFlowProps) {
  const currentIdx = PRODUCTION_STAGES.indexOf(currentStage as ProductionStage);

  return (
    <ol
      className={cn(
        "flex gap-1 overflow-x-auto pb-1 scrollbar-thin",
        className,
      )}
    >
      {PRODUCTION_STAGES.map((stage, idx) => {
        const done = currentIdx >= 0 && idx < currentIdx;
        const current = idx === currentIdx;
        return (
          <li
            key={stage}
            title={STAGE_LABELS[stage]}
            className={cn(
              "shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium leading-tight sm:text-xs",
              done && "border-emerald-200 bg-emerald-50 text-emerald-800",
              current && "border-primary bg-primary text-primary-foreground",
              !done && !current && "border-transparent bg-muted/40 text-muted-foreground",
            )}
          >
            <span className="mr-1 opacity-70">{idx + 1}.</span>
            {STAGE_LABELS[stage]}
          </li>
        );
      })}
    </ol>
  );
}
