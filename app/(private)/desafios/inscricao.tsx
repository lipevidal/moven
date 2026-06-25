import { useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { registerChallenge } from '../../../src/features/challenges/services/registerChallenge';

type VehicleType = 'moto' | 'carro' | '';
type RankingType = 'day' | 'week' | 'month';

export default function ChallengeRegisterScreen() {
  const { challengeId, challengeType } = useLocalSearchParams<{
    challengeId?: string;
    challengeType?: string;
  }>();

  const [vehicleType, setVehicleType] =
    useState<VehicleType>('');

  const [platforms, setPlatforms] =
    useState<string[]>([]);

  const [region, setRegion] =
    useState('');

  const [rankingTypes, setRankingTypes] =
    useState<RankingType[]>([]);

  const [selectedDays, setSelectedDays] =
    useState<string[]>([]);

  const [selectedWeeks, setSelectedWeeks] =
    useState<string[]>([]);

  const [selectedMonths, setSelectedMonths] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (
      challengeType === 'day' ||
      challengeType === 'week' ||
      challengeType === 'month'
    ) {
      setRankingTypes([challengeType]);
    }
  }, [challengeType]);

  const availablePlatforms = useMemo(() => {
    if (vehicleType === 'moto') {
      return ['Uber', '99', 'inDrive'];
    }

    if (vehicleType === 'carro') {
      return [
        'UberX',
        'Uber Black',
        '99 Pop',
        '99 Plus',
        'inDrive',
      ];
    }

    return [];
  }, [vehicleType]);

  const regions = [
    'Belo Horizonte',
    'São Paulo',
    'Rio de Janeiro',
  ];

  const rankingOptions = [
    {
      label: 'Dia',
      value: 'day',
    },
    {
      label: 'Semana',
      value: 'week',
    },
    {
      label: 'Mês',
      value: 'month',
    },
  ] as const;

  const availableDays = useMemo(() => {
    return generateAvailableDays();
  }, []);

  const availableWeeks = useMemo(() => {
    return generateWeeks();
  }, []);

  const availableMonths = useMemo(() => {
    return generateMonths();
  }, []);

  function generateAvailableDays() {
    const now = new Date();
    const list: { id: string; label: string }[] = [];

    const start = now.getHours() < 12 ? 0 : 1;

    for (let i = start; i < start + 10; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      list.push({
        id: formatDateKey(date),
        label: date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          weekday: 'short',
        }),
      });
    }

    return list;
  }

  function generateWeeks() {
    const now = new Date();
    const currentDay = now.getDay();

    const includeCurrentWeek =
      currentDay >= 1 && currentDay <= 3;

    const weeks: { id: string; label: string }[] = [];
    const startIndex = includeCurrentWeek ? 0 : 1;

    for (let i = startIndex; i < startIndex + 5; i++) {
      const monday = getMondayFromDate(new Date());
      monday.setDate(monday.getDate() + i * 7);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      weeks.push({
        id: formatDateKey(monday),
        label: `${monday.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        })} até ${sunday.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        })}`,
      });
    }

    return weeks;
  }

  function generateMonths() {
    const now = new Date();
    const includeCurrentMonth = now.getDate() <= 15;

    const months: { id: string; label: string }[] = [];
    const startIndex = includeCurrentMonth ? 0 : 1;

    for (let i = startIndex; i < startIndex + 5; i++) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() + i,
        1,
      );

      months.push({
        id: `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        }),
      });
    }

    return months;
  }

  function getMondayFromDate(date: Date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);

    return monday;
  }

  function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function togglePlatform(platform: string) {
    if (platforms.includes(platform)) {
      setPlatforms(
        platforms.filter((item) => item !== platform),
      );

      return;
    }

    setPlatforms([...platforms, platform]);
  }

  function toggleRankingType(value: RankingType) {
    if (rankingTypes.includes(value)) {
      setRankingTypes(
        rankingTypes.filter((item) => item !== value),
      );

      if (value === 'day') setSelectedDays([]);
      if (value === 'week') setSelectedWeeks([]);
      if (value === 'month') setSelectedMonths([]);

      return;
    }

    setRankingTypes([...rankingTypes, value]);
  }

  function toggleDay(day: string) {
    if (selectedDays.includes(day)) {
      setSelectedDays(
        selectedDays.filter((item) => item !== day),
      );

      return;
    }

    setSelectedDays([...selectedDays, day]);
  }

  function toggleWeek(week: string) {
    if (selectedWeeks.includes(week)) {
      setSelectedWeeks(
        selectedWeeks.filter((item) => item !== week),
      );

      return;
    }

    setSelectedWeeks([...selectedWeeks, week]);
  }

  function toggleMonth(month: string) {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(
        selectedMonths.filter((item) => item !== month),
      );

      return;
    }

    setSelectedMonths([...selectedMonths, month]);
  }

  async function handleRegister() {
    if (!vehicleType) {
      Alert.alert(
        'Selecione o veículo',
        'Escolha entre moto ou carro.',
      );

      return;
    }

    if (!platforms.length) {
      Alert.alert(
        'Selecione as plataformas',
        'Escolha pelo menos uma plataforma.',
      );

      return;
    }

    if (!region) {
      Alert.alert(
        'Selecione a região',
        'Escolha a região do desafio.',
      );

      return;
    }

    if (!rankingTypes.length) {
      Alert.alert(
        'Selecione o período',
        'Escolha pelo menos um tipo de desafio.',
      );

      return;
    }

    if (
      rankingTypes.includes('day') &&
      !selectedDays.length
    ) {
      Alert.alert(
        'Selecione o dia',
        'Escolha pelo menos um dia para o desafio diário.',
      );

      return;
    }

    if (
      rankingTypes.includes('week') &&
      !selectedWeeks.length
    ) {
      Alert.alert(
        'Selecione a semana',
        'Escolha pelo menos uma semana para o desafio semanal.',
      );

      return;
    }

    if (
      rankingTypes.includes('month') &&
      !selectedMonths.length
    ) {
      Alert.alert(
        'Selecione o mês',
        'Escolha pelo menos um mês para o desafio mensal.',
      );

      return;
    }

    try {
      setLoading(true);

      await registerChallenge({
        challenge_id: challengeId || null,
        vehicle_type: vehicleType,
        region,
        platforms,
        ranking_types: rankingTypes,
        selected_days: selectedDays,
        selected_weeks: selectedWeeks,
        selected_months: selectedMonths,
      });

      Alert.alert(
        'Inscrição realizada',
        'Você já está participando do desafio.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace('/(private)/desafios/meus-desafios'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível realizar a inscrição.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>
            Inscrição
          </Text>

          <Text style={styles.subtitle}>
            Escolha veículo, plataformas, região e períodos.
          </Text>
        </View>
      </View>

      <Section title="Tipo de veículo">
        <View style={styles.optionsRow}>
          <Option
            label="Moto"
            active={vehicleType === 'moto'}
            onPress={() => {
              setVehicleType('moto');
              setPlatforms([]);
            }}
          />

          <Option
            label="Carro"
            active={vehicleType === 'carro'}
            onPress={() => {
              setVehicleType('carro');
              setPlatforms([]);
            }}
          />
        </View>
      </Section>

      {vehicleType ? (
        <Section title="Plataformas">
          <View style={styles.listGap}>
            {availablePlatforms.map((platform) => (
              <CheckOption
                key={platform}
                label={platform}
                active={platforms.includes(platform)}
                onPress={() => togglePlatform(platform)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Região">
        <View style={styles.listGap}>
          {regions.map((item) => (
            <CheckOption
              key={item}
              label={item}
              active={region === item}
              onPress={() => setRegion(item)}
              single
            />
          ))}
        </View>
      </Section>

      <Section title="Tipo de desafio">
        <View style={styles.optionsRow}>
          {rankingOptions.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={rankingTypes.includes(item.value)}
              onPress={() => toggleRankingType(item.value)}
            />
          ))}
        </View>
      </Section>

      {rankingTypes.includes('day') && (
        <Section title="Dias disponíveis">
          <View style={styles.listGap}>
            {availableDays.map((day) => (
              <CheckOption
                key={day.id}
                label={day.label}
                active={selectedDays.includes(day.id)}
                onPress={() => toggleDay(day.id)}
              />
            ))}
          </View>
        </Section>
      )}

      {rankingTypes.includes('week') && (
        <Section title="Semanas disponíveis">
          <View style={styles.listGap}>
            {availableWeeks.map((week) => (
              <CheckOption
                key={week.id}
                label={week.label}
                active={selectedWeeks.includes(week.id)}
                onPress={() => toggleWeek(week.id)}
              />
            ))}
          </View>
        </Section>
      )}

      {rankingTypes.includes('month') && (
        <Section title="Meses disponíveis">
          <View style={styles.listGap}>
            {availableMonths.map((month) => (
              <CheckOption
                key={month.id}
                label={month.label}
                active={selectedMonths.includes(month.id)}
                onPress={() => toggleMonth(month.id)}
              />
            ))}
          </View>
        </Section>
      )}

      <TouchableOpacity
        style={[
          styles.submitButton,
          loading && styles.submitButtonDisabled,
        ]}
        disabled={loading}
        onPress={handleRegister}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name="flag-outline"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.submitButtonText}>
              Confirmar inscrição
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {children}
    </View>
  );
}

function Option({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.option,
        active && styles.optionActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.optionText,
          active && styles.optionTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CheckOption({
  label,
  active,
  onPress,
  single,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  single?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.checkOption,
        active && styles.checkOptionActive,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.checkbox,
          active && styles.checkboxActive,
          single && styles.checkboxRounded,
        ]}
      >
        {active && (
          <Ionicons
            name="checkmark"
            size={15}
            color="#FFFFFF"
          />
        )}
      </View>

      <Text
        style={[
          styles.checkOptionText,
          active && styles.checkOptionTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 280,
  },

  section: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  option: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  optionText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '900',
  },

  optionTextActive: {
    color: '#FFFFFF',
  },

  listGap: {
    gap: 10,
  },

  checkOption: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkOptionActive: {
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  checkboxRounded: {
    borderRadius: 999,
  },

  checkboxActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  checkOptionText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },

  checkOptionTextActive: {
    color: '#FFFFFF',
  },

  submitButton: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
