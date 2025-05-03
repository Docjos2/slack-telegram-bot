// slack_new_campaign_form.js
require('dotenv').config();
const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 1) Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2) Initialize your Bolt app in Socket Mode
const app = new App({
  token:        process.env.SLACK_BOT_TOKEN,       // xoxb-…
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:   true,
  appToken:     process.env.SLACK_APP_TOKEN        // xapp-…
});

// 3) Slash command listener—opens the full modal
app.command('/new_campaign', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type:       'modal',
        callback_id:'new_campaign_modal',
        title:      { type: 'plain_text', text: 'New Campaign Brief' },
        submit:     { type: 'plain_text', text: 'Submit' },
        close:      { type: 'plain_text', text: 'Cancel' },
        blocks: [
          // Campaign Name
          {
            type:     'input',
            block_id: 'campaign_name',
            element:  { type: 'plain_text_input', action_id: 'value' },
            label:    { type: 'plain_text', text: 'Campaign Name' }
          },
          // Campaign Summary
          {
            type:     'input',
            block_id: 'description',
            element:  {
              type:      'plain_text_input',
              action_id: 'value',
              multiline: true
            },
            label: { type: 'plain_text', text: 'Campaign Summary' }
          },
          // Objectives & KPIs
          {
            type:     'input',
            block_id: 'objectives',
            element:  {
              type:      'checkboxes',
              action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
                { text: { type: 'plain_text', text: 'Lead Gen' },          value: 'Lead Gen' },
                { text: { type: 'plain_text', text: 'Engagement' },        value: 'Engagement' }
              ]
            },
            label: { type: 'plain_text', text: 'Objectives & KPIs' }
          },
          // Target Audience (optional)
          {
            type:     'input',
            block_id: 'target_audience',
            optional: true,
            element:  {
              type:      'plain_text_input',
              action_id: 'value',
              multiline: true
            },
            label: { type: 'plain_text', text: 'Target Audience' }
          },
          // Budget
          {
            type:     'input',
            block_id: 'budget',
            element:  {
              type:                'number_input',
              action_id:           'value',
              is_decimal_allowed:  false,
              min_value:          '0'
            },
            label: { type: 'plain_text', text: 'Budget (EUR)' }
          },
          // Channels (multi-select)
          {
            type:     'input',
            block_id: 'channels',
            element:  {
              type:        'multi_static_select',
              action_id:   'value',
              placeholder: { type: 'plain_text', text: 'Select channels' },
              options: [
                { text: { type: 'plain_text', text: 'Email' },       value: 'Email' },
                { text: { type: 'plain_text', text: 'Social Media' }, value: 'Social Media' },
                { text: { type: 'plain_text', text: 'Paid Ads' },     value: 'Paid Ads' }
              ]
            },
            label: { type: 'plain_text', text: 'Channels' }
          },
          // Start Date
          {
            type:     'input',
            block_id: 'start_date',
            element:  {
              type:        'datepicker',
              action_id:   'value',
              placeholder: { type: 'plain_text', text: 'Select a date' }
            },
            label: { type: 'plain_text', text: 'Start Date' }
          },
          // End Date
          {
            type:     'input',
            block_id: 'end_date',
            element:  {
              type:        'datepicker',
              action_id:   'value',
              placeholder: { type: 'plain_text', text: 'Select a date' }
            },
            label: { type: 'plain_text', text: 'End Date' }
          },
          // Assets URLs / Notes (optional)
          {
            type:     'input',
            block_id: 'assets_links',
            optional: true,
            element:  {
              type:      'plain_text_input',
              action_id: 'value',
              multiline: true
            },
            label: { type: 'plain_text', text: 'Asset URLs / Notes' }
          }
        ]
      }
    });
  } catch (err) {
    logger.error(err);
  }
});

// 4) Handle the submission, insert into Supabase, confirm back in Slack (and optionally Telegram)
app.view('new_campaign_modal', async ({ ack, view, body, client, logger }) => {
  await ack();
  const userId = body.user.id;
  const v = view.state.values;

  // Extract all field values
  const payload = {
    user_id:         userId,
    campaign_name:   v.campaign_name.value.value,
    description:     v.description.value.value,
    objectives:      v.objectives.value.selected_options.map(o => o.value),
    target_audience: v.target_audience?.value.value || null,
    budget:          parseInt(v.budget.value.value, 10),
    channels:        v.channels.value.selected_options.map(o => o.value),
    start_date:      v.start_date.value.selected_date,
    end_date:        v.end_date.value.selected_date,
    assets_links:    v.assets_links?.value.value || null
  };

  const { error } = await supabase
    .from('campaigns')
    .insert(payload);

  if (error) {
    await client.chat.postEphemeral({
      channel: body.user.id,
      user:    userId,
      text:    `❌ Failed to save campaign: ${error.message}`
    });
  } else {
    await client.chat.postMessage({
      channel: userId,
      text:    `🎉 Your campaign *${payload.campaign_name}* has been saved!`
    });

    // ← optional: forward to Telegram here
  }
});

// 5) Start your app (no HTTP port needed in socket mode)
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
})();
