import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { loginUser } from '../api/auth';
import { AppBrandHeader } from '../components/AppBrandHeader';
import { PasswordField } from '../components/PasswordField';
import { useSession } from '../context/SessionContext';
import { colors, layout, type } from '../theme';

export function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { setSession } = useSession();
  const [email, setEmail] = useState('it24104153@my.sliit.lk');
  const [password, setPassword] = useState('Student@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Enter both your email and password.');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const data = await loginUser({
        email: normalizedEmail,
        password,
      });

      if (data.user.role !== 'student') {
        setError('This standalone build is only for the student chat module.');
        return;
      }

      setSession({
        token: data.token,
        user: data.user,
      });
      navigation.replace('StudentChat');
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.main}>
          <AppBrandHeader style={styles.topBar} showLogoutAction={false} />

          <View style={styles.heroWrap}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Student Chat Module</Text>
            </View>
            <Text style={styles.heroTitle}>Standalone submission for the student AI chat feature.</Text>
            <Text style={styles.heroBody}>
              This build contains only the login and student chat workflow so your part can be run and reviewed separately.
            </Text>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
              }}
              style={styles.image}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.infoBanner}>
              <MaterialIcons name="info-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>Default demo student account is already filled in for quick testing.</Text>
            </View>

            <Text style={styles.inputLabel}>Student Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. it24104153@my.sliit.lk"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#777683"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <PasswordField
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
            />

            {error ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={16} color="#ba1a1a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.signIn, loading && styles.signInDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.signInText}>{loading ? 'Signing In...' : 'Open Student Chat'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}> 
          <Text style={styles.footerBrand}>UniGuide AI Chat Submission</Text>
          <Text style={styles.footerCopy}>Prepared as an isolated frontend for the student chat component.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'space-between' },
  main: {
    paddingBottom: 24,
    gap: 18,
  },
  topBar: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 8,
  },
  heroWrap: {
    paddingHorizontal: layout.screenPadding,
    gap: 10,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: layout.pillRadius,
    backgroundColor: 'rgba(107,56,212,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: type.hero,
    color: colors.primary,
    fontWeight: '800',
    lineHeight: type.heroLine,
  },
  heroBody: {
    color: colors.textMuted,
    lineHeight: 22,
    fontSize: type.body,
  },
  image: {
    marginTop: 4,
    width: '100%',
    height: layout.imageHeight,
    borderRadius: layout.cardRadius,
  },
  card: {
    marginHorizontal: layout.screenPadding,
    padding: layout.cardPadding,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#c7d7ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoText: {
    flex: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#e0e3e5',
    paddingHorizontal: 14,
    color: colors.text,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#ffebe9',
    borderWidth: 1,
    borderColor: '#ffcac3',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
  signIn: {
    marginTop: 2,
    backgroundColor: colors.secondary,
    borderRadius: layout.pillRadius,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: layout.touchTarget,
  },
  signInText: { color: 'white', fontWeight: '800', fontSize: 18 },
  signInDisabled: { opacity: 0.65 },
  footer: {
    marginTop: 8,
    backgroundColor: colors.footer,
    paddingTop: 18,
    paddingHorizontal: layout.screenPadding,
    gap: 6,
  },
  footerBrand: { color: 'white', fontSize: 18, fontWeight: '700' },
  footerCopy: { color: '#cfd2ff', fontSize: 12, lineHeight: 18 },
});
