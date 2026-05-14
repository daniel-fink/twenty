import { Trans } from '@lingui/react';
import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { Link } from 'src/components/Link';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type PasswordResetLinkEmailProps = {
  duration: string;
  hasPassword: boolean;
  link: string;
  assetBaseUrl: string;
  locale: keyof typeof APP_LOCALES;
};

export const PasswordResetLinkEmail = ({
  duration,
  hasPassword,
  link,
  assetBaseUrl,
  locale,
}: PasswordResetLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const headline = hasPassword
    ? i18n._('Reset your password 🗝')
    : i18n._('Set your password 🗝');
  const ctaLabel = hasPassword ? i18n._('Reset') : i18n._('Set');

  return (
    <BaseEmail locale={locale} assetBaseUrl={assetBaseUrl}>
      <Title value={headline} />
      <MainText>
        <Trans
          id="This link is only valid for the next {duration}. If the link does not work, you can use the login verification link directly:"
          values={{ duration }}
        />
        <br />
        <Link href={link} value={link} />
      </MainText>
      <br />
      <CallToAction href={link} value={ctaLabel} />
      <br />
      <br />
    </BaseEmail>
  );
};

PasswordResetLinkEmail.PreviewProps = {
  duration: '24 hours',
  hasPassword: true,
  link: 'https://app.twenty.com/reset-password/123',
  assetBaseUrl: 'https://app.twenty.com',
  locale: 'en',
} as PasswordResetLinkEmailProps;

export default PasswordResetLinkEmail;
