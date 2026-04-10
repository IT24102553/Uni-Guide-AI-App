import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { ModulePlaceholder } from "../components/ModulePlaceholder";
import { AdminDashboardScreen } from "../screens/AdminDashboardScreen";
import { colors, layout } from "../theme";

const Tab = createBottomTabNavigator();

function Placeholder({ label }) {
  return (
    <ModulePlaceholder
      title={label}
      description="This admin module is styled and ready for live platform data, alerts, and operational controls."
      points={[
        "Monitor service health, team activity, and escalation volume.",
        "Audit conversations and tickets with searchable timelines.",
        "Review admin actions before enabling automation or exports.",
      ]}
    />
  );
}

const AnalyticsScreen = () => <Placeholder label="Analytics Center" />;
const MonitorScreen = () => <Placeholder label="Conversation Monitor" />;
const TicketsScreen = () => <Placeholder label="Ticket Control" />;
const MoreScreen = () => <Placeholder label="Operations Hub" />;

export function AdminTabs() {
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
            Analytics: "insights",
            Monitor: "forum",
            Tickets: "confirmation-number",
            More: "more-horiz",
          };
          return <MaterialIcons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={AdminDashboardScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Monitor" component={MonitorScreen} />
      <Tab.Screen name="Tickets" component={TicketsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
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
