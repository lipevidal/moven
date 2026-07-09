import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../src/database/supabase";

type FinanceType = "income" | "expense";
type ExpenseKind = "single" | "recurring" | "installment";
type ExpenseStatus = "pending" | "paid" | "partial";
type RecurrenceType = "daily" | "weekly" | "biweekly" | "monthly";
type SectionKey = "income" | "overdue" | "today" | "upcoming" | "paid";
type ListVariant = SectionKey;
type DebtSearchFilter = "all" | "overdue" | "paid" | "upcoming";
type DebtSearchMonthFilter = "selected" | "all";
type BottomMode = "summary" | "statement";
type ScopeAction = "edit" | "delete";
type ScopeValue = "single" | "unpaid" | "future" | "all";

type FinanceCategory = {
  id?: string;
  user_id?: string | null;
  name: string;
  type: FinanceType;
};

type FinanceTransaction = {
  id: string;
  user_id: string;
  type: FinanceType;
  description: string | null;
  category: string | null;
  category_id?: string | null;
  amount: number;
  transaction_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  status: ExpenseStatus | "paid";
  expense_kind?: ExpenseKind | null;
  recurrence_type?: RecurrenceType | null;
  recurrence_day?: number | null;
  recurrence_day_two?: number | null;
  installment_number?: number | null;
  installments_count?: number | null;
  series_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  statement_order?: number;
};

type StatementItem = {
  id: string;
  date: Date;
  createdAt: string;
  launchOrder: number;
  statementSortAt: string;
  title: string;
  subtitle: string;
  type: FinanceType;
  amount: number;
  balanceAfter: number;
};

const DEFAULT_INCOME_CATEGORIES = ["Salário", "Ganhos pelas Plataformas"];
const DEFAULT_EXPENSE_CATEGORIES = [
  "Alimentação",
  "Cartão",
  "Casa",
  "Carro",
  "Roupa",
  "Beleza",
  "Saúde",
];

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const weekDays = [
  { label: "Domingo", value: 0 },
  { label: "Segunda", value: 1 },
  { label: "Terça", value: 2 },
  { label: "Quarta", value: 3 },
  { label: "Quinta", value: 4 },
  { label: "Sexta", value: 5 },
  { label: "Sábado", value: 6 },
];

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function maskCurrency(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 12);

  if (!numbers) return "";

  return (Number(numbers) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTransactionDateISOString(date: Date) {
  const todayKey = toLocalDateKey(new Date());
  const selectedKey = toLocalDateKey(date);

  if (todayKey === selectedKey) {
    return toLocalISOString(new Date());
  }

  return toLocalISOString(date);
}

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function parseDatabaseDate(value?: string | null) {
  if (!value) return null;

  const direct = String(value).match(/^(\d{4}-\d{2}-\d{2})/);

  if (direct) return dateFromKey(direct[1]);

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "--/--/----";

  const date = value instanceof Date ? value : parseDatabaseDate(value);

  if (!date) return "--/--/----";

  return date.toLocaleDateString("pt-BR");
}

function getToday() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);

  return date;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isDateInRange(value: Date, start: Date, end: Date) {
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
}

function getTransactionDate(transaction: FinanceTransaction) {
  return (
    parseDatabaseDate(
      transaction.transaction_date ||
        transaction.due_date ||
        transaction.paid_at,
    ) ?? getToday()
  );
}

function getExpenseDueDate(transaction: FinanceTransaction) {
  return (
    parseDatabaseDate(transaction.due_date || transaction.transaction_date) ??
    getToday()
  );
}

function getExpensePaidDate(transaction: FinanceTransaction) {
  return parseDatabaseDate(transaction.paid_at) ?? null;
}

function getPaidAmount(transaction: FinanceTransaction) {
  return Number(transaction.paid_amount ?? 0);
}

function getDateKeyFromValue(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    return toLocalDateKey(value);
  }

  const directDateMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);

  if (directDateMatch) {
    return directDateMatch[1];
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return toLocalDateKey(parsedDate);
}

function getTransactionDueDateKey(transaction: FinanceTransaction) {
  return getDateKeyFromValue(
    transaction.due_date ||
      transaction.transaction_date ||
      transaction.created_at,
  );
}

function getRemainingAmount(transaction: FinanceTransaction) {
  return Math.max(
    Number(transaction.amount ?? 0) - getPaidAmount(transaction),
    0,
  );
}

function getTransactionTitleParts(
  transaction: FinanceTransaction,
  fallback: string,
) {
  const baseTitle = transaction.description || transaction.category || fallback;

  if (
    transaction.type === "expense" &&
    transaction.expense_kind === "installment" &&
    transaction.installment_number &&
    transaction.installments_count
  ) {
    return {
      baseTitle,
      installmentSuffix: `${transaction.installment_number}/${transaction.installments_count}`,
    };
  }

  return {
    baseTitle,
    installmentSuffix: null,
  };
}

function getTransactionDisplayTitle(
  transaction: FinanceTransaction,
  fallback: string,
) {
  const titleParts = getTransactionTitleParts(transaction, fallback);

  return titleParts.installmentSuffix
    ? `${titleParts.baseTitle} ${titleParts.installmentSuffix}`
    : titleParts.baseTitle;
}

function getSeriesId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();

  return Math.min(Math.max(day, 1), lastDay);
}

function nextWeekday(fromDate: Date, weekday: number) {
  const date = new Date(fromDate);
  date.setHours(12, 0, 0, 0);

  const diff = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);

  return date;
}

function getExpenseIcon(category?: string | null) {
  const normalized = String(category ?? "").toLowerCase();

  if (normalized.includes("aliment")) return "restaurant-outline" as const;
  if (normalized.includes("cart")) return "card-outline" as const;
  if (normalized.includes("casa")) return "home-outline" as const;
  if (normalized.includes("carro")) return "car-sport-outline" as const;
  if (normalized.includes("roupa")) return "shirt-outline" as const;
  if (normalized.includes("beleza")) return "sparkles-outline" as const;
  if (normalized.includes("saúde") || normalized.includes("saude"))
    return "medkit-outline" as const;

  return "receipt-outline" as const;
}

function getIncomeIcon(category?: string | null) {
  const normalized = String(category ?? "").toLowerCase();

  if (normalized.includes("salário") || normalized.includes("salario"))
    return "business-outline" as const;
  if (normalized.includes("plataforma")) return "car-sport-outline" as const;

  return "cash-outline" as const;
}

export default function PersonalFinanceScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthStart(getToday()));
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [customCategories, setCustomCategories] = useState<FinanceCategory[]>(
    [],
  );

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(
    {
      income: false,
      overdue: false,
      today: false,
      upcoming: false,
      paid: false,
    },
  );

  const [bottomMode, setBottomMode] = useState<BottomMode>("summary");
  const [debtSearchVisible, setDebtSearchVisible] = useState(false);
  const [debtSearchTerm, setDebtSearchTerm] = useState("");
  const [debtSearchCategory, setDebtSearchCategory] = useState("Todas");
  const [debtSearchFilter, setDebtSearchFilter] =
    useState<DebtSearchFilter>("all");
  const [debtSearchMonthFilter, setDebtSearchMonthFilter] =
    useState<DebtSearchMonthFilter>("selected");
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(
    getToday().getFullYear(),
  );
  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<
    | null
    | "incomeDate"
    | "dueDate"
    | "paidAt"
    | "firstInstallmentDue"
    | "paymentDate"
  >(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<FinanceType>("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [editingIncome, setEditingIncome] = useState<FinanceTransaction | null>(
    null,
  );
  const [selectedIncome, setSelectedIncome] =
    useState<FinanceTransaction | null>(null);
  const [incomeActionsVisible, setIncomeActionsVisible] = useState(false);
  const [incomeDate, setIncomeDate] = useState(getToday());
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeCategory, setIncomeCategory] = useState(
    DEFAULT_INCOME_CATEGORIES[0],
  );
  const [savingIncome, setSavingIncome] = useState(false);

  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<FinanceTransaction | null>(null);
  const [editScope, setEditScope] = useState<ScopeValue>("single");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState(
    DEFAULT_EXPENSE_CATEGORIES[0],
  );
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>("single");
  const [singleAlreadyPaid, setSingleAlreadyPaid] = useState(false);
  const [singlePaidAt, setSinglePaidAt] = useState(getToday());
  const [singleDueDate, setSingleDueDate] = useState(getToday());
  const [recurrenceType, setRecurrenceType] =
    useState<RecurrenceType>("monthly");
  const [weeklyDueDay, setWeeklyDueDay] = useState(getToday().getDay());
  const [biweeklyDayOne, setBiweeklyDayOne] = useState("5");
  const [biweeklyDayTwo, setBiweeklyDayTwo] = useState("20");
  const [monthlyDueDay, setMonthlyDueDay] = useState(
    String(getToday().getDate()),
  );
  const [installmentsCount, setInstallmentsCount] = useState("12");
  const [installmentsPaid, setInstallmentsPaid] = useState("0");
  const [firstInstallmentDue, setFirstInstallmentDue] = useState(getToday());
  const [savingExpense, setSavingExpense] = useState(false);

  const [selectedExpense, setSelectedExpense] =
    useState<FinanceTransaction | null>(null);
  const [expenseActionsVisible, setExpenseActionsVisible] = useState(false);
  const [scopeModalVisible, setScopeModalVisible] = useState(false);
  const [scopeAction, setScopeAction] = useState<ScopeAction>("edit");
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [payFullAmount, setPayFullAmount] = useState(true);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const incomeCategories = useMemo(() => {
    const custom = customCategories
      .filter((category) => category.type === "income")
      .map((category) => category.name);

    return Array.from(new Set([...DEFAULT_INCOME_CATEGORIES, ...custom]));
  }, [customCategories]);

  const expenseCategories = useMemo(() => {
    const custom = customCategories
      .filter((category) => category.type === "expense")
      .map((category) => category.name);

    return Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...custom]));
  }, [customCategories]);

  const monthStart = useMemo(
    () => getMonthStart(selectedMonth),
    [selectedMonth],
  );
  const monthEnd = useMemo(() => getMonthEnd(selectedMonth), [selectedMonth]);
  const todayKey = toLocalDateKey(getToday());
  const selectedMonthLabel = `${months[selectedMonth.getMonth()]} de ${selectedMonth.getFullYear()}`;

  const incomesInMonth = useMemo(() => {
    return transactions
      .filter((item) => item.type === "income")
      .filter((item) =>
        isDateInRange(getTransactionDate(item), monthStart, monthEnd),
      )
      .sort(
        (a, b) =>
          getTransactionDate(a).getTime() - getTransactionDate(b).getTime(),
      );
  }, [transactions, monthStart, monthEnd]);

  const expenses = useMemo(
    () => transactions.filter((item) => item.type === "expense"),
    [transactions],
  );

  const overdueExpenses = useMemo(() => {
    const todayKey = toLocalDateKey(getToday());
    const selectedMonthEndKey = toLocalDateKey(getMonthEnd(selectedMonth));

    return transactions
      .filter((transaction) => {
        if (transaction.type !== "expense") return false;
        if (transaction.status === "paid") return false;

        const dueDateKey = getTransactionDueDateKey(transaction);

        if (!dueDateKey) return false;

        /*
          Despesas vencidas devem aparecer somente até o mês selecionado.
          Exemplo:
          - mês selecionado: Julho
          - mostra vencidas de meses anteriores e de Julho
          - não mostra despesas vencidas depois de Julho quando o usuário estiver olhando Julho
        */
        return dueDateKey < todayKey && dueDateKey <= selectedMonthEndKey;
      })
      .sort((a, b) => {
        const aDate = getTransactionDueDateKey(a) ?? "";
        const bDate = getTransactionDueDateKey(b) ?? "";

        return aDate.localeCompare(bDate);
      });
  }, [transactions, selectedMonth]);

  const dueTodayExpenses = useMemo(() => {
    return expenses
      .filter((item) => item.status !== "paid")
      .filter((item) => toLocalDateKey(getExpenseDueDate(item)) === todayKey)
      .sort((a, b) =>
        String(a.description ?? "").localeCompare(
          String(b.description ?? ""),
          "pt-BR",
        ),
      );
  }, [expenses, todayKey]);

  const upcomingExpenses = useMemo(() => {
    return expenses
      .filter((item) => item.status !== "paid")
      .filter((item) => {
        const dueDate = getExpenseDueDate(item);
        const dueKey = toLocalDateKey(dueDate);

        return (
          dueKey > todayKey && isDateInRange(dueDate, monthStart, monthEnd)
        );
      })
      .sort(
        (a, b) =>
          getExpenseDueDate(a).getTime() - getExpenseDueDate(b).getTime(),
      );
  }, [expenses, todayKey, monthStart, monthEnd]);

  const paidExpensesInMonth = useMemo(() => {
    return expenses
      .filter((item) => item.status === "paid" || getPaidAmount(item) > 0)
      .filter((item) => {
        const paidDate = getExpensePaidDate(item);

        return paidDate ? isDateInRange(paidDate, monthStart, monthEnd) : false;
      })
      .sort((a, b) => {
        const aDate = getExpensePaidDate(a)?.getTime() ?? 0;
        const bDate = getExpensePaidDate(b)?.getTime() ?? 0;

        return aDate - bDate;
      });
  }, [expenses, monthStart, monthEnd]);

  const debtSearchCategories = useMemo(() => {
    const categories = expenses
      .map((item) => item.category)
      .filter(Boolean)
      .map((category) => String(category));

    return ["Todas", ...Array.from(new Set(categories))];
  }, [expenses]);

  const debtSearchResults = useMemo(() => {
    const search = debtSearchTerm.trim().toLowerCase();

    return expenses
      .filter((item) => {
        const title = getTransactionDisplayTitle(item, "Despesa");
        const searchableText = `${title} ${item.description ?? ""} ${
          item.category ?? ""
        }`.toLowerCase();

        if (search && !searchableText.includes(search)) {
          return false;
        }

        if (
          debtSearchCategory !== "Todas" &&
          item.category !== debtSearchCategory
        ) {
          return false;
        }

        const dueKey =
          getTransactionDueDateKey(item) ?? toLocalDateKey(getExpenseDueDate(item));
        const isPaid = item.status === "paid";
        const isOverdue = !isPaid && dueKey < todayKey;
        const isUpcoming = !isPaid && dueKey >= todayKey;

        if (debtSearchFilter === "overdue" && !isOverdue) return false;
        if (debtSearchFilter === "paid" && !isPaid) return false;
        if (debtSearchFilter === "upcoming" && !isUpcoming) return false;

        if (debtSearchMonthFilter === "selected") {
          const referenceDate = isPaid
            ? getExpensePaidDate(item)
            : getExpenseDueDate(item);

          if (!referenceDate) return false;

          return isDateInRange(referenceDate, monthStart, monthEnd);
        }

        return true;
      })
      .sort((a, b) => {
        const aDate = getExpenseDueDate(a).getTime();
        const bDate = getExpenseDueDate(b).getTime();

        return aDate - bDate;
      });
  }, [
    expenses,
    debtSearchTerm,
    debtSearchCategory,
    debtSearchFilter,
    debtSearchMonthFilter,
    monthStart,
    monthEnd,
    todayKey,
  ]);

  const debtSearchTotal = useMemo(() => {
    return debtSearchResults.reduce((total, item) => {
      const remaining = getRemainingAmount(item);
      const paid = getPaidAmount(item);

      if (item.status === "paid") return total + paid;

      return total + (remaining || Number(item.amount ?? 0));
    }, 0);
  }, [debtSearchResults]);

  const incomeTotal = incomesInMonth.reduce(
    (total, item) => total + Number(item.amount ?? 0),
    0,
  );
  const overdueTotal = overdueExpenses.reduce(
    (total, item) => total + getRemainingAmount(item),
    0,
  );
  const dueTodayTotal = dueTodayExpenses.reduce(
    (total, item) => total + getRemainingAmount(item),
    0,
  );
  const upcomingTotal = upcomingExpenses.reduce(
    (total, item) => total + getRemainingAmount(item),
    0,
  );
  const paidTotal = paidExpensesInMonth.reduce(
    (total, item) => total + getPaidAmount(item),
    0,
  );

  const currentBalance = useMemo(() => {
    return transactions.reduce((total, item) => {
      if (item.type === "income") return total + Number(item.amount ?? 0);

      return total - getPaidAmount(item);
    }, 0);
  }, [transactions]);

  const payableTotal = useMemo(() => {
    const selectedMonthStartKey = toLocalDateKey(monthStart);
    const selectedMonthEndKey = toLocalDateKey(monthEnd);
    const currentTodayKey = toLocalDateKey(getToday());

    return expenses
      .filter((item) => item.status !== "paid")
      .filter((item) => {
        const dueDateKey = getTransactionDueDateKey(item);

        if (!dueDateKey) return false;

        const isFromSelectedMonth =
          dueDateKey >= selectedMonthStartKey &&
          dueDateKey <= selectedMonthEndKey;

        /*
          No Saldo atual, o "A pagar" deve considerar:
          - despesas vencidas de meses anteriores;
          - despesas vencidas do mês selecionado;
          - despesas não pagas do mês selecionado.

          Assim, não entram despesas futuras de outros meses.
        */
        const isPastOverdue = dueDateKey < selectedMonthStartKey && dueDateKey < currentTodayKey;

        return isFromSelectedMonth || isPastOverdue;
      })
      .reduce((total, item) => total + getRemainingAmount(item), 0);
  }, [expenses, monthStart, monthEnd]);

  const statementItems = useMemo(
    () => buildStatementItems(),
    [transactions, monthStart, monthEnd],
  );

  useFocusEffect(
    useCallback(() => {
      loadFinanceData();
    }, []),
  );

  async function loadFinanceData() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        setUserId("");
        setTransactions([]);
        setCustomCategories([]);
        return;
      }

      setUserId(user.id);

      const [transactionsResponse, categoriesResponse] = await Promise.all([
        supabase
          .from("personal_finance_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("personal_finance_categories")
          .select("id, user_id, name, type")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (categoriesResponse.error) throw categoriesResponse.error;

      const orderedTransactions = (
        (transactionsResponse.data ?? []) as FinanceTransaction[]
      ).map((transaction, index) => ({
        ...transaction,
        statement_order: index,
      }));

      setTransactions(orderedTransactions);
      setCustomCategories((categoriesResponse.data ?? []) as FinanceCategory[]);
    } catch (error: any) {
      console.log("Erro ao carregar financeiro pessoal:", error);
      Alert.alert(
        "Erro ao carregar financeiro",
        String(error?.message ?? "").includes("personal_finance")
          ? "Rode o SQL do financeiro pessoal no Supabase e tente novamente."
          : "Não foi possível carregar os dados financeiros.",
      );
    } finally {
      setLoading(false);
    }
  }

  function buildStatementItems() {
    /*
      Correção da ordem real do extrato:

      O erro acontecia porque uma despesa pode ter sido criada antes,
      mas só foi paga depois. Nesse caso, created_at da despesa é antigo
      e não representa o momento do lançamento no extrato.

      Regra correta:
      - Receita: o evento do extrato é o lançamento da receita, então usa created_at.
      - Despesa paga/parcial: o evento do extrato é o pagamento, então usa updated_at.
        O updated_at muda exatamente quando o pagamento é salvo.

      Depois de ordenar os eventos, calculamos o saldo correndo.
      Assim, o saldo mostrado é o saldo que ficou após cada transação.
    */
    const statementEvents = transactions
      .flatMap((item) => {
        if (item.type === "income") {
          const date = getTransactionDate(item);
          const amount = Number(item.amount ?? 0);

          return [
            {
              id: item.id,
              date,
              createdAt: item.created_at || "",
              launchOrder: item.statement_order ?? 0,
              statementSortAt: item.created_at || item.transaction_date || "",
              title: getTransactionDisplayTitle(item, "Receita"),
              subtitle: item.category || "Receita",
              type: "income" as FinanceType,
              amount,
              balanceAfter: 0,
            },
          ];
        }

        const paidAmount = getPaidAmount(item);

        if (paidAmount <= 0) return [];

        const paidDate = getExpensePaidDate(item) ?? getExpenseDueDate(item);

        return [
          {
            id: item.id,
            date: paidDate,
            createdAt: item.created_at || "",
            launchOrder: item.statement_order ?? 0,
            statementSortAt:
              item.updated_at || item.paid_at || item.created_at || "",
            title: getTransactionDisplayTitle(item, "Despesa"),
            subtitle: item.category || "Despesa paga",
            type: "expense" as FinanceType,
            amount: -paidAmount,
            balanceAfter: 0,
          },
        ];
      })
      .sort((a, b) => {
        const aTime = a.statementSortAt
          ? new Date(a.statementSortAt).getTime()
          : Number.NaN;
        const bTime = b.statementSortAt
          ? new Date(b.statementSortAt).getTime()
          : Number.NaN;

        if (
          Number.isFinite(aTime) &&
          Number.isFinite(bTime) &&
          aTime !== bTime
        ) {
          return aTime - bTime;
        }

        return a.launchOrder - b.launchOrder;
      });

    let runningBalance = 0;
    const visibleItems: StatementItem[] = [];

    statementEvents.forEach((item) => {
      runningBalance += item.amount;

      if (isDateInRange(item.date, monthStart, monthEnd)) {
        visibleItems.push({
          ...item,
          balanceAfter: runningBalance,
        });
      }
    });

    return visibleItems;
  }

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function changeMonth(direction: "prev" | "next") {
    const nextDate = new Date(selectedMonth);
    nextDate.setMonth(
      selectedMonth.getMonth() + (direction === "next" ? 1 : -1),
    );

    setSelectedMonth(getMonthStart(nextDate));
  }

  function goToCurrentMonth() {
    const today = getMonthStart(getToday());

    setSelectedMonth(today);
    setMonthPickerYear(today.getFullYear());
    setYearDropdownVisible(false);
    setMonthPickerVisible(false);
  }

  function openMonthPicker() {
    setMonthPickerYear(selectedMonth.getFullYear());
    setYearDropdownVisible(false);
    setMonthPickerVisible(true);
  }

  function openDebtSearchModal() {
    setDebtSearchMonthFilter("selected");
    setDebtSearchVisible(true);
  }

  function openIncomeForm() {
    setQuickActionsVisible(false);
    setEditingIncome(null);
    setSelectedIncome(null);
    setIncomeDate(getToday());
    setIncomeAmount("");
    setIncomeDescription("");
    setIncomeCategory(incomeCategories[0] ?? DEFAULT_INCOME_CATEGORIES[0]);
    setIncomeModalVisible(true);
  }

  function openExpenseForm() {
    setQuickActionsVisible(false);
    setEditingExpense(null);
    setEditScope("single");
    setExpenseAmount("");
    setExpenseDescription("");
    setExpenseCategory(expenseCategories[0] ?? DEFAULT_EXPENSE_CATEGORIES[0]);
    setExpenseKind("single");
    setSingleAlreadyPaid(false);
    setSinglePaidAt(getToday());
    setSingleDueDate(getToday());
    setRecurrenceType("monthly");
    setWeeklyDueDay(getToday().getDay());
    setBiweeklyDayOne("5");
    setBiweeklyDayTwo("20");
    setMonthlyDueDay(String(getToday().getDate()));
    setInstallmentsCount("12");
    setInstallmentsPaid("0");
    setFirstInstallmentDue(getToday());
    setExpenseModalVisible(true);
  }

  function openCategoryModal(type: FinanceType) {
    setCategoryTarget(type);
    setNewCategoryName("");
    setCategoryModalVisible(true);
  }

  async function handleCreateCategory() {
    try {
      const name = newCategoryName.trim();

      if (!name) {
        Alert.alert("Categoria obrigatória", "Informe o nome da categoria.");
        return;
      }

      if (!userId) return;

      setSavingCategory(true);

      const { error } = await supabase
        .from("personal_finance_categories")
        .insert({
          user_id: userId,
          name,
          type: categoryTarget,
        });

      if (error) throw error;

      setCategoryModalVisible(false);
      setNewCategoryName("");

      if (categoryTarget === "income") setIncomeCategory(name);
      if (categoryTarget === "expense") setExpenseCategory(name);

      await loadFinanceData();
    } catch (error: any) {
      console.log("Erro ao criar categoria:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível criar a categoria.",
      );
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleSaveIncome() {
    try {
      const amount = parseCurrency(incomeAmount);

      if (!incomeCategory) {
        Alert.alert("Categoria obrigatória", "Selecione uma categoria.");
        return;
      }

      if (!incomeDescription.trim()) {
        Alert.alert(
          "Descrição obrigatória",
          "Informe uma descrição para a receita.",
        );
        return;
      }

      if (amount <= 0) {
        Alert.alert("Valor inválido", "Informe o valor da receita.");
        return;
      }

      if (!userId) return;

      setSavingIncome(true);

      const payload = {
        category: incomeCategory,
        description: incomeDescription.trim(),
        amount,
        transaction_date: toTransactionDateISOString(incomeDate),
        status: "paid" as const,
        paid_amount: amount,
      };

      if (editingIncome?.id) {
        const { error } = await supabase
          .from("personal_finance_transactions")
          .update(payload)
          .eq("id", editingIncome.id)
          .eq("user_id", userId)
          .eq("type", "income");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("personal_finance_transactions")
          .insert({
            user_id: userId,
            type: "income",
            ...payload,
          });

        if (error) throw error;
      }

      setIncomeModalVisible(false);
      setEditingIncome(null);
      setSelectedIncome(null);
      await loadFinanceData();
    } catch (error: any) {
      console.log("Erro ao salvar receita:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível salvar a receita.",
      );
    } finally {
      setSavingIncome(false);
    }
  }

  function openIncomeActions(income: FinanceTransaction) {
    setSelectedIncome(income);
    setIncomeActionsVisible(true);
  }

  function openEditIncome(income: FinanceTransaction) {
    setEditingIncome(income);
    setSelectedIncome(income);
    setIncomeDate(getTransactionDate(income));
    setIncomeAmount(
      maskCurrency(String(Math.round(Number(income.amount ?? 0) * 100))),
    );
    setIncomeDescription(income.description ?? "");
    setIncomeCategory(
      income.category ?? incomeCategories[0] ?? DEFAULT_INCOME_CATEGORIES[0],
    );
    setIncomeActionsVisible(false);
    setIncomeModalVisible(true);
  }

  function requestDeleteIncome() {
    if (!selectedIncome) return;

    Alert.alert("Excluir receita", "Deseja realmente excluir esta receita?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("personal_finance_transactions")
              .delete()
              .eq("id", selectedIncome.id)
              .eq("user_id", userId)
              .eq("type", "income");

            if (error) throw error;

            setIncomeActionsVisible(false);
            setSelectedIncome(null);
            setEditingIncome(null);
            await loadFinanceData();
          } catch (error: any) {
            console.log("Erro ao excluir receita:", error);
            Alert.alert(
              "Erro",
              error?.message ?? "Não foi possível excluir a receita.",
            );
          }
        },
      },
    ]);
  }

  function buildExpensePayload(
    date: Date,
    status: ExpenseStatus,
    paidAmount = 0,
    paidAt?: Date | null,
  ) {
    return {
      user_id: userId,
      type: "expense" as FinanceType,
      category: expenseCategory,
      description: expenseDescription.trim(),
      amount: parseCurrency(expenseAmount),
      transaction_date: toLocalISOString(date),
      due_date: toLocalISOString(date),
      paid_at: paidAt ? toLocalISOString(paidAt) : null,
      paid_amount: paidAmount,
      status,
      expense_kind: expenseKind,
    };
  }

  function buildRecurringDates() {
    const start = getToday();

    if (recurrenceType === "daily") {
      return Array.from({ length: 90 }).map((_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
      });
    }

    if (recurrenceType === "weekly") {
      const first = nextWeekday(start, weeklyDueDay);

      return Array.from({ length: 52 }).map((_, index) => {
        const date = new Date(first);
        date.setDate(first.getDate() + index * 7);
        return date;
      });
    }

    if (recurrenceType === "biweekly") {
      const dayOne = Number(biweeklyDayOne) || 1;
      const dayTwo = Number(biweeklyDayTwo) || 15;
      const dates: Date[] = [];

      for (let index = 0; index < 24; index += 1) {
        const base = new Date(
          start.getFullYear(),
          start.getMonth() + index,
          1,
          12,
          0,
          0,
          0,
        );
        const year = base.getFullYear();
        const month = base.getMonth();
        dates.push(
          new Date(year, month, clampDay(year, month, dayOne), 12, 0, 0, 0),
        );
        dates.push(
          new Date(year, month, clampDay(year, month, dayTwo), 12, 0, 0, 0),
        );
      }

      return dates.sort((a, b) => a.getTime() - b.getTime());
    }

    const day = Number(monthlyDueDay) || start.getDate();

    return Array.from({ length: 24 }).map((_, index) => {
      const base = new Date(
        start.getFullYear(),
        start.getMonth() + index,
        1,
        12,
        0,
        0,
        0,
      );
      const year = base.getFullYear();
      const month = base.getMonth();

      return new Date(year, month, clampDay(year, month, day), 12, 0, 0, 0);
    });
  }

  async function handleSaveExpense() {
    try {
      const amount = parseCurrency(expenseAmount);

      if (!expenseCategory) {
        Alert.alert("Categoria obrigatória", "Selecione uma categoria.");
        return;
      }

      if (!expenseDescription.trim()) {
        Alert.alert(
          "Descrição obrigatória",
          "Informe uma descrição para a despesa.",
        );
        return;
      }

      if (amount <= 0) {
        Alert.alert("Valor inválido", "Informe o valor da despesa.");
        return;
      }

      if (!userId) return;

      setSavingExpense(true);

      if (editingExpense?.id) {
        await handleSaveExpenseEdit();
        return;
      }

      if (expenseKind === "single") {
        const status: ExpenseStatus = singleAlreadyPaid ? "paid" : "pending";
        const paidAmount = singleAlreadyPaid ? amount : 0;
        const dueDate = singleDueDate;
        const paidAt = singleAlreadyPaid ? singlePaidAt : null;

        const { error } = await supabase
          .from("personal_finance_transactions")
          .insert({
            ...buildExpensePayload(dueDate, status, paidAmount, paidAt),
            expense_kind: "single",
          });

        if (error) throw error;
      }

      if (expenseKind === "recurring") {
        const seriesId = getSeriesId();
        const dates = buildRecurringDates();
        const rows = dates.map((date) => ({
          ...buildExpensePayload(date, "pending", 0, null),
          expense_kind: "recurring",
          recurrence_type: recurrenceType,
          recurrence_day:
            recurrenceType === "weekly"
              ? weeklyDueDay
              : recurrenceType === "monthly"
                ? Number(monthlyDueDay)
                : recurrenceType === "biweekly"
                  ? Number(biweeklyDayOne)
                  : null,
          recurrence_day_two:
            recurrenceType === "biweekly" ? Number(biweeklyDayTwo) : null,
          series_id: seriesId,
        }));

        const { error } = await supabase
          .from("personal_finance_transactions")
          .insert(rows);

        if (error) throw error;
      }

      if (expenseKind === "installment") {
        const seriesId = getSeriesId();
        const totalInstallments = Math.max(
          Number(installmentsCount.replace(/\D/g, "")) || 1,
          1,
        );
        const paidCount = Math.min(
          Number(installmentsPaid.replace(/\D/g, "")) || 0,
          totalInstallments,
        );
        const pendingInstallmentsCount = totalInstallments - paidCount;

        if (pendingInstallmentsCount <= 0) {
          Alert.alert(
            "Parcelas já pagas",
            "Todas as parcelas informadas já estão pagas. Não há parcelas futuras para lançar no controle.",
          );
          return;
        }

        /*
          As parcelas já pagas antes do cadastro não entram no saldo atual.
          Por isso, elas são desconsideradas e não são inseridas no banco.
          Exemplo:
          - 12 parcelas totais
          - 9 já pagas
          - serão criadas apenas as parcelas 10/12, 11/12 e 12/12 como pendentes.
        */
        const rows = Array.from({ length: pendingInstallmentsCount }).map(
          (_, rowIndex) => {
            const installmentIndex = paidCount + rowIndex;
            const date = new Date(firstInstallmentDue);
            date.setMonth(firstInstallmentDue.getMonth() + installmentIndex);

            return {
              ...buildExpensePayload(date, "pending", 0, null),
              expense_kind: "installment" as ExpenseKind,
              installment_number: installmentIndex + 1,
              installments_count: totalInstallments,
              series_id: seriesId,
            };
          },
        );

        const { error } = await supabase
          .from("personal_finance_transactions")
          .insert(rows);

        if (error) throw error;
      }

      setExpenseModalVisible(false);
      await loadFinanceData();
    } catch (error: any) {
      console.log("Erro ao salvar despesa:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível salvar a despesa.",
      );
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleSaveExpenseEdit() {
    if (!editingExpense?.id) return;

    const amount = parseCurrency(expenseAmount);
    const baseUpdate = {
      category: expenseCategory,
      description: expenseDescription.trim(),
      amount,
    };

    let query = supabase
      .from("personal_finance_transactions")
      .update(baseUpdate)
      .eq("user_id", userId)
      .eq("type", "expense");

    if (editScope === "single" || !editingExpense.series_id) {
      query = query.eq("id", editingExpense.id);
    }

    if (editScope === "unpaid" && editingExpense.series_id) {
      query = query
        .eq("series_id", editingExpense.series_id)
        .neq("status", "paid");
    }

    if (editScope === "future" && editingExpense.series_id) {
      query = query
        .eq("series_id", editingExpense.series_id)
        .gte(
          "due_date",
          editingExpense.due_date || editingExpense.transaction_date || "",
        );
    }

    const { error } = await query;

    if (error) throw error;

    setExpenseModalVisible(false);
    setEditingExpense(null);
    await loadFinanceData();
  }

  function openExpenseActions(expense: FinanceTransaction) {
    setSelectedExpense(expense);
    setExpenseActionsVisible(true);
  }

  function requestEditExpense() {
    if (!selectedExpense) return;

    if (selectedExpense.series_id) {
      setScopeAction("edit");
      setExpenseActionsVisible(false);
      setScopeModalVisible(true);
      return;
    }

    openEditExpense(selectedExpense, "single");
  }

  function openEditExpense(expense: FinanceTransaction, scope: ScopeValue) {
    setEditingExpense(expense);
    setEditScope(scope);
    setExpenseAmount(
      maskCurrency(String(Math.round(Number(expense.amount ?? 0) * 100))),
    );
    setExpenseDescription(expense.description ?? "");
    setExpenseCategory(expense.category ?? expenseCategories[0]);
    setExpenseKind((expense.expense_kind as ExpenseKind) || "single");
    setSingleDueDate(getExpenseDueDate(expense));
    setSingleAlreadyPaid(expense.status === "paid");
    setSinglePaidAt(getExpensePaidDate(expense) ?? getToday());
    setExpenseActionsVisible(false);
    setScopeModalVisible(false);
    setExpenseModalVisible(true);
  }

  function requestDeleteExpense() {
    if (!selectedExpense) return;

    if (selectedExpense.series_id) {
      setScopeAction("delete");
      setExpenseActionsVisible(false);
      setScopeModalVisible(true);
      return;
    }

    confirmDeleteExpense("single");
  }

  function confirmDeleteExpense(scope: ScopeValue) {
    if (!selectedExpense) return;

    Alert.alert("Excluir despesa", "Deseja realmente excluir esta despesa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            let query = supabase
              .from("personal_finance_transactions")
              .delete()
              .eq("user_id", userId)
              .eq("type", "expense");

            if (scope === "single" || !selectedExpense.series_id) {
              query = query.eq("id", selectedExpense.id);
            }

            if (scope === "unpaid" && selectedExpense.series_id) {
              query = query
                .eq("series_id", selectedExpense.series_id)
                .neq("status", "paid");
            }

            if (scope === "future" && selectedExpense.series_id) {
              query = query
                .eq("series_id", selectedExpense.series_id)
                .gte(
                  "due_date",
                  selectedExpense.due_date ||
                    selectedExpense.transaction_date ||
                    "",
                );
            }

            if (scope === "all" && selectedExpense.series_id) {
              query = query.eq("series_id", selectedExpense.series_id);
            }

            const { error } = await query;

            if (error) throw error;

            setScopeModalVisible(false);
            setSelectedExpense(null);
            await loadFinanceData();
          } catch (error: any) {
            console.log("Erro ao excluir despesa:", error);
            Alert.alert(
              "Erro",
              error?.message ?? "Não foi possível excluir a despesa.",
            );
          }
        },
      },
    ]);
  }

  function openPaymentModal() {
    if (!selectedExpense) return;

    setPaymentDate(getToday());
    setPayFullAmount(true);
    setPartialPaymentAmount(
      maskCurrency(
        String(Math.round(getRemainingAmount(selectedExpense) * 100)),
      ),
    );
    setExpenseActionsVisible(false);
    setPaymentModalVisible(true);
  }

  async function handlePayExpense() {
    try {
      if (!selectedExpense?.id) return;

      const remaining = getRemainingAmount(selectedExpense);
      const paymentAmount = payFullAmount
        ? remaining
        : parseCurrency(partialPaymentAmount);

      if (paymentAmount <= 0) {
        Alert.alert("Valor inválido", "Informe o valor que deseja pagar.");
        return;
      }

      if (paymentAmount > remaining) {
        Alert.alert(
          "Valor maior que o restante",
          "O valor pago não pode ser maior que o valor em aberto.",
        );
        return;
      }

      if (paymentAmount > currentBalance) {
        Alert.alert(
          "Saldo insuficiente",
          `Você não tem saldo suficiente para pagar essa dívida. Saldo atual: R$ ${formatCurrency(currentBalance)}.`,
        );
        return;
      }

      setSavingPayment(true);

      const newPaidAmount = getPaidAmount(selectedExpense) + paymentAmount;
      const status: ExpenseStatus =
        newPaidAmount >= Number(selectedExpense.amount ?? 0)
          ? "paid"
          : "partial";

      const { error } = await supabase
        .from("personal_finance_transactions")
        .update({
          paid_amount: newPaidAmount,
          paid_at: toTransactionDateISOString(paymentDate),
          status,
        })
        .eq("id", selectedExpense.id)
        .eq("user_id", userId);

      if (error) throw error;

      setPaymentModalVisible(false);
      setSelectedExpense(null);
      await loadFinanceData();
    } catch (error: any) {
      console.log("Erro ao pagar despesa:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível pagar a despesa.",
      );
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleMarkExpenseAsUnpaid() {
    try {
      if (!selectedExpense?.id) return;

      setSavingPayment(true);

      const { error } = await supabase
        .from("personal_finance_transactions")
        .update({
          status: "pending",
          paid_amount: 0,
          paid_at: null,
        })
        .eq("id", selectedExpense.id)
        .eq("user_id", userId)
        .eq("type", "expense");

      if (error) throw error;

      setExpenseActionsVisible(false);
      setSelectedExpense(null);
      await loadFinanceData();
    } catch (error: any) {
      console.log("Erro ao definir despesa como não paga:", error);
      Alert.alert(
        "Erro",
        error?.message ??
          "Não foi possível definir essa despesa como não paga.",
      );
    } finally {
      setSavingPayment(false);
    }
  }

  function handleCalendarSelect(day: any) {
    const date = dateFromKey(day.dateString);

    if (calendarTarget === "incomeDate") setIncomeDate(date);
    if (calendarTarget === "dueDate") setSingleDueDate(date);
    if (calendarTarget === "paidAt") setSinglePaidAt(date);
    if (calendarTarget === "firstInstallmentDue") setFirstInstallmentDue(date);
    if (calendarTarget === "paymentDate") setPaymentDate(date);

    setCalendarTarget(null);
  }

  function renderDateButton(
    label: string,
    value: Date,
    target: NonNullable<typeof calendarTarget>,
  ) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.dateButton}
        onPress={() => setCalendarTarget(target)}
      >
        <View>
          <Text style={styles.dateButtonLabel}>{label}</Text>
          <Text style={styles.dateButtonValue}>{formatDate(value)}</Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color="#D4A64A" />
      </TouchableOpacity>
    );
  }

  function renderCategorySelector(
    type: FinanceType,
    selected: string,
    onSelect: (value: string) => void,
  ) {
    const categories = type === "income" ? incomeCategories : expenseCategories;

    return (
      <View>
        <View style={styles.fieldHeaderRow}>
          <Text style={styles.fieldLabel}>Categoria</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openCategoryModal(type)}
          >
            <Text style={styles.addCategoryText}>+ Criar categoria</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => {
            const active = selected === category;

            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.86}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
                onPress={() => onSelect(category)}
              >
                <Ionicons
                  name={
                    type === "income"
                      ? getIncomeIcon(category)
                      : getExpenseIcon(category)
                  }
                  size={16}
                  color={active ? "#080808" : "#D4A64A"}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function renderTextInput(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: "default" | "numeric" = "default",
  ) {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8F8A91"
          keyboardType={keyboardType}
          style={styles.input}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.headerIconButton}
              onPress={() =>
                router.push("/(private)/(tabs)/dashboard" as never)
              }
            >
              <Ionicons name="home-outline" size={22} color="#F5F0E6" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>Controle pessoal</Text>
              <Text style={styles.headerTitle}>Financeiro pessoal</Text>
            </View>
          </View>
        </View>

        <View style={styles.fixedBlock}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceTopRow}>
              <View>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
                <Text
                  style={[
                    styles.balanceValue,
                    currentBalance < 0 && styles.balanceValueNegative,
                  ]}
                >
                  R$ {formatCurrency(currentBalance)}
                </Text>
              </View>

              <View style={styles.balanceIconBox}>
                <Ionicons name="wallet-outline" size={26} color="#D4A64A" />
              </View>
            </View>

            <View style={styles.payableBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#F87171" />
              <Text style={styles.payableText}>
                A pagar: R$ {formatCurrency(payableTotal)}
              </Text>
            </View>
          </View>

          <View style={styles.monthCard}>
            <TouchableOpacity
              style={styles.monthArrow}
              onPress={() => changeMonth("prev")}
            >
              <Ionicons name="chevron-back" size={22} color="#F5F0E6" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.monthCenter}
              onPress={openMonthPicker}
            >
              <Text style={styles.monthEyebrow}>Período</Text>
              <Text style={styles.monthTitle}>{selectedMonthLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.monthArrow}
              onPress={() => changeMonth("next")}
            >
              <Ionicons name="chevron-forward" size={22} color="#F5F0E6" />
            </TouchableOpacity>
          </View>
        </View>

        {bottomMode === "summary" ? (
          <View style={styles.sectionsContent}>
            <View
              style={[
                styles.sectionGroup,
                openSections.income && styles.sectionGroupOpen,
              ]}
            >
              <FinanceSectionCard
                variant="income"
                icon="arrow-down-circle-outline"
                title="Receitas"
                count={incomesInMonth.length}
                amount={incomeTotal}
                open={openSections.income}
                onPress={() => toggleSection("income")}
              />
              {openSections.income && (
                <TransactionList
                  emptyText="Nenhuma receita lançada neste mês."
                  items={incomesInMonth}
                  type="income"
                  listVariant="income"
                  onPressIncome={openIncomeActions}
                />
              )}
            </View>

            <View
              style={[
                styles.sectionGroup,
                openSections.overdue && styles.sectionGroupOpen,
              ]}
            >
              <FinanceSectionCard
                variant="overdue"
                icon="alert-circle-outline"
                title="Despesas vencidas"
                count={overdueExpenses.length}
                amount={overdueTotal}
                open={openSections.overdue}
                onPress={() => toggleSection("overdue")}
              />
              {openSections.overdue && (
                <TransactionList
                  emptyText="Nenhuma despesa vencida."
                  items={overdueExpenses}
                  type="expense"
                  listVariant="overdue"
                  onPressExpense={openExpenseActions}
                />
              )}
            </View>

            <View
              style={[
                styles.sectionGroup,
                openSections.today && styles.sectionGroupOpen,
              ]}
            >
              <FinanceSectionCard
                variant="today"
                icon="today-outline"
                title="Vence hoje"
                count={dueTodayExpenses.length}
                amount={dueTodayTotal}
                open={openSections.today}
                onPress={() => toggleSection("today")}
              />
              {openSections.today && (
                <TransactionList
                  emptyText="Nenhuma despesa vence hoje."
                  items={dueTodayExpenses}
                  type="expense"
                  listVariant="today"
                  onPressExpense={openExpenseActions}
                />
              )}
            </View>

            <View
              style={[
                styles.sectionGroup,
                openSections.upcoming && styles.sectionGroupOpen,
              ]}
            >
              <FinanceSectionCard
                variant="upcoming"
                icon="calendar-outline"
                title="Próximas despesas"
                count={upcomingExpenses.length}
                amount={upcomingTotal}
                open={openSections.upcoming}
                onPress={() => toggleSection("upcoming")}
              />
              {openSections.upcoming && (
                <TransactionList
                  emptyText="Nenhuma próxima despesa neste mês."
                  items={upcomingExpenses}
                  type="expense"
                  listVariant="upcoming"
                  onPressExpense={openExpenseActions}
                />
              )}
            </View>

            <View
              style={[
                styles.sectionGroup,
                openSections.paid && styles.sectionGroupOpen,
              ]}
            >
              <FinanceSectionCard
                variant="paid"
                icon="checkmark-circle-outline"
                title="Despesas pagas"
                count={paidExpensesInMonth.length}
                amount={paidTotal}
                open={openSections.paid}
                onPress={() => toggleSection("paid")}
              />
              {openSections.paid && (
                <TransactionList
                  emptyText="Nenhuma despesa paga neste mês."
                  items={paidExpensesInMonth}
                  type="expense"
                  listVariant="paid"
                  onPressExpense={openExpenseActions}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.statementCard}>
            <View style={styles.statementHeader}>
              <View>
                <Text style={styles.statementTitle}>Extrato</Text>
                <Text style={styles.statementSubtitle}>
                  Entradas e saídas do mês com saldo após cada transação.
                </Text>
              </View>
            </View>

            {statementItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={30}
                  color="#8F8A91"
                />
                <Text style={styles.emptyTitle}>Nenhuma transação no mês</Text>
              </View>
            ) : (
              statementItems.map((item) => (
                <View
                  key={`${item.id}-${item.date.toISOString()}`}
                  style={styles.statementItem}
                >
                  <View
                    style={[
                      styles.statementIcon,
                      item.type === "income"
                        ? styles.statementIconIncome
                        : styles.statementIconExpense,
                    ]}
                  >
                    <Ionicons
                      name={
                        item.type === "income"
                          ? "arrow-down-outline"
                          : "arrow-up-outline"
                      }
                      size={18}
                      color={item.type === "income" ? "#60A5FA" : "#F87171"}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.statementItemTitle}>{item.title}</Text>
                    <Text style={styles.statementItemSubtitle}>
                      {formatDate(item.date)} • {item.subtitle}
                    </Text>
                  </View>

                  <View style={styles.statementRight}>
                    <Text
                      style={[
                        styles.statementAmount,
                        item.amount < 0
                          ? styles.statementAmountExpense
                          : styles.statementAmountIncome,
                      ]}
                    >
                      {item.amount < 0 ? "-" : "+"} R${" "}
                      {formatCurrency(Math.abs(item.amount))}
                    </Text>
                    <Text style={styles.statementBalance}>
                      Saldo R$ {formatCurrency(item.balanceAfter)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.bottomMenuItem}
          onPress={() => router.push("/(private)/(tabs)/dashboard" as never)}
        >
          <Ionicons name="home-outline" size={21} color="#9B969B" />
          <Text style={styles.bottomMenuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.bottomMenuItem,
            bottomMode === "summary" && styles.bottomMenuItemActive,
          ]}
          onPress={() => setBottomMode("summary")}
        >
          <Ionicons
            name="grid-outline"
            size={21}
            color={bottomMode === "summary" ? "#D4A64A" : "#9B969B"}
          />
          <Text
            style={[
              styles.bottomMenuText,
              bottomMode === "summary" && styles.bottomMenuTextActive,
            ]}
          >
            Resumo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.bottomPlusButton}
          onPress={() => setQuickActionsVisible(true)}
        >
          <Ionicons name="add-sharp" size={34} color="#080808" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.bottomMenuItem,
            bottomMode === "statement" && styles.bottomMenuItemActive,
          ]}
          onPress={() => setBottomMode("statement")}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={21}
            color={bottomMode === "statement" ? "#D4A64A" : "#9B969B"}
          />
          <Text
            style={[
              styles.bottomMenuText,
              bottomMode === "statement" && styles.bottomMenuTextActive,
            ]}
          >
            Extrato
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.bottomMenuItem}
          onPress={openDebtSearchModal}
        >
          <Ionicons name="search-outline" size={21} color="#9B969B" />
          <Text style={styles.bottomMenuText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#D4A64A" />
          <Text style={styles.loadingText}>Carregando financeiro...</Text>
        </View>
      ) : null}

      <Modal visible={debtSearchVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.formOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.searchModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Buscar dívida</Text>
                <Text style={styles.modalTitle}>Encontrar despesa</Text>
              </View>

              <TouchableOpacity onPress={() => setDebtSearchVisible(false)}>
                <Ionicons name="close" size={27} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.searchScrollContent}
            >
              <View style={styles.searchInputBox}>
                <Ionicons name="search-outline" size={20} color="#D4A64A" />
                <TextInput
                  value={debtSearchTerm}
                  onChangeText={setDebtSearchTerm}
                  placeholder="Buscar dívida pelo nome"
                  placeholderTextColor="#8F8A91"
                  style={styles.searchInput}
                />

                {debtSearchTerm ? (
                  <TouchableOpacity onPress={() => setDebtSearchTerm("")}>
                    <Ionicons name="close-circle" size={20} color="#8F8A91" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.searchTotalCard}>
                <View>
                  <Text style={styles.searchTotalLabel}>Total filtrado</Text>
                  <Text style={styles.searchTotalValue}>
                    R$ {formatCurrency(debtSearchTotal)}
                  </Text>
                </View>

                <View style={styles.searchTotalIcon}>
                  <Ionicons name="cash-outline" size={22} color="#D4A64A" />
                </View>
              </View>

              <Text style={styles.searchFilterLabel}>Período</Text>
              <View style={styles.searchPeriodRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.searchPeriodChip,
                    debtSearchMonthFilter === "selected" &&
                      styles.searchPeriodChipActive,
                  ]}
                  onPress={() => setDebtSearchMonthFilter("selected")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={
                      debtSearchMonthFilter === "selected"
                        ? "#080808"
                        : "#D4A64A"
                    }
                  />
                  <Text
                    style={[
                      styles.searchPeriodChipText,
                      debtSearchMonthFilter === "selected" &&
                        styles.searchPeriodChipTextActive,
                    ]}
                  >
                    {selectedMonthLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.searchPeriodChip,
                    debtSearchMonthFilter === "all" &&
                      styles.searchPeriodChipActive,
                  ]}
                  onPress={() => setDebtSearchMonthFilter("all")}
                >
                  <Ionicons
                    name="layers-outline"
                    size={16}
                    color={
                      debtSearchMonthFilter === "all" ? "#080808" : "#D4A64A"
                    }
                  />
                  <Text
                    style={[
                      styles.searchPeriodChipText,
                      debtSearchMonthFilter === "all" &&
                        styles.searchPeriodChipTextActive,
                    ]}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.searchFilterLabel}>Situação</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.searchFilterRow}
              >
                {[
                  { id: "all", label: "Todas" },
                  { id: "overdue", label: "Vencidas" },
                  { id: "paid", label: "Pagas" },
                  { id: "upcoming", label: "A vencer" },
                ].map((filter) => {
                  const active = debtSearchFilter === filter.id;

                  return (
                    <TouchableOpacity
                      key={filter.id}
                      activeOpacity={0.86}
                      style={[
                        styles.searchFilterChip,
                        active && styles.searchFilterChipActive,
                      ]}
                      onPress={() =>
                        setDebtSearchFilter(filter.id as DebtSearchFilter)
                      }
                    >
                      <Text
                        style={[
                          styles.searchFilterChipText,
                          active && styles.searchFilterChipTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.searchFilterLabel}>Categoria</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.searchFilterRow}
              >
                {debtSearchCategories.map((category) => {
                  const active = debtSearchCategory === category;

                  return (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.86}
                      style={[
                        styles.searchFilterChip,
                        active && styles.searchFilterChipActive,
                      ]}
                      onPress={() => setDebtSearchCategory(category)}
                    >
                      <Text
                        style={[
                          styles.searchFilterChipText,
                          active && styles.searchFilterChipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.searchResultHeader}>
                <View>
                  <Text style={styles.searchResultTitle}>Resultados</Text>
                  <Text style={styles.searchResultPeriod}>
                    {debtSearchMonthFilter === "selected"
                      ? selectedMonthLabel
                      : "Todos os meses"}
                  </Text>
                </View>

                <Text style={styles.searchResultCount}>
                  {debtSearchResults.length}{" "}
                  {debtSearchResults.length === 1 ? "dívida" : "dívidas"}
                </Text>
              </View>

              {debtSearchResults.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="search-outline" size={30} color="#8F8A91" />
                  <Text style={styles.emptyTitle}>Nenhuma dívida encontrada</Text>
                </View>
              ) : (
                debtSearchResults.map((item) => {
                  const titleParts = getTransactionTitleParts(item, "Despesa");
                  const dueDate = getExpenseDueDate(item);
                  const remaining = getRemainingAmount(item);
                  const paid = getPaidAmount(item);
                  const dueKey =
                    getTransactionDueDateKey(item) ?? toLocalDateKey(dueDate);
                  const isPaid = item.status === "paid";
                  const isOverdue = !isPaid && dueKey < todayKey;
                  const statusColor = isPaid
                    ? "#22C55E"
                    : isOverdue
                      ? "#EF4444"
                      : "#FACC15";
                  const statusLabel = isPaid
                    ? "Paga"
                    : paid > 0
                      ? "Parcial"
                      : isOverdue
                        ? "Vencida"
                        : "A vencer";
                  const statusIcon = isPaid
                    ? "checkmark-circle-outline"
                    : isOverdue
                      ? "alert-circle-outline"
                      : "calendar-outline";

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.86}
                      style={styles.searchDebtItem}
                      onPress={() => {
                        setDebtSearchVisible(false);

                        setTimeout(() => {
                          openExpenseActions(item);
                        }, 260);
                      }}
                    >
                      <View
                        style={[
                          styles.searchDebtIcon,
                          {
                            backgroundColor: `${statusColor}1A`,
                            borderColor: `${statusColor}40`,
                          },
                        ]}
                      >
                        <Ionicons
                          name={statusIcon}
                          size={20}
                          color={statusColor}
                        />
                      </View>

                      <View style={styles.searchDebtTextBox}>
                        <Text style={styles.searchDebtTitle} numberOfLines={1}>
                          {titleParts.baseTitle}
                          {titleParts.installmentSuffix ? (
                            <Text style={styles.installmentSuffixText}>
                              {" "}
                              {titleParts.installmentSuffix}
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={styles.searchDebtMeta} numberOfLines={1}>
                          {formatDate(dueDate)} • {item.category || "Sem categoria"}
                        </Text>

                        {paid > 0 && remaining > 0 ? (
                          <Text style={[styles.searchDebtPartial, { color: statusColor }]}>
                            Pago R$ {formatCurrency(paid)} • Falta R$ {formatCurrency(remaining)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.searchDebtRight}>
                        <Text style={[styles.searchDebtAmount, { color: statusColor }]}>
                          R$ {formatCurrency(remaining || Number(item.amount ?? 0))}
                        </Text>
                        <Text style={[styles.searchDebtStatus, { color: statusColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={quickActionsVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQuickActionsVisible(false)}
        >
          <View style={styles.quickActionsCard}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.quickActionRow}
              onPress={openIncomeForm}
            >
              <View style={styles.quickActionIconBlue}>
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={22}
                  color="#60A5FA"
                />
              </View>
              <Text style={styles.quickActionText}>Nova Receita</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.quickActionRow}
              onPress={openExpenseForm}
            >
              <View style={styles.quickActionIconRed}>
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={22}
                  color="#F87171"
                />
              </View>
              <Text style={styles.quickActionText}>Nova Despesa</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={incomeModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.formOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.formModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Receita</Text>
                <Text style={styles.modalTitle}>
                  {editingIncome ? "Editar receita" : "Nova receita"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIncomeModalVisible(false);
                  setEditingIncome(null);
                }}
              >
                <Ionicons name="close" size={27} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              {renderDateButton("Data da receita", incomeDate, "incomeDate")}
              {renderTextInput(
                "Valor",
                incomeAmount,
                (value) => setIncomeAmount(maskCurrency(value)),
                "0,00",
                "numeric",
              )}
              {renderTextInput(
                "Descrição",
                incomeDescription,
                setIncomeDescription,
                "Ex: Salário, bônus, pix...",
              )}
              {renderCategorySelector(
                "income",
                incomeCategory,
                setIncomeCategory,
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingIncome && styles.disabledButton,
                ]}
                disabled={savingIncome}
                onPress={handleSaveIncome}
              >
                {savingIncome ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#080808"
                  />
                )}
                <Text style={styles.primaryButtonText}>
                  {editingIncome ? "Salvar alterações" : "Salvar receita"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={expenseModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.formOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.formModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Despesa</Text>
                <Text style={styles.modalTitle}>
                  {editingExpense ? "Editar despesa" : "Nova despesa"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                <Ionicons name="close" size={27} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              {renderTextInput(
                "Valor",
                expenseAmount,
                (value) => setExpenseAmount(maskCurrency(value)),
                expenseKind === "installment"
                  ? "Valor de cada parcela"
                  : "0,00",
                "numeric",
              )}
              {renderTextInput(
                "Descrição",
                expenseDescription,
                setExpenseDescription,
                "Ex: Mercado, cartão, aluguel...",
              )}
              {renderCategorySelector(
                "expense",
                expenseCategory,
                setExpenseCategory,
              )}

              {!editingExpense ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Tipo da despesa</Text>
                  <View style={styles.segmentRow}>
                    {[
                      { id: "single", label: "Única" },
                      { id: "recurring", label: "Recorrente" },
                      { id: "installment", label: "Parcelada" },
                    ].map((item) => {
                      const active = expenseKind === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.segmentButton,
                            active && styles.segmentButtonActive,
                          ]}
                          onPress={() => setExpenseKind(item.id as ExpenseKind)}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {expenseKind === "single" ? (
                <View>
                  <View style={styles.switchRow}>
                    <View>
                      <Text style={styles.switchTitle}>
                        Despesa já foi paga?
                      </Text>
                      <Text style={styles.switchSubtitle}>
                        Se marcada, entra no saldo como saída.
                      </Text>
                    </View>
                    <Switch
                      value={singleAlreadyPaid}
                      onValueChange={setSingleAlreadyPaid}
                      thumbColor={singleAlreadyPaid ? "#D4A64A" : "#8F8A91"}
                      trackColor={{
                        false: "#2A2830",
                        true: "rgba(212,166,74,0.35)",
                      }}
                    />
                  </View>

                  {renderDateButton(
                    "Data de vencimento",
                    singleDueDate,
                    "dueDate",
                  )}

                  {singleAlreadyPaid
                    ? renderDateButton(
                        "Data de pagamento",
                        singlePaidAt,
                        "paidAt",
                      )
                    : null}
                </View>
              ) : null}

              {expenseKind === "recurring" && !editingExpense ? (
                <View>
                  <Text style={styles.fieldLabel}>Periodicidade</Text>
                  <View style={styles.segmentRowWrap}>
                    {[
                      { id: "daily", label: "Diário" },
                      { id: "weekly", label: "Semanal" },
                      { id: "biweekly", label: "Quinzenal" },
                      { id: "monthly", label: "Mensal" },
                    ].map((item) => {
                      const active = recurrenceType === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.segmentButtonSmall,
                            active && styles.segmentButtonActive,
                          ]}
                          onPress={() =>
                            setRecurrenceType(item.id as RecurrenceType)
                          }
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {recurrenceType === "weekly" ? (
                    <View style={styles.segmentRowWrap}>
                      {weekDays.map((day) => {
                        const active = weeklyDueDay === day.value;
                        return (
                          <TouchableOpacity
                            key={day.value}
                            style={[
                              styles.dayChip,
                              active && styles.segmentButtonActive,
                            ]}
                            onPress={() => setWeeklyDueDay(day.value)}
                          >
                            <Text
                              style={[
                                styles.dayChipText,
                                active && styles.segmentTextActive,
                              ]}
                            >
                              {day.label.slice(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  {recurrenceType === "biweekly" ? (
                    <View style={styles.twoColumnRow}>
                      {renderTextInput(
                        "1º dia",
                        biweeklyDayOne,
                        (value) =>
                          setBiweeklyDayOne(
                            value.replace(/\D/g, "").slice(0, 2),
                          ),
                        "5",
                        "numeric",
                      )}
                      {renderTextInput(
                        "2º dia",
                        biweeklyDayTwo,
                        (value) =>
                          setBiweeklyDayTwo(
                            value.replace(/\D/g, "").slice(0, 2),
                          ),
                        "20",
                        "numeric",
                      )}
                    </View>
                  ) : null}

                  {recurrenceType === "monthly"
                    ? renderTextInput(
                        "Dia do vencimento",
                        monthlyDueDay,
                        (value) =>
                          setMonthlyDueDay(
                            value.replace(/\D/g, "").slice(0, 2),
                          ),
                        "Ex: 10",
                        "numeric",
                      )
                    : null}
                </View>
              ) : null}

              {expenseKind === "installment" && !editingExpense ? (
                <View>
                  <View style={styles.twoColumnRow}>
                    {renderTextInput(
                      "Parcelas",
                      installmentsCount,
                      (value) =>
                        setInstallmentsCount(
                          value.replace(/\D/g, "").slice(0, 3),
                        ),
                      "12",
                      "numeric",
                    )}
                    {renderTextInput(
                      "Pagas",
                      installmentsPaid,
                      (value) =>
                        setInstallmentsPaid(
                          value.replace(/\D/g, "").slice(0, 3),
                        ),
                      "0",
                      "numeric",
                    )}
                  </View>
                  {renderDateButton(
                    "1º vencimento",
                    firstInstallmentDue,
                    "firstInstallmentDue",
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingExpense && styles.disabledButton,
                ]}
                disabled={savingExpense}
                onPress={handleSaveExpense}
              >
                {savingExpense ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#080808"
                  />
                )}
                <Text style={styles.primaryButtonText}>
                  {editingExpense ? "Salvar alteração" : "Salvar despesa"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(calendarTarget)} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher data</Text>
              <TouchableOpacity onPress={() => setCalendarTarget(null)}>
                <Ionicons name="close" size={26} color="#F5F0E6" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleCalendarSelect}
              theme={{
                calendarBackground: "#101014",
                dayTextColor: "#F5F0E6",
                monthTextColor: "#F5F0E6",
                textDisabledColor: "#52525B",
                arrowColor: "#D4A64A",
                todayTextColor: "#D4A64A",
                selectedDayBackgroundColor: "#D4A64A",
                selectedDayTextColor: "#080808",
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={monthPickerVisible} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.monthPickerCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher mês</Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setYearDropdownVisible(false);
                  setMonthPickerVisible(false);
                }}
              >
                <Ionicons name="close" size={26} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.currentMonthButton}
              onPress={goToCurrentMonth}
            >
              <Ionicons name="calendar-outline" size={18} color="#080808" />
              <Text style={styles.currentMonthButtonText}>
                Mostrar mês atual
              </Text>
            </TouchableOpacity>

            <View style={styles.yearDropdownWrapper}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.yearDropdownButton}
                onPress={() => setYearDropdownVisible((current) => !current)}
              >
                <View>
                  <Text style={styles.yearDropdownLabel}>Ano</Text>
                  <Text style={styles.yearDropdownValue}>
                    {monthPickerYear}
                  </Text>
                </View>

                <Ionicons
                  name={yearDropdownVisible ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#D4A64A"
                />
              </TouchableOpacity>

              {yearDropdownVisible ? (
                <View style={styles.yearDropdownList}>
                  {Array.from({ length: 9 }).map((_, yearIndex) => {
                    const year = getToday().getFullYear() - 4 + yearIndex;
                    const active = year === monthPickerYear;

                    return (
                      <TouchableOpacity
                        key={year}
                        activeOpacity={0.86}
                        style={[
                          styles.yearDropdownOption,
                          active && styles.yearDropdownOptionActive,
                        ]}
                        onPress={() => {
                          setMonthPickerYear(year);
                          setYearDropdownVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.yearDropdownOptionText,
                            active && styles.yearDropdownOptionTextActive,
                          ]}
                        >
                          {year}
                        </Text>

                        {active ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#080808"
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View style={styles.monthGrid}>
              {months.map((month, monthIndex) => {
                const active =
                  selectedMonth.getFullYear() === monthPickerYear &&
                  selectedMonth.getMonth() === monthIndex;

                return (
                  <TouchableOpacity
                    key={`${monthPickerYear}-${month}`}
                    activeOpacity={0.86}
                    style={[
                      styles.monthOption,
                      active && styles.monthOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedMonth(
                        new Date(monthPickerYear, monthIndex, 1, 12, 0, 0, 0),
                      );
                      setYearDropdownVisible(false);
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        active && styles.monthOptionTextActive,
                      ]}
                    >
                      {month.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.calendarOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.simpleModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova categoria</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={26} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              {renderTextInput(
                "Nome da categoria",
                newCategoryName,
                setNewCategoryName,
                "Ex: Escola, Lazer, Freelance",
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingCategory && styles.disabledButton,
                ]}
                disabled={savingCategory}
                onPress={handleCreateCategory}
              >
                {savingCategory ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <Ionicons
                    name="add-circle-outline"
                    size={21}
                    color="#080808"
                  />
                )}
                <Text style={styles.primaryButtonText}>Criar categoria</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={incomeActionsVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIncomeActionsVisible(false)}
        >
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>
              {selectedIncome?.description || "Receita"}
            </Text>
            <Text style={styles.actionsSubtitle}>
              Valor: R$ {formatCurrency(Number(selectedIncome?.amount ?? 0))}
            </Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                if (selectedIncome) openEditIncome(selectedIncome);
              }}
            >
              <Ionicons name="create-outline" size={21} color="#BFDBFE" />
              <Text style={styles.actionRowText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={requestDeleteIncome}
            >
              <Ionicons name="trash-outline" size={21} color="#F87171" />
              <Text style={styles.actionRowText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={expenseActionsVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setExpenseActionsVisible(false)}
        >
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>
              {selectedExpense?.description || "Despesa"}
            </Text>
            <Text style={styles.actionsSubtitle}>
              {selectedExpense?.status === "paid"
                ? `Pago: R$ ${formatCurrency(getPaidAmount(selectedExpense))}`
                : selectedExpense?.status === "partial"
                  ? `Parcial: R$ ${formatCurrency(getPaidAmount(selectedExpense))} pago • R$ ${formatCurrency(getRemainingAmount(selectedExpense))} em aberto`
                  : `Em aberto: R$ ${formatCurrency(selectedExpense ? getRemainingAmount(selectedExpense) : 0)}`}
            </Text>

            {selectedExpense?.status === "paid" ? (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleMarkExpenseAsUnpaid}
                disabled={savingPayment}
              >
                {savingPayment ? (
                  <ActivityIndicator color="#FACC15" />
                ) : (
                  <Ionicons
                    name="refresh-circle-outline"
                    size={21}
                    color="#FACC15"
                  />
                )}
                <Text style={styles.actionRowText}>Definir como não paga</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={requestEditExpense}
                >
                  <Ionicons name="create-outline" size={21} color="#BFDBFE" />
                  <Text style={styles.actionRowText}>Editar</Text>
                </TouchableOpacity>

                {selectedExpense?.status === "partial" ? (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={handleMarkExpenseAsUnpaid}
                    disabled={savingPayment}
                  >
                    {savingPayment ? (
                      <ActivityIndicator color="#FACC15" />
                    ) : (
                      <Ionicons
                        name="refresh-circle-outline"
                        size={21}
                        color="#FACC15"
                      />
                    )}
                    <Text style={styles.actionRowText}>
                      Definir como não paga
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={openPaymentModal}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#22C55E"
                  />
                  <Text style={styles.actionRowText}>Pagar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={requestDeleteExpense}
                >
                  <Ionicons name="trash-outline" size={21} color="#F87171" />
                  <Text style={styles.actionRowText}>Excluir</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={scopeModalVisible} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.simpleModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {scopeAction === "edit" ? "Editar despesa" : "Excluir despesa"}
              </Text>
              <TouchableOpacity onPress={() => setScopeModalVisible(false)}>
                <Ionicons name="close" size={26} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            {[
              { id: "single", label: "Somente essa" },
              { id: "unpaid", label: "Todas as não pagas" },
              { id: "future", label: "Esta e as próximas" },
              ...(scopeAction === "delete"
                ? [{ id: "all", label: "Excluir todas" }]
                : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.scopeOption}
                onPress={() => {
                  if (!selectedExpense) return;
                  if (scopeAction === "edit")
                    openEditExpense(selectedExpense, item.id as ScopeValue);
                  if (scopeAction === "delete")
                    confirmDeleteExpense(item.id as ScopeValue);
                }}
              >
                <Text style={styles.scopeOptionText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#D4A64A" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.formOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View style={styles.formModalSmall}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Pagamento</Text>
                <Text style={styles.modalTitle}>Pagar despesa</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={27} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScrollContent}
            >
              {renderDateButton(
                "Data de pagamento",
                paymentDate,
                "paymentDate",
              )}

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Pagar valor total</Text>
                  <Text style={styles.switchSubtitle}>Marcado por padrão.</Text>
                </View>
                <Switch
                  value={payFullAmount}
                  onValueChange={setPayFullAmount}
                  thumbColor={payFullAmount ? "#D4A64A" : "#8F8A91"}
                  trackColor={{
                    false: "#2A2830",
                    true: "rgba(212,166,74,0.35)",
                  }}
                />
              </View>

              {!payFullAmount
                ? renderTextInput(
                    "Valor que vai pagar",
                    partialPaymentAmount,
                    (value) => setPartialPaymentAmount(maskCurrency(value)),
                    "0,00",
                    "numeric",
                  )
                : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingPayment && styles.disabledButton,
                ]}
                disabled={savingPayment}
                onPress={handlePayExpense}
              >
                {savingPayment ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#080808"
                  />
                )}
                <Text style={styles.primaryButtonText}>
                  Confirmar pagamento
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );

  function TransactionList({
    items,
    type,
    emptyText,
    listVariant,
    onPressExpense,
    onPressIncome,
  }: {
    items: FinanceTransaction[];
    type: FinanceType;
    emptyText: string;
    listVariant: ListVariant;
    onPressExpense?: (expense: FinanceTransaction) => void;
    onPressIncome?: (income: FinanceTransaction) => void;
  }) {
    if (items.length === 0) {
      return (
        <View style={styles.emptyListBox}>
          <Text style={styles.emptyListText}>{emptyText}</Text>
        </View>
      );
    }

    const listColor = {
      income: "#60A5FA",
      overdue: "#EF4444",
      today: "#FACC15",
      upcoming: "#8F8A91",
      paid: "#22C55E",
    }[listVariant];

    return (
      <View style={styles.listCard}>
        {items.map((item) => {
          const paid = getPaidAmount(item);
          const remaining = getRemainingAmount(item);
          const isIncome = type === "income";
          const date = isIncome
            ? getTransactionDate(item)
            : getExpenseDueDate(item);
          const titleParts = getTransactionTitleParts(
            item,
            isIncome ? "Receita" : "Despesa",
          );
          const canPress = isIncome
            ? Boolean(onPressIncome)
            : Boolean(onPressExpense);

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={canPress ? 0.86 : 1}
              style={styles.transactionItem}
              onPress={() => {
                if (isIncome) {
                  onPressIncome?.(item);
                  return;
                }

                onPressExpense?.(item);
              }}
            >
              <View
                style={[
                  styles.transactionIcon,
                  {
                    backgroundColor: `${listColor}1A`,
                    borderColor: `${listColor}40`,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isIncome
                      ? getIncomeIcon(item.category)
                      : getExpenseIcon(item.category)
                  }
                  size={19}
                  color={listColor}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.transactionTitle} numberOfLines={1}>
                  {titleParts.baseTitle}
                  {titleParts.installmentSuffix ? (
                    <Text style={styles.installmentSuffixText}>
                      {" "}
                      {titleParts.installmentSuffix}
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.transactionSubtitle}>
                  {formatDate(date)} • {item.category || "Sem categoria"}
                </Text>
                {!isIncome && paid > 0 && remaining > 0 ? (
                  <Text style={[styles.partialText, { color: listColor }]}>
                    Pago R$ {formatCurrency(paid)} • Falta R${" "}
                    {formatCurrency(remaining)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, { color: listColor }]}>
                  R${" "}
                  {formatCurrency(
                    isIncome
                      ? Number(item.amount ?? 0)
                      : remaining || Number(item.amount ?? 0),
                  )}
                </Text>
                {canPress ? (
                  <Ionicons name="chevron-forward" size={17} color="#8F8A91" />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
}

function FinanceSectionCard({
  variant,
  icon,
  title,
  count,
  amount,
  open,
  onPress,
}: {
  variant: "income" | "overdue" | "today" | "upcoming" | "paid";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  count: number;
  amount: number;
  open: boolean;
  onPress: () => void;
}) {
  const variantStyle = {
    income: styles.sectionIncome,
    overdue: styles.sectionOverdue,
    today: styles.sectionToday,
    upcoming: styles.sectionUpcoming,
    paid: styles.sectionPaid,
  }[variant];

  const cardColor = {
    income: "#60A5FA",
    overdue: "#EF4444",
    today: "#FACC15",
    upcoming: "#8F8A91",
    paid: "#22C55E",
  }[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.sectionCard, variantStyle, open && styles.sectionCardOpen]}
      onPress={onPress}
    >
      <View style={styles.sectionLeft}>
        <View
          style={[
            styles.sectionIconBox,
            {
              borderColor: `${cardColor}40`,
              backgroundColor: `${cardColor}1A`,
            },
          ]}
        >
          <Ionicons name={icon} size={24} color={cardColor} />
        </View>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>
            {count} {count === 1 ? "item" : "itens"}
          </Text>
        </View>
      </View>

      <View style={styles.sectionRight}>
        <Text style={[styles.sectionAmount, { color: cardColor }]}>
          R$ {formatCurrency(amount)}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color="#F5F0E6"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  formScrollContent: {
    paddingBottom: 22,
  },
  sectionGroup: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    overflow: "hidden",
  },
  sectionGroupOpen: {
    backgroundColor: "#101014",
    borderColor: "#2A2830",
  },
  sectionCardOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  currentMonthButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.35)",
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#D4A64A",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },

  currentMonthButtonText: {
    color: "#080808",
    fontSize: 13,
    fontWeight: "900",
  },

  yearDropdownWrapper: {
    marginBottom: 14,
    position: "relative",
    zIndex: 20,
  },

  yearDropdownButton: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  yearDropdownLabel: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
  },

  yearDropdownValue: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  yearDropdownList: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    overflow: "hidden",
  },

  yearDropdownOption: {
    minHeight: 43,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  yearDropdownOptionActive: {
    backgroundColor: "#D4A64A",
  },

  yearDropdownOptionText: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },

  yearDropdownOptionTextActive: {
    color: "#080808",
  },

  monthOptionActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },

  monthOptionTextActive: {
    color: "#080808",
  },

  root: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, backgroundColor: "#050505" },
  content: { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 170 },
  header: {
    marginHorizontal: -18,
    marginTop: -50,
    marginBottom: 14,
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 2,
  },
  fixedBlock: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: "#050505",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,40,48,0.6)",
    zIndex: 20,
    elevation: 20,
  },
  balanceCard: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 16,
    marginBottom: 10,
  },
  balanceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceLabel: { color: "#9B969B", fontSize: 12, fontWeight: "800" },
  balanceValue: {
    color: "#F5F0E6",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  balanceValueNegative: { color: "#F87171" },
  balanceIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  payableBox: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  payableText: { color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  monthCard: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthArrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    alignItems: "center",
    justifyContent: "center",
  },
  monthCenter: { flex: 1, alignItems: "center" },
  monthEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  monthTitle: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  sectionsContent: { paddingTop: 14, gap: 14 },
  sectionCard: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 0,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIncome: {
    backgroundColor: "rgba(96,165,250,0.12)",
    borderColor: "rgba(96,165,250,0.26)",
  },
  sectionOverdue: {
    backgroundColor: "rgba(239,68,68,0.13)",
    borderColor: "rgba(239,68,68,0.30)",
  },
  sectionToday: {
    backgroundColor: "rgba(250,204,21,0.13)",
    borderColor: "rgba(250,204,21,0.30)",
  },
  sectionUpcoming: {
    backgroundColor: "rgba(143,138,145,0.12)",
    borderColor: "rgba(143,138,145,0.26)",
  },
  sectionPaid: {
    backgroundColor: "rgba(34,197,94,0.13)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  sectionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  sectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  sectionRight: { alignItems: "flex-end", gap: 4 },
  sectionAmount: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  listCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: "#101014",
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    padding: 10,
    paddingTop: 8,
  },
  transactionItem: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  transactionIconIncome: {
    backgroundColor: "rgba(96,165,250,0.12)",
    borderColor: "rgba(96,165,250,0.24)",
  },
  transactionIconExpense: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.24)",
  },
  transactionTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  installmentSuffixText: { color: "#E8D8A8", fontSize: 12, fontWeight: "900" },
  transactionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  partialText: {
    color: "#FACC15",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  transactionRight: { alignItems: "flex-end", gap: 3 },
  transactionAmount: { fontSize: 12, fontWeight: "900" },
  incomeAmount: { color: "#60A5FA" },
  expenseAmount: { color: "#F87171" },
  emptyListBox: {
    minHeight: 74,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: "#101014",
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  emptyListText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  statementCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 15,
  },
  statementHeader: { marginBottom: 12 },
  statementTitle: { color: "#F5F0E6", fontSize: 18, fontWeight: "900" },
  statementSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  statementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
  },
  statementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statementIconIncome: {
    backgroundColor: "rgba(96,165,250,0.12)",
    borderColor: "rgba(96,165,250,0.24)",
  },
  statementIconExpense: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.24)",
  },
  statementItemTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  statementItemSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  statementRight: { alignItems: "flex-end" },
  statementAmount: { fontSize: 12, fontWeight: "900" },
  statementAmountIncome: { color: "#60A5FA" },
  statementAmountExpense: { color: "#F87171" },
  statementBalance: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },
  bottomMenu: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 5,
    minHeight: 74,
    borderRadius: 22,
    backgroundColor: "#070707",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  bottomMenuItem: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bottomMenuItemActive: { backgroundColor: "transparent" },
  bottomMenuText: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "900",
  },
  bottomMenuTextActive: { color: "#D4A64A" },
  bottomPlusButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,5,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 100,
  },
  loadingText: { color: "#9B969B", fontSize: 13, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
    padding: 18,
  },
  quickActionsCard: {
    borderRadius: 20,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    gap: 10,
    marginBottom: 86,
  },
  searchModal: {
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#050505",
    borderTopWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  searchScrollContent: {
    paddingBottom: 24,
  },
  searchInputBox: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "800",
    paddingVertical: 0,
  },
  searchTotalCard: {
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    padding: 15,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchTotalLabel: {
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  searchTotalValue: {
    color: "#F5F0E6",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5,
  },
  searchTotalIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchPeriodRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 15,
  },
  searchPeriodChip: {
    flex: 1,
    minHeight: 43,
    borderRadius: 14,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  searchPeriodChipActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  searchPeriodChipText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  searchPeriodChipTextActive: {
    color: "#080808",
  },
  searchFilterLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 9,
    marginLeft: 3,
  },
  searchFilterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  searchFilterChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  searchFilterChipActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  searchFilterChipText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  searchFilterChipTextActive: {
    color: "#080808",
  },
  searchResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 10,
  },
  searchResultTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  searchResultPeriod: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  searchResultCount: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
  },
  searchDebtItem: {
    minHeight: 74,
    borderRadius: 17,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  searchDebtIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchDebtTextBox: {
    flex: 1,
  },
  searchDebtTitle: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  searchDebtMeta: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  searchDebtPartial: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  searchDebtRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  searchDebtAmount: {
    fontSize: 12,
    fontWeight: "900",
  },
  searchDebtStatus: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  quickActionRow: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  quickActionIconBlue: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(96,165,250,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIconRed: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  formOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  formModal: {
    maxHeight: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#050505",
    borderTopWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  formModalSmall: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#050505",
    borderTopWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  modalTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  inputGroup: { flex: 1, marginBottom: 16 },
  fieldLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    marginLeft: 3,
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "800",
  },
  dateButton: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonLabel: { color: "#9B969B", fontSize: 11, fontWeight: "800" },
  dateButtonValue: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  fieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addCategoryText: { color: "#D4A64A", fontSize: 12, fontWeight: "900" },
  categoryList: { gap: 8, paddingBottom: 14 },
  categoryChip: {
    minHeight: 39,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChipActive: { backgroundColor: "#D4A64A", borderColor: "#D4A64A" },
  categoryChipText: { color: "#D4A64A", fontSize: 12, fontWeight: "900" },
  categoryChipTextActive: { color: "#080808" },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 24,
  },
  primaryButtonText: { color: "#080808", fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  segmentRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonSmall: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentButtonActive: { backgroundColor: "#D4A64A", borderColor: "#D4A64A" },
  segmentText: { color: "#9B969B", fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: "#080808" },
  dayChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dayChipText: { color: "#9B969B", fontSize: 11, fontWeight: "900" },
  twoColumnRow: { flexDirection: "row", gap: 10 },
  switchRow: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  switchSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18,
  },
  calendarCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
  },
  monthPickerCard: {
    maxHeight: "82%",
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
  },
  simpleModalCard: {
    maxHeight: "78%",
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  yearBlock: { marginBottom: 16 },
  yearTitle: {
    color: "#D4A64A",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthOption: {
    width: "30.8%",
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  monthOptionText: { color: "#F5F0E6", fontSize: 12, fontWeight: "900" },
  actionsCard: {
    borderRadius: 20,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  actionsTitle: { color: "#F5F0E6", fontSize: 16, fontWeight: "900" },
  actionsSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  actionRow: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  actionRowText: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  scopeOption: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  scopeOptionText: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  emptyBox: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
});
