# Rafiki Peer-to-Peer Cross Currency Payment Flow

This document illustrates the event flow for a cross-currency payment between Cloud Nine Wallet and Happy Life Bank using the Rafiki Admin API.

## Architecture Overview

Install "Markdown Preview Mermaid Support" extension in VSCode to visualize the diagrams.

```mermaid
graph TB
    subgraph "Cloud Nine Wallet"
        CN_ASE[Mock ASE<br/>:3030]
        CN_Backend[Backend<br/>:3001 Admin<br/>:3002 Connector<br/>:3000 Open Payments]
        CN_Auth[Auth Server<br/>:3006]
        CN_Admin[Admin Frontend<br/>:3010]
    end

    subgraph "Happy Life Bank"
        HL_ASE[Mock ASE<br/>:3031]
        HL_Backend[Backend<br/>:4001 Admin<br/>:4002 Connector<br/>:4000 Open Payments]
        HL_Auth[Auth Server<br/>:4006]
        HL_Admin[Admin Frontend<br/>:4010]
    end

    subgraph "Shared Infrastructure"
        DB[(PostgreSQL<br/>Database)]
        Redis[(Redis Cache)]
    end

    CN_Backend <--> DB
    HL_Backend <--> DB
    CN_Backend <--> Redis
    HL_Backend <--> Redis
    CN_Backend <-.->|ILP Packets| HL_Backend
```

## Payment Event Flow

```mermaid
sequenceDiagram
    participant Admin as Admin API Client
    participant CN_Backend as Cloud Nine Backend<br/>(Port 3001)
    participant CN_ASE as Cloud Nine Mock ASE<br/>(Port 3030)
    participant HL_Backend as Happy Life Backend<br/>(Port 4001)
    participant HL_ASE as Happy Life Mock ASE<br/>(Port 3031)
    participant Database as PostgreSQL
    participant Redis as Redis Cache

    Note over Admin, Redis: Cross-Currency P2P Payment Flow

    %% 1. Initiate Payment
    rect rgb(230, 245, 255)
        Note over Admin, CN_Backend: 1. Payment Initiation
        Admin->>CN_Backend: POST /graphql<br/>CreateOutgoingPayment mutation
        CN_Backend->>Database: Store payment intent & validate sender
        CN_Backend->>Redis: Cache payment state (PENDING)
        CN_Backend->>Admin: Return payment ID & status
    end

    %% 2. Payment Processing
    rect rgb(255, 245, 230)
        Note over CN_Backend, HL_Backend: 2. ILP Protocol Exchange
        CN_Backend->>CN_Backend: Calculate exchange rates<br/>USD → EUR conversion
        CN_Backend->>HL_Backend: ILP Prepare Packet<br/>(via Connector Port 3002→4002)
        HL_Backend->>Database: Validate incoming payment<br/>Check recipient account
        HL_Backend->>CN_Backend: ILP Fulfill Packet<br/>(Conditional transfer)
    end

    %% 3. Account Settlement
    rect rgb(245, 255, 230)
        Note over CN_ASE, HL_ASE: 3. Account Updates via Webhooks
        CN_Backend->>CN_ASE: POST /webhooks<br/>Account debit notification
        CN_ASE->>CN_ASE: Update sender account balance
        CN_ASE->>CN_Backend: Confirm debit processed

        HL_Backend->>HL_ASE: POST /webhooks<br/>Account credit notification
        HL_ASE->>HL_ASE: Update recipient account balance
        HL_ASE->>HL_Backend: Confirm credit processed
    end

    %% 4. Final Settlement
    rect rgb(255, 230, 245)
        Note over CN_Backend, Redis: 4. Payment Completion
        CN_Backend->>Database: Update payment status (COMPLETED)
        HL_Backend->>Database: Update payment status (COMPLETED)
        CN_Backend->>Redis: Update cached state (COMPLETED)
        HL_Backend->>Redis: Update cached state (COMPLETED)
        CN_Backend->>Admin: Payment completion webhook/notification
    end
```

## Key Components & Ports

### Cloud Nine Wallet

- **Mock ASE**: `localhost:3030` - Customer wallet interface
- **Backend Admin API**: `localhost:3001` - GraphQL management
- **Backend Connector**: `localhost:3002` - ILP communication
- **Backend Open Payments**: `localhost:3000` - Open Payments API
- **Auth Server**: `localhost:3006` - OAuth/authentication
- **Admin Frontend**: `localhost:3010` - Administrative UI

### Happy Life Bank

- **Mock ASE**: `localhost:3031` - Customer wallet interface
- **Backend Admin API**: `localhost:4001` - GraphQL management
- **Backend Connector**: `localhost:4002` - ILP communication
- **Backend Open Payments**: `localhost:4000` - Open Payments API
- **Auth Server**: `localhost:4006` - OAuth/authentication
- **Admin Frontend**: `localhost:4010` - Administrative UI

## Environment Variables Configuration

Both wallets use the same `rafiki-mock-ase` image but differentiate through environment variables:

### Cloud Nine Configuration

```yaml
DISPLAY_NAME: Cloud Nine Wallet
DISPLAY_ICON: wallet-icon.svg
OPERATOR_TENANT_ID: 438fa74a-fa7d-4317-9ced-dde32ece1787
FRONTEND_PORT: 3010
```

### Happy Life Bank Configuration

```yaml
DISPLAY_NAME: Happy Life Bank
DISPLAY_ICON: bank-icon.svg
OPERATOR_TENANT_ID: cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d
FRONTEND_PORT: 4010
```

## Data Flow Summary

1. **Admin API** initiates payment via GraphQL mutation
2. **ILP Connectors** handle cross-currency exchange and routing
3. **Mock ASEs** manage actual account debits/credits via webhooks
4. **PostgreSQL** stores persistent payment and account data
5. **Redis** caches real-time payment states for performance
6. **Tenant IDs** ensure data isolation between wallet instances

The system demonstrates a complete Interledger payment flow with proper separation of concerns between payment processing (backends) and account management (ASEs).
