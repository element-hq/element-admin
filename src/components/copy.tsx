import { useMutation } from "@tanstack/react-query";
import { CopyIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton } from "@vector-im/compound-web";

type Props = { value: string };

export const CopyToClipboard: React.FC<Props> = ({ value }: Props) => {
  const copyMutation = useMutation({
    mutationFn: () => navigator.clipboard.writeText(value),
    onSuccess: () => setTimeout(() => copyMutation.reset(), 2000),
  });

  return (
    <IconButton
      disabled={copyMutation.isSuccess}
      onClick={() => copyMutation.mutate()}
      tooltip={copyMutation.isSuccess ? "Copied!" : "Copy to clipboard"}
    >
      <CopyIcon />
    </IconButton>
  );
};
