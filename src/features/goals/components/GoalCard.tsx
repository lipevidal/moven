import { useEffect, useMemo, useRef, useState } from "react";

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

/**
 * Listas auxiliares usadas para montar labels amigáveis de datas.
 */
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

/**
 * Propriedades recebidas pelo card de meta.
 *
 * periodType:
 * - tipo do período da meta: dia, semana, mês ou ano.
 *
 * periodKey:
 * - chave única do período.
 * - exemplo para dia: 2026-07-12.
 * - exemplo para mês: 2026-07.
 * - exemplo para ano: 2026.
 *
 * periodStart:
 * - data inicial do período.
 *
 * periodEnd:
 * - data final do período.
 *
 * currentAmount:
 * - valor atual feito pelo usuário naquele período.
 * - normalmente vem do faturamento do dashboard.
 */
type GoalCardProps = {
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  currentAmount: number;
};

/**
 * Opção de período que pode receber a mesma meta.
 *
 * Exemplo:
 * - ao criar meta diária, o app pode mostrar os próximos 10 dias.
 * - o usuário pode aplicar a mesma meta em mais de um desses dias.
 */
type GoalOption = {
  label: string;
  periodType: GoalPeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

/**
 * Opção exibida no modal de exclusão de metas.
 */
type DeleteGoalOption = {
  id: string;
  label: string;
  targetAmount: number;
};

/**
 * Card principal de meta.
 *
 * Esse componente é responsável por:
 *
 * - carregar a meta do período atual;
 * - mostrar progresso da meta;
 * - mostrar quanto falta;
 * - mostrar tempo restante;
 * - permitir criar meta dentro do prazo;
 * - permitir editar meta dentro do prazo;
 * - permitir excluir uma ou várias metas dentro do prazo;
 * - mostrar mensagem de meta alcançada ou meta não batida.
 */
export function GoalCard({
  periodType,
  periodKey,
  periodStart,
  periodEnd,
  currentAmount,
}: GoalCardProps) {
  /**
   * Evita setState depois que o componente for desmontado.
   *
   * Isso deixa a tela mais segura quando o usuário muda de aba ou período
   * enquanto uma busca ainda está em andamento.
   */
  const mountedRef = useRef(true);

  /**
   * Controla o carregamento inicial da meta.
   */
  const [loading, setLoading] = useState(true);

  /**
   * Controla o loading dos botões de salvar/excluir.
   */
  const [saving, setSaving] = useState(false);

  /**
   * Controla o modal de criar/editar meta.
   */
  const [modalVisible, setModalVisible] = useState(false);

  /**
   * Guarda a meta encontrada para o período atual.
   */
  const [goal, setGoal] = useState<any>(null);

  /**
   * Valor digitado no input de meta.
   *
   * Fica como string porque precisa receber máscara de moeda.
   */
  const [amount, setAmount] = useState("");

  /**
   * Data/hora atual usada para:
   * - atualizar o contador regressivo;
   * - verificar se ainda pode criar/editar/excluir meta;
   * - verificar se o período acabou.
   */
  const [now, setNow] = useState(new Date());

  /**
   * Lista de períodos disponíveis para aplicar a meta.
   *
   * Exemplo:
   * - próximos dias;
   * - próximas semanas;
   * - próximos meses.
   */
  const [options, setOptions] = useState<GoalOption[]>([]);

  /**
   * Chaves dos períodos selecionados para receber a meta.
   */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  /**
   * Controla o modal de exclusão de metas.
   */
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  /**
   * Controla o loading ao buscar metas para exclusão.
   */
  const [deleteLoading, setDeleteLoading] = useState(false);

  /**
   * Lista de metas que podem ser excluídas.
   */
  const [deleteOptions, setDeleteOptions] = useState<DeleteGoalOption[]>([]);

  /**
   * IDs das metas selecionadas para exclusão.
   */
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);

  /**
   * Marca quando o componente está montado.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Atualiza o horário atual somente enquanto ainda existe algo temporal
   * para acompanhar.
   *
   * Antes, o contador rodava a cada segundo para sempre enquanto o card
   * estivesse montado.
   *
   * Agora ele para automaticamente quando:
   * - o prazo de gerenciar a meta já passou;
   * - e o período também já terminou.
   *
   * Isso reduz renderizações desnecessárias.
   */
  useEffect(() => {
    const manageDeadline = getManageDeadline(periodType, periodStart);
    const periodEndDate = new Date(periodEnd);
    const lastRelevantTime = Math.max(
      manageDeadline.getTime(),
      periodEndDate.getTime(),
    );

    setNow(new Date());

    if (Date.now() > lastRelevantTime) {
      return;
    }

    const interval = setInterval(() => {
      if (mountedRef.current) {
        setNow(new Date());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [periodType, periodStart, periodEnd]);

  /**
   * Sempre que o tipo ou a chave do período mudar,
   * recarrega a meta correspondente.
   */
  useEffect(() => {
    loadGoal();
  }, [periodType, periodKey]);

  /**
   * Define se o usuário ainda pode criar, editar ou excluir meta.
   */
  const canManage = isManageAllowed(periodType, periodStart, now);

  /**
   * Indica se o período ainda não começou.
   */
  const periodNotStarted = now < new Date(periodStart);

  /**
   * Indica se o período já terminou.
   */
  const periodEnded = now > new Date(periodEnd);

  /**
   * Prazo máximo para gerenciar a meta.
   */
  const manageDeadline = getManageDeadline(periodType, periodStart);

  /**
   * Contagem regressiva até o prazo final para gerenciar a meta.
   */
  const manageDeadlineCountdown = getCountdown(
    manageDeadline.toISOString(),
    now,
  );

  /**
   * Texto que explica a regra de criação/edição/exclusão da meta.
   */
  const manageRuleDescription = getManageRuleDescription(
    periodType,
    Boolean(goal),
  );

  /**
   * Calcula o progresso da meta em percentual.
   *
   * useMemo evita recalcular em todo render quando goal/currentAmount
   * não mudaram.
   */
  const progress = useMemo(() => {
    if (!goal?.target_amount) return 0;

    return Math.min(
      (Number(currentAmount ?? 0) / Number(goal.target_amount)) * 100,
      100,
    );
  }, [goal, currentAmount]);

  /**
   * Calcula quanto ainda falta para bater a meta.
   */
  const missingAmount = Math.max(
    Number(goal?.target_amount ?? 0) - Number(currentAmount ?? 0),
    0,
  );

  /**
   * Indica se a meta foi alcançada.
   */
  const achieved =
    Boolean(goal) && currentAmount >= Number(goal.target_amount ?? 0);

  /**
   * Carrega a meta cadastrada para o período atual.
   */
  async function loadGoal() {
    try {
      setLoading(true);

      const response = await getGoalForPeriod(periodType, periodKey);

      if (!mountedRef.current) return;

      setGoal(response);

      /**
       * Se já existe meta, preenche o input com o valor salvo.
       * Multiplica por 100 porque a função formatCurrencyInput trabalha
       * com números digitados como centavos.
       */
      if (response?.target_amount) {
        setAmount(
          formatCurrencyInput(String(Number(response.target_amount) * 100)),
        );
      } else {
        setAmount("");
      }
    } catch (error) {
      console.log(error);

      if (mountedRef.current) {
        setGoal(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  /**
   * Abre o modal de criar ou editar meta.
   *
   * Se já existe meta:
   * - permite editar somente o período atual.
   *
   * Se não existe meta:
   * - gera opções futuras para aplicar a meta em vários períodos.
   */
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

  /**
   * Marca ou desmarca um período no modal de criação de metas.
   *
   * Mantém pelo menos uma opção selecionada para evitar salvar sem período.
   */
  function toggleOption(key: string) {
    setSelectedKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }

      return [...current, key];
    });
  }

  /**
   * Valida e salva a meta.
   *
   * Quando o usuário seleciona vários períodos, salva a mesma meta
   * em todos eles usando Promise.all.
   */
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

      if (!mountedRef.current) return;

      setModalVisible(false);
      await loadGoal();
    } catch (error: any) {
      Alert.alert("Erro", error.message ?? "Não foi possível salvar a meta.");
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

  /**
   * Abre o modal de exclusão de metas.
   *
   * Busca todas as metas a partir do período selecionado,
   * permitindo excluir uma ou várias de uma vez.
   */
  async function openDeleteModal() {
    try {
      setDeleteLoading(true);

      const response = await getGoalsFromPeriod(periodType, periodStart);

      if (!mountedRef.current) return;

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
      if (mountedRef.current) {
        setDeleteLoading(false);
      }
    }
  }

  /**
   * Marca ou desmarca uma meta para exclusão.
   */
  function toggleDeleteOption(id: string) {
    setSelectedDeleteIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  /**
   * Exclui as metas selecionadas no modal de exclusão.
   */
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

      if (!mountedRef.current) return;

      setDeleteModalVisible(false);
      setSelectedDeleteIds([]);
      await loadGoal();
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message ?? "Não foi possível excluir as metas selecionadas.",
      );
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

  /**
   * Retorna o complemento textual do período.
   *
   * Exemplo:
   * - Meta do dia.
   * - Meta da semana.
   */
  function getPeriodLabel() {
    if (periodType === "day") return "do dia";
    if (periodType === "week") return "da semana";
    if (periodType === "month") return "do mês";
    return "do ano";
  }

  /**
   * Retorna o label do período atual exibido no modal de edição.
   */
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

  /**
   * Retorna mensagem de status da meta.
   *
   * Só mostra mensagem quando:
   * - a meta foi batida;
   * - ou o período terminou e a meta não foi batida.
   */
  function getStatusMessage() {
    if (!goal) return null;
    if (achieved) return "🎉 Parabéns, meta alcançada!";
    if (periodEnded) return "Meta não batida!";
    return null;
  }

  /**
   * Formata número para moeda brasileira sem incluir o prefixo "R$".
   */
  function formatCurrency(value: number) {
    return Number(value ?? 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Aplica máscara de moeda no input.
   *
   * O usuário digita apenas números e a função transforma em formato:
   * - 1,00
   * - 10,00
   * - 100,00
   */
  function formatCurrencyInput(value: string) {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";

    const cents = Number(numbers) / 100;

    return cents.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Converte moeda brasileira em número.
   *
   * Exemplo:
   * - "1.250,50" vira 1250.5.
   */
  function parseCurrency(value: string) {
    if (!value) return 0;

    return Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, ""),
    );
  }

  /**
   * Estado de carregamento inicial do card.
   */
  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  /**
   * Se não existe meta e o período já terminou,
   * o card não aparece.
   */
  if (!goal && periodEnded) {
    return null;
  }

  /**
   * Se for meta anual, não existe meta e o prazo de gestão acabou,
   * o card também não aparece.
   */
  if (!goal && periodType === "year" && !canManage) {
    return null;
  }

  /**
   * Renderização quando ainda não existe meta cadastrada.
   */
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
              Defina uma meta para acompanhar seu desempenho no período.
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

  /**
   * Renderização quando já existe meta cadastrada.
   */
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
            Acompanhe seu progresso até o final do período.
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
        <Detail
          label={periodEnded ? "Faltou" : "Falta"}
          value={`R$ ${formatCurrency(missingAmount)}`}
        />

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

/**
 * Modal usado para criar ou editar uma meta.
 *
 * Quando showOptions é true:
 * - mostra a lista horizontal de períodos selecionáveis.
 *
 * Quando showOptions é false:
 * - edita apenas a meta do período atual.
 */
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

/**
 * Modal usado para excluir uma ou várias metas.
 */
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

/**
 * Pequeno card de detalhe usado dentro da meta.
 *
 * Exemplo:
 * - Falta: R$ 120,00.
 * - Tempo restante: 02:10:30.
 */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Gera opções de metas futuras para o usuário selecionar.
 *
 * Regras:
 * - Meta diária: próximos 10 dias.
 * - Meta semanal: próximas 5 semanas.
 * - Meta mensal: próximos 5 meses.
 * - Meta anual: apenas o ano selecionado.
 */
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

/**
 * Formata o nome de uma meta para exibição no modal de exclusão.
 */
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

/**
 * Verifica se a meta ainda pode ser criada, editada ou excluída.
 */
function isManageAllowed(
  periodType: GoalPeriodType,
  periodStart: string,
  currentDate: Date,
) {
  return currentDate <= getManageDeadline(periodType, periodStart);
}

/**
 * Retorna o prazo final de gerenciamento de acordo com o tipo da meta.
 */
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

/**
 * Retorna o texto explicativo da regra de cada meta.
 */
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

/**
 * Calcula contagem regressiva até uma data.
 *
 * Retorna:
 * - DDd HH:mm:ss quando ainda falta mais de um dia;
 * - HH:mm:ss quando falta menos de um dia.
 */
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

/**
 * Retorna o início do dia.
 */
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

/**
 * Retorna o final do dia.
 */
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

/**
 * Retorna a segunda-feira da semana da data recebida.
 */
function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

/**
 * Soma dias a uma data.
 */
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formata uma data como chave YYYY-MM-DD.
 */
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Formata uma data curta para exibição.
 *
 * Exemplo:
 * - Seg, 12 Jul.
 */
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
    marginBottom: 12,
  },
  amountLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  targetAmount: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
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
