import { AppError } from "../middleware/error.middleware";
import { Role } from "../models/auth.model";
import { Report } from "../models/report.model";

/*
  Status Transition Matrix:
  
  draft      -> in_review  (editor+, if entries ≥ 1)
  in_review  -> draft      (editor+)
  in_review  -> approved   (admin only)
  approved   -> archived   (editor+)
  archived   -> (nothing)  (immutable)
*/

interface TransitionRule {
  allowedRoles: Role[];
  condition?: (report: Report) => void;
}

const transitionMatrix: Record<string, Record<string, TransitionRule>> = {
  draft: {
    in_review: {
      allowedRoles: ["editor", "admin"],
      condition: (report) => {
        if (report.entries.length === 0) {
          throw new AppError(
            422,
            "TRANSITION_PRECONDITION_FAILED",
            "Report must have at least one entry before submitting for review"
          );
        }
      },
    },
  },
  in_review: {
    draft: {
      allowedRoles: ["editor", "admin"],
    },
    approved: {
      allowedRoles: ["admin"],
    },
  },
  approved: {
    archived: {
      allowedRoles: ["editor", "admin"],
    },
  },
  archived: {},
};

export function validateTransition(
  report: Report,
  newStatus: string,
  userRole: Role
): void {
  const currentStatus = report.status;

  // No change : not a transition
  if (currentStatus === newStatus) return;

  // Archived reports are immutable
  if (currentStatus === "archived") {
    throw new AppError(
      422,
      "REPORT_ARCHIVED",
      "Archived reports cannot be modified"
    );
  }

  const allowedTransitions = transitionMatrix[currentStatus];
  const rule = allowedTransitions?.[newStatus];

  // Transition not in matrix
  if (!rule) {
    throw new AppError(
      422,
      "INVALID_TRANSITION",
      `Cannot transition from '${currentStatus}' to '${newStatus}'`
    );
  }

  // Role check
  if (!rule.allowedRoles.includes(userRole)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      `Role '${userRole}' cannot transition from '${currentStatus}' to '${newStatus}'`
    );
  }

  // Precondition check
  if (rule.condition) {
    rule.condition(report);
  }
}
