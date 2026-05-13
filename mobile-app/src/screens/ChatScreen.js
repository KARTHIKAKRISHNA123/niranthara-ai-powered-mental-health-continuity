import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, SafeAreaView,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const STARTER_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    text: 'Hello! I am here for you.\nHow are you feeling today?',
  },
];

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState(STARTER_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef();

  const canSend = input.trim().length > 0 && !loading;

  const send = () => {
    if (!canSend) return;

    const userMsg = { id: Date.now(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Placeholder reply — replaced with real Gemma API in Task 8
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'I am listening. Tell me more.',
        },
      ]);
      setLoading(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Nirantara Chat</Text>
          
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Message list */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(m => (
            <View
              key={m.id}
              style={[
                styles.bubbleWrapper,
                m.role === 'user' ? styles.wrapperUser : styles.wrapperAI,
              ]}
            >
              {m.role === 'assistant' && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>N</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === 'user' ? styles.bubbleUser : styles.bubbleAI,
                ]}
              >
                <Text style={m.role === 'user' ? styles.textUser : styles.textAI}>
                  {m.text}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={[styles.bubbleWrapper, styles.wrapperAI]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>N</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleAI]}>
                <Text style={styles.textAI}> Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar — always visible above keyboard */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Tamil, English, or Tanglish..."
            placeholderTextColor={COLORS.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxHeight={100}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Text style={styles.sendBtnText}>Send</Text>
            
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 12,
    backgroundColor: '#F4EDE8',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '22',
  },
  backBtn: { paddingRight: 8 },
  backText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primary },
  headerTitle: {
    fontFamily: FONTS.heading, fontSize: 24, color: COLORS.roseDark,
  },
  headerSub: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted,
  },

  // Messages
  messages: { flex: 1 },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 12,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  wrapperUser: { justifyContent: 'flex-end' },
  wrapperAI: { justifyContent: 'flex-start' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.roseDark,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontFamily: FONTS.body, fontSize: 13,
    color: COLORS.warmWhite, fontWeight: '500',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#F4EDE8',
    borderBottomLeftRadius: 4,
  },
  textUser: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.warmWhite, lineHeight: 22,
  },
  textAI: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.text, lineHeight: 22,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F4EDE8',
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '22',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    minHeight: 44,
  },
  sendBtn: {
    backgroundColor: COLORS.roseDark,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 70,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.muted,
  },
  sendBtnText: {
    fontFamily: FONTS.body, fontSize: 13,
    color: COLORS.warmWhite, fontWeight: '500',
  },
  sendBtnTamil: {
    fontFamily: FONTS.body, fontSize: 10,
    color: COLORS.warmWhite + 'CC',
  },
});