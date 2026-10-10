import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { colors, space } from "@/theme";

// Material 3 navigation bar height, which overlays content on Android.
const ANDROID_TAB_BAR = 80;

// Scrollable tab screen with a large title and pull-to-refresh.
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: space.lg,
        gap: space.lg,
        // iOS insets the scroll view for the status bar and translucent tab
        // bar itself (contentInsetAdjustmentBehavior). Android draws
        // edge-to-edge, so pad for the status bar and tab bar by hand.
        paddingTop: Platform.OS === "ios" ? space.sm : insets.top + space.sm,
        paddingBottom: Platform.OS === "ios" ? space.xl : ANDROID_TAB_BAR + space.xl,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.muted} />}
    >
      <Text weight="bold" size={30}>
        {title}
      </Text>
      <View style={{ gap: space.lg }}>{children}</View>
    </ScrollView>
  );
}
