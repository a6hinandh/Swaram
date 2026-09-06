import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { AppIcon } from '../modules/shared/navigation/AppIcon';
import {
  ChatMessage,
  sendChatMessageToGemini,
  getCustomGeminiChatApiKey,
  setCustomGeminiChatApiKey,
  getGeminiModel
} from '../services/geminiChatService';

interface AshaChatbotModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `നമസ്കാരം! ഞാൻ നിങ്ങളുടെ സ്വരം എഐ സഹായിയാണ് (Swaram ASHA Copilot).

ഫീൽഡ് വിസിറ്റുകൾക്കിടയിൽ മാതൃ-ശിശു സംരക്ഷണം, പോഷകാഹാരം, ഇമ്മ്യൂണൈസേഷൻ, ബിപി/പ്രമേഹ പരിശോധനകൾ എന്നിവ സംബന്ധിച്ച ഏത് ചോദ്യങ്ങളും എന്നോട് ചോദിക്കാം.

താഴെ നൽകിയിട്ടുള്ള വിഷയങ്ങളിൽ ക്ലിക്ക് ചെയ്യുകയോ ടൈപ്പ് ചെയ്യുകയോ ചെയ്യാം:`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

const SUGGESTION_CHIPS = [
  { id: 'chip_nutrition', label: 'കുഞ്ഞിന്റെ പോഷകാഹാരം', prompt: 'ശിശു പോഷകാഹാരവും മ്യൂവാക് (MUAC) അളവുകളും എന്തൊക്കെയാണ്?' },
  { id: 'chip_anc', label: 'ഗർഭകാല മുന്നറിയിപ്പുകൾ', prompt: 'ഗർഭകാലത്തെ അപകട ലക്ഷണങ്ങളും (ANC Danger Signs) റഫറൽ മാനദണ്ഡങ്ങളും എന്തൊക്കെ?' },
  { id: 'chip_bp', label: 'ബിപി / ഹൈപ്പർടെൻഷൻ', prompt: 'ഹൈപ്പർടെൻഷൻ നിയന്ത്രണത്തിനുള്ള ആശാ വർക്കറുടെ മാർഗ്ഗനിർദ്ദേശങ്ങൾ എന്തൊക്കെ?' },
  { id: 'chip_ifa', label: 'IFA ഗുളികകൾ', prompt: 'IFA ഗുളികകൾ കഴിക്കേണ്ട വിധവും പാർശ്വഫലങ്ങളും എന്തൊക്കെ?' },
  { id: 'chip_cbac', label: 'CBAC ഹൈ-റിസ്ക്', prompt: 'CBAC സർവേയിൽ സ്കോർ 4-ൽ കൂടുതൽ വന്നാൽ എന്തുചെയ്യണം?' }
];

export const AshaChatbotModal: React.FC<AshaChatbotModalProps> = ({
  visible,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(getCustomGeminiChatApiKey());
  const [showKeyPlaintext, setShowKeyPlaintext] = useState<boolean>(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const activeKey = getCustomGeminiChatApiKey();
  const currentModel = getGeminiModel();

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [visible, messages]);

  const handleSaveApiKey = () => {
    setCustomGeminiChatApiKey(apiKeyInput);
    if (apiKeyInput.trim()) {
      setKeySaveMessage('✓ Google Gemini API Key saved successfully!');
    } else {
      setKeySaveMessage('Gemini Key cleared. Operating in offline knowledge mode.');
    }
    setTimeout(() => setKeySaveMessage(null), 3000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      const reply = await sendChatMessageToGemini(messages, textToSend);

      const assistantMessage: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: err.message || 'മറുപടി ലഭിക്കുന്നതിൽ തടസ്സമുണ്ടായി. വീണ്ടും ശ്രമിക്കുക.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* Mini Robot Avatar */}
              <View style={styles.avatarWrapper}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="2" r="1.5" fill="#34D399" />
                  <Path d="M12 2.5v3.5" stroke="#6EE7B7" strokeWidth="1.6" />
                  <Rect x="4" y="6" width="16" height="14" rx="3.5" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
                  <Rect x="6" y="9" width="12" height="6" rx="2" fill="#022C22" />
                  <Circle cx="9" cy="12" r="1.3" fill="#34D399" />
                  <Circle cx="15" cy="12" r="1.3" fill="#34D399" />
                  <Path d="M9.5 16.5h5" stroke="#6EE7B7" strokeWidth="1.2" strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.headerTitle}>സ്വരം AI സഹായി</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Copilot</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {activeKey ? `Google Gemini • ${currentModel}` : 'Offline Frontline Assistant'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* API Key Settings Toggle */}
              <TouchableOpacity
                style={[styles.headerIconBtn, showSettings && styles.headerIconBtnActive]}
                onPress={() => setShowSettings(!showSettings)}
                accessibilityLabel="Key Settings"
              >
                <AppIcon name="key" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Clear Chat Button */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleClearChat}
                accessibilityLabel="Clear Chat"
              >
                <AppIcon name="trash" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityLabel="Close Chatbot"
              >
                <AppIcon name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings Bar / API Key Input Drawer */}
          {showSettings && (
            <View style={styles.settingsDrawer}>
              <Text style={styles.settingsHeading}>Google Gemini API Configuration (ASHA Assistant):</Text>
              <Text style={styles.settingsSubtext}>
                Model: <Text style={{ fontWeight: 'bold', color: '#065F46' }}>{currentModel}</Text> • 
                Also reads from <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#047857' }}>EXPO_PUBLIC_GEMINI_CHATBOT_API_KEY</Text> in .env
              </Text>
              <View style={styles.keyInputRow}>
                <TextInput
                  style={styles.keyInput}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="Paste AIzaSy... Google Gemini API key"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showKeyPlaintext}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.saveKeyBtn} onPress={handleSaveApiKey}>
                  <Text style={styles.saveKeyBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.keyMetaRow}>
                <TouchableOpacity onPress={() => setShowKeyPlaintext(!showKeyPlaintext)}>
                  <Text style={styles.plainToggleText}>
                    {showKeyPlaintext ? 'Hide Key' : 'Show Key'}
                  </Text>
                </TouchableOpacity>
                {activeKey ? (
                  <Text style={styles.keyStatusOk}>
                    Key active ({activeKey.slice(0, 7)}...{activeKey.slice(-4)})
                  </Text>
                ) : (
                  <Text style={styles.keyStatusMissing}>No key set (Offline mode)</Text>
                )}
              </View>

              {keySaveMessage && (
                <Text style={styles.keyFeedbackText}>{keySaveMessage}</Text>
              )}
            </View>
          )}

          {/* Quick Prompt Suggestion Chips */}
          <View style={styles.suggestionsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {SUGGESTION_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip.id}
                  style={styles.chip}
                  onPress={() => handleSendMessage(chip.prompt)}
                  disabled={isSending}
                >
                  <Text style={styles.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Messages Scroll Area */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAi
                  ]}
                >
                  {!isUser && (
                    <View style={styles.aiMessageAvatar}>
                      <AppIcon name="bot" size={14} color="#34D399" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.aiBubble,
                      msg.isError && styles.errorBubble
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.aiMessageText,
                        msg.isError && styles.errorMessageText
                      ]}
                    >
                      {msg.content}
                    </Text>
                    <Text
                      style={[
                        styles.messageTimestamp,
                        isUser ? styles.userTimestamp : styles.aiTimestamp
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}

            {isSending && (
              <View style={[styles.messageRow, styles.messageRowAi]}>
                <View style={styles.aiMessageAvatar}>
                  <AppIcon name="bot" size={14} color="#34D399" />
                </View>
                <View style={[styles.messageBubble, styles.aiBubble, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={{ marginLeft: 8, fontSize: 12, color: '#065F46', fontStyle: 'italic' }}>
                      സ്വരം ചിന്തിക്കുന്നു... (Consulting Swaram AI)
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="ചോദിക്കുക... Ask medical or ASHA protocol question..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={600}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isSending) && styles.sendBtnDisabled
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#064E3B'
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#047857'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#022C22',
    borderWidth: 1.5,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  activePill: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6
  },
  activePillText: {
    color: '#022C22',
    fontSize: 9,
    fontWeight: '800'
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  headerIconBtnActive: {
    backgroundColor: '#10B981'
  },
  headerIconText: {
    fontSize: 15
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  settingsDrawer: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0'
  },
  settingsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2
  },
  settingsSubtext: {
    fontSize: 10,
    color: '#047857',
    marginBottom: 8
  },
  keyInputRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  keyInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827'
  },
  saveKeyBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8
  },
  saveKeyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  keyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  plainToggleText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600'
  },
  keyStatusOk: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600'
  },
  keyStatusMissing: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600'
  },
  keyFeedbackText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
    marginTop: 4
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8
  },
  suggestionsScroll: {
    paddingHorizontal: 12
  },
  chip: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8
  },
  chipText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600'
  },
  messageList: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  messageContent: {
    padding: 14,
    paddingBottom: 24
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end'
  },
  messageRowUser: {
    justifyContent: 'flex-end'
  },
  messageRowAi: {
    justifyContent: 'flex-start'
  },
  aiMessageAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 2
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16
  },
  userBubble: {
    backgroundColor: '#065F46',
    borderBottomRightRadius: 2
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2
      },
      android: {
        elevation: 1
      }
    })
  },
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  aiMessageText: {
    color: '#1F2937'
  },
  errorMessageText: {
    color: '#B91C1C'
  },
  messageTimestamp: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.75)'
  },
  aiTimestamp: {
    color: '#9CA3AF'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    maxHeight: 100
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  sendBtnDisabled: {
    backgroundColor: '#9CA3AF'
  }
});
