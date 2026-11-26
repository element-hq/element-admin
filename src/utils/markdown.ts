// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import * as commonmark from "commonmark";

// Raw HTML counts as plain text because it is rendered escaped, as typed.
const PLAIN_NODE_TYPES = new Set<commonmark.NodeType>([
  "document",
  "paragraph",
  "text",
  "softbreak",
  "html_inline",
  "html_block",
]);

const isPlainText = (document: commonmark.Node): boolean => {
  const walker = document.walker();
  let event;
  while ((event = walker.next())) {
    if (!PLAIN_NODE_TYPES.has(event.node.type)) return false;
  }
  return true;
};

/** The renderer internals the overrides below rely on, untyped upstream. */
interface RendererInternals {
  paragraph(
    this: RendererInternals,
    node: commonmark.Node,
    entering: boolean,
  ): void;
  html_inline(this: RendererInternals, node: commonmark.Node): void;
  html_block(this: RendererInternals, node: commonmark.Node): void;
  lit(text: string): void;
  cr(): void;
  esc(text: string): string;
}

const renderHtml = (document: commonmark.Node): string => {
  const renderer = new commonmark.HtmlRenderer({
    safe: true,
    softbreak: "<br />",
  });
  const internals = renderer as unknown as RendererInternals;

  // A message made of one paragraph is sent without the `<p>` around it.
  const renderParagraph = internals.paragraph.bind(internals);
  internals.paragraph = function (node, entering) {
    const parent = node.parent;
    if (parent?.type === "document" && parent.firstChild === parent.lastChild) {
      return;
    }
    renderParagraph(node, entering);
  };
  internals.html_inline = function (node) {
    this.lit(this.esc(node.literal ?? ""));
  };
  internals.html_block = function (node) {
    this.cr();
    this.lit(this.esc(node.literal ?? ""));
    this.cr();
  };

  return renderer.render(document);
};

/**
 * Builds `m.text` message content from Markdown the way Element Web does: the
 * HTML rendering is only attached when the text contains markup.
 */
export const markdownMessageContent = (
  body: string,
): Record<string, unknown> => {
  const document = new commonmark.Parser().parse(body);
  if (isPlainText(document)) {
    return { msgtype: "m.text", body };
  }

  return {
    msgtype: "m.text",
    body,
    format: "org.matrix.custom.html",
    formatted_body: renderHtml(document),
  };
};
