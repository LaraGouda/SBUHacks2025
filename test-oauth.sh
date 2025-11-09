#!/bin/bash
echo "=== Google OAuth Configuration Test ==="
echo ""
echo "1. Checking .env file..."
if [ -f .env ]; then
  echo "✓ .env file exists"
  if grep -q "VITE_SUPABASE_URL" .env; then
    echo "✓ VITE_SUPABASE_URL is set"
    grep "VITE_SUPABASE_URL" .env
  else
    echo "✗ VITE_SUPABASE_URL is missing"
  fi
  if grep -q "VITE_SUPABASE_PUBLISHABLE_KEY" .env; then
    KEY=$(grep "VITE_SUPABASE_PUBLISHABLE_KEY" .env | cut -d'=' -f2)
    if [ "$KEY" != "your_anon_key_here" ] && [ -n "$KEY" ]; then
      echo "✓ VITE_SUPABASE_PUBLISHABLE_KEY is set (first 20 chars: ${KEY:0:20}...)"
    else
      echo "✗ VITE_SUPABASE_PUBLISHABLE_KEY is not set (still has placeholder)"
    fi
  else
    echo "✗ VITE_SUPABASE_PUBLISHABLE_KEY is missing"
  fi
else
  echo "✗ .env file does not exist"
fi
echo ""
echo "2. Checking Supabase config..."
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep "project_id" supabase/config.toml | cut -d'"' -f2)
  if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "your-project-id-here" ]; then
    echo "Project ID in config.toml: $PROJECT_ID"
    echo "✓ Project ID is set"
  else
    echo "⚠ Project ID not set in config.toml"
  fi
fi
echo ""
echo "3. Next steps:"
echo "   - Make sure .env has your actual Supabase anon key"
echo "   - Set project_id in supabase/config.toml"
echo "   - Verify Supabase Edge Function Secrets are set:"
echo "     * GOOGLE_CLIENT_ID"
echo "     * GOOGLE_CLIENT_SECRET"
echo "     * PROJECT_URL (optional)"
echo "     * NEURALSEEK_API_KEY"
echo "     * NEURALSEEK_BASE_URL (optional, defaults to stagingapi.neuralseek.com)"
echo "     * NEURALSEEK_WORKSPACE (optional, defaults to stony52)"
echo "   - Verify Google Cloud Console redirect URI matches your project:"
echo "     https://[YOUR-PROJECT-REF].supabase.co/functions/v1/google-auth-callback"
