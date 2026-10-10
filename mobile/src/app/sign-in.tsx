import * as Device from "expo-device";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, ErrorText, Field, Input, Text } from "@/components/ui";
import { SignInError, signIn, useAuth } from "@/lib/session";
import { colors, space } from "@/theme";

export default function SignIn() {
  const auth = useAuth();
  const [serverUrl, setServerUrl] = useState(
    auth.status === "signedOut" ? (auth.serverUrl ?? "") : "",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await signIn({
        serverUrl,
        username,
        password,
        deviceName: Device.deviceName ?? Device.modelName ?? "Phone",
      });
    } catch (e) {
      setError(e instanceof SignInError ? e.message : "Something went wrong. Try again.");
      setPending(false);
    }
  }

  const canSubmit = serverUrl.trim() !== "" && username !== "" && password !== "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: space.xs }}>
            <Text weight="bold" size={34}>
              Health<Text weight="bold" size={34} color={colors.volt}>App</Text>
            </Text>
            <Text color={colors.muted}>Sign in to your server</Text>
          </View>

          <Card>
            <Field label="Server address">
              <Input
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="192.168.1.20:3420"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
              />
            </Field>
            <Field label="Username">
              <Input
                ref={usernameRef}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </Field>
            <Field label="Password">
              <Input
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => canSubmit && submit()}
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button title="Sign in" onPress={submit} disabled={!canSubmit} loading={pending} />
          </Card>

          <Text size={13} color={colors.faint} style={{ textAlign: "center" }}>
            New server? Finish the setup wizard in a browser first.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
