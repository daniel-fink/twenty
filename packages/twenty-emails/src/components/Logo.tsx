import { Img } from '@react-email/components';

const WHIRLWIND_LOGO_PATH =
  '/images/icons/whirlwind/whirlwind-logo-192.png';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  assetBaseUrl: string;
};

export const Logo = ({ assetBaseUrl }: LogoProps) => {
  const logoUrl = new URL(WHIRLWIND_LOGO_PATH, assetBaseUrl).toString();

  return (
    <Img
      src={logoUrl}
      alt="Whirlwind logo"
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
