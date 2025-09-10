import { H3, H4, H5, Text } from "@vector-im/compound-web";
import cx from "classnames";
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

interface ReleaseNotesProps {
  markdown: string;
  repo: string;
}
const ReleaseNotes = ({ markdown, repo }: ReleaseNotesProps) => {
  return (
    <Markdown
      components={{
        a: ({ node: _, className, children, ...props }) => (
          <a
            {...props}
            className={cx(
              className,
              "underline hover:no-underline font-semibold",
            )}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        h1: ({ node: _, ...props }) => <H3 {...props} />,
        h2: ({ node: _, ...props }) => <H4 {...props} />,
        h3: ({ node: _, ...props }) => <H5 {...props} />,
        h4: ({ node: _, ...props }) => <H5 {...props} />,
        h5: ({ node: _, ...props }) => <H5 {...props} />,
        h6: ({ node: _, ...props }) => <H5 {...props} />,
        code: ({ node: _, className, ...props }) => (
          <code {...props} className={cx(className, "font-mono break-all")} />
        ),
        ul: ({ node: _, className, ...props }) => (
          <ul className={cx(className, "list-disc list-outside")} {...props} />
        ),
        li: ({ node: _, className, ...props }) => (
          <li className={cx(className, "my-1 ml-6")} {...props} />
        ),
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
  );
};

export default ReleaseNotes;
