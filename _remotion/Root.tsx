import { Composition } from 'remotion';
import { FundBounty } from './compositions/FundBounty';
import { PasskeyWallet } from './compositions/PasskeyWallet';
import { AutoPayout } from './compositions/AutoPayout';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composition 1: Fund a Bounty
          Shows maintainer funding a GitHub issue with USD stablecoin
          Duration: 10 seconds at 30fps */}
      <Composition
        id="FundBounty"
        component={FundBounty}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Composition 2: Passkey Wallet
          Shows passkey wallet creation and transaction signing
          Duration: 12 seconds at 30fps */}
      <Composition
        id="PasskeyWallet"
        component={PasskeyWallet}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Composition 3: Auto Payout
          Shows automated batch payout after PR merge
          Duration: 12 seconds at 30fps */}
      <Composition
        id="AutoPayout"
        component={AutoPayout}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
