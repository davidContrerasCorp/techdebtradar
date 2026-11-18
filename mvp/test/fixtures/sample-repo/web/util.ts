export function clamp<T extends number>(value: T, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

export const identity = <T>(x: T): T => {
  return x;
};
