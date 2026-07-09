import { Node, mergeAttributes } from '@tiptap/core';

export interface ToggleBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      /**
       * Toggle the open/closed state of the toggle block
       */
      toggleCollapse: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create<ToggleBlockOptions>({
  name: 'toggleBlock',
  group: 'block',
  content: 'toggleHeader toggleContent',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        'data-type': 'toggle-block',
        class: 'toggle-block my-3 border-l-2 border-primary/20 pl-4 py-1 transition-all duration-300',
      },
    };
  },

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => {
          const val = element.getAttribute('data-open');
          return val === null ? true : val === 'true';
        },
        renderHTML: attributes => {
          return {
            'data-open': attributes.open ? 'true' : 'false',
            class: attributes.open ? 'toggle-open' : 'toggle-closed',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

export const ToggleHeader = Node.create({
  name: 'toggleHeader',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-header"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle-header',
        class: 'flex items-center gap-2 font-semibold text-foreground/90 py-1 select-text',
      }),
      // We will render a custom visual toggle chevron button in NodeViews or pure CSS
      ['span', { class: 'toggle-chevron-indicator' }],
      ['div', { class: 'toggle-header-text flex-1' }, 0],
    ];
  },
});

export const ToggleContent = Node.create({
  name: 'toggleContent',
  group: 'block',
  content: 'block*',
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-content"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle-content',
        class: 'toggle-content-wrapper pl-6 mt-1 transition-all duration-300 ease-in-out',
      }),
      0,
    ];
  },
});
