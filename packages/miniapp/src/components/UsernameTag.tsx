import { useUsernameQuery } from "../lib/interwovenkit-stub";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

interface UsernameTagProps {
  address: string;
  className?: string;
}

export default function UsernameTag({ address, className }: UsernameTagProps) {
  const { data: username, isLoading } = useUsernameQuery(address);

  if (isLoading) {
    return <span className={className}>...</span>;
  }

  return (
    <span className={className} title={address}>
      {username ? `${username}.init` : truncateAddress(address)}
    </span>
  );
}
