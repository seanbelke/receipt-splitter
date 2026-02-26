import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { STEP_ORDER, Step } from "./types";

function stepIndex(step: Step): number {
  return { setup: 1, claims: 2, assign: 3, results: 4 }[step];
}

type ProgressHeaderProps = {
  step: Step;
  setStep: (step: Step) => void;
};

export function ProgressHeader({ step, setStep }: ProgressHeaderProps) {
  return (
    <Stack spacing={3} sx={{ mb: 4 }}>
      <Typography className="mono" variant="overline" color="text.secondary" sx={{ letterSpacing: "0.18em" }}>
        Receipt Splitter
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Progress: Step {stepIndex(step)} of 4
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {STEP_ORDER.map((stepName) => {
          const isCurrent = stepName === step;
          const isDone = stepIndex(stepName) < stepIndex(step);
          const canGoToStep = isDone;
          return (
            <Chip
              key={stepName}
              label={stepName}
              onClick={canGoToStep ? () => setStep(stepName) : undefined}
              clickable={canGoToStep}
              aria-current={isCurrent ? "step" : undefined}
              sx={{
                textTransform: "capitalize",
                fontWeight: 600,
                ...(isCurrent
                  ? {
                      bgcolor: "primary.main",
                      color: "common.white",
                    }
                  : isDone
                    ? {
                        bgcolor: "primary.50",
                        color: "primary.dark",
                      }
                    : {
                        bgcolor: "grey.200",
                        color: "text.secondary",
                      }),
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
