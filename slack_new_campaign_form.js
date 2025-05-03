// FILE: slack_new_campaign_form.js
require('dotenv').config();
const { App, LogLevel } = require('@slack/bolt'); // Import LogLevel
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Bolt in Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,       // xoxb-...
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,                         // Enable Socket Mode
  appToken: process.env.SLACK_APP_TOKEN,    // xapp-...
  logLevel: LogLevel.INFO // Optional: Set log level (DEBUG, INFO, WARN, ERROR)
});

// Use app.logger for logging
const logger = app.logger;

// --- Step 0: Slash Command to Open the First Modal ---
// *** RESTORED MODAL OPENING LOGIC ***
app.command('/new_campaign', async ({ ack, body, client, logger }) => {
  // Acknowledge the command request
  await ack();

  try {
    // Define the view for the first step
    const viewPayload = {
      type: 'modal',
      // *** Using V2 CALLBACK ID ***
      callback_id: 'new_campaign_v2_step1',
      title: { type: 'plain_text', text: 'New Campaign - 1/3' },
      submit: { type: 'plain_text', text: 'Next' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        // --- Blocks for Step 1 (Ensure these match your desired Step 1 fields) ---
        {
          "type": "input",
          "block_id": "campaign_name_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "campaign_name_input"
          },
          "label": {
            "type": "plain_text",
            "text": "Campaign Name"
          }
        },
        {
          "type": "input",
          "block_id": "brand_product_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "brand_product_input"
          },
          "label": {
            "type": "plain_text",
            "text": "Brand / Product"
          }
        },
        {
          "type": "input",
          "block_id": "background_block",
          "element": {
            "type": "plain_text_input",
            "action_id": "background_input",
            "multiline": true
          },
          "label": {
            "type": "plain_text",
            "text": "Background / Why Now?"
          }
        },
        {
            "type": "input",
            "block_id": "objectives_block",
            "element": {
                "type": "checkboxes",
                "action_id": "objectives_select",
                "options": [
                    { "text": { "type": "plain_text", "text": "Awareness" }, "value": "awareness" },
                    { "text": { "type": "plain_text", "text": "Consideration" }, "value": "consideration" },
                    { "text": { "type": "plain_text", "text": "Conversion" }, "value": "conversion" },
                    { "text": { "type": "plain_text", "text": "Loyalty" }, "value": "loyalty" }
                ]
            },
            "label": { "type": "plain_text", "text": "Objectives" }
        },
        {
            "type": "input",
            "block_id": "audience_block",
            "element": { "type": "plain_text_input", "action_id": "audience_input", "multiline": true },
            "label": { "type": "plain_text", "text": "Target Audience" }
        },
        {
            "type": "input",
            "block_id": "budget_block",
            "element": { "type": "plain_text_input", "action_id": "budget_input", "dispatch_action": false }, // Use plain text for flexibility, parse later
            "label": { "type": "plain_text", "text": "Budget (Estimate)" }
        },
         {
            "type": "input",
            "block_id": "channels_block",
            "element": {
                "type": "checkboxes",
                "action_id": "channels_select",
                "options": [
                    { "text": { "type": "plain_text", "text": "Social Media" }, "value": "social" },
                    { "text": { "type": "plain_text", "text": "Search (SEM/SEO)" }, "value": "search" },
                    { "text": { "type": "plain_text", "text": "Display Ads" }, "value": "display" },
                    { "text": { "type": "plain_text", "text": "Email Marketing" }, "value": "email" },
                    { "text": { "type": "plain_text", "text": "Content Marketing" }, "value": "content" },
                    { "text": { "type": "plain_text", "text": "Offline (Events, Print)" }, "value": "offline" }
                ]
            },
            "label": { "type": "plain_text", "text": "Channels" }
        },
        {
            "type": "input",
            "block_id": "assets_block",
            "optional": true, // Make optional
            "element": { "type": "plain_text_input", "action_id": "assets_input", "multiline": true },
            "label": { "type": "plain_text", "text": "Links to Existing Assets (Optional)" }
        }
        // --- End Blocks for Step 1 ---
      ]
    };

    // Log before opening the view
    logger.info(`>>> Opening Step 1 modal with callback_id: ${viewPayload.callback_id}`); // Log the v2 ID
    // logger.debug(`>>> View Payload Step 1: ${JSON.stringify(viewPayload)}`); // Uncomment for detailed debugging

    // Call views.open with the trigger_id and view payload
    await client.views.open({
      trigger_id: body.trigger_id,
      view: viewPayload
    });
    logger.info(`>>> Successfully called views.open for trigger_id: ${body.trigger_id}`);

  } catch (error) {
    logger.error(`Error in /new_campaign command handler: ${error}`);
    // Optionally send an ephemeral message to the user
    try {
        await client.chat.postEphemeral({
            channel: body.channel_id, // Use channel_id from command body
            user: body.user_id,
            text: `Sorry, I couldn't open the campaign form. Error: ${error.message}`
        });
    } catch (ephemeralError) {
        logger.error(`Failed to send ephemeral error message: ${ephemeralError}`);
    }
  }
});


// --- Step 1 Submission: Push Step 2 ---
// *** LISTEN FOR RENAMED CALLBACK ID ***
app.view('new_campaign_v2_step1', async ({ ack, view, client, logger }) => {
  // Acknowledge the view submission
  await ack();

  // Capture Step 1 values
  const step1 = view.state.values;

  // Push Step 2, embedding step1 in private_metadata
  try {
    logger.info(`>>> Submitting Step 1 (v2), pushing Step 2. Trigger ID: ${view.trigger_id}`);
    await client.views.push({
      // trigger_id is required for pushing views
      trigger_id: view.trigger_id,
      view: {
        type: 'modal',
        // *** USE RENAMED CALLBACK ID ***
        callback_id: 'new_campaign_v2_step2',
        title: { type: 'plain_text', text: 'New Campaign - 2/3' },
        submit: { type: 'plain_text', text: 'Next' },
        close: { type: 'plain_text', text: 'Cancel' },
        // Pass step 1 data to the next view
        private_metadata: JSON.stringify({ step1 }),
        blocks: [
          // --- Blocks for Step 2 ---
          {
            "type": "input",
            "block_id": "kpis_block",
            "element": {
              "type": "plain_text_input",
              "action_id": "kpis_input",
              "multiline": true,
              "placeholder": {
                "type": "plain_text",
                "text": "Enter KPIs one per line, format: Metric Name: Target Value (e.g., CTR: 2%)"
              }
            },
            "label": {
              "type": "plain_text",
              "text": "KPIs & Targets"
            }
          },
          {
            "type": "input",
            "block_id": "pillars_block",
            "element": {
                "type": "plain_text_input",
                "action_id": "pillars_input",
                "placeholder": { "type": "plain_text", "text": "Pillar 1, Pillar 2, Pillar 3" }
            },
            "label": { "type": "plain_text", "text": "Key Message Pillars (comma-separated)" }
          },
          {
            "type": "input",
            "block_id": "milestones_block",
            "optional": true,
            "element": {
                "type": "plain_text_input",
                "action_id": "milestones_input",
                "multiline": true,
                "placeholder": { "type": "plain_text", "text": "YYYY-MM-DD: Check-in note\nYYYY-MM-DD: Launch phase 1" }
            },
            "label": { "type": "plain_text", "text": "Milestones / Check-ins (Optional, one per line: DATE: Note)" }
          },
          // --- End Blocks for Step 2 ---
        ]
      }
    });
     logger.info(`>>> Successfully pushed Step 2 (v2) view.`);
  } catch (err) {
    logger.error(`Error pushing step 2 (v2) view: ${err}`);
  }
});

// --- Step 2 Submission: Push Step 3 ---
// *** LISTEN FOR RENAMED CALLBACK ID ***
app.view('new_campaign_v2_step2', async ({ ack, view, client, logger }) => {
  // Acknowledge the view submission
  await ack();

  let step1 = {};
  const step2 = view.state.values; // Capture Step 2 values

  // Safely retrieve previous step's data
  try {
    // private_metadata is passed along automatically by Slack when pushing views
    const metadata = JSON.parse(view.private_metadata);
    step1 = metadata.step1 || {}; // Use default if parsing fails or step1 missing
  } catch (parseError) {
    logger.error(`Error parsing private_metadata in step 2 (v2): ${parseError}`);
    // Decide how to handle - maybe show an error message back to the user?
    // For now, we proceed with potentially missing step1 data but log the error.
  }

  // Push Step 3, embedding both step1 & step2
  try {
    logger.info(`>>> Submitting Step 2 (v2), pushing Step 3. Trigger ID: ${view.trigger_id}`);
    await client.views.push({
      trigger_id: view.trigger_id,
      view: {
        type: 'modal',
        // *** USE RENAMED CALLBACK ID ***
        callback_id: 'new_campaign_v2_step3',
        title: { type: 'plain_text', text: 'New Campaign - 3/3' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        // Store combined previous steps' data
        private_metadata: JSON.stringify({ step1, step2 }), // Pass along step1 and step2 data
        blocks: [
           // --- Blocks for Step 3 ---
           {
             "type": "input",
             "block_id": "tactics_block",
             "optional": true,
             "element": {
               "type": "plain_text_input",
               "action_id": "tactics_input",
               "multiline": true
             },
             "label": {
               "type": "plain_text",
               "text": "Tactical Requirements (Optional)"
             }
           },
           {
             "type": "input",
             "block_id": "legal_block",
             "optional": true,
             "element": {
               "type": "plain_text_input",
               "action_id": "legal_input",
               "multiline": true
             },
             "label": {
               "type": "plain_text",
               "text": "Legal / Compliance Notes (Optional)"
             }
           },
           {
                "type": "input",
                "block_id": "stakeholders_block",
                "element": {
                    "type": "checkboxes", // Or multi_users_select if you want specific users
                    "action_id": "stakeholders_select",
                    "options": [ // Example roles - adjust as needed
                        { "text": { "type": "plain_text", "text": "Marketing Lead" }, "value": "marketing_lead" },
                        { "text": { "type": "plain_text", "text": "Sales Lead" }, "value": "sales_lead" },
                        { "text": { "type": "plain_text", "text": "Legal Team" }, "value": "legal_team" },
                        { "text": { "type": "plain_text", "text": "Product Manager" }, "value": "product_manager" }
                    ]
                },
                "label": { "type": "plain_text", "text": "Stakeholder Approvals Required" }
            },
           {
             "type": "input",
             "block_id": "reporting_reqs_block",
             "element": {
               "type": "plain_text_input",
               "action_id": "reporting_reqs_input",
               "multiline": true
             },
             "label": {
               "type": "plain_text",
               "text": "Reporting Requirements"
             }
           },
           {
                "type": "input",
                "block_id": "distribution_block",
                "optional": true,
                "element": {
                    "type": "checkboxes", // Or multi_channels_select
                    "action_id": "distribution_select",
                    "options": [ // Example distribution methods
                        { "text": { "type": "plain_text", "text": "Email List: Marketing Team" }, "value": "email_marketing" },
                        { "text": { "type": "plain_text", "text": "Slack Channel: #campaign-updates" }, "value": "slack_campaign_updates" },
                        { "text": { "type": "plain_text", "text": "Shared Drive Folder" }, "value": "shared_drive" }
                    ]
                },
                "label": { "type": "plain_text", "text": "Distribution of Reporting (Optional)" }
            }
           // --- End Blocks for Step 3 ---
        ]
      }
    });
    logger.info(`>>> Successfully pushed Step 3 (v2) view.`);
  } catch (err) {
    logger.error(`Error pushing step 3 (v2) view: ${err}`);
  }
});


// --- Final Submission: Process All Data ---
// *** LISTEN FOR RENAMED CALLBACK ID ***
app.view('new_campaign_v2_step3', async ({ ack, view, body, client, logger }) => {
  // Acknowledge the view submission immediately
  await ack();
  logger.info(`>>> Received final submission (Step 3 v2) from user ${body.user.id}`);

  let step1 = {};
  let step2 = {};
  const step3 = view.state.values; // Capture Step 3 values

  // Safely parse all previous steps' data from private_metadata
  try {
    // private_metadata contains data from the view that triggered this submission (step 2's push)
    const metadata = JSON.parse(view.private_metadata);
    step1 = metadata.step1 || {};
    step2 = metadata.step2 || {};
    logger.info(`>>> Successfully parsed private_metadata for steps 1 & 2 (v2).`);
  } catch (parseError) {
    logger.error(`Error parsing private_metadata in step 3 (v2): ${parseError}`);
    // Notify the user about the error
    try {
        await client.chat.postEphemeral({
          channel: body.user.id, // Use user ID for ephemeral message channel
          user: body.user.id,
          text: `⚠️ Error processing data from previous steps. Please cancel and try creating the campaign again.`
        });
    } catch (ephemeralError) {
        logger.error(`Failed to send ephemeral error message: ${ephemeralError}`);
    }
    return; // Stop processing if metadata is corrupt
  }

  // Combine values from all steps into a single state object
  const combinedState = { ...step1, ...step2, ...step3 };
  // logger.debug(">>> Combined State (v2):", JSON.stringify(combinedState, null, 2)); // Uncomment for debugging

  // Helper function to safely get value from state object
  const getValue = (state, blockId, actionId, type = 'value', defaultValue = null) => {
      const block = state[blockId];
      if (!block) return defaultValue;
      const element = block[actionId];
      if (!element) return defaultValue;

      switch (type) {
          case 'selected_options':
              // Checkboxes return selected_options
              return element.selected_options || defaultValue || [];
          case 'selected_option':
              // Radio buttons or select menus return selected_option
              return element.selected_option || defaultValue;
          case 'selected_date':
              // Date pickers return selected_date
              return element.selected_date || defaultValue;
          case 'value':
          default:
              // Plain text input returns value
              return element.value !== undefined && element.value !== null ? element.value : defaultValue;
      }
  };


  // Helper function to parse KPI input string into JSONB format
  const parseKpis = (kpiString) => {
    if (!kpiString || typeof kpiString !== 'string') return [];
    return kpiString.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes(':')) // Ensure line has a separator
      .map(line => {
        const parts = line.split(':');
        const metric = parts[0].trim();
        const target = parts.slice(1).join(':').trim(); // Handle potential colons in target
        return { metric, target };
      })
      .filter(kpi => kpi.metric && kpi.target); // Ensure both parts exist
  };

  // Helper function to parse Milestones input string into JSONB format
  const parseMilestones = (milestoneString) => {
      if (!milestoneString || typeof milestoneString !== 'string') return [];
      return milestoneString.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':')) // Ensure line has a separator
        .map(line => {
          const parts = line.split(':');
          const date = parts[0].trim(); // Keep date as string for now
          const note = parts.slice(1).join(':').trim(); // Handle potential colons in note
          // Basic validation could be added here for date format if needed
          return { date, note };
        })
        .filter(ms => ms.date && ms.note); // Ensure both parts exist
  };

  // Build the payload for Supabase, matching the SQL schema
  // Use the getValue helper for safety and provide default values where appropriate
  const payload = {
    // Meta
    user_id: body.user.id, // Get user ID from the body

    // Step 1 Fields (Accessed via combinedState using block/action IDs from Step 1 blocks)
    campaign_name: getValue(combinedState, 'campaign_name_block', 'campaign_name_input', 'value', 'Untitled Campaign'),
    brand_product: getValue(combinedState, 'brand_product_block', 'brand_product_input', 'value', ''), // NOT NULL DEFAULT ''
    background: getValue(combinedState, 'background_block', 'background_input', 'value', ''), // NOT NULL DEFAULT ''
    objectives: (getValue(combinedState, 'objectives_block', 'objectives_select', 'selected_options') || []).map(o => o.value), // Assuming this maps to TEXT[] or similar
    target_audience: getValue(combinedState, 'audience_block', 'audience_input', 'value'), // TEXT, allows NULL
    budget: parseInt(getValue(combinedState, 'budget_block', 'budget_input', 'value', '0') || '0', 10), // Assuming integer budget
    channels: (getValue(combinedState, 'channels_block', 'channels_select', 'selected_options') || []).map(o => o.value), // Assuming TEXT[]
    assets_links: getValue(combinedState, 'assets_block', 'assets_input', 'value'), // TEXT, allows NULL

    // Step 2 Fields (Accessed via combinedState using block/action IDs from Step 2 blocks)
    kpis: parseKpis(getValue(combinedState, 'kpis_block', 'kpis_input', 'value')), // JSONB NOT NULL DEFAULT '[]'
    message_pillars: (getValue(combinedState, 'pillars_block', 'pillars_input', 'value', '') || '').split(',').map(s => s.trim()).filter(s => s), // TEXT[] NOT NULL DEFAULT '{}'
    milestones: parseMilestones(getValue(combinedState, 'milestones_block', 'milestones_input', 'value')), // JSONB DEFAULT '[]'

    // Step 3 Fields (Accessed via combinedState using block/action IDs from Step 3 blocks)
    tactical_requirements: getValue(combinedState, 'tactics_block', 'tactics_input', 'value'), // TEXT, allows NULL
    legal_notes: getValue(combinedState, 'legal_block', 'legal_input', 'value'), // TEXT, allows NULL
    stakeholder_approvals: (getValue(combinedState, 'stakeholders_block', 'stakeholders_select', 'selected_options') || []).map(o => o.value), // TEXT[] NOT NULL DEFAULT '{}'
    reporting_requirements: getValue(combinedState, 'reporting_reqs_block', 'reporting_reqs_input', 'value'), // TEXT, allows NULL
    report_distribution: (getValue(combinedState, 'distribution_block', 'distribution_select', 'selected_options') || []).map(o => o.value), // TEXT[] DEFAULT '{}'
  };

   // Clean up payload: Remove null values for fields that allow NULL in DB
   // Keep empty arrays/objects for fields with NOT NULL DEFAULTs
   Object.keys(payload).forEach(key => {
     // Check if the value is truly null or undefined before deleting
     if (payload[key] === null || payload[key] === undefined) {
       // Only delete if the DB column allows NULLs
       if (['tactical_requirements', 'legal_notes', 'reporting_requirements', 'assets_links', 'target_audience', 'milestones', 'report_distribution'].includes(key)) { // Added milestones/report_distribution as they have defaults but might be optional inputs
            delete payload[key];
       }
     }
     // Ensure required fields have a value (getValue defaults should handle most)
     if (key === 'campaign_name' && !payload[key]) payload[key] = 'Untitled Campaign';
     if (key === 'brand_product' && payload[key] === null) payload[key] = ''; // Ensure NOT NULL fields have a default
     if (key === 'background' && payload[key] === null) payload[key] = ''; // Ensure NOT NULL fields have a default
     // Ensure array/JSONB fields that are NOT NULL have a default value if empty after processing
     if (key === 'kpis' && !payload[key]) payload[key] = [];
     if (key === 'message_pillars' && !payload[key]) payload[key] = [];
     if (key === 'stakeholder_approvals' && !payload[key]) payload[key] = [];
     if (key === 'objectives' && !payload[key]) payload[key] = []; // Added objectives check
     if (key === 'channels' && !payload[key]) payload[key] = []; // Added channels check

   });

  // Log the final payload before insertion
  logger.info('Attempting to insert payload (v2) into Supabase:', JSON.stringify(payload, null, 2));

  // Insert into Supabase
  const { data, error } = await supabase.from('campaigns').insert(payload).select(); // Added .select() to potentially get back the inserted row

  // Confirm or error message to the user
  if (error) {
    logger.error('Supabase error (v2):', error);
    // Provide more specific feedback
    try {
        await client.chat.postEphemeral({
          channel: body.user.id, // Use user ID for ephemeral message channel
          user: body.user.id,
          text: `❌ Failed to save campaign: ${error.message}. Please check your inputs, especially formatting for KPIs/Milestones, and try again. \n Details: ${error.details || '(no details provided)'}`
        });
    } catch (ephemeralError) {
        logger.error(`Failed to send ephemeral error message: ${ephemeralError}`);
    }
  } else {
    logger.info(`Campaign '${payload.campaign_name}' saved successfully (v2) for user ${body.user.id}. Inserted data: ${JSON.stringify(data)}`);
    try {
        await client.chat.postMessage({
          channel: body.user.id, // Send confirmation to the user who submitted
          text: `✅ Your campaign *${payload.campaign_name}* has been saved!`
          // Optionally add blocks with a summary or link to the campaign if available
        });
    } catch (messageError) {
        logger.error(`Failed to send success message: ${messageError}`);
    }
  }
});

// --- Global Error Handler ---
app.error(async (error) => {
  // error contains payload data, error object
  logger.error(`Unhandled Bolt error: ${error.message || error}`);
  logger.debug("Error payload:", JSON.stringify(error, null, 2)); // Log the full error context if needed

  // Attempt to notify the user if possible (e.g., from an interaction payload)
  const userId = error.context?.userId || error.body?.user?.id;
  const channelId = error.context?.channelId || error.body?.channel?.id || userId; // Fallback to DM

  if (userId && channelId && error.client) {
      try {
          await error.client.chat.postEphemeral({
              channel: channelId,
              user: userId,
              text: `An unexpected error occurred. Please try again later or contact support if the issue persists.`
          });
      } catch (ephemeralError) {
          logger.error(`Failed to send global error ephemeral message: ${ephemeralError}`);
      }
  }
});


// --- Start the app ---
(async () => {
  try {
    await app.start();
    console.log('⚡️ Bolt app is running in Socket Mode!');
     logger.info('⚡️ Bolt app is running in Socket Mode!');
  } catch (startError) {
     console.error('💥 Failed to start Bolt app:', startError);
     logger.error('💥 Failed to start Bolt app:', startError);
     process.exit(1);
  }
})();
