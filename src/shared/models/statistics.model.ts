/**
 * Mirrors `SandboxStatistics` — live, non-financial operational counts computed
 * from the current database state at call time. No caching upstream, so this is
 * the one endpoint worth re-reading on a timer rather than loading once.
 *
 * Every key in the count maps is always present, 0 when empty: an absent stage
 * and an empty stage mean different things to a council, so render zero rows
 * rather than dropping them.
 */
export interface Statistics {
    /** Count of license/permit accounts (credentials) per lifecycle status. */
    credentialStatusCounts: Record<string, number>;

    /** Count of license applications per processing stage. */
    licenseApplicationStageCounts: Record<string, number>;

    /**
     * Count of permit applications per processing stage. Permits run a lighter
     * pipeline than licenses — no committee tabling, no deferral loop.
     */
    permitApplicationStageCounts: Record<string, number>;

    /**
     * ACTIVE accounts whose validity ends within the next 30 days — the renewal
     * workload coming due.
     */
    expiringSoonCount: number;

    /** Scheduled site inspections not yet completed — the field officers' backlog. */
    inspectionPendingCount: number;

    /** Site inspections already completed, all-time. */
    inspectionCompletedCount: number;
}

/**
 * Plain-language glosses for the status and stage keys, so a dashboard is
 * readable without the spec open beside it. Unknown keys fall through to the
 * raw enum name — the sandbox contract is additive, so new stages will appear
 * here before this map is updated.
 */
export const CREDENTIAL_STATUS_DESCRIPTION: Record<string, string> = {
    INACTIVE: 'Account opened at intake, nothing approved yet',
    ACTIVE: 'Currently valid',
    EXPIRED: 'Validity period has passed',
    REJECTED: 'Application refused',
    CANCELLED: 'Closed before issue',
    BLACKLISTED: 'Barred by the council',
};

/**
 * Stage glosses. The two pipelines do not share a stage vocabulary — a license
 * is tabled to committee (MJKPP / MJKKTP) where a permit is only site-verified
 * — so both sets live here and each map is looked up against its own endpoint.
 */
export const STAGE_DESCRIPTION: Record<string, string> = {
    // License pipeline
    APPLICATION: 'Intake',
    COMPLETENESS_CHECK: 'Document checklist gate',
    INSPECTION_AND_REFERRAL: 'Site inspection and agency referrals',
    MJKPP: 'Tabled to the licensing committee (MJKPP)',
    MJKKTP: 'Tabled to the higher committee (MJKKTP)',
    DEFERRED: 'Sent back for more information',
    // Permit pipeline
    DOCUMENT_CHECK: 'Document check',
    SITE_VERIFICATION: 'Site verification',
    // Shared terminals
    PAYMENT: 'Awaiting payment',
    COMPLETED: 'Issued and closed',
    REJECTED: 'Refused',
};
