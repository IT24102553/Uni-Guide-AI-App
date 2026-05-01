import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StudentDashboardScreen } from "../screens/StudentDashboardScreen";
import { StudentAnnouncementsScreen } from "../screens/student/StudentAnnouncementsScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export function StudentOverviewNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="StudentOverviewHome" component={StudentDashboardScreen} />
      <Stack.Screen
        name="StudentAnnouncements"
        component={StudentAnnouncementsScreen}
      />
    </Stack.Navigator>
  );
}
