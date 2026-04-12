import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { StudentOverviewNavigator } from "./StudentOverviewNavigator";
import {
  StudentTicketsScreen,
  StudentMessagesScreen,
  StudentKnowledgeBaseScreen,
} from "../screens/student/StudentPages";
import { StudentProfileScreen } from "../screens/student/StudentProfileScreen";
import { colors, layout } from "../theme";

const Tab = createBottomTabNavigator();

export function StudentTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBottomSpace = Math.max(insets.bottom, layout.tabBarBottomPadding);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
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
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap = {
            Overview: "home",
            "My Tickets": "confirmation-number",
            Messages: "forum",
            "Knowledge Base": "menu-book",
            Profile: "person",
          };
          return (
            <MaterialIcons
              name={iconMap[route.name]}
              size={size}
              color={color}
              style={focused ? styles.iconActive : undefined}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Overview" component={StudentOverviewNavigator} />
      <Tab.Screen name="My Tickets" component={StudentTicketsScreen} />
      <Tab.Screen name="Messages" component={StudentMessagesScreen} />
      <Tab.Screen name="Knowledge Base" component={StudentKnowledgeBaseScreen} />
      <Tab.Screen name="Profile" component={StudentProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopColor: "#e0e3e5",
    borderTopWidth: 1,
    paddingTop: layout.tabBarTopPadding,
  },
  tabBarItem: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  tabBarIcon: {
    marginTop: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    marginTop: 2,
  },
  iconActive: {
    opacity: 1,
  },
});
