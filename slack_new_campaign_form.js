// FILE: slack_new_campaign_form.js
// (Assuming necessary imports for app, supabase, logger are present)

// ... (Keep Step 1 and Step 2 handlers as they are, maybe add JSON.parse try/catch) ...

// Step 1 submission: push Step 2 (carry Step 1 values forward)
app.view('new_campaign_step1', async ({ ack, view, client, logger }) => {
  await ack();

  // 1) capture Step 1 values
  const step1 = view.state.values;

  // 2) push Step 2, embedding step1 in private_metadata
  try {
    await client.views.push({
      trigger_id: view.trigger_id, // Use trigger_id from the view submission
      view: {
        type: 'modal',
        callback_id: 'new_campaign_step2',
        title: { type: 'plain_text', text: 'New Campaign - 2/3' },
        submit: { type: 'plain_text', text: 'Next' },
        close: { type: 'plain_text', text: 'Cancel' },
        // Store previous step's data
        private_metadata: JSON.stringify({ step1 }),
        // Define blocks for Step 2 here...
        blocks: [
          // Example: Add blocks for KPIs, Message Pillars etc.
          // Make sure the block_id and action_id match what you use in Step 3 processing
          {
            "type": "input",
            "block_id": "kpis_block", // Ensure this block_id is used below
            "element": {
              "type": "plain_text_input",
              "action_id": "kpis_input", // Ensure this action_id is used below
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
          // ... other blocks for step 2 ...
        ]
      }
    });
  } catch (err) {
    logger.error(`Error pushing step 2 view: ${err}`);
  }
});

// Step 2 submission: push Step 3 (carry Step 1 & Step 2 values forward)
app.view('new_campaign_step2', async ({ ack, view, client, logger }) => {
  await ack();

  let step1 = {};
  const step2 = view.state.values; // Capture Step 2 values

  // 1) Safely retrieve previous step's data
  try {
    const metadata = JSON.parse(view.private_metadata);
    step1 = metadata.step1 || {}; // Use default if parsing fails or step1 missing
  } catch (parseError) {
    logger.error(`Error parsing private_metadata in step 2: ${parseError}`);
    // Decide how to handle - maybe show an error message?
    // For now, we proceed with potentially missing step1 data
  }


  // 2) push Step 3, embedding both step1 & step2
  try {
    await client.views.push({
      trigger_id: view.trigger_id, // Use trigger_id from the view submission
      view: {
        type: 'modal',
        callback_id: 'new_campaign_step3',
        title: { type: 'plain_text', text: 'New Campaign - 3/3' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        // Store combined previous steps' data
        private_metadata: JSON.stringify({ step1, step2 }),
        // Define blocks for Step 3 here...
        blocks: [
           // ... blocks for step 3 (e.g., reporting, legal) ...
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
           // ... other blocks ...
        ]
      }
    });
  } catch (err) {
    logger.error(`Error pushing step 3 view: ${err}`);
  }
});


// Final submission: read private_metadata, combine all steps, format for Supabase
app.view('new_campaign_step3', async ({ ack, view, body, client, logger }) => {
  // Acknowledge the view submission immediately
  await ack();

  let step1 = {};
  let step2 = {};
  const step3 = view.state.values; // Capture Step 3 values

  // 1) Safely parse all previous steps' data from private_metadata
  try {
    const metadata = JSON.parse(view.private_metadata);
    step1 = metadata.step1 || {};
    step2 = metadata.step2 || {};
  } catch (parseError) {
    logger.error(`Error parsing private_metadata in step 3: ${parseError}`);
    // Optionally notify the user about the error
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `⚠️ Error processing previous steps' data. Please try again.`
    });
    return; // Stop processing if metadata is corrupt
  }

  // 2) Combine values from all steps into a single 'values' object for easier access
  // Note: Assumes unique block_ids across all steps. If not, structure access like step1['block_id'].action_id.value
  const combinedState = { ...step1, ...step2, ...step3 };

  // Helper function to safely get value from state object
  // state = combined state object
  // blockId = the unique block_id of the input
  // actionId = the action_id of the input element
  // type = expected type ('value', 'selected_options', 'selected_option', 'selected_date', etc.)
  const getValue = (state, blockId, actionId, type = 'value') => {
      return state[blockId]?.[actionId]?.[type] || null;
  };

  // Helper function to parse KPI input string into JSONB format
  const parseKpis = (kpiString) => {
    if (!kpiString) return [];
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
      if (!milestoneString) return [];
      return milestoneString.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':')) // Ensure line has a separator
        .map(line => {
          const parts = line.split(':');
          const date = parts[0].trim();
          const note = parts.slice(1).join(':').trim(); // Handle potential colons in note
          return { date, note };
        })
        .filter(ms => ms.date && ms.note); // Ensure both parts exist
    };


  // 3) Build the payload for Supabase, matching the SQL schema
  // Use the getValue helper for safety. Replace block_ids/action_ids with your actual ones.
  // Ensure these block_ids/action_ids exist in the respective steps' modal definitions.
  const payload = {
    // Assuming these fields come from Step 1
    user_id: body.user.id, // Get user ID from the body
    campaign_name: getValue(combinedState, 'campaign_name_block', 'campaign_name_input'),
    brand_product: getValue(combinedState, 'brand_product_block', 'brand_product_input'), // New field
    background: getValue(combinedState, 'background_block', 'background_input'), // New field
    objectives: (getValue(combinedState, 'objectives_block', 'objectives_select', 'selected_options') || []).map(o => o.value), // Assuming multi-select
    target_audience: getValue(combinedState, 'audience_block', 'audience_input'),
    budget: parseInt(getValue(combinedState, 'budget_block', 'budget_input') || '0', 10),
    channels: (getValue(combinedState, 'channels_block', 'channels_select', 'selected_options') || []).map(o => o.value), // Assuming multi-select
    assets_links: getValue(combinedState, 'assets_block', 'assets_input'),

    // Assuming these fields come from Step 2
    // --- CRITICAL FIX FOR KPIs ---
    kpis: parseKpis(getValue(combinedState, 'kpis_block', 'kpis_input')), // Use parser function for JSONB
    message_pillars: (getValue(combinedState, 'pillars_block', 'pillars_input') || '').split(',').map(s => s.trim()).filter(s => s), // TEXT[]
    milestones: parseMilestones(getValue(combinedState, 'milestones_block', 'milestones_input')), // Use parser function for JSONB

    // Assuming these fields come from Step 3
    tactical_requirements: getValue(combinedState, 'tactics_block', 'tactics_input'), // TEXT
    legal_notes: getValue(combinedState, 'legal_block', 'legal_input'), // TEXT
    stakeholder_approvals: (getValue(combinedState, 'stakeholders_block', 'stakeholders_select', 'selected_options') || []).map(o => o.value), // TEXT[]
    reporting_requirements: getValue(combinedState, 'reporting_reqs_block', 'reporting_reqs_input'), // TEXT
    report_distribution: (getValue(combinedState, 'distribution_block', 'distribution_select', 'selected_options') || []).map(o => o.value), // TEXT[]
  };

   // Remove null values if your DB doesn't handle them or if you prefer cleaner inserts
   Object.keys(payload).forEach(key => {
     if (payload[key] === null) {
       delete payload[key];
     }
     // Clean up empty arrays for array types if needed (depends on DB column constraints)
     if (Array.isArray(payload[key]) && payload[key].length === 0) {
        // Decide whether to delete the key or send an empty array '{}' based on DB DEFAULTs and NOT NULL constraints
        // If the column is NOT NULL DEFAULT '{}', sending `[]` via the JS client usually works.
        // If it allows NULL, deleting the key might be preferable. Let's assume sending [] is okay.
     }
   });

  // 4) Insert into Supabase
  logger.info('Attempting to insert payload:', JSON.stringify(payload, null, 2)); // Log the final payload
  const { error } = await supabase.from('campaigns').insert(payload);

  // 5) Confirm or error message to the user
  if (error) {
    logger.error('Supabase error:', error);
    // Provide more specific feedback if possible
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `❌ Failed to save campaign: ${error.message}. Please check your inputs and try again. \n Details: ${error.details || ''}`
    });
  } else {
    logger.info(`Campaign '${payload.campaign_name}' saved successfully for user ${body.user.id}.`);
    await client.chat.postMessage({
      channel: body.user.id, // Send confirmation to the user who submitted
      text: `✅ Your campaign *${payload.campaign_name}* has been saved!`
    });
  }
});

// ... (rest of your Bolt app setup, including app.start()) ...

```
**Explanation of Changes:**

1.  **Robust `private_metadata` Parsing:** Added `try...catch` blocks when parsing `private_metadata` in steps 2 and 3 to prevent errors if the data is missing or corrupt.
2.  **Combined State Object:** Created a `combinedState` object in step 3 to merge values from all steps, simplifying access using `block_id` and `action_id`. **Important:** This assumes your `block_id`s are unique across *all* steps of the modal. If you reuse `block_id`s, you'll need to access the state differently (e.g., `step1['block_id']['action_id'].value`).
3.  **`getValue` Helper:** Introduced a helper function `getValue` to safely access nested properties within the state object, returning `null` if any part of the path is missing. This makes the payload construction cleaner and less prone to errors.
4.  **`parseKpis` Function:** Added a specific function to parse the multi-line KPI input string into the required JSONB array-of-objects format `[{ metric: '...', target: '...' }]`. You **must** update the corresponding input block in your Step 2 modal definition to guide the user on the expected format (e.g., "Metric Name: Target Value" per line).
5.  **`parseMilestones` Function:** Added a similar parser for milestones to ensure consistent JSONB formatting.
6.  **Payload Construction:** Updated the `payload` object creation to use the `getValue` helper and the `parseKpis`/`parseMilestones` functions, ensuring data types align with the Supabase schema (`JSONB` for `kpis` and `milestones`, `TEXT[]` for arrays, `TEXT` for strings, `integer` for `budget`).
7.  **Null/Empty Value Handling:** Added basic logic to remove `null` keys before insertion (optional, depending on preference) and noted considerations for empty arrays based on DB constraints.
8.  **Logging:** Added logging for the final payload before insertion and for successful saves, which is helpful for debugging.
9.  **Error Message:** Improved the error message sent to the user in case of Supabase failure.
10. **Trigger ID:** Ensured `trigger_id: view.trigger_id` is used in `views.push` calls, which is crucial for pushing subsequent views correctly.

**Don't Forget the Checklist!**

Even with corrected code, the original troubleshooting steps are vital:

1.  ✅ **Confirm Code is Running:** Use `ps aux | grep your_file.js`, check Railway/host logs, ensure the `⚡️ Bolt app is running...` message appears without errors. Kill old processes.
2.  ✅ **Re-install Slack App:** *Crucial* after changing modal `blocks` or `callback_id`s to clear Slack's cache. Go to `https://api.slack.com/apps/{YOUR_APP_ID}/install-on-team` and reinstall.
3.  ✅ **Double-check `callback_id`s:** Ensure the ID in `app.command`'s `views.open` matches `app.view('new_campaign_step1',...)`, and subsequent `views.push` IDs match their `app.view` listeners (`step1`, `step2`, `step3`).
4.  ✅ **Test End-to-End:** Use a clean/new Slack workspace for testing the full `/new_campaign` flow.

By applying the code fixes (especially for `kpis` and robust state handling) and diligently following the deployment/caching checklist, you should be able to get your multi-step modal working reliably. Remember to adjust the `block_id` and `action_id` names in the code to match your actual modal definitio
