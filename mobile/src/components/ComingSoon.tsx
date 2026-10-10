import { Screen } from "@/components/Screen";
import { Card, Text } from "@/components/ui";
import { colors } from "@/theme";

export function ComingSoon({ title, detail }: { title: string; detail: string }) {
  return (
    <Screen title={title}>
      <Card>
        <Text weight="semibold">Not ported yet</Text>
        <Text color={colors.muted}>{detail}</Text>
      </Card>
    </Screen>
  );
}
