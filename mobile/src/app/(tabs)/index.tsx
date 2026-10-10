import {
  formatDuration,
  isScheduledOn,
  todayISO,
  useActiveSession,
  useDayLog,
  useMe,
  useMetricMutations,
  useMetrics,
  useRoutines,
  useSchedule,
  useSessionHistory,
  useWaterDay,
  useWaterMutations,
} from "@healthapp/shared";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { Bar, Button, Card, Input, Label, Text } from "@/components/ui";
import { colors, space } from "@/theme";

function BigNumber({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
      <Text mono weight="bold" size={40}>
        {value}
      </Text>
      <Text size={14} color={colors.muted}>
        {unit}
      </Text>
    </View>
  );
}

function CaloriesCard() {
  const { data: day } = useDayLog(todayISO());
  const { data: user } = useMe();
  const s = user?.settings;
  const totals = day?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const target = s?.calorieTarget != null && s.calorieTarget > 0 ? s.calorieTarget : null;
  const remaining = target != null ? Math.round(target - totals.calories) : null;

  return (
    <Card accent={colors.food}>
      <Label>Today's food</Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <BigNumber value={String(Math.round(totals.calories))} unit={target ? `/ ${target} cal` : "cal"} />
        {remaining != null && (
          <Text weight="semibold" size={14} color={remaining < 0 ? colors.danger : colors.volt}>
            {remaining < 0 ? `${-remaining} over` : `${remaining} left`}
          </Text>
        )}
      </View>
      <Bar value={totals.calories} target={target} color={colors.food} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {(
          [
            ["P", totals.protein, s?.proteinTarget],
            ["C", totals.carbs, s?.carbsTarget],
            ["F", totals.fat, s?.fatTarget],
          ] as const
        ).map(([k, v, t]) => (
          <Text key={k} mono size={13} color={colors.muted}>
            {k} {Math.round(v)}
            {t ? `/${t}` : ""}g
          </Text>
        ))}
      </View>
    </Card>
  );
}

function WorkoutCard() {
  const { data: activeData } = useActiveSession();
  const { data: scheduleData } = useSchedule();
  const { data: routinesData } = useRoutines();
  const { data: historyData } = useSessionHistory(1);

  const { data: user } = useMe();

  const active = activeData?.session;
  const todayIso = todayISO();
  const weekStartsMonday = user?.settings.weekStart !== "sunday";
  const plannedIds = (scheduleData?.entries ?? [])
    .filter((e) => isScheduledOn(e, todayIso, weekStartsMonday))
    .map((e) => e.routineId);
  const planned = (routinesData?.routines ?? []).filter((r) => plannedIds.includes(r.id));
  const last = historyData?.sessions[0];

  return (
    <Card accent={colors.volt}>
      <Label>Today's workout</Label>
      {active ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.volt }} />
          <Text weight="semibold" color={colors.volt} style={{ flex: 1 }}>
            {active.routineName ?? "Freeform"} — in progress
          </Text>
          <Text mono size={13} color={colors.volt}>
            {formatDuration(active.startedAt, null)}
          </Text>
        </View>
      ) : planned.length > 0 ? (
        planned.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text weight="semibold" style={{ flex: 1 }}>
              {r.name}
            </Text>
            <Text size={13} color={colors.faint}>
              {r.exercises.length} exercises
            </Text>
          </View>
        ))
      ) : (
        <View style={{ gap: space.xs }}>
          <Text color={colors.muted}>Nothing scheduled for today.</Text>
          {last && (
            <Text size={13} color={colors.faint}>
              Last workout: {last.routineName ?? "Freeform"} ·{" "}
              {new Date(last.startedAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

const WATER_QUICK = [250, 500, 750];

function WaterCard() {
  const today = todayISO();
  const { data } = useWaterDay(today);
  const { data: user } = useMe();
  const { add, remove } = useWaterMutations();
  const target = user?.settings.waterTargetMl ?? null;
  const total = data?.totalMl ?? 0;
  const lastEntry = data?.entries[data.entries.length - 1];

  return (
    <Card accent={colors.water}>
      <Label>Water</Label>
      <BigNumber value={(total / 1000).toFixed(2)} unit={target ? `/ ${(target / 1000).toFixed(1)} L` : "L"} />
      <Bar value={total} target={target} color={colors.water} />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {WATER_QUICK.map((ml) => (
          <Button
            key={ml}
            small
            variant="ghost"
            title={`+${ml}ml`}
            onPress={() => add.mutate({ date: today, amountMl: ml })}
          />
        ))}
        {lastEntry && (
          <Button
            small
            variant="ghost"
            title="Undo"
            style={{ marginLeft: "auto" }}
            onPress={() => remove.mutate(lastEntry.id)}
          />
        )}
      </View>
    </Card>
  );
}

function WeightCard() {
  const { data } = useMetrics("weight");
  const { add } = useMetricMutations();
  const { data: user } = useMe();
  const [value, setValue] = useState("");
  const latest = data?.metrics[0];
  const unit = user?.settings.weightUnit ?? "lbs";
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n) && n > 0;

  function log() {
    if (!valid) return;
    add.mutate(
      { date: todayISO(), type: "weight", value: n },
      {
        onSuccess: () => {
          setValue("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    );
  }

  return (
    <Card accent={colors.body}>
      <Label>Body weight</Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <BigNumber value={latest ? String(latest.value) : "—"} unit={unit} />
        {latest && (
          <Text size={13} color={colors.faint}>
            {new Date(`${latest.date}T00:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Input
          style={{ flex: 1 }}
          keyboardType="decimal-pad"
          placeholder={`Today's weight (${unit})`}
          value={value}
          onChangeText={setValue}
          returnKeyType="done"
          onSubmitEditing={log}
        />
        <Button variant="ghost" title="Log" disabled={!valid} loading={add.isPending} onPress={log} />
      </View>
    </Card>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function Today() {
  const { data: user } = useMe();
  return (
    <Screen title={user ? `${greeting()}, ${user.username}` : greeting()}>
      <WorkoutCard />
      <CaloriesCard />
      <WaterCard />
      <WeightCard />
    </Screen>
  );
}
