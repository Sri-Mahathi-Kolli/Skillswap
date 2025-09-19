# Zoom Integration Setup Guide

## Problem Description
You're experiencing the error "Invalid meeting ID. (3,000)" when trying to start a Zoom meeting. This happens because the Zoom credentials are not properly configured, causing the system to generate mock meeting IDs instead of real Zoom meeting IDs.

## Root Cause
The Zoom API requires proper authentication credentials to create real meetings. When credentials are missing or incorrect, the system may generate mock meeting IDs like `mock_1754094628882`, which Zoom rejects with error code 3,000.

## Solution: Configure Zoom Credentials

### Step 1: Create a Zoom App
1. Go to the [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click "Develop" → "Build App"
4. Choose "Server-to-Server OAuth" app type
5. Fill in the app information:
   - App name: "SkillSwap Integration"
   - App type: "Meeting"
   - User type: "Account"
6. Click "Create"

### Step 2: Configure App Settings
1. In your app dashboard, go to "App Credentials"
2. Copy the following values:
   - **Client ID**
   - **Client Secret**
   - **Account ID** (found in the "Account" section)

### Step 3: Set Up Environment Variables
1. Navigate to your backend directory
2. Create or edit the `.env` file
3. Add the following Zoom configuration:

```env
# Zoom Configuration
ZOOM_CLIENT_ID=your_actual_client_id_here
ZOOM_CLIENT_SECRET=your_actual_client_secret_here
ZOOM_ACCOUNT_ID=your_actual_account_id_here
ZOOM_ACCOUNT_EMAIL=your_zoom_account_email@example.com
```

### Step 4: Configure App Permissions
1. In your Zoom app dashboard, go to "Scopes"
2. Add the following scopes:
   - `meeting:write:admin`
   - `meeting:read:admin`
   - `user:read:admin`
   - `meeting:write`
   - `meeting:read`

### Step 5: Activate Your App
1. Go to "App Settings" → "General"
2. Set the app status to "Active"
3. Save the changes

### Step 6: Test the Configuration
1. Restart your backend server
2. Check the console logs for:
   - ✅ "Zoom credentials validated successfully"
   - ❌ Any credential validation errors

## Verification Steps

### Check Backend Logs
When you start the backend server, you should see:
```
✅ Zoom credentials validated successfully
```

If you see errors like:
```
❌ Zoom credentials not configured: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
```
Then the credentials are not properly set.

### Test Meeting Creation
1. Go to the Schedule page in your app
2. Create a new session
3. Click "Create Zoom Meeting"
4. You should see a real Zoom meeting ID (not starting with "mock_")
5. The join URL should be a valid Zoom URL

## Common Issues and Solutions

### Issue 1: "Invalid meeting ID. (3,000)"
**Cause**: Mock meeting IDs are being generated due to missing credentials
**Solution**: Follow the setup guide above to configure proper Zoom credentials

### Issue 2: "Zoom authentication failed"
**Cause**: Invalid or expired credentials
**Solution**: 
- Verify your credentials are correct
- Check that your Zoom app is active
- Ensure you have the correct scopes

### Issue 3: "Zoom user not found"
**Cause**: Incorrect ZOOM_ACCOUNT_EMAIL setting
**Solution**: 
- Set ZOOM_ACCOUNT_EMAIL to the email of your Zoom account owner
- This should be the same email used to create the Zoom app

### Issue 4: "Zoom access denied"
**Cause**: Insufficient permissions
**Solution**: 
- Add the required scopes to your Zoom app
- Ensure your Zoom account has the necessary permissions
- Check that your app is active

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `ZOOM_CLIENT_ID` | Your Zoom app's client ID | Yes | `abc123def456` |
| `ZOOM_CLIENT_SECRET` | Your Zoom app's client secret | Yes | `xyz789uvw012` |
| `ZOOM_ACCOUNT_ID` | Your Zoom account ID | Yes | `a1b2c3d4e5f6` |
| `ZOOM_ACCOUNT_EMAIL` | Email of Zoom account owner | Yes | `admin@yourcompany.com` |

## Security Notes
- Never commit your `.env` file to version control
- Keep your Zoom credentials secure
- Rotate credentials periodically
- Use environment-specific credentials for development/production

## Support
If you continue to experience issues after following this guide:
1. Check the backend console logs for specific error messages
2. Verify your Zoom app is properly configured
3. Test with a simple Zoom API call to verify credentials
4. Contact Zoom support if the issue persists with valid credentials 