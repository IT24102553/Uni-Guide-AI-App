import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, layout } from "../../theme";
import {
  ATTACHMENT_HELPER_TEXT,
  attachmentKey,
  formatAttachmentSize,
  resolveAttachmentUrl,
} from "./attachmentUtils";

function AttachmentRow({ attachment, removable, onRemove }) {
  const name = attachment?.originalName || attachment?.name || "Attachment";
  const sizeText = formatAttachmentSize(attachment?.size);
  const hasUrl = Boolean(attachment?.url);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.rowMain, !hasUrl && styles.rowStatic]}
        onPress={() => {
          if (hasUrl) {
            void Linking.openURL(resolveAttachmentUrl(attachment.url));
          }
        }}
        disabled={!hasUrl}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="attach-file" size={18} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.fileName}>{name}</Text>
          {sizeText ? <Text style={styles.fileMeta}>{sizeText}</Text> : null}
        </View>
        {hasUrl ? <MaterialIcons name="open-in-new" size={18} color={colors.textMuted} /> : null}
      </Pressable>
      {removable ? (
        <Pressable style={styles.removeBtn} onPress={() => onRemove?.(attachmentKey(attachment))}>
          <MaterialIcons name="close" size={16} color="#b42318" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AttachmentPickerField({
  title,
  attachments,
  onPick,
  onRemove,
  helperText = ATTACHMENT_HELPER_TEXT,
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <Pressable style={styles.pickButton} onPress={onPick}>
        <MaterialIcons name="attach-file" size={18} color={colors.secondary} />
        <Text style={styles.pickButtonText}>Add Attachment</Text>
      </Pressable>
      {attachments.length ? (
        <View style={styles.list}>
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachmentKey(attachment)}
              attachment={attachment}
              removable
              onRemove={onRemove}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.helperText}>{helperText}</Text>
    </View>
  );
}

export function AttachmentList({
  title,
  attachments,
  emptyText = "No attachments.",
  hideWhenEmpty = false,
  removable = false,
  onRemove,
}) {
  if (hideWhenEmpty && !attachments?.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {attachments?.length ? (
        <View style={styles.list}>
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachmentKey(attachment)}
              attachment={attachment}
              removable={removable}
              onRemove={onRemove}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  pickButton: {
    minHeight: 42,
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  pickButtonText: { color: colors.secondary, fontWeight: "800" },
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowMain: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9dde3",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowStatic: {
    paddingRight: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1 },
  fileName: { color: colors.text, fontWeight: "700" },
  fileMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff1f3",
    borderWidth: 1,
    borderColor: "#fecdd3",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  emptyText: { color: colors.textMuted, fontSize: 12 },
});
