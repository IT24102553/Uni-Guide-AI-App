import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { StaffDashboardScreen } from "../screens/StaffDashboardScreen";
import { StaffAnnouncementsScreen } from "../screens/staff/StaffAnnouncementsScreen";
import { StaffKnowledgeBaseScreen } from "../screens/staff/StaffKnowledgeBaseScreen";
import { StaffTicketWorkspaceScreen } from "../screens/tickets/StaffTicketWorkspaceScreen";
import { colors, layout } from "../theme";

const Tab = createBottomTabNavigator();

export function StaffTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBottomSpace = Math.max(insets.bottom, layout.tabBarBottomPadding);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: "#8b8f99",
        tabBarStyle: [
          styles.tabBar,
          {
            height: layout.tabBarBaseHeight + tabBarBottomSpace,
            paddingBottom: tabBarBottomSpace,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            Home: "dashboard",
            Tickets: "confirmation-number",
            Updates: "campaign",
            KB: "library-books",
          };
          return <MaterialIcons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={StaffDashboardScreen} />
      <Tab.Screen
        name="Tickets"
        component={StaffTicketWorkspaceScreen}
        options={{ tabBarLabel: "Queue" }}
      />
      <Tab.Screen
        name="Updates"
        component={StaffAnnouncementsScreen}
        options={{ tabBarLabel: "Updates" }}
      />
      <Tab.Screen
        name="KB"
        component={StaffKnowledgeBaseScreen}
        options={{ tabBarLabel: "Knowledge" }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "#e0e3e5",
    paddingTop: layout.tabBarTopPadding,
  },
  tabBarItem: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  tabBarIcon: {
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    marginTop: 2,
  },
});
