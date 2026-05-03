import { KeyboardAvoidingView, Platform, StatusBar, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LandingScreen } from "./src/screens/LandingScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { VerifyOtpScreen } from "./src/screens/VerifyOtpScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { StudentTabs } from "./src/navigation/StudentTabs";
import { StaffTabs } from "./src/navigation/StaffTabs";
import { AdminNavigator } from "./src/navigation/AdminNavigator";
import { SessionProvider } from "./src/context/SessionContext";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <KeyboardAvoidingView
          style={styles.appShell}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          enabled={Platform.OS !== "web"}
        >
          <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <Stack.Navigator
              initialRouteName="Landing"
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
            >
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              <Stack.Screen name="StudentTabs" component={StudentTabs} />
              <Stack.Screen name="StaffTabs" component={StaffTabs} />
              <Stack.Screen name="AdminStack" component={AdminNavigator} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
        </KeyboardAvoidingView>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
