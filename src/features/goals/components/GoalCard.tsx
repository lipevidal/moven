import { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { getGoalForPeriod, GoalPeriodType } from "../services/getGoalForPeriod";
import { saveGoal } from "../services/saveGoal";
import { getGoalsFromPeriod } from "../services/getGoalsFromPeriod";
import { deleteGoals } from "../services/deleteGoals";

const rewardByPeriod: Record<GoalPeriodType, number> = {
  day: 10,
  week: 30,
  month: 50,
  year: 100,
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const shortMonths = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
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

type GoalCardProps = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  currentAmount: number;
};

type GoalOption = {
  label: string;
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

type DeleteGoalOption = {
  id: string;
  label: string;
  targetAmount: number;
};

export function GoalCard({
  periodType,
  periodKey,
  periodStart,
  periodEnd,
  currentAmount,
}: GoalCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [goal, setGoal] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [now, setNow] = useState(new Date());
  const [options, setOptions] = useState<GoalOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState<DeleteGoalOption[]>([]);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadGoal();
  }, [periodType, periodKey]);

  const rewardXp = rewardByPeriod[periodType];
  const canManage = isManageAllowed(periodType, periodStart, now);
  const periodNotStarted = now < new Date(periodStart);
  const periodEnded = now > new Date(periodEnd);
  const manageDeadline = getManageDeadline(periodType, periodStart);
  const manageDeadlineCountdown = getCountdown(
    manageDeadline.toISOString(),
    now,
  );
  const manageRuleDescription = getManageRuleDescription(
    periodType,
    Boolean(goal),
  );

  const progress = useMemo(() => {
    if (!goal?.target_amount) return 0;

    return Math.min(
      (Number(currentAmount ?? 0) / Number(goal.target_amount)) * 100,
      100,
    );
  }, [goal, currentAmount]);

  const missingAmount = Math.max(
    Number(goal?.target_amount ?? 0) - Number(currentAmount ?? 0),
    0,
  );

  const achieved =
    Boolean(goal) && currentAmount >= Number(goal.target_amount ?? 0);

  async function loadGoal() {
    try {
      setLoading(true);

      const response = await getGoalForPeriod(periodType, periodKey);

      setGoal(response);

      if (response?.target_amount) {
        setAmount(
          formatCurrencyInput(String(Number(response.target_amount) * 100)),
        );
      } else {
        setAmount("");
      }
    } catch (error) {
      console.log(error);
      setGoal(null);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    if (!canManage) return;

    if (goal) {
      setOptions([
        {
          label: getCurrentPeriodLabel(),
          periodType,
          periodKey,
          periodStart,
          periodEnd,
        },
      ]);
      setSelectedKeys([periodKey]);
      setAmount(
        formatCurrencyInput(String(Number(goal.target_amount ?? 0) * 100)),
      );
    } else {
      const generatedOptions = getSelectableGoalOptions(
        periodType,
        periodStart,
      );
      setOptions(generatedOptions);
      setSelectedKeys([generatedOptions[0]?.periodKey].filter(Boolean));
      setAmount("");
    }

    setModalVisible(true);
  }

  function toggleOption(key: string) {
    setSelectedKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }

      return [...current, key];
    });
  }

  async function handleSaveGoal() {
    const targetAmount = parseCurrency(amount);

    if (targetAmount <= 0) {
      Alert.alert("Valor inválido", "Informe uma meta maior que zero.");
      return;
    }

    const selectedOptions = options.filter((item) =>
      selectedKeys.includes(item.periodKey),
    );

    if (selectedOptions.length === 0) {
      Alert.alert(
        "Selecione um período",
        "Escolha pelo menos um período para aplicar a meta.",
      );
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        selectedOptions.map((item) =>
          saveGoal({
            periodType: item.periodType,
            periodKey: item.periodKey,
            periodStart: item.periodStart,
            periodEnd: item.periodEnd,
            targetAmount,
          }),
        ),
      );

      setModalVisible(false);
      await loadGoal();
    } catch (error: any) {
      Alert.alert("Erro", error.message ?? "Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  }

  async function openDeleteModal() {
    try {
      setDeleteLoading(true);

      const response = await getGoalsFromPeriod(periodType, periodStart);

      const mappedOptions = response.map((item: any) => ({
        id: item.id,
        label: formatGoalOptionLabel(
          periodType,
          item.period_start,
          item.period_end,
        ),
        targetAmount: Number(item.target_amount ?? 0),
      }));

      setDeleteOptions(mappedOptions);
      setSelectedDeleteIds(goal?.id ? [goal.id] : []);
      setDeleteModalVisible(true);
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message ?? "Não foi possível carregar as metas.",
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleDeleteOption(id: string) {
    setSelectedDeleteIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  async function handleDeleteSelectedGoals() {
    if (selectedDeleteIds.length === 0) {
      Alert.alert(
        "Selecione uma meta",
        "Marque pelo menos um período para excluir.",
      );
      return;
    }

    try {
      setSaving(true);

      await deleteGoals(selectedDeleteIds);

      setDeleteModalVisible(false);
      setSelectedDeleteIds([]);
      await loadGoal();
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message ?? "Não foi possível excluir as metas selecionadas.",
      );
    } finally {
      setSaving(false);
    }
  }

  function getPeriodLabel() {
    if (periodType === "day") return "do dia";
    if (periodType === "week") return "da semana";
    if (periodType === "month") return "do mês";
    return "do ano";
  }

  function getCurrentPeriodLabel() {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (periodType === "day") return formatDayLabel(start);
    if (periodType === "week")
      return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
    if (periodType === "month")
      return `${months[start.getMonth()]} ${start.getFullYear()}`;
    return String(start.getFullYear());
  }

  function getStatusMessage() {
    if (!goal) return null;
    if (achieved) return "🎉 Parabéns, meta alcançada!";
    if (periodEnded) return "Meta não batida!";
    return null;
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatCurrencyInput(value: string) {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";

    const cents = Number(numbers) / 100;

    return cents.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseCurrency(value: string) {
    if (!value) return 0;

    return Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, ""),
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!goal && periodEnded) {
    return null;
  }

  if (!goal && periodType === "year" && !canManage) {
    return null;
  }

  if (!goal) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="flag-outline" size={24} color="#22C55E" />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>Meta {getPeriodLabel()}</Text>
            <Text style={styles.subtitle}>
              Defina uma meta e ganhe {rewardXp} XP ao atingi-la.
            </Text>
          </View>
        </View>

        <View style={styles.ruleBox}>
          <View style={styles.ruleIconBox}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#60A5FA"
            />
          </View>

          <Text style={styles.ruleText}>{manageRuleDescription}</Text>
        </View>

        {canManage && (
          <View style={styles.deadlineBox}>
            <View style={styles.deadlineIconBox}>
              <Ionicons name="timer-outline" size={20} color="#FACC15" />
            </View>

            <View style={styles.deadlineInfo}>
              <Text style={styles.deadlineLabel}>Prazo termina em:</Text>

              <Text style={styles.deadlineValue}>
                {manageDeadlineCountdown}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, !canManage && styles.disabledButton]}
          disabled={!canManage}
          onPress={openModal}
        >
          <Ionicons name="add-circle-outline" size={19} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            Definir meta {getPeriodLabel()}
          </Text>
        </TouchableOpacity>

        {!canManage && (
          <Text style={styles.blockedText}>
            Prazo encerrado para definir meta neste período.
          </Text>
        )}

        <GoalModal
          visible={modalVisible}
          amount={amount}
          saving={saving}
          title={`Definir meta ${getPeriodLabel()}`}
          options={options}
          selectedKeys={selectedKeys}
          showOptions
          onToggleOption={toggleOption}
          onChangeAmount={(text) => setAmount(formatCurrencyInput(text))}
          onClose={() => setModalVisible(false)}
          onSave={handleSaveGoal}
        />
      </View>
    );
  }

  const statusMessage = getStatusMessage();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="flag" size={24} color="#22C55E" />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.title}>Meta {getPeriodLabel()}</Text>
          <Text style={styles.subtitle}>
            Ganhe {rewardXp} XP ao atingir essa meta.
          </Text>
        </View>
      </View>

      <View style={styles.ruleBox}>
        <View style={styles.ruleIconBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#60A5FA"
          />
        </View>

        <Text style={styles.ruleText}>{manageRuleDescription}</Text>
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Meta</Text>
          <Text style={styles.targetAmount}>
            R$ {formatCurrency(goal.target_amount)}
          </Text>
        </View>

        <View style={styles.xpBadge}>
          <Ionicons name="flash" size={15} color="#FACC15" />
          <Text style={styles.xpBadgeText}>{rewardXp} XP</Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          R$ {formatCurrency(currentAmount)} feito
        </Text>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%` as `${number}%` },
          ]}
        />
      </View>

      <View style={styles.detailsGrid}>
        <Detail label={periodEnded ? "Faltou" : "Falta"} value={`R$ ${formatCurrency(missingAmount)}`} />
        <Detail
          label={periodNotStarted ? "Inicia em" : "Tempo restante"}
          value={
            periodEnded
              ? "Encerrado"
              : getCountdown(periodNotStarted ? periodStart : periodEnd, now)
          }
        />
      </View>

      {statusMessage && (
        <View
          style={[
            styles.statusBox,
            achieved ? styles.successBox : styles.failedBox,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              achieved ? styles.successText : styles.failedText,
            ]}
          >
            {statusMessage}
          </Text>
        </View>
      )}

      {canManage && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.editButton} onPress={openModal}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Editar meta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={openDeleteModal}
          >
            <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
            <Text style={styles.deleteButtonText}>Excluir meta</Text>
          </TouchableOpacity>
        </View>
      )}

      {!canManage && !periodEnded && (
        <Text style={styles.blockedText}>
          Prazo encerrado para editar ou excluir esta meta.
        </Text>
      )}

      <GoalModal
        visible={modalVisible}
        amount={amount}
        saving={saving}
        title={`Editar meta ${getPeriodLabel()}`}
        options={options}
        selectedKeys={selectedKeys}
        showOptions={false}
        onToggleOption={toggleOption}
        onChangeAmount={(text) => setAmount(formatCurrencyInput(text))}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveGoal}
      />

      <DeleteGoalModal
        visible={deleteModalVisible}
        loading={deleteLoading}
        saving={saving}
        options={deleteOptions}
        selectedIds={selectedDeleteIds}
        onToggle={toggleDeleteOption}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteSelectedGoals}
      />
    </View>
  );
}

function GoalModal({
  visible,
  title,
  amount,
  saving,
  options,
  selectedKeys,
  showOptions,
  onToggleOption,
  onChangeAmount,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  amount: string;
  saving: boolean;
  options: GoalOption[];
  selectedKeys: string[];
  showOptions: boolean;
  onToggleOption: (key: string) => void;
  onChangeAmount: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>
            Defina o valor e selecione os períodos que receberão essa meta.
          </Text>

          {showOptions && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionsList}
            >
              {options.map((item) => {
                const selected = selectedKeys.includes(item.periodKey);

                return (
                  <TouchableOpacity
                    key={item.periodKey}
                    style={[
                      styles.optionChip,
                      selected && styles.optionChipActive,
                    ]}
                    onPress={() => onToggleOption(item.periodKey)}
                  >
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={17}
                      color={selected ? "#FFFFFF" : "#A1A1AA"}
                    />

                    <Text
                      style={[
                        styles.optionChipText,
                        selected && styles.optionChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.inputBox}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              value={amount}
              onChangeText={onChangeAmount}
              placeholder="0,00"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              disabled={saving}
              onPress={onSave}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DeleteGoalModal({
  visible,
  loading,
  saving,
  options,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  loading: boolean;
  saving: boolean;
  options: DeleteGoalOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Excluir metas</Text>
          <Text style={styles.modalSubtitle}>
            Marque os períodos que deseja excluir a partir do período
            selecionado.
          </Text>

          {loading ? (
            <View style={styles.deleteLoadingBox}>
              <ActivityIndicator color="#22C55E" />
            </View>
          ) : options.length === 0 ? (
            <View style={styles.deleteLoadingBox}>
              <Text style={styles.emptyDeleteText}>
                Nenhuma meta encontrada a partir deste período.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.deleteList}
              showsVerticalScrollIndicator={false}
            >
              {options.map((item) => {
                const selected = selectedIds.includes(item.id);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.deleteOption,
                      selected && styles.deleteOptionActive,
                    ]}
                    onPress={() => onToggle(item.id)}
                  >
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={selected ? "#22C55E" : "#A1A1AA"}
                    />

                    <View style={styles.deleteOptionInfo}>
                      <Text style={styles.deleteOptionTitle}>{item.label}</Text>

                      <Text style={styles.deleteOptionValue}>
                        R${" "}
                        {item.targetAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmDeleteButton}
              disabled={saving || selectedIds.length === 0}
              onPress={onConfirm}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmDeleteButtonText}>Excluir</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function getSelectableGoalOptions(
  periodType: GoalPeriodType,
  periodStart: string,
) {
  if (periodType === "day") {
    const start = startOfDay(new Date(periodStart));

    return Array.from({ length: 10 }).map((_, index) => {
      const day = addDays(start, index);

      return {
        label: formatDayLabel(day),
        periodType,
        periodKey: formatDateKey(day),
        periodStart: startOfDay(day).toISOString(),
        periodEnd: endOfDay(day).toISOString(),
      };
    });
  }

  if (periodType === "week") {
    const start = startOfWeekMonday(new Date(periodStart));

    return Array.from({ length: 5 }).map((_, index) => {
      const weekStart = addDays(start, index * 7);
      const weekEnd = endOfDay(addDays(weekStart, 6));

      return {
        label: `${formatDayLabel(weekStart)} - ${formatDayLabel(weekEnd)}`,
        periodType,
        periodKey: formatDateKey(weekStart),
        periodStart: startOfDay(weekStart).toISOString(),
        periodEnd: weekEnd.toISOString(),
      };
    });
  }

  if (periodType === "month") {
    const start = new Date(
      new Date(periodStart).getFullYear(),
      new Date(periodStart).getMonth(),
      1,
    );

    return Array.from({ length: 5 }).map((_, index) => {
      const monthStart = new Date(
        start.getFullYear(),
        start.getMonth() + index,
        1,
        0,
        0,
        0,
        0,
      );
      const monthEnd = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      return {
        label: `${months[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
        periodType,
        periodKey: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
        periodStart: monthStart.toISOString(),
        periodEnd: monthEnd.toISOString(),
      };
    });
  }

  const yearStart = new Date(
    new Date(periodStart).getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0,
  );
  const yearEnd = new Date(yearStart.getFullYear(), 11, 31, 23, 59, 59, 999);

  return [
    {
      label: String(yearStart.getFullYear()),
      periodType,
      periodKey: String(yearStart.getFullYear()),
      periodStart: yearStart.toISOString(),
      periodEnd: yearEnd.toISOString(),
    },
  ];
}

function formatGoalOptionLabel(
  periodType: GoalPeriodType,
  periodStart: string,
  periodEnd: string,
) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  if (periodType === "day") return formatDayLabel(start);
  if (periodType === "week")
    return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
  if (periodType === "month")
    return `${months[start.getMonth()]} ${start.getFullYear()}`;
  return String(start.getFullYear());
}

function isManageAllowed(
  periodType: GoalPeriodType,
  periodStart: string,
  currentDate: Date,
) {
  return currentDate <= getManageDeadline(periodType, periodStart);
}

function getManageDeadline(periodType: GoalPeriodType, periodStart: string) {
  const start = new Date(periodStart);
  const deadline = new Date(start);

  if (periodType === "day") {
    // Meta diária: pode criar, editar ou excluir até 15:00 do dia selecionado.
    deadline.setHours(15, 0, 0, 0);
  }

  if (periodType === "week") {
    // Meta semanal: semana começa na segunda. Quinta-feira é o quarto dia da semana.
    deadline.setDate(start.getDate() + 3);
    deadline.setHours(23, 59, 59, 999);
  }

  if (periodType === "month") {
    // Meta mensal: pode criar, editar ou excluir até o dia 20 do mês selecionado.
    deadline.setDate(20);
    deadline.setHours(23, 59, 59, 999);
  }

  if (periodType === "year") {
    // Meta anual: pode criar, editar ou excluir até o último dia de outubro do ano selecionado.
    deadline.setMonth(9);
    deadline.setDate(31);
    deadline.setHours(23, 59, 59, 999);
  }

  return deadline;
}

function getManageRuleDescription(
  periodType: GoalPeriodType,
  hasGoal: boolean,
) {
  const actionText = hasGoal
    ? "podem ser editadas ou excluídas"
    : "devem ser definidas";

  if (periodType === "day") {
    return `As metas do dia ${actionText} até as 15:00 do dia selecionado.`;
  }

  if (periodType === "week") {
    return `As metas da semana ${actionText} até quinta-feira da semana selecionada.`;
  }

  if (periodType === "month") {
    return `As metas do mês ${actionText} até o dia 20 do mês selecionado.`;
  }

  return `As metas do ano ${actionText} até o final de outubro do ano selecionado.`;
}

function getCountdown(targetDate: string, currentDate: Date) {
  const now = currentDate.getTime();
  const target = new Date(targetDate).getTime();
  const diff = Math.max(target - now, 0);

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hh}:${mm}:${ss}`;
  }

  return `${hh}:${mm}:${ss}`;
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date) {
  return `${weekDays[date.getDay()]}, ${date.getDate()} ${shortMonths[date.getMonth()]}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
    marginBottom: 14,
    minHeight: 170,
    justifyContent: "center",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerInfo: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
  },
  ruleBox: {
    borderRadius: 18,
    backgroundColor: "rgba(96,165,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ruleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(96,165,250,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleText: {
    flex: 1,
    color: "#DBEAFE",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  primaryButton: {
    height: 46,
    borderRadius: 15,
    backgroundColor: "#22C55E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  blockedText: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  amountLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  targetAmount: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
  xpBadge: {
    height: 32,
    borderRadius: 999,
    backgroundColor: "#2A2408",
    borderWidth: 1,
    borderColor: "#713F12",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
  },
  xpBadgeText: { color: "#FACC15", fontSize: 12, fontWeight: "900" },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: { color: "#A1A1AA", fontSize: 12, fontWeight: "800" },
  progressPercent: { color: "#22C55E", fontSize: 12, fontWeight: "900" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#18181B",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  detailsGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  detailBox: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 10,
    justifyContent: "center",
  },
  detailLabel: { color: "#A1A1AA", fontSize: 10, fontWeight: "800" },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },
  statusBox: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  successBox: { backgroundColor: "#052E16", borderColor: "#166534" },
  failedBox: { backgroundColor: "#2A0A0A", borderColor: "#7F1D1D" },
  statusText: { fontSize: 13, fontWeight: "900", textAlign: "center" },
  successText: { color: "#BBF7D0" },
  failedText: { color: "#FCA5A5" },
  actionsRow: { flexDirection: "row", gap: 8 },
  editButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  editButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  deleteButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#3F1D1D",
    borderWidth: 1,
    borderColor: "#7F1D1D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteButtonText: { color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  deadlineBox: {
    borderRadius: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  deadlineIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#2A2408",
    borderWidth: 1,
    borderColor: "#713F12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  deadlineInfo: { flex: 1 },
  deadlineLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  deadlineValue: {
    color: "#FACC15",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },

  deleteLoadingBox: {
    minHeight: 130,
    borderRadius: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    padding: 16,
  },
  emptyDeleteText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  deleteList: { maxHeight: 300, marginBottom: 16 },
  deleteOption: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteOptionActive: { borderColor: "#22C55E", backgroundColor: "#052E16" },
  deleteOptionInfo: { flex: 1 },
  deleteOptionTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  deleteOptionValue: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  confirmDeleteButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDeleteButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxHeight: "82%",
    borderRadius: 26,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 18,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  modalSubtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 5,
    marginBottom: 16,
  },
  optionsList: { gap: 8, paddingBottom: 14 },
  optionChip: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionChipActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  optionChipText: { color: "#A1A1AA", fontSize: 12, fontWeight: "900" },
  optionChipTextActive: { color: "#FFFFFF" },
  inputBox: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  currencyPrefix: {
    color: "#22C55E",
    fontSize: 16,
    fontWeight: "900",
    marginRight: 8,
  },
  input: { flex: 1, color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
