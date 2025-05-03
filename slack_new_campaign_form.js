// slack_new_campaign_form.js
// Node.js Slack Bolt app for the /new_campaign slash command and modal
// Integrated with Supabase for persisting campaign briefs

const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client using service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize your Bolt app with your bot token and signing secret (HTTP mode)
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
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
          { type: 'input', block_id: 'campaign_name',
            element: { type: 'plain_text_input', action_id: 'value' },
            label: { type: 'plain_text', text: 'Campaign Name' } },
          { type: 'input', block_id: 'description',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Campaign Summary' } },
          { type: 'input', block_id: 'objectives',
            element: {
              type: 'checkboxes', action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
                { text: { type: 'plain_text', text: 'Lead Gen' },      value: 'Lead Gen' },
                { text: { type: 'plain_text', text: 'Engagement' },    value: 'Engagement' }
              ]
            },
            label: { type: 'plain_text', text: 'Objectives & KPIs' }
          },
          { type: 'input', optional: true, block_id: 'target_audience',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Target Audience' }
          },
          { type: 'input', block_id: 'budget',
            element: { type: 'number_input', action_id: 'value', is_decimal_allowed: false, min_value: '100' },
            label: { type: 'plain_text', text: 'Budget (EUR)' }
          },
          { type: 'input', block_id: 'channels',
            element: {
              type: 'multi_static_select', action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Select channels' },
              options: [
                { text: { type: 'plain_text', text: 'Email' },       value: 'Email' },
                { text: { type: 'plain_text', text: 'Social' },      value: 'Social' },
                { text: { type: 'plain_text', text: 'Paid Search' }, value: 'Paid Search' },
                { text: { type: 'plain_text', text: 'Events' },      value: 'Events' }
              ]
            },
            label: { type: 'plain_text', text: 'Channels' }
          },
          { type: 'input', block_id: 'start_date',
            element: { type: 'datepicker', action_id: 'value' },
            label: { type: 'plain_text', text: 'Start Date' }
          },
          { type: 'input', block_id: 'end_date',
            element: { type: 'datepicker', action_id: 'value' },
            label: { type: 'plain_text', text: 'End Date' }
          },
          { type: 'input', optional: true, block_id: 'assets_links',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Asset URLs / Notes' }
          }
        ]
      }
    });
  } catch (error) {
    logger.error(error);
  }
});

// Handle modal submissions
app.view('new_campaign_modal', async ({ ack, body, view, client, logger }) => {
  await ack();
  try {
    const v = view.state.values;
    const output = {
      campaign_name:  v.campaign_name.value.value,
      description:    v.description.value.value,
      objectives:     v.objectives.value.selected_options.map(o => o.value),
      target_audience:v.target_audience?.value.value || null,
      budget:         parseInt(v.budget.value.value, 10),
      channels:       v.channels.value.selected_options.map(o => o.value),
      start_date:     v.start_date.value.selected_date,
      end_date:       v.end_date.value.selected_date,
      assets_links:   v.assets_links?.value.value || null
    };

    const record = {
      agentName:     'Campaign Intake',
      agentRole:     'campaign_input',
      taskCompleted: false,
      output,
      toolsUsed:    ['slack'],
      timestamp:     new Date().toISOString(),
      status:        'success'
    };

    // Insert into Supabase
    const { data, error } = await supabase.from('campaigns').insert([record]);
    if (error) {
      logger.error('Supabase insert error:', error);
      await client.chat.postEphemeral({
        channel: body.user.id,
        user:    body.user.id,
        text:    'Error saving your campaign. Please try again later.'
      });
      return;
    }

    await client.chat.postEphemeral({
      channel: body.user.id,
      user:    body.user.id,
      text:    'Got it – your campaign brief has been saved!'
    });
  } catch (error) {
    logger.error(error);
  }
});

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack Bolt app with Supabase is running!');
})();
