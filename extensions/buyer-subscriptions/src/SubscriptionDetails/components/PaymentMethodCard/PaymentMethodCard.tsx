import {
  BlockStack,
  Text,
  InlineStack,
  Icon,
  Button,
  SkeletonText,
} from '@shopify/ui-extensions-react/customer-account';
import {useExtensionApi} from 'foundation/Api';

interface PaymentMethodCardProps {
  paymentMethod: any;
  onUpdatePaymentMethod: () => void;
}

export function PaymentMethodCard({
  paymentMethod,
  onUpdatePaymentMethod,
}: PaymentMethodCardProps) {
  const {i18n} = useExtensionApi();

  if (!paymentMethod) {
    return (
      <BlockStack spacing="tight">
        <InlineStack spacing="tight" blockAlignment="center">
          <Text emphasis="bold">{i18n.translate('payment')}</Text>
        </InlineStack>
        <Text appearance="subdued">No payment method found</Text>
      </BlockStack>
    );
  }

  const instrument = paymentMethod.instrument;

  const renderPaymentMethodInfo = () => {
    // Credit Card
    if (instrument?.__typename === 'CustomerCreditCard') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Text>
            {instrument.brand} •••• {instrument.lastDigits}
          </Text>
        </InlineStack>
      );
    }

    // PayPal
    if (instrument?.__typename === 'CustomerPaypalBillingAgreement') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Text>PayPal</Text>
          {instrument.paypalAccountEmail && (
            <Text appearance="subdued" size="small">
              {instrument.paypalAccountEmail}
            </Text>
          )}
        </InlineStack>
      );
    }

    // Shop Pay
    if (instrument?.__typename === 'CustomerShopPayAgreement') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Text>Shop Pay</Text>
          {instrument.lastDigits && (
            <Text>•••• {instrument.lastDigits}</Text>
          )}
        </InlineStack>
      );
    }

    return <Text appearance="subdued">Payment method</Text>;
  };

  return (
    <BlockStack spacing="tight">
      <InlineStack spacing="tight" blockAlignment="center" inlineAlignment="space-between">
        <Text emphasis="bold">{i18n.translate('payment')}</Text>
        <Button
          kind="plain"
          accessibilityLabel={i18n.translate('update_payment_method')}
          onPress={onUpdatePaymentMethod}
        >
          <Icon source="edit" />
        </Button>
      </InlineStack>
      {renderPaymentMethodInfo()}
    </BlockStack>
  );
}

export function PaymentMethodCardSkeleton() {
  return (
    <BlockStack spacing="tight">
      <Text emphasis="bold">Payment</Text>
      <SkeletonText lines={1} />
    </BlockStack>
  );
}
