import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { DEMO_CREDENTIALS, AshaWorkerProfile, saveSession, createDemoSession } from '../services/authService';
import { apiClient } from '../api/apiClient';

interface LoginScreenProps {
  onLoginSuccess: (profile: AshaWorkerProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interactive teal gradient state
  const [focusedField, setFocusedField] = useState<'none' | 'username' | 'password'>('none');
  const [isLoginPressed, setIsLoginPressed] = useState<boolean>(false);

  // Dynamic teal gradient: highlights interactively when focusing inputs
  const getActiveGradientColors = (): [string, string, string] => {
    if (focusedField === 'username') {
      return ['#042F2E', '#0D9488', '#022C22'];
    }
    if (focusedField === 'password') {
      return ['#042F2E', '#14B8A6', '#022C22'];
    }
    return ['#042F2E', '#0F766E', '#022C22'];
  };

  const handleLogin = async () => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('ദയവായി യൂസർനെയിമും പാസ്‌വേഡും നൽകുക (Please enter username and password)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Attempt authentication with Module 3 backend
      const res = await apiClient.login(cleanUser, cleanPass);

      if (res.data && res.data.user) {
        await saveSession({
          isLoggedIn: true,
          token: res.data.access_token,
          user: res.data.user
        });
        onLoginSuccess(res.data.user);
        return;
      }

      // 2. Offline Fallback for Demo ASHA Worker
      if (
        (cleanUser === DEMO_CREDENTIALS.username || cleanUser === 'demo_asha' || cleanUser.startsWith('asha')) &&
        (cleanPass === DEMO_CREDENTIALS.password || cleanPass === 'password123' || cleanPass === 'swaram123')
      ) {
        const demoSession = createDemoSession();
        await saveSession(demoSession);
        onLoginSuccess(demoSession.user!);
        return;
      }

      setErrorMessage('അസാധുവായ വിവരങ്ങൾ. ദയവായി താഴെയുള്ള ഡെമോ വിവരങ്ങൾ ഉപയോഗിക്കുക (Invalid credentials. Use demo credentials below).');
    } catch (err: any) {
      // Local fallback in case of network issue
      if (
        (cleanUser === DEMO_CREDENTIALS.username || cleanUser === 'demo_asha' || cleanUser.startsWith('asha')) &&
        (cleanPass === DEMO_CREDENTIALS.password || cleanPass === 'password123' || cleanPass === 'swaram123')
      ) {
        const demoSession = createDemoSession();
        await saveSession(demoSession);
        onLoginSuccess(demoSession.user!);
      } else {
        setErrorMessage(`ലോഗിൻ പരാജയപ്പെട്ടു: ${err.message || 'Error logging in'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#042F2E" />
      <LinearGradient
        colors={getActiveGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Header Branding */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#2DD4BF', '#0D9488', '#14B8A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradientRing}
            >
              <Image
                source={require('../../assets/swaram.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </LinearGradient>
            <Text style={styles.brandTitle}>സ്വരം • SWARAM</Text>
            <Text style={styles.brandSubtitle}>
              Frontline ASHA Worker Platform & Clinical Care Ledger
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>ആശാ ലോഗിൻ</Text>
            <Text style={styles.formSubtitle}>ASHA Worker Login</Text>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>യൂസർനെയിം (Username)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'username' && styles.textInputFocused
                ]}
                placeholder="e.g. asha_ward4"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField('none')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.fieldHelperBtn}
                onPress={() => {
                  setUsername(DEMO_CREDENTIALS.username);
                  setErrorMessage(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.fieldHelperText}>Use Demo Username</Text>
              </TouchableOpacity>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>പാസ്‌വേഡ് (Password)</Text>
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.togglePasswordText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  focusedField === 'password' && styles.textInputFocused
                ]}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('none')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <View style={styles.demoFillRow}>
                <TouchableOpacity
                  style={styles.fieldHelperBtn}
                  onPress={() => {
                    setPassword(DEMO_CREDENTIALS.password);
                    setErrorMessage(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fieldHelperText}>Use Demo Password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fillBothWrapper}
                  onPress={() => {
                    setUsername(DEMO_CREDENTIALS.username);
                    setPassword(DEMO_CREDENTIALS.password);
                    setErrorMessage(null);
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#042F2E', '#0D9488']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fillBothGradient}
                  >
                    <Text style={styles.fillBothText}>Fill Both</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button with Interactive Teal Gradient */}
            <TouchableOpacity
              style={[styles.loginButtonWrapper, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              onPressIn={() => setIsLoginPressed(true)}
              onPressOut={() => setIsLoginPressed(false)}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  isLoading
                    ? ['#5EEAD4', '#99F6E4']
                    : isLoginPressed
                    ? ['#042F2E', '#0F766E']
                    : ['#0D9488', '#14B8A6']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>ലോഗിൻ ചെയ്യുക (Log In)</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 24
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22
  },
  logoGradientRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  logoImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF'
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#CCFBF1',
    marginTop: 4,
    textAlign: 'center'
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center'
  },
  formSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 18,
    letterSpacing: 0.5
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 14
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6
  },
  togglePasswordText: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '600'
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827'
  },
  textInputFocused: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  fieldHelperBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F0FDFA'
  },
  fieldHelperText: {
    color: '#0D9488',
    fontSize: 12,
    fontWeight: '600'
  },
  demoFillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6
  },
  fillBothWrapper: {
    borderRadius: 6,
    overflow: 'hidden'
  },
  fillBothGradient: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  fillBothText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  loginButtonWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10
  },
  loginButtonDisabled: {
    opacity: 0.65
  },
  loginButtonGradient: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  }
});
