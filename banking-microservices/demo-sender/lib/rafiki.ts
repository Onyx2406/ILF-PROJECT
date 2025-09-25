import { ApolloClient, InMemoryCache, createHttpLink, gql } from '@apollo/client';

const httpLink = createHttpLink({
  uri: '/api/graphql', // Use our server-side API route
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

// GraphQL Mutations
export const CREATE_RECEIVER = gql`
  mutation CreateReceiver($input: CreateReceiverInput!) {
    createReceiver(input: $input) {
      receiver {
        id
        walletAddressUrl
        incomingAmount {
          value
          assetCode
          assetScale
        }
        metadata
        completed
        createdAt
        expiresAt
        receivedAmount {
          value
          assetCode
          assetScale
        }
      }
    }
  }
`;

export const CREATE_QUOTE = gql`
  mutation CreateQuote($input: CreateQuoteInput!) {
    createQuote(input: $input) {
      quote {
        id
        walletAddressId
        receiver
        createdAt
        expiresAt
        debitAmount {
          value
          assetCode
          assetScale
        }
        receiveAmount {
          value
          assetCode
          assetScale
        }
      }
    }
  }
`;

export const CREATE_OUTGOING_PAYMENT = gql`
  mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
    createOutgoingPayment(input: $input) {
      payment {
        createdAt
        error
        metadata
        id
        walletAddressId
        receiveAmount {
          assetCode
          assetScale
          value
        }
        receiver
        debitAmount {
          assetCode
          assetScale
          value
        }
        sentAmount {
          assetCode
          assetScale
          value
        }
        state
        stateAttempts
        __typename
      }
      __typename
    }
  }
`;

export const DEPOSIT_OUTGOING_PAYMENT_LIQUIDITY = gql`
  mutation DepositOutgoingPaymentLiquidity($input: DepositOutgoingPaymentLiquidityInput!) {
    depositOutgoingPaymentLiquidity(input: $input) {
      success
      __typename
    }
  }
`;

export const WITHDRAW_OUTGOING_PAYMENT_LIQUIDITY = gql`
  mutation WithdrawOutgoingPaymentLiquidity($input: WithdrawOutgoingPaymentLiquidityInput!) {
    withdrawOutgoingPaymentLiquidity(input: $input) {
      success
    }
  }
`;

export const CREATE_INCOMING_PAYMENT_WITHDRAWAL = gql`
  mutation CreateIncomingPaymentWithdrawal($input: CreateIncomingPaymentWithdrawalInput!) {
    createIncomingPaymentWithdrawal(input: $input) {
      success
      __typename
    }
  }
`;

// Export query strings for fetch API
export const CREATE_RECEIVER_QUERY = `
  mutation CreateReceiver($input: CreateReceiverInput!) {
    createReceiver(input: $input) {
      receiver {
        id
        walletAddressUrl
        incomingAmount {
          value
          assetCode
          assetScale
        }
        metadata
        completed
        createdAt
        expiresAt
        receivedAmount {
          value
          assetCode
          assetScale
        }
        __typename
      }
      __typename
    }
  }
`;

export const CREATE_QUOTE_QUERY = `
  mutation CreateQuote($input: CreateQuoteInput!) {
    createQuote(input: $input) {
      quote {
        id
        walletAddressId
        receiver
        debitAmount {
          assetCode
          assetScale
          value
        }
        receiveAmount {
          assetCode
          assetScale
          value
        }
        createdAt
        expiresAt
        __typename
      }
      __typename
    }
  }
`;

export const CREATE_OUTGOING_PAYMENT_QUERY = `
  mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
    createOutgoingPayment(input: $input) {
      payment {
        id
        walletAddressId
        receiveAmount {
          assetCode
          assetScale
          value
        }
        receiver
        debitAmount {
          assetCode
          assetScale
          value
        }
        sentAmount {
          assetCode
          assetScale
          value
        }
        state
        stateAttempts
        metadata
        __typename
      }
      __typename
    }
  }
`;

export const CREATE_INCOMING_PAYMENT_WITHDRAWAL_QUERY = `
  mutation CreateIncomingPaymentWithdrawal($input: CreateIncomingPaymentWithdrawalInput!) {
    createIncomingPaymentWithdrawal(input: $input) {
      success
      __typename
    }
  }
`;

// Helper function to format amount for Rafiki (convert to string with proper scale)
export const formatAmountForRafiki = (amount: number, assetScale: number = 2): string => {
  return (amount * Math.pow(10, assetScale)).toString();
};

// Helper function to parse amount from Rafiki (convert from string to number)
export const parseAmountFromRafiki = (value: string, assetScale: number = 2): number => {
  return parseInt(value) / Math.pow(10, assetScale);
};
