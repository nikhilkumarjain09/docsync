'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import * as Y from 'yjs';

import { ToggleBlock, ToggleHeader, ToggleContent } from '@/lib/editor/toggle-block';
import { CalloutBlock } from '@/lib/editor/callout-block';

function getUserColor(userId: string) {
  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

interface CollaborativeEditorProps {
  stableDoc: Y.Doc | null;
  stableContent: Y.XmlFragment | null;
  stableProvider: any;
  stableAwareness: any;
  userId: string;
  userName: string;
  isViewer: boolean;
  isLocked: boolean;
  onEditorCreated: (editor: any) => void;
  onEditorDestroyed: () => void;
}

export default function CollaborativeEditor({
  stableDoc,
  stableContent,
  stableProvider,
  stableAwareness,
  userId,
  userName,
  isViewer,
  isLocked,
  onEditorCreated,
  onEditorDestroyed,
}: CollaborativeEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Collaboration handles undo/redo
          dropcursor: {
            color: 'var(--primary)',
            width: 2,
          },
        }),
        Collaboration.configure({
          document: stableDoc || undefined,
          fragment: stableContent || undefined,
        }),
        CollaborationCursor.configure({
          provider:
            stableProvider && stableAwareness
              ? Object.assign(Object.create(stableProvider), { awareness: stableAwareness })
              : ({ awareness: {}, doc: {} } as unknown as Record<string, unknown>),
          user: {
            name: userName,
            color: getUserColor(userId),
          },
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands...",
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Highlight.configure({
          multicolor: true,
        }),
        LinkExtension.configure({
          openOnClick: false,
        }),
        GlobalDragHandle.configure({
          dragHandleWidth: 36,
          dragHandleSelector: '#editor-gutter-controls',
        }),
        ToggleBlock,
        ToggleHeader,
        ToggleContent,
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          allowBase64: true,
        }),
        CalloutBlock,
      ],
      editorProps: {
        attributes: {
          class:
            'prose dark:prose-invert focus:outline-none min-h-[480px] w-full max-w-none text-base leading-relaxed',
        },
        handleClickOn(view, pos, node, nodePos, event) {
          const target = event.target as HTMLElement;
          if (target.classList.contains('toggle-chevron-indicator')) {
            const transaction = view.state.tr;
            const parentNode = view.state.doc.nodeAt(nodePos);
            if (parentNode && parentNode.type.name === 'toggleBlock') {
              const nextOpen = !parentNode.attrs.open;
              view.dispatch(
                transaction.setNodeMarkup(nodePos, undefined, {
                  ...parentNode.attrs,
                  open: nextOpen,
                }),
              );
              return true;
            }
          }
          return false;
        },
      },
      immediatelyRender: false,
    },
    [stableDoc, stableProvider, stableContent],
  );

  useEffect(() => {
    if (editor) {
      onEditorCreated(editor);
      return () => {
        onEditorDestroyed();
      };
    }
  }, [editor, onEditorCreated, onEditorDestroyed]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isViewer && !isLocked);
    }
  }, [editor, isViewer, isLocked]);

  return <EditorContent editor={editor} />;
}
