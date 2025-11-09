#!/bin/bash

echo "🚀 Deploying Supabase Edge Functions..."
echo ""

# Check if logged in
echo "Checking Supabase login status..."
if ! supabase projects list &>/dev/null; then
    echo "❌ Not logged in. Please run: supabase login"
    exit 1
fi

# Check if linked
echo "Checking if project is linked..."
if ! supabase status &>/dev/null; then
    echo "⚠️  Project not linked. Please link your project first:"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    echo "   Or set project_id in supabase/config.toml"
    exit 1
fi

echo ""
echo "📦 Deploying google-auth function..."
supabase functions deploy google-auth

if [ $? -eq 0 ]; then
    echo "✅ google-auth deployed successfully!"
else
    echo "❌ Failed to deploy google-auth"
    exit 1
fi

echo ""
echo "📦 Deploying google-auth-callback function..."
supabase functions deploy google-auth-callback

if [ $? -eq 0 ]; then
    echo "✅ google-auth-callback deployed successfully!"
else
    echo "❌ Failed to deploy google-auth-callback"
    exit 1
fi

echo ""
echo "📦 Deploying analyze-meeting function..."
supabase functions deploy analyze-meeting

if [ $? -eq 0 ]; then
    echo "✅ analyze-meeting deployed successfully!"
else
    echo "❌ Failed to deploy analyze-meeting"
    exit 1
fi

echo ""
echo "🎉 All edge functions deployed successfully!"
echo ""
echo "⚠️  Don't forget to set secrets in Supabase Dashboard:"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"
echo "   - NEURALSEEK_API_KEY"
echo "   - NEURALSEEK_BASE_URL (optional, defaults to https://stagingapi.neuralseek.com)"
echo "   - NEURALSEEK_WORKSPACE (optional, defaults to stony52)"
echo "   - PROJECT_URL (optional)"
echo ""
echo "📍 Go to: Supabase Dashboard > Edge Functions > Secrets"

