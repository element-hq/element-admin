import { H3, H4, H5, Link, Text } from "@vector-im/compound-web";
import type { Root } from "mdast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGithub from "remark-github";
import type { Transformer } from "unified";

function remarkRemoveFirstHeading(): Transformer<Root, Root> {
  return (tree: Root) => {
    // Check if the document has children and if the first child is a heading.
    if (tree.children[0]?.type === "heading") {
      // Remove the first child from the tree.
      tree.children.shift();
    }
  };
}

interface MarkdownProps {
  markdown: string;
  repo: string;
}
const Gfm = ({ markdown, repo }: MarkdownProps) => {
  return (
    <article>
      <Markdown
        components={{
          a: (props) => <Link {...props} target="_blank" />,
          h1: H3,
          h2: H4,
          h3: H5,
          h4: H5,
          h5: H5,
          h6: H5,
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-8">{children}</ul>
          ),
          li: ({ children }) => <li className="space-x-2">{children}</li>,
          p: ({ children }) => <Text>{children}</Text>,
        }}
        remarkPlugins={[
          remarkRemoveFirstHeading,
          remarkGfm,
          [remarkGithub, { repository: repo }],
        ]}
      >
        {markdown}
      </Markdown>
    </article>
  );
};

export default Gfm;
