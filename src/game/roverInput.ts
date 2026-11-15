/** Canonical tokens shared by keyboard input and the live Three.js controller. */
export function roverKey(event: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const physical: Record<string, string> = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e',
    ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
    Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', Escape: 'escape',
  };
  return physical[event.code] ?? event.key.toLowerCase();
}

export const DRIVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift']);

/** Editing and open help/modal surfaces retain their native keyboard behavior. */
export function roverInputBlocked(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"], [data-tutorial-panel], [data-drive-focus]');
}
