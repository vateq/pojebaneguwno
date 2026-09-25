export const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyE', 'KeyF',
  'ShiftLeft', 'ShiftRight', 'Space',
]);

export function handleGameKey(event, active, pressed, isDown) {
  if (!active || !GAME_KEYS.has(event.code)) return false;
  // Leave browser/system shortcuts alone. None of the game's actions use Ctrl,
  // Alt, or Command, since a page cannot reliably take over reserved shortcuts.
  if (isDown && (event.ctrlKey || event.altKey || event.metaKey)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (isDown) pressed.add(event.code);
  else pressed.delete(event.code);
  return true;
}
