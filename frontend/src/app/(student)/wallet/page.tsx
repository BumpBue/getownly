import type { Metadata } from "next";
import { walletMessages } from "@/lib/messages/wallet";
import { WalletView } from "./WalletView";

export const metadata: Metadata = {
  title: walletMessages.wallet.title,
  description: walletMessages.wallet.subtitle,
};

/**
 * A wallet balance is the one number on the site that must never be a cached
 * render, so unlike the catalog this page is fetched by the client on mount
 * rather than server-rendered.
 */
export default function WalletPage() {
  return <WalletView />;
}
