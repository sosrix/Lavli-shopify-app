import {useTranslation} from 'react-i18next';
import {TablePagination} from '~/components';

import type {LoaderFunctionArgs} from '@remix-run/node';
import {useLoaderData, type ShouldRevalidateFunction, Link} from '@remix-run/react';
import {
  Card,
  Divider,
  EmptyState,
  Page,
  Text,
  Button,
  useIndexResourceState,
} from '@shopify/polaris';

import type {PaginationInfo} from '~/types';
import type {SubscriptionContractListItem} from '~/types/contracts';
import {getContracts} from '../../models/SubscriptionContract/SubscriptionContract.server';
import {authenticate} from '../../shopify.server';
import {ContractsTable} from './components/ContractsTable/ContractsTable';
import {Footer} from '~/components/Footer';
import {getContractsQueryVariables} from './utilities';

type SubscriptionContractsLoaderData = {
  subscriptionContracts: SubscriptionContractListItem[];
  subscriptionContractPageInfo: PaginationInfo;
  hasContractsWithInventoryError: boolean;
  savedView: boolean;
};

export const handle = {
  i18n: 'app.contracts',
};

export async function loader({
  request,
}: LoaderFunctionArgs): Promise<SubscriptionContractsLoaderData> {
  const {admin} = await authenticate.admin(request);
  const url = new URL(request.url);
  const savedView = url.searchParams.get('savedView');

  const getContractsPromise = getContracts(admin.graphql, {
    ...getContractsQueryVariables(url),
  });

  const getContractResult = await getContractsPromise;

  const {
    subscriptionContracts,
    subscriptionContractPageInfo,
    hasContractsWithInventoryError,
  } = getContractResult;

  return {
    subscriptionContracts,
    subscriptionContractPageInfo,
    hasContractsWithInventoryError,
    savedView: Boolean(savedView),
  };
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  formAction,
  formMethod,
  defaultShouldRevalidate,
}) => {
  switch (formMethod) {
    case 'POST':
    case 'PUT':
      switch (formAction) {
        case '/app/contracts/bulk-operation':
          return false;
      }
    default:
      return defaultShouldRevalidate;
  }
};

export default function Index() {
  const {t, i18n} = useTranslation('app.contracts');
  const loaderData = useLoaderData<typeof loader>();
  const {
    subscriptionContracts,
    subscriptionContractPageInfo,
    hasContractsWithInventoryError,
    savedView,
  } = loaderData;

  const shouldShowPagination =
    (subscriptionContracts.length > 0 &&
      subscriptionContractPageInfo.hasPreviousPage) ||
    subscriptionContractPageInfo.hasNextPage;

  const formattedContracts = subscriptionContracts.map((contract) => {
    return {
      id: contract.id,
    };
  });
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(formattedContracts);

  return (
    <Page 
      title={t('page.title')}
      secondaryActions={[
        {
          content: 'Debug Subscriptions',
          url: '/app/admin/check-subscriptions',
          external: false,
        }
      ]}
    >
      <div style={{paddingBottom: '24px', width: '100%'}}>
        {subscriptionContracts?.length === 0 && !savedView ? (
          <Card>
            <EmptyState
              heading={t('emptyState.title')}
              image="/images/contracts-empty-state.png"
            >
              <Text as="p">{t('emptyState.description')}</Text>
            </EmptyState>
          </Card>
        ) : (
          <Card padding="0">
            <ContractsTable
              contracts={subscriptionContracts}
              hasContractsWithInventoryError={hasContractsWithInventoryError}
              selectedResources={selectedResources}
              allResourcesSelected={allResourcesSelected}
              clearSelection={clearSelection}
              handleSelectionChange={handleSelectionChange}
            />
            {shouldShowPagination && (
              <>
                <Divider />
                <TablePagination pagination={subscriptionContractPageInfo} />
              </>
            )}
          </Card>
        )}
      </div>

      <Footer
        page="contracts"
        link={`https://help.shopify.com/${i18n.language}/manual/products/purchase-options/shopify-subscriptions/manage-subscriptions`}
      />
    </Page>
  );
}
