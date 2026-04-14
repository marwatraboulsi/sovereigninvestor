/**
 * MessageBubble - renders a single conversation message.
 *
 * User messages: plain text in a blue bubble.
 * Assistant messages: rendered as Markdown so that bold text, bullet lists,
 * headers, and emoji scorecards (🟢/🟡/🔴) display correctly.
 */

import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  /** True when this is the in-progress streaming bubble */
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: Props) {
  if (role === 'user') {
    return (
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{content}</Text>
      </View>
    );
  }

  return (
    <View style={styles.assistantBubble}>
      <Text style={styles.roleLabel}>
        Analysis{isStreaming ? '  ·  writing…' : ''}
      </Text>
      <Markdown style={markdownStyles}>{content}</Markdown>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  userBubble: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    padding: 14,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  userText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 22,
  },
  assistantBubble: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
});

// Markdown styles - mapped to the dark theme
const markdownStyles = {
  body: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
  },
  heading1: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700' as const,
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700' as const,
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  strong: {
    color: '#F1F5F9',
    fontWeight: '700' as const,
  },
  em: {
    color: '#94A3B8',
    fontStyle: 'italic' as const,
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  ordered_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  list_item: {
    marginBottom: 2,
  },
  bullet_list_icon: {
    color: '#3B82F6',
    fontSize: 14,
  },
  hr: {
    backgroundColor: '#334155',
    height: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  blockquote: {
    backgroundColor: '#0F172A',
    borderLeftColor: '#3B82F6',
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    marginVertical: 6,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#94A3B8',
  },
  code_inline: {
    backgroundColor: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#7DD3FC',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
  },
};
