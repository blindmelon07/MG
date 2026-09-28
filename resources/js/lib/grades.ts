import type { GradingSystem } from '@/types/auth';

export const gradingSystemLabels: Record<GradingSystem, string> = {
    k12: 'K-12 (quarterly)',
    college: 'College (semestral)',
};

/**
 * K-12 grades are percentages shown without trailing zeros (87, 87.5);
 * college grades keep two decimals (1.75).
 */
export function formatGrade(
    value: string | number | null | undefined,
    system: GradingSystem,
): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const number = Number(value);

    return system === 'college' ? number.toFixed(2) : String(number);
}

export function formatUnits(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === ''
        ? '—'
        : String(Number(value));
}

export function isFailing(remarks: string | null): boolean {
    return remarks !== null && remarks.toLowerCase() === 'failed';
}
