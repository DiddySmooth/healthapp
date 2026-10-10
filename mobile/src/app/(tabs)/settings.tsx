import { useMe, useUpdateSettings, type UserSettings } from "@healthapp/shared";
import { Alert, Pressable, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button, Card, Label, Text } from "@/components/ui";
import { signOut, useAuth } from "@/lib/session";
import { colors, radius, space } from "@/theme";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.raised,
        borderRadius: radius.control,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.control - 3,
              backgroundColor: selected ? colors.border : "transparent",
            }}
          >
            <Text weight={selected ? "semibold" : "regular"} size={14} color={selected ? colors.fg : colors.muted}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
      <Text color={colors.muted}>{label}</Text>
      <Text style={{ flexShrink: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function Settings() {
  const auth = useAuth();
  const { data: user } = useMe();
  const update = useUpdateSettings();
  const s = user?.settings;
  const set = (patch: Partial<UserSettings>) => update.mutate(patch);

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need your password to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <Screen title="Settings">
      <Card>
        <Label>Account</Label>
        <Row label="User" value={user ? `${user.username}${user.role === "admin" ? " (admin)" : ""}` : "—"} />
        <Row label="Server" value={auth.status === "signedIn" ? auth.serverUrl.replace(/^https?:\/\//, "") : "—"} />
      </Card>

      <Card>
        <Label>Units</Label>
        <Segmented
          options={[
            { value: "lbs", label: "lbs" },
            { value: "kg", label: "kg" },
          ]}
          value={s?.weightUnit}
          onChange={(weightUnit) => set({ weightUnit })}
        />
        <Segmented
          options={[
            { value: "mi", label: "miles" },
            { value: "km", label: "km" },
          ]}
          value={s?.distanceUnit}
          onChange={(distanceUnit) => set({ distanceUnit })}
        />
      </Card>

      <Text size={13} color={colors.faint}>
        Targets, timezone, and admin tools are still in the web app for now.
      </Text>

      <Button variant="danger" title="Sign out" onPress={confirmSignOut} />
    </Screen>
  );
}
