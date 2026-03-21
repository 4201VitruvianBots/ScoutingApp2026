const TABLET_ID_STORAGE_KEY = 'scouting-tablet-id';

function createTabletId() {
    const random = Math.random().toString(36).slice(2, 10);
    return `tablet-${random}`;
}

function getOrCreateTabletId() {
    const existing = localStorage.getItem(TABLET_ID_STORAGE_KEY)?.trim();
    if (existing) return existing;

    const generated = createTabletId();
    localStorage.setItem(TABLET_ID_STORAGE_KEY, generated);
    return generated;
}

export { getOrCreateTabletId, TABLET_ID_STORAGE_KEY };
