// @ts-check

export const VALUE_COMPARE_EPSILON = 1e-9;

export function valuesEqualWithTolerance(a, b, epsilon = VALUE_COMPARE_EPSILON){
  if (typeof a === "number" && typeof b === "number"){
    const parsed = Number(epsilon);
    const tol = (Number.isFinite(parsed) && parsed > 0) ? parsed : VALUE_COMPARE_EPSILON;
    return Math.abs(a - b) < tol;
  }
  return Object.is(a, b);
}
