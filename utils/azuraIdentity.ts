export const normalizeForComparison = (value: string) =>
    value
        .normalize('NFKD')
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]/gu, '');

export const normalizeAzuraIdentity = (value: string) => {
    const normalized = normalizeForComparison(value);
    if (normalized.startsWith('dj') && normalized.length > 2) {
        return normalized.slice(2);
    }
    return normalized;
};
