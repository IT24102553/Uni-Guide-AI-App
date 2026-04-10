import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, layout } from "../theme";

export function PasswordField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = "#777683",
  containerStyle,
  inputStyle,
  editable = true,
  onFocus,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={!visible}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        onFocus={onFocus}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
      >
        <MaterialIcons
          name={visible ? "visibility-off" : "visibility"}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#e0e3e5",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    minHeight: layout.touchTarget,
    paddingRight: 10,
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
