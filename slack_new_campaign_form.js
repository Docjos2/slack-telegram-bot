// slack_new_campaign_form.js
require('dotenv').config();
const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// — Supabase client —
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// — Slack Bolt in Socket Mode —
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// — 1) Open the modal on /new_campaign —
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
        close:  { type: 'plain_text', text: 'Cancel' },
        blocks: [
          // Campaign Name
          {
            type: 'input', block_id: 'campaign_name',
            element: { type: 'plain_text_input', action_id: 'value' },
            label: { type: 'plain_text',      text: 'Campaign Name' }
          },

          // Campaign Summary
          {
            type: 'input', block_id: 'description',
            element: {
              type: 'plain_text_input', action_id: 'value', multiline: true
            },
            label: { type: 'plain_text', text: 'Campaign Summary' }
          },

          // Objectives & KPIs (checkboxes)
          {
            type: 'input', block_id: 'objectives',
            element: {
              type: 'checkboxes', action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
                { text: { type: 'plain_text', text: 'Lead Gen'          }, value: 'Lead Gen' },
                { text: { type: 'plain_text', text: 'Engagement'        }, value: 'Engagement' }
              ]
            },
            label: { type: 'plain_text', text: 'Objectives & KPIs' }
          },

          // Target Audience (optional)
          {
            type: 'input', optional: true, block_id: 'target_audience',
            element: {
              type: 'plain_text_input', action_id: 'value', multiline: true
            },
            label: { type: 'plain_text', text: 'Target Audience' }
          },

          // Budget (EUR)
          {
            type: 'input', block_id: 'budget',
            element: {
              type: 'number_input', action_id: 'value',
              is_decimal_allowed: false, min_value: '100'
            },
            label: { type: 'plain_text', text: 'Budget (EUR)' }
          },

          // Channels (multi-select dropdown)
          {
            type: 'input', block_id: 'channels',
            element: {
              type: 'multi_static_select', action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Select channels' },
              options: [
                { text: { type: 'plain_text', text: 'Email'   }, value: 'email'   },
                { text: { type: 'plain_text', text: 'Social'  }, value: 'social'  },
                { text: { type: 'plain_text', text: 'Webinar' }, value: 'webinar' },
                { text: { type: 'plain_text', text: 'PPC'     }, value: 'ppc'     }
              ]
            },
            label: { type: 'plain_text', text: 'Channels' }
          },

          // Start Date
          {
            type: 'input', block_id: 'start_date',
            element: {
              type: 'datepicker', action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Select a date' }
            },
            label: { type: 'plain_text', text: 'Start Date' }
          },

          // End Date
          {
            type: 'input', block_id: 'end_date',
            element: {
              type: 'datepicker', action_id: 'value',
              placeholder: { type: 'plain_text', text: 'Select a date' }
            },
            label: { type: 'plain_text', text: 'End Date' }
          },

          // Assets Links / Notes (optional)
          {
            type: 'input', optional: true, block_id: 'assets_links',
            element: {
              type: 'plain_text_input', action_id: 'value', multiline: true
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

// — 2) Handle the submission and write to Supabase —
app.view('new_campaign_modal', async ({ ack, view, body, client, logger }) => {
  await ack();
  const user = body.user.id;
  const vals = view.state.values;

  // pull out each field
  const campaign_name   = vals.campaign_name.value.value;
  const description     = vals.description.value.value;
  const objectives      = vals.objectives.value.selected_options.map(o => o.value);
  const target_audience = vals.target_audience?.value.value || null;
  const budget          = parseInt(vals.budget.value.value, 10);
  const channels        = vals.channels.value.selected_options.map(o => o.value);
  const start_date      = vals.start_date.value.selected_date;
  const end_date        = vals.end_date.value.selected_date;
  const assets_links    = vals.assets_links?.value.value || null;

  // insert into your new table
  const { error } = await supabase
    .from('campaigns')
    .insert({
      user_id:        user,
      campaign_name,
      description,
      objectives,
      target_audience,
      budget,
      channels,
      start_date,
      end_date,
      assets_links
    });

  if (error) {
    logger.error(error);
    await client.chat.postMessage({
      channel: user,
      text: `❌ Failed to save campaign: ${error.message}`
    });
    return;
  }

  // confirm back in Slack
  await client.chat.postMessage({
    channel: user,
    text: `✅ Your campaign *${campaign_name}* has been saved!`
  });
});

// — 3) start the app —
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
})();
