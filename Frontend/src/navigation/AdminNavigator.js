import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  AdminPortalScreen,
  AdminHomeScreen,
  ChatMonitorScreen,
  FeedbackScreen,
  AllTicketsScreen,
} from "../screens/admin/AdminPages";
import { AnalyticsLogsScreen } from "../screens/admin/AnalyticsLogsScreen";
import { AnnouncementsScreen } from "../screens/admin/AnnouncementsScreen";
import { KnowledgeBaseScreen } from "../screens/admin/KnowledgeBaseScreen";
import { UserManagementScreen } from "../screens/admin/UserManagementScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export function AdminNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="AdminHome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="AdminWorkspace" component={AdminPortalScreen} />
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="AnalyticsLogs" component={AnalyticsLogsScreen} />
      <Stack.Screen name="ChatMonitor" component={ChatMonitorScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="AllTickets" component={AllTicketsScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} />
    </Stack.Navigator>
  );
}
