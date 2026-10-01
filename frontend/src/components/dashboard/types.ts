

export interface CalendarDay { date: string; expense: number; revenue: number; net: number; }
export interface AlertItem {
  id: string; title: string; description?: string | null;
  amount?: number | null; daysUntilDue?: number | null;
  severity?: "info" | "warning" | "danger"; dueDate?: string | null;
}
export interface TopExpense { id: string; title: string; amount: number; category: string; date: string; }
