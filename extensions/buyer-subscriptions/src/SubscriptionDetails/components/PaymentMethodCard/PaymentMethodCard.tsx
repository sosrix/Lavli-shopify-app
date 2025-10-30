import {
  Card,
  BlockStack,
  Text,
  InlineStack,
  Icon,
  Button,
  SkeletonText,
  View,
} from '@shopify/ui-extensions-react/customer-account';
import {useCustomerPaymentMethods} from '../../hooks/useCustomerPaymentMethods';
import {useExtensionApi} from 'foundation/Api';

interface PaymentMethodCardProps {
  contractId: string;
  refetchSubscriptionContract: () => void;
}

export function PaymentMethodCard({
  contractId,
  refetchSubscriptionContract,
}: PaymentMethodCardProps) {
  const {i18n} = useExtensionApi();
  const {data, loading, error} = useCustomerPaymentMethods();

  if (loading) {
    return (
      <Card padding>
        <BlockStack spacing="tight">
          <Text emphasis="bold">Payment Method</Text>
          <SkeletonText lines={2} />
        </BlockStack>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card padding>
        <BlockStack spacing="tight">
          <Text emphasis="bold">Payment Method</Text>
          <Text appearance="subdued">
            Unable to load payment method information
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const primaryPaymentMethod = data.paymentMethods.find(method =>
    method.associatedSubscriptions.includes(contractId)
  ) || data.paymentMethods[0];

  if (!primaryPaymentMethod) {
    return (
      <Card padding>
        <BlockStack spacing="tight">
          <Text emphasis="bold">Payment Method</Text>
          <Text appearance="subdued">No payment method found</Text>
          <Button
            accessibilityLabel="Update payment method"
            onPress={() => {
              // TODO: Implement payment method update
              console.log('Update payment method clicked');
            }}
          >
            Add Payment Method
          </Button>
        </BlockStack>
      </Card>
    );
  }

  const renderPaymentMethodInfo = () => {
    if (primaryPaymentMethod.type === 'credit_card') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Icon source="creditCard" />
          <BlockStack spacing="extraTight">
            <Text>
              {primaryPaymentMethod.brand?.toUpperCase()} ••••{' '}
              {primaryPaymentMethod.lastFour}
            </Text>
            <Text appearance="subdued" size="small">
              Expires {primaryPaymentMethod.expiryMonth}/{primaryPaymentMethod.expiryYear}
            </Text>
            {primaryPaymentMethod.name && (
              <Text appearance="subdued" size="small">
                {primaryPaymentMethod.name}
              </Text>
            )}
          </BlockStack>
        </InlineStack>
      );
    }

    if (primaryPaymentMethod.type === 'paypal') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Icon source="wallet" />
          <BlockStack spacing="extraTight">
            <Text>PayPal</Text>
            <Text appearance="subdued" size="small">
              {primaryPaymentMethod.email}
            </Text>
          </BlockStack>
        </InlineStack>
      );
    }

    if (primaryPaymentMethod.type === 'shop_pay') {
      return (
        <InlineStack spacing="tight" blockAlignment="center">
          <Icon source="wallet" />
          <BlockStack spacing="extraTight">
            <Text>Shop Pay</Text>
            {primaryPaymentMethod.lastFour && (
              <Text appearance="subdued" size="small">
                ••••{primaryPaymentMethod.lastFour}
              </Text>
            )}
            {primaryPaymentMethod.name && (
              <Text appearance="subdued" size="small">
                {primaryPaymentMethod.name}
              </Text>
            )}
          </BlockStack>
        </InlineStack>
      );
    }

    return (
      <Text appearance="subdued">Payment method information unavailable</Text>
    );
  };

  return (
    <Card padding>
      <BlockStack spacing="base">
        <InlineStack spacing="tight" blockAlignment="center">
          <Text emphasis="bold">Payment Method</Text>
        </InlineStack>
        
        <View>
          {renderPaymentMethodInfo()}
        </View>

        <InlineStack spacing="tight">
          <Button
            kind="secondary"
            accessibilityLabel="Update payment method"
            onPress={() => {
              // TODO: Implement payment method update navigation
              console.log('Update payment method clicked');
              // For now, redirect to customer account payment methods
              window.location.href = '/account/payment_methods';
            }}
          >
            Update Payment Method
          </Button>
        </InlineStack>

        <Text appearance="subdued" size="small">
          Changes to your payment method will apply to future subscription orders.
        </Text>
      </BlockStack>
    </Card>
  );
}