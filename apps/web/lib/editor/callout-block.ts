import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    calloutBlock: {
      /**
       * Toggle a callout block
       */
      toggleCallout: (attributes?: { emoji?: string; color?: string }) => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create<CalloutBlockOptions>({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
        renderHTML: (attributes) => ({ 'data-emoji': attributes.emoji }),
      },
      color: {
        default: 'default',
        parseHTML: (element) => element.getAttribute('data-color') || 'default',
        renderHTML: (attributes) => ({ 'data-color': attributes.color }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes['data-color'] || 'default';
    const colorClasses: Record<string, string> = {
      default: 'bg-muted/40 border-border/60 text-foreground',
      blue: 'bg-blue-500/5 border-blue-500/20 text-blue-900 dark:text-blue-200',
      green: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-200',
      yellow: 'bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-200',
      red: 'bg-red-500/5 border-red-500/20 text-red-900 dark:text-red-200',
      purple: 'bg-violet-500/5 border-violet-500/20 text-violet-900 dark:text-violet-200',
    };

    const baseClasses = 'callout-block border p-4 rounded-xl flex gap-3 my-4';
    const classes = `${baseClasses} ${colorClasses[color] || colorClasses.default}`;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout-block',
        class: classes,
      }),
      [
        'span',
        { class: 'callout-emoji text-xl select-none shrink-0', contenteditable: 'false' },
        HTMLAttributes['data-emoji'] || '💡',
      ],
      ['div', { class: 'callout-content flex-1 min-w-0' }, 0],
    ];
  },

  addCommands() {
    return {
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap('calloutBlock', attributes);
        },
    };
  },
});
