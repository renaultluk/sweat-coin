#!/bin/bash

# FitDAO Quick Start Script
# This script automates the initial setup process

set -e  # Exit on error

echo "======================================"
echo "🚀 FitDAO Quick Start Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed!${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm $NPM_VERSION found${NC}"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file and add your private key!${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
    echo ""
fi

# Compile contracts
echo "🔨 Compiling smart contracts..."
npx hardhat compile
echo -e "${GREEN}✅ Contracts compiled successfully${NC}"
echo ""

# Run tests
echo "🧪 Running tests..."
npx hardhat test
echo -e "${GREEN}✅ All tests passed${NC}"
echo ""

# Create deployments directory
if [ ! -d "deployments" ]; then
    mkdir deployments
    echo -e "${GREEN}✅ Created deployments directory${NC}"
fi

echo "======================================"
echo "✨ Setup Complete!"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Edit .env file:"
echo "   ${YELLOW}nano .env${NC}"
echo ""
echo "2. Start local blockchain (in a new terminal):"
echo "   ${YELLOW}npm run node${NC}"
echo ""
echo "3. Deploy contracts to local network:"
echo "   ${YELLOW}npm run deploy:local${NC}"
echo ""
echo "4. Open the web interface:"
echo "   ${YELLOW}open index.html${NC}"
echo ""
echo "5. For testnet deployment:"
echo "   - Get test ETH from faucets"
echo "   - Run: ${YELLOW}npm run deploy:sepolia${NC}"
echo ""
echo "📚 Read SETUP.md for detailed instructions"
echo ""
echo "Happy coding! 💪"
