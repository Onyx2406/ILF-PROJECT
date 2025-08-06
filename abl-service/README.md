# ABL Account Manager

A Next.js application for managing Allied Bank Limited (ABL) customer accounts and wallet addresses, integrated with the Rafiki payment system.

## Features

- ✅ **Account Creation** - Create customer accounts with Pakistani formatting
- ✅ **Wallet Address Management** - Generate wallet addresses via GraphQL
- ✅ **IBAN Validation** - Pakistani IBAN format validation (PK format)
- ✅ **Mobile Formatting** - Pakistani mobile number formatting (+92)
- ✅ **Real-time GraphQL** - Integration with Rafiki backend
- ✅ **Local Storage** - Persist account data locally
- ✅ **Modern UI** - Built with Tailwind CSS
- ✅ **TypeScript** - Full type safety

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3001/graphql
```

## Usage

1. **Start your Rafiki backend services**:
   ```bash
   # From the main rafiki directory
   pnpm localenv:compose:psql up
   ```

2. **Access the ABL Account Manager**:
   - Open http://localhost:3000
   - Fill in customer details (Name, IBAN, Mobile)
   - Select currency (USD by default)
   - Click "Create Account & Wallet Address"

3. **View created accounts** in the right panel with:
   - Wallet address URLs
   - Account status
   - Creation timestamps
   - Asset information

## Pakistani Banking Format

- **IBAN**: PK + 2 digits + 4 letters + 16 digits (e.g., PK36SCBL0000001123456702)
- **Mobile**: +92 followed by 10 digits (e.g., +923001234567)

## API Integration

The application integrates with Rafiki's GraphQL API using these mutations:

- `createWalletAddress` - Creates new wallet addresses
- `assets` - Retrieves available currencies

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **GraphQL Request** - API client
- **Nanoid** - ID generation

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Contributing

This is part of the Rafiki project ecosystem for Interledger payments.
