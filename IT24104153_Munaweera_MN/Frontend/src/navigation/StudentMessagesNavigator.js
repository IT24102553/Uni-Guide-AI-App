import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StudentChatConversationScreen } from "../screens/student/StudentChatConversationScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export function StudentMessagesNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="StudentChatConversation"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="StudentChatConversation"
        component={StudentChatConversationScreen}
      />
    </Stack.Navigator>
  );
}
