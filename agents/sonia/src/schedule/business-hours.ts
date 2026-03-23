/**
 * Horario util do escritorio SD Legal
 *
 * Segunda a Sexta, 09:00–18:00, timezone Europe/Lisbon.
 * Feriados nacionais portugueses de 2026.
 */

const TIMEZONE = "Europe/Lisbon";

// Feriados nacionais portugueses 2026 (MM-DD)
const FERIADOS_2026 = [
  "01-01", // Ano Novo
  "04-14", // Sexta-feira Santa
  "04-16", // Pascoa
  "04-25", // Liberdade
  "05-01", // Trabalhador
  "06-04", // Corpo de Deus
  "06-10", // Portugal
  "08-15", // Assuncao
  "10-05", // Republica
  "11-01", // Todos os Santos
  "12-01", // Restauracao
  "12-08", // Imaculada
  "12-25", // Natal
];

function getNowLisbon(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE })
  );
}

function formatMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}-${d}`;
}

export function isHoliday(date?: Date): boolean {
  const d = date ?? getNowLisbon();
  return FERIADOS_2026.includes(formatMMDD(d));
}

export function isWeekend(date?: Date): boolean {
  const d = date ?? getNowLisbon();
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isBusinessHours(date?: Date): boolean {
  const d = date ?? getNowLisbon();
  if (isWeekend(d) || isHoliday(d)) return false;
  const hour = d.getHours();
  return hour >= 9 && hour < 18;
}

export function isOutsideHours(date?: Date): boolean {
  return !isBusinessHours(date);
}

/**
 * Mensagem automatica para fora do horario.
 */
export const OUT_OF_HOURS_MESSAGE =
  "Obrigada pela sua mensagem! O escritorio SD Legal funciona de segunda a sexta, das 9h as 18h. Voltaremos ao seu contacto no proximo dia util. Bom descanso!";

export { TIMEZONE };
