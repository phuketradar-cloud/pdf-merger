import type { Rotation } from '../types/pdf';

export function normalizeRotation(angle: number): Rotation {
  const snapped = Math.round(angle / 90) * 90;
  return ((((snapped % 360) + 360) % 360) as Rotation);
}

export function addRotation(current: Rotation, delta: number): Rotation {
  return normalizeRotation(current + delta);
}
