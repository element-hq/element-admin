import { WelcomeLayout } from "@/components/layout";

/**
 * This is what is displayed when the app is loading.
 * Because of when this is displayed, there are a few constraints with this:
 *
 *   - no localized text
 *   - no compound (-web or -design-tokens)
 *   - no suspending or throwing errors
 *
 * This gets pre-rendered at build-time
 */
const LoadingFallback: React.FC = () => <WelcomeLayout />;

export default LoadingFallback;
