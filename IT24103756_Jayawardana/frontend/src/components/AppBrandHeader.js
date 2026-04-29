import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { colors, layout } from "../theme";

function resolveRootNavigation(navigation) {
  let current = navigation;
  let parent = current?.getParent?.();

  while (parent) {
    current = parent;
    parent = current?.getParent?.();
  }

  return current;
}

export function AppBrandWordmark({ iconSize = 24, style, textStyle }) {
  return (
    <View style={[styles.brandRow, style]}>
      <MaterialIcons name="school" size={iconSize} color={colors.primary} />
      <Text style={[styles.brandText, textStyle]}>UniGuide AI</Text>
    </View>
  );
}

export function AppBrandHeader({
  onBack,
  right,
  style,
  textStyle,
  iconSize = 24,
  showLogoutAction = true,
}) {
  const navigation = useNavigation();
  const { currentUser, logout } = useSession();
  const canShowLogout = showLogoutAction && Boolean(currentUser);

  function handleLogout() {
    logout();

    const rootNavigation = resolveRootNavigation(navigation);

    if (typeof rootNavigation?.replace === "function") {
      rootNavigation.replace("Login");
      return;
    }

    if (typeof rootNavigation?.reset === "function") {
      rootNavigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      return;
    }

    rootNavigation?.navigate?.("Login");
  }

  return (
    <View style={[styles.header, style]}>
      <View style={styles.leading}>
        {onBack ? (
          <Pressable style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
        <AppBrandWordmark iconSize={iconSize} textStyle={textStyle} />
      </View>
      {right || canShowLogout ? (
        <View style={styles.right}>
          <View style={styles.actionRow}>
            {right}
            {canShowLogout ? (
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <MaterialIcons name="logout" size={20} color="#dc2626" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: layout.topBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leading: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 6,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e0e3e5",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  brandText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  right: {
    alignItems: "flex-end",
    flexShrink: 1,
    minWidth: 40,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    alignItems: "center",
    justifyContent: "center",
  },
});
