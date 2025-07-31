#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setup() {
  console.log('🗺️  IxMaps Interactive Mapping System Setup');
  console.log('==========================================\n');

  // Check if .env.local exists
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    console.log('📁 Found existing .env.local');
    const existingEnv = fs.readFileSync(envPath, 'utf8');
    envContent = existingEnv;
    
    const useExisting = await askQuestion('Use existing environment configuration? (y/n): ');
    if (useExisting.toLowerCase() === 'y') {
      console.log('✅ Using existing configuration');
      rl.close();
      return;
    }
  }

  console.log('\n📋 Please provide your IxMaps configuration:');
  console.log('   This will create a .env.local file with your settings\n');

  // Database configuration
  console.log('\n🗄️  Database Configuration:');
  console.log('   Using PostgreSQL via Docker Compose (recommended)');
  
  const useDocker = await askQuestion('Use Docker Compose for PostgreSQL? (y/n): ');
  
  if (useDocker.toLowerCase() === 'y') {
    console.log('\n🐳 Starting PostgreSQL with Docker Compose...');
    const { execSync } = require('child_process');
    try {
      execSync('docker compose up -d', { stdio: 'inherit' });
      console.log('✅ PostgreSQL started successfully');
    } catch (error) {
      console.log('⚠️  Docker Compose failed. Please start manually: docker compose up -d');
    }
    
    envContent += `DATABASE_URL="postgresql://ixmapsuser:ghantisghont448@localhost:5432/ixmapsdb?schema=public"\n`;
  } else {
    const dbUrl = await askQuestion('Enter your DATABASE_URL: ');
    envContent += `DATABASE_URL="${dbUrl}"\n`;
  }

  // Auth configuration
  console.log('\n🔐 Authentication Configuration:');
  console.log('   You can get these from your auth provider (Discord, Clerk, etc.)\n');
  
  const authSecret = await askQuestion('AUTH_SECRET (generate a random string): ');
  envContent += `AUTH_SECRET="${authSecret}"\n`;
  
  const useDiscord = await askQuestion('Use Discord authentication? (y/n): ');
  if (useDiscord.toLowerCase() === 'y') {
    const discordId = await askQuestion('AUTH_DISCORD_ID: ');
    const discordSecret = await askQuestion('AUTH_DISCORD_SECRET: ');
    envContent += `AUTH_DISCORD_ID="${discordId}"\n`;
    envContent += `AUTH_DISCORD_SECRET="${discordSecret}"\n`;
  }
  
  const useClerk = await askQuestion('Use Clerk authentication? (y/n): ');
  if (useClerk.toLowerCase() === 'y') {
    const clerkPublishable = await askQuestion('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ');
    const clerkSecret = await askQuestion('CLERK_SECRET_KEY: ');
    const clerkWebhook = await askQuestion('CLERK_WEBHOOK_SIGNING_SECRET (optional): ');
    
    envContent += `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${clerkPublishable}"\n`;
    envContent += `CLERK_SECRET_KEY="${clerkSecret}"\n`;
    if (clerkWebhook) {
      envContent += `CLERK_WEBHOOK_SIGNING_SECRET="${clerkWebhook}"\n`;
    }
  }

  // NextAuth configuration
  const nextAuthUrl = await askQuestion('NEXTAUTH_URL (e.g., https://ixwiki.com/public/maps/ixmaps-new): ');
  envContent += `NEXTAUTH_URL="${nextAuthUrl}"\n`;
  envContent += `AUTH_TRUST_HOST="true"\n`;

  // Save .env.local
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Environment configuration saved to .env.local');

  // Create logs directory
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('📁 Created logs directory');
  }

  console.log('\n🚀 Setup complete! Next steps:');
  console.log('   1. Run: npm run prisma:dev');
  console.log('   2. Run: npm run build');
  console.log('   3. Run: pm2 start ecosystem.config.js');
  console.log('');
  console.log('   ⚠️  IMPORTANT: Keep your .env.local file secure and never commit it!');
  console.log('   The file is already in .gitignore by default.');

  rl.close();
}

setup().catch(console.error); 