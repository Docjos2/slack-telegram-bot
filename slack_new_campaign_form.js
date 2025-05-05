// FILE: slack_new_campaign_form.js
// Handles Slack command, opens modal, and confirms submission.
// Channel creation and further processing should be handled by n8n.

require('dotenv').config();
const { App, LogLevel } = require('@slack/bolt');

// Initialize Bolt App
// Ensure SLACK_BOT_TOKEN (xoxb-), SLACK_APP_TOKEN (xapp-), and SLACK_SIGNING_SECRET are in your .env file
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.INFO, // Use DEBUG for more detailed logs if needed
});

const logger = app.logger;

// --- Slash Command Handler (/new_campaign_v2) ---
// Listens for the command and opens the modal
app.command('/new_campaign_v2', async ({ ack, body, client, logger }) => {
  // Acknowledge the command request within 3 seconds
  await ack();
  logger.info(`Received /new_campaign_v2 command from user ${body.user_id} in channel ${body.channel_id}`);

  try {
    // Define the modal view
    const viewPayload = {
      type: 'modal',
      // Unique identifier for this specific modal's submission
      callback_id: 'campaign_brief_modal_submit',
      title: { type: 'plain_text', text: 'New Campaign Brief' },
      submit: { type: 'plain_text', text: 'Submit Brief' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        // Block for Business Name
        {
          "type": "input",
          "block_id": "business_name_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "business_name_input"
          },
          "label": {
            "type": "plain_text",
            "text": "Business Name",
            "emoji": true
          }
        },
        // Block for Request Category (Radio Buttons)
        {
          "type": "input",
          "block_id": "request_category_block",
          "element": {
            "type": "radio_buttons",
            "action_id": "request_category_select",
            "options": [
              {
                "text": { "type": "plain_text", "text": "Content Creation", "emoji": true },
                "value": "content"
              },
              {
                "text": { "type": "plain_text", "text": "Strategy Development", "emoji": true },
                "value": "strategy"
              },
              {
                "text": { "type": "plain_text", "text": "Research & Insights", "emoji": true },
                "value": "research"
              },
              {
                "text": { "type": "plain_text", "text": "Other (Specify Below)", "emoji": true },
                "value": "other"
              }
            ]
          },
          "label": {
            "type": "plain_text",
            "text": "Request Category",
            "emoji": true
          }
        },
        // Block for "Other" category details (Optional)
         {
          "type": "input",
          "block_id": "other_category_details_block",
          "optional": true, // Make this field optional
          "element": {
            "type": "plain_text_input",
            "action_id": "other_category_details_input",
            "placeholder": {
                "type": "plain_text",
                "text": "If you selected 'Other', please provide details here"
            }
          },
          "label": {
            "type": "plain_text",
            "text": "Other Category Details",
            "emoji": true
          }
        },
        // Block for Target Audience
        {
          "type": "input",
          "block_id": "target_audience_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "target_audience_input",
            "multiline": true // Allows multiple lines
          },
          "label": {
            "type": "plain_text",
            "text": "Target Audience",
            "emoji": true
          }
        },
        // Block for Requested Deliverables
        {
          "type": "input",
          "block_id": "deliverables_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "deliverables_input",
            "multiline": true // Allows multiple lines
          },
          "label": {
            "type": "plain_text",
            "text": "Requested Deliverables",
            "emoji": true
          }
        }
      ]
    };

    // Open the modal view
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: viewPayload
    });
    logger.info(`Successfully opened modal view ${result.view.id} for user ${body.user_id}`);

  } catch (error) {
    logger.error(`Error opening modal for /new_campaign_v2: ${error}`);
    // Optionally notify the user if the modal failed to open
     try {
        await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `Sorry, I couldn't open the brief form due to an error: ${error.message}`
        });
    } catch (ephemeralError) {
        logger.error(`Failed to send ephemeral error message: ${ephemeralError}`);
    }
  }
});

// --- View Submission Handler ---
// Handles the submission of the modal with callback_id 'campaign_brief_modal_submit'
app.view('campaign_brief_modal_submit', async ({ ack, body, view, client, logger }) => {
  // Acknowledge the view submission within 3 seconds
  await ack();
  logger.info(`Received view submission for callback_id: ${view.callback_id} from user ${body.user.id}`);

  // Extract data submitted in the modal
  const submittedData = view.state.values;
  const user = body.user.id;

  // Helper function to safely extract values
  const getValue = (blockId, actionId, type = 'value', defaultValue = '') => {
    const block = submittedData[blockId];
    if (!block) return defaultValue;
    const element = block[actionId];
    if (!element) return defaultValue;

    switch (type) {
      case 'selected_option': // For radio buttons
        return element.selected_option ? element.selected_option.value : defaultValue;
      case 'value': // For plain_text_input
      default:
        return element.value !== undefined && element.value !== null ? element.value : defaultValue;
    }
  };

  // Extract specific fields using the helper
  const businessName = getValue('business_name_block', 'business_name_input');
  const requestCategory = getValue('request_category_block', 'request_category_select', 'selected_option');
  const otherCategoryDetails = getValue('other_category_details_block', 'other_category_details_input');
  const targetAudience = getValue('target_audience_block', 'target_audience_input');
  const deliverables = getValue('deliverables_block', 'deliverables_input');

  // Log extracted data
  logger.info(`Extracted Data: Business Name='${businessName}', Category='${requestCategory}', Other Details='${otherCategoryDetails}', Audience='${targetAudience}', Deliverables='${deliverables}'`);

  // Prepare a confirmation message for the user
  let confirmationText = `✅ Brief Received!\n\n*Business Name:* ${businessName}\n*Category:* ${requestCategory}`;
  if (requestCategory === 'other' && otherCategoryDetails) {
      confirmationText += ` (${otherCategoryDetails})`;
  }
  confirmationText += `\n*Target Audience:* ${targetAudience}\n*Deliverables:* ${deliverables}\n\nYour request is being processed.`;

  // Send the confirmation message directly to the user who submitted
  try {
    await client.chat.postMessage({
      channel: user, // Send DM to the user
      text: confirmationText
    });
    logger.info(`Sent confirmation DM to user ${user}`);
  } catch (error) {
    logger.error(`Error sending confirmation DM to user ${user}: ${error}`);
  }

  // IMPORTANT: At this point, you would typically trigger your n8n workflow.
  // Options include:
  // 1. Posting the extracted data to a specific *internal* Slack channel that n8n monitors.
  // 2. Sending the data to an n8n webhook URL using an HTTP request.
  // 3. Inserting the data directly into your Supabase 'campaigns' table.
  // This example only sends a confirmation DM. Implement your n8n trigger mechanism here.

});

// --- Global Error Handler ---
app.error(async (error) => {
  logger.error(`Unhandled Bolt error: ${error.code} - ${error.message}`);
  logger.error(error.stack); // Log the full stack trace for debugging
});

// --- Start the App ---
(async () => {
  try {
    const port = process.env.PORT || 3000; // Required for some environments, though Socket Mode doesn't strictly use it for requests
    await app.start(port);
    const startupMessage = `⚡️ Bolt app (Simple Modal v1) is running on port ${port} in Socket Mode!`;
    console.log(startupMessage);
    logger.info(startupMessage);
  } catch (error) {
    const errorMessage = `💥 Failed to start Bolt app: ${error}`;
    console.error(errorMessage);
    logger.error(errorMessage);
    process.exit(1);
  }
})();

