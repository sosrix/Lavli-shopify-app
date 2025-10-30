import {useEffect} from 'react';
import {useGraphqlApi} from 'foundation/Api';
import CustomerPaymentMethodsQuery from './graphql/CustomerPaymentMethodsQuery';

export function useCustomerPaymentMethods() {
  const [query, response] = useGraphqlApi<any>();

  useEffect(() => {
    query(CustomerPaymentMethodsQuery);
  }, [query]);

  const refetchPaymentMethods = () => {
    query(CustomerPaymentMethodsQuery);
  };

  return {
    ...response,
    data: formatPaymentMethodsData(response.data),
    refetchPaymentMethods,
  };
}

function formatPaymentMethodsData(data?: any) {
  if (!data?.customer?.paymentMethods?.edges) {
    return {
      paymentMethods: [],
      customerId: data?.customer?.id || null,
    };
  }

  const paymentMethods = data.customer.paymentMethods.edges.map(({node}) => {
    const instrument = node.instrument;
    let displayInfo = {};

    if (instrument?.__typename === 'CustomerCreditCard') {
      displayInfo = {
        type: 'credit_card',
        brand: instrument.brand,
        lastFour: instrument.lastDigits,
        expiryMonth: instrument.expiryMonth,
        expiryYear: instrument.expiryYear,
        maskedNumber: instrument.maskedNumber,
        name: instrument.name,
      };
    } else if (instrument?.__typename === 'CustomerPaypalBillingAgreement') {
      displayInfo = {
        type: 'paypal',
        email: instrument.paypalAccountEmail,
      };
    } else if (instrument?.__typename === 'CustomerShopPayAgreement') {
      displayInfo = {
        type: 'shop_pay',
        name: instrument.name,
        lastFour: instrument.maskedNumber?.slice(-4),
        expiryMonth: instrument.expiryMonth,
        expiryYear: instrument.expiryYear,
      };
    }

    const associatedSubscriptions = node.subscriptionContracts?.edges?.map(
      ({node: contract}) => contract.id
    ) || [];

    return {
      id: node.id,
      ...displayInfo,
      associatedSubscriptions,
    };
  });

  return {
    paymentMethods,
    customerId: data.customer.id,
  };
}