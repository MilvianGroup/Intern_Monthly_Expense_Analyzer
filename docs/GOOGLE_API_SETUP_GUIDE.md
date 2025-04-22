# Setting Up Google API Credentials for Monthly Financial Project

This guide will walk you through the process of setting up Google API credentials to use with the Monthly Financial Project. These credentials will allow the application to access Google Drive (to retrieve expense reports) and Gmail (to send email reports).

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click on "New Project"
4. Enter a project name (e.g., "Monthly Financial Project")
5. Click "Create"
6. Wait for the project to be created, then select it from the project dropdown

## Step 2: Enable the Required APIs

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - Google Drive API
   - Gmail API

For each API:
1. Click on the API in the search results
2. Click "Enable"
3. Wait for the API to be enabled

## Step 3: Create a Service Account

1. In the Google Cloud Console, navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" and select "Service Account"
3. Enter a service account name (e.g., "monthly-financial-service")
4. (Optional) Enter a description
5. Click "Create and Continue"
6. For the "Grant this service account access to project" step:
   - Select "Basic" > "Editor" role (or a more restrictive role if preferred)
   - Click "Continue"
7. For the "Grant users access to this service account" step:
   - You can skip this step for now
   - Click "Done"

## Step 4: Create and Download Service Account Key

1. In the Google Cloud Console, navigate to "APIs & Services" > "Credentials"
2. Find your service account in the list and click on it
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Select "JSON" as the key type
6. Click "Create"
7. The key file will be automatically downloaded to your computer

## Step 5: Set Up Google Drive Access

For the service account to access your Google Drive files:

1. Create or identify the folder in Google Drive where you'll store your expense reports
2. Right-click on the folder and select "Share"
3. In the "Share with people and groups" dialog, enter the service account email address (found in the downloaded JSON key file under "client_email")
4. Set the permission to "Editor" (or "Viewer" if you only need read access)
5. Click "Share"

## Step 6: Configure the Application

1. Copy the downloaded JSON key file to the `credentials` directory of the project:
   - Rename it to `google_credentials.json`
   - Replace the existing template file

2. Update the `config/config.json` file:
   - Ensure the `google_drive.expense_file_name` and `google_drive.expense_file_path` match your actual file name and path in Google Drive

3. Update the `.env` file:
   - Set `DEMO_MODE=false` to use the real Google APIs instead of sample data

## Step 7: Test the Configuration

Run the application to verify that it can:
1. Connect to Google Drive and retrieve your expense report
2. Send an email report via Gmail

```
npm start
```

## Troubleshooting

If you encounter issues:

1. Check that the service account has the correct permissions on your Google Drive folder
2. Verify that the file path and name in `config.json` match exactly with your Google Drive structure
3. Ensure the APIs are properly enabled in your Google Cloud project
4. Check the application logs for specific error messages

## Security Notes

- Keep your service account key secure and never commit it to public repositories
- Consider using environment variables for sensitive information
- Regularly rotate your service account keys for better security
