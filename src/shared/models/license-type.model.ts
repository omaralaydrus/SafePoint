/**
 * Mirrors `SandboxLicenseType` — the catalog of what a business can apply for.
 * Reference data: small, slow-moving, safe to load once and cache.
 */
export interface LicenseType {
    /**
     * Stable unique identifier of the type. Use this code — never the display
     * names — when referring to a type in other calls or when correlating data.
     */
    code: string;

    /** Display name in Malay (the council's working language). */
    name: string;

    /** Display name in English. May be null when no translation is maintained. */
    nameEn: string | null;

    /** Base legal category. See `FAMILY_LABEL` for what each value means. */
    family: LicenseFamily;

    /**
     * Risk classification driving which agency referrals are mandatory.
     *
     * Nullable in practice even though the spec declares a bare enum: as at
     * 2026-08-31 two of the thirteen live types return null, meaning the type
     * has not been classified yet. Treat null as "unclassified", never as
     * NOT_HIGH_RISK — the difference decides whether agency referrals are
     * mandatory, so guessing the safe-sounding value is the unsafe choice.
     */
    riskCategory: RiskCategory | null;

    /**
     * Whether the type is currently offered. The list endpoint only returns
     * active types, so this is always true today.
     */
    active: boolean;
}

/**
 * Mirrors the backend enum; Jackson serialises by name, so these literals must
 * match exactly.
 *   LICENSE — an annually renewable license account (Malay: Lesen) that goes
 *             through the full processing pipeline including committee tabling.
 *   PERMIT  — a one-off temporary grant (Malay: Permit) on a lighter pipeline.
 */
export type LicenseFamily = 'LICENSE' | 'PERMIT';

/**
 *   HIGH_RISK     — Malay: Berisiko Tinggi. Referrals to supporting agencies
 *                   are mandatory during processing.
 *   NOT_HIGH_RISK — Malay: Tidak Berisiko Tinggi. Referrals are not mandatory.
 */
export type RiskCategory = 'HIGH_RISK' | 'NOT_HIGH_RISK';

/** Display-only; the backend sends the enum name and nothing else. */
export const FAMILY_LABEL: Record<LicenseFamily, string> = {
    LICENSE: 'Lesen',
    PERMIT: 'Permit',
};

export const RISK_LABEL: Record<RiskCategory, string> = {
    HIGH_RISK: 'Berisiko Tinggi',
    NOT_HIGH_RISK: 'Tidak Berisiko Tinggi',
};
