const CustomerPaymentMethodsQuery = `#graphql
  query CustomerPaymentMethods {
    customer {
      id
      paymentMethods(first: 10) {
        edges {
          node {
            id
            instrument {
              ... on CustomerCreditCard {
                brand
                expiryMonth
                expiryYear
                firstDigits
                lastDigits
                maskedNumber
                name
              }
              ... on CustomerPaypalBillingAgreement {
                paypalAccountEmail
              }
              ... on CustomerShopPayAgreement {
                name
                maskedNumber
                expiryMonth
                expiryYear
              }
            }
            subscriptionContracts(first: 50) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default CustomerPaymentMethodsQuery;