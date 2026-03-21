// @ts-check

export const PRODUCT_NAME = "Vector Intelligence Campaign Engine";
export const PRODUCT_ABBREVIATION = "V.I.C.E.";
export const COMPANY_NAME = "Vector Intelligence LLC";

export function buildSidebarCopyrightText(year = new Date().getFullYear()) {
  const safeYear = Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear();
  return `\u00A9 ${safeYear} by ${COMPANY_NAME}`;
}
