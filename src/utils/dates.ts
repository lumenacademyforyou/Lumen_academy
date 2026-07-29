import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns";

export const toISODate = (date: Date): string => format(date, "yyyy-MM-dd");

export const todayISO = (): string => toISODate(new Date());

export const parseDate = (iso: string): Date => parseISO(iso);

export const isDateToday = (iso: string): boolean => isToday(parseISO(iso));

export const isSameISODay = (isoA: string, isoB: string): boolean => isSameDay(parseISO(isoA), parseISO(isoB));

export const formatShort = (iso: string): string => format(parseISO(iso), "MMM d");

export const formatDayLabel = (iso: string): string => format(parseISO(iso), "EEE d").toUpperCase();

export const formatLong = (iso: string): string => format(parseISO(iso), "EEEE, MMMM d, yyyy");

export const formatMonthYear = (date: Date): string => format(date, "MMMM yyyy");

export const getWeekDates = (anchorISO: string): string[] => {
  const start = startOfWeek(parseISO(anchorISO), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)));
};

export const addDaysISO = (iso: string, days: number): string => toISODate(addDays(parseISO(iso), days));

export const getUpcomingWeekend = (fromISO: string): string => {
  const date = parseISO(fromISO);
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  return toISODate(addDays(date, daysUntilSaturday));
};
