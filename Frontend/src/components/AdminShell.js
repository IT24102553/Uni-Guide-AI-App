import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "./AppBrandHeader";
import { liveAdminModules, openAdminRoute } from "../navigation/adminModules";
import { useSession } from "../context/SessionContext";
import { colors, layout } from "../theme";

const drawerWidth = Math.min(Dimensions.get("window").width * 0.84, 320);

export function AdminShell({ navigation, currentRoute, showBack = currentRoute !== "AdminHome", children }) {
  const { logout } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pendingAction = useRef(null);

  useEffect(() => {
    if (!drawerMounted) {
      return;
    }

    Animated.timing(progress, {
      toValue: drawerOpen ? 1 : 0,
      duration: drawerOpen ? 220 : 180,
      easing: drawerOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !drawerOpen) {
        setDrawerMounted(false);
        const action = pendingAction.current;
        pendingAction.current = null;
        action?.();
      }
    });
  }, [drawerMounted, drawerOpen, progress]);

  const openDrawer = () => {
    pendingAction.current = null;
    setDrawerMounted(true);
    setDrawerOpen(true);
  };

  const closeDrawer = (afterClose) => {
    pendingAction.current = afterClose ?? null;
    setDrawerOpen(false);
  };

  const handleRoutePress = (route) => {
    if (route === currentRoute) {
      closeDrawer();
      return;
    }

    closeDrawer(() => openAdminRoute(navigation, route));
  };

  const handleBack = () => {
    openAdminRoute(navigation, "AdminHome");
  };

  const handleLogout = () => {
    logout();
    navigation.getParent()?.replace("Login");
  };

  const footerAction =
    currentRoute === "AdminHome"
      ? {
          icon: "apps",
          label: "Browse Full Workspace",
          onPress: () => closeDrawer(() => navigation.navigate("AdminWorkspace")),
        }
      : {
          icon: "dashboard",
          label: "Return to Dashboard",
          onPress: () => closeDrawer(() => openAdminRoute(navigation, "AdminHome")),
        };

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth - 24, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <AppBrandHeader
            showLogoutAction={false}
            onBack={showBack ? handleBack : undefined}
            right={
              <View style={styles.actionRow}>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                  <MaterialIcons name="logout" size={20} color="#dc2626" />
                </Pressable>
                <Pressable style={styles.menuButton} onPress={openDrawer}>
                  <MaterialIcons name="menu" size={22} color={colors.primary} />
                </Pressable>
              </View>
            }
          />
        </View>

        <View style={styles.body}>{children}</View>

        {drawerMounted ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, { opacity: progress }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDrawer()} />
            </Animated.View>

            <Animated.View style={[styles.drawerPanel, { transform: [{ translateX }] }]}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerEyebrow}>Admin Navigation</Text>
                <Text style={styles.drawerTitle}>Switch Modules</Text>
                <Text style={styles.drawerSubtitle}>
                  Jump straight into the live admin workspaces and keep the flow focused.
                </Text>
              </View>

              <ScrollView
                style={styles.drawerList}
                contentContainerStyle={styles.drawerListContent}
                showsVerticalScrollIndicator={false}
              >
                {liveAdminModules.map((item) => {
                  const active = item.route === currentRoute;

                  return (
                    <Pressable
                      key={item.route}
                      style={[styles.drawerItem, active && styles.drawerItemActive]}
                      onPress={() => handleRoutePress(item.route)}
                    >
                      <View style={[styles.drawerIconWrap, active && styles.drawerIconWrapActive]}>
                        <MaterialIcons name={item.icon} size={20} color={active ? "white" : colors.primary} />
                      </View>
                      <View style={styles.drawerTextWrap}>
                        <Text style={[styles.drawerItemTitle, active && styles.drawerItemTitleActive]}>
                          {item.label}
                        </Text>
                        <Text style={styles.drawerItemNote}>{item.note}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={styles.drawerFooterButton}
                onPress={footerAction.onPress}
              >
                <MaterialIcons name={footerAction.icon} size={18} color={colors.primary} />
                <Text style={styles.drawerFooterText}>{footerAction.label}</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 8,
  },
  body: { flex: 1 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  drawerPanel: {
    width: drawerWidth,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderRightWidth: 1,
    borderRightColor: "#e0e3e5",
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 0 },
    elevation: 12,
  },
  drawerHeader: {
    gap: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f2",
  },
  drawerEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  drawerTitle: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  drawerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  drawerList: {
    flex: 1,
    minHeight: 0,
  },
  drawerListContent: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 16,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e8ec",
    backgroundColor: "white",
  },
  drawerItemActive: {
    borderColor: colors.secondary,
    backgroundColor: "#f5f0ff",
  },
  drawerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerIconWrapActive: {
    backgroundColor: colors.primary,
  },
  drawerTextWrap: {
    flex: 1,
    gap: 2,
  },
  drawerItemTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  drawerItemTitleActive: {
    color: colors.primary,
  },
  drawerItemNote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  drawerFooterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingVertical: 12,
    backgroundColor: "#f7f9fb",
  },
  drawerFooterText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
