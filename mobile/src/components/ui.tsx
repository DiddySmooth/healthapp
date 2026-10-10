import * as Haptics from "expo-haptics";
import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, fonts, hit, radius, space } from "@/theme";

type Weight = "regular" | "medium" | "semibold" | "bold";

export function Text({
  weight = "regular",
  mono = false,
  size = 15,
  color = colors.fg,
  style,
  ...rest
}: TextProps & {
  weight?: Weight;
  mono?: boolean;
  size?: number;
  color?: string;
}) {
  const fontFamily = mono
    ? weight === "bold" || weight === "semibold"
      ? fonts.monoBold
      : fonts.mono
    : fonts[weight];
  return (
    <RNText
      style={[
        { fontFamily, fontSize: size, color },
        mono && { fontVariant: ["tabular-nums"] },
        style,
      ]}
      {...rest}
    />
  );
}

// Small uppercase section label ("TODAY'S FOOD").
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text weight="semibold" size={12} color={colors.muted} style={[{ letterSpacing: 0.8 }, style]}>
      {typeof children === "string" ? children.toUpperCase() : children}
    </Text>
  );
}

export function Card({
  children,
  accent,
  style,
}: {
  children: ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderCurve: "continuous",
          padding: space.lg,
          gap: space.md,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {accent && (
        <View
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }}
        />
      )}
      {children}
    </View>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  color = colors.volt,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant === "primary";
  const fg = filled ? colors.onVolt : variant === "danger" ? colors.danger : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : hit,
          paddingHorizontal: small ? space.md : space.lg,
          borderRadius: radius.control,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: filled ? color : colors.raised,
          borderWidth: filled ? 0 : 1,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text weight="semibold" size={small ? 13 : 15} color={fg}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...rest }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.faint}
      keyboardAppearance="dark"
      selectionColor={colors.volt}
      style={[
        {
          minHeight: hit,
          paddingHorizontal: space.md,
          borderRadius: radius.control,
          borderCurve: "continuous",
          backgroundColor: colors.raised,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.fg,
          fontFamily: fonts.regular,
          fontSize: 16,
        },
        style,
      ]}
      {...rest}
    />
  );
});

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text weight="medium" size={13} color={colors.muted}>
        {label}
      </Text>
      {children}
    </View>
  );
}

// Thin progress bar against an optional target.
export function Bar({ value, target, color }: { value: number; target: number | null; color: string }) {
  const pct = target != null && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.raised }}>
      <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <Text size={14} color={colors.danger}>
      {children}
    </Text>
  );
}
