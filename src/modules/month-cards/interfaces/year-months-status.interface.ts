import { MonthStatus } from '../enums/month-status.enum';

export interface MonthStatusEntry {
  id: string | null;
  month: number;
  status: MonthStatus;
}

export interface YearMonthsStatusResponse {
  year: number;
  months: MonthStatusEntry[];
}
