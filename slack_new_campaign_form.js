// slack_new_campaign_form.js
// Node.js Slack Bolt app for the /new_campaign slash command and modal
// Integrated with Supabase for persisting campaign briefs

require('dotenv').config();
const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize your Bolt app in Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,        // xoxb-... from OAuth & Permissions
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,                          // enable Socket Mode
  appToken: process.env.SLACK_APP_TOKEN      // xapp-... from App-Level Tokens
});

// Slash command listener for /new_campaign
app.command('/new_campaign', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'new_campaign_modal',
        title: { type: 'plain_text', text: 'New Campaign Brief' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input', block_id: 'campaign_name',
            element: { type: 'plain_text_input', action_id: 'value' },
            label: { type: 'plain_text', text: 'Campaign Name' }
          },
          {
            type: 'input', block_id: 'description',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Campaign Summary' }
          },
          {
            type: 'input', block_id: 'objectives',
            element: {
              type: 'checkboxes', action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
                { text: { type: 'plain_text', text: 'Lead Gen' },       value: 'Lead Gen' },
                { text: { type: 'plain_text', text: 'Engagement' },     value: 'Engagement' }
              ]
            },
            label: { type: 'plain_text', text: 'Objectives & KPIs' }
          },
          {
            type: 'input', optional: true, block_id: 'target_audience',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Target Audience' }
          },
          {
            type: 'input', block_id: 'budget',
            element: { type: 'number_input', action_id: 'value', is_decimal_allowed: false, min_value: '100' },
            label: { type: 'plain_text', text: 'Budget (EUR)' }
          }
        ]
      }
    });
  } catch (error) {
    logger.error(error);
  }
});

// Listener for modal submission
app.view('new_campaign_modal', async ({ ack, body, view, client, logger }) => {
  await ack();
  try {
    const values = view.state.values;
    const name = values.campaign_name.value.value;
    const desc = values.description.value.value;
    const obj = values.objectives.value.selected_options.map(o => o.value);
    const audience = values.target_audience?.value.value || null;
    const budget = values.budget.value.value;

    // Persist to Supabase
    await supabase.from('campaigns').insert({
      name, description: desc, objectives: obj,
      audience, budget: Number(budget), created_by: body.user.id
    });

    // Notify in Slack
    await client.chat.postMessage({
      channel: body.user.id,
      text: `Your campaign *${name}* has been saved to the database! 🎉`
    });
  } catch (error) {
    logger.error(error);
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
})();

