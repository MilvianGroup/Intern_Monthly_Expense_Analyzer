# Running Monthly Financial Project in Non-Demo Mode

This guide provides instructions for running the Monthly Financial Project with real Google Drive and Gmail integration, instead of using sample data.

## Prerequisites

Before running in non-demo mode, you need to:

1. Set up Google API credentials (see `GOOGLE_API_SETUP_GUIDE.md` for detailed instructions)
2. Prepare your expense report CSV file in Google Drive

## Configuration Steps

### 1. Google API Credentials

Make sure you have:
- Created a Google Cloud project
- Enabled the Google Drive API and Gmail API
- Created a service account with appropriate permissions
- Downloaded the service account key
- Placed the key in the `credentials/google_credentials.json` file

### 2. Expense Report Format

Your expense report CSV file should have the following columns:
- Date: The date of the expense (YYYY-MM-DD format)
- Amount: The amount of the expense (numeric)
- Category: The expense category (e.g., Housing, Transportation)
- Description: A brief description of the expense

See `sample_expense_report_template.csv` for an example of the expected format.

### 3. Update Configuration Files

#### a. Update `.env` file
The `.env` file has already been updated to set `DEMO_MODE=false`.

#### b. Update `config/config.json`
Modify the Google Drive section to match your actual file name and path:

```json
"google_drive": {
  "expense_file_name": "your_expense_file.csv",
  "expense_file_path": "your_folder/your_expense_file.csv"
}
```

### 4. Running the Application

Once everything is configured, run the application:

```
npm start
```

The application will:
1. Connect to Google Drive and retrieve your expense report
2. Analyze the expense data
3. Generate visualizations
4. Send an email report via Gmail

## Troubleshooting

If you encounter issues:

1. Check the console output for error messages
2. Verify that your Google credentials are correct
3. Ensure your expense report file exists in Google Drive and is shared with the service account
4. Confirm that the file path and name in `config.json` match exactly with your Google Drive structure

## Switching Back to Demo Mode

If you need to switch back to demo mode (to use sample data instead of real Google APIs):

1. Update the `.env` file to set `DEMO_MODE=true`
2. Run the application with `npm start`
