import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { SLASH_COMMANDS, NOTE_TEMPLATES } from "./templates";
import type { Editor } from "@tiptap/core";

export type SlashCommandItem = (typeof SLASH_COMMANDS)[number];

export const SlashCommandKey = new PluginKey("slash-command");

type SuggestionConfig = Omit<SuggestionOptions<SlashCommandItem>, "editor">;

export const SlashCommand = Extension.create<{ suggestion: SuggestionConfig }>({
  name: "slash-command",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }) => {
          const { from, to } = range;
          const item = props as SlashCommandItem;
          editor.chain().focus().deleteRange({ from, to }).run();

          if ("template" in item && item.template) {
            const template = NOTE_TEMPLATES[item.template];
            if (template) {
              editor.chain().focus().insertContent(template.content).run();
            }
            return;
          }

          if (item.action) {
            item.action(editor);
          }
        },
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_COMMANDS.filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              i.description.toLowerCase().includes(q),
          ).slice(0, 8);
        },
        render: () => ({
          onStart: () => {},
          onUpdate: () => {},
          onKeyDown: () => false,
          onExit: () => {},
        }),
      } satisfies SuggestionConfig,
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
