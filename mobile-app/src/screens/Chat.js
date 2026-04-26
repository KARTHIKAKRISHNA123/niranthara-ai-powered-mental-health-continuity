// src/screens/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { postData } from '../utils/api';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef();

  useEffect(() => {
    setMessages([
      { id: '0', text: "Namaste. I'm Niranthara. How are you feeling right now?", sender: 'ai' }
    ]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    const newMessages = [...messages, { id: Date.now().toString(), text: userMsg, sender: 'user' }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const result = await postData('/chat/message', { message: userMsg }, 'chatLogs');
    setLoading(false);

    if (result.success && result.data && result.data.reply) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: result.data.reply, sender: 'ai' }]);
    } else if (result.offline) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "I've saved your message. I'll respond as soon as you're back online.", sender: 'ai' }]);
    } else {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "I'm having trouble connecting right now. Please try again later.", sender: 'ai' }]);
    }
  };

  const renderItem = ({ item }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.msgContainer, isAi ? styles.msgAi : styles.msgUser]}>
        <Text style={[styles.msgText, isAi ? styles.msgTextAi : styles.msgTextUser]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Talk to Niranthara</Text>
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatArea}
          onContentSizeChange={() => {
            if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {loading && <ActivityIndicator style={{ margin: 10 }} color={theme.colors.lavenderDark} />}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  headerTitle: {
    fontFamily: theme.typography.display,
    fontSize: 24,
    color: theme.colors.lavenderDark,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lavenderLight,
    backgroundColor: theme.colors.warmWhite,
  },
  chatArea: {
    padding: theme.spacing.lg,
  },
  msgContainer: {
    maxWidth: '80%',
    padding: theme.spacing.md,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
  },
  msgAi: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.lavenderLight,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
    shadowColor: theme.colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgUser: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.roseDark,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 18,
  },
  msgText: {
    fontFamily: theme.typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  msgTextAi: {
    color: theme.colors.charcoal,
  },
  msgTextUser: {
    color: theme.colors.warmWhite,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warmWhite,
    borderTopWidth: 1,
    borderTopColor: theme.colors.softGray,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.cream,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.body,
    fontSize: 15,
  },
  sendBtn: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  sendText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.lavenderDark,
    fontSize: 16,
  }
});
