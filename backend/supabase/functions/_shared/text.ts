const TR_LOCALE = "tr-TR";

export function toTurkishUpper(value: string): string {
  return value.toLocaleUpperCase(TR_LOCALE);
}

export function normalizeTurkishWord(value: string): string {
  return toTurkishUpper(value.trim());
}
