import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "./AppBrandHeader";
import { colors, layout, type } from "../theme";

export function ModulePlaceholder({ title, description, points = [] }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.header} />

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Module Ready</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>What this workspace is designed for</Text>
          <View style={styles.pointList}>
            {points.map((point) => (
              <View key={point} style={styles.pointRow}>
                <View style={styles.pointIcon}>
                  <MaterialIcons name="check-circle" size={18} color={colors.secondary} />
                </View>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 24,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: layout.cardPadding,
    gap: 10,
  },
  kicker: {
    alignSelf: "flex-start",
    color: colors.primary,
    backgroundColor: "#f4f2ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "white",
    fontSize: type.h1,
    fontWeight: "800",
  },
  description: {
    color: "#d6d8ff",
    fontSize: type.body,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: layout.cardPadding,
    gap: 12,
  },
  panelTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  pointList: {
    gap: 10,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pointIcon: {
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
