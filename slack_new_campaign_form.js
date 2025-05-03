// slack_new_campaign_form.js
require('dotenv').config();
const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');
const { Telegraf } = require('telegraf'); // if you want to send Telegram messages

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// (Optional) Telegram bot
const telegram = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Slack Bolt in Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// 1️⃣ Slash command opens the modal
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
            label: { type: 'plain_text', text: 'Campaign Name' }
          },
          { type: 'input', block_id: 'description',
            element: { type: 'plain_text_input', action_id: 'value', multiline: true },
            label: { type: 'plain_text', text: 'Campaign Summary' }
          },
          { type: 'input', block_id: 'objectives',
            element: {
              type: 'checkboxes', action_id: 'value',
              options: [
                { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
                { text: { type: 'plain_text', text: 'Lead Gen' },         value: 'Lead Gen' },
                { text: { type: 'plain_text', text: 'Engagement' },       value: 'Engagement' }
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
        ]
      }
    });
  } catch (err) {
    logger.error(err);
  }
});

// 2️⃣ When they hit “Submit” on that modal…
app.view('new_campaign_modal', async ({ ack, view, body, client, logger }) => {
  await ack();
  const user = body.user.id;

  // Extract their inputs:
  const name        = view.state.values.campaign_name.value.value;
  const summary     = view.state.values.description.value.value;
  const objectives  = view.state.values.objectives.value.selected_options.map(o => o.value).join(', ');
  const audience    = view.state.values.target_audience?.value.value || null;
  const budget      = view.state.values.budget.value.value;

  // Insert into Supabase
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: user,
      title: name,
      summary,
      objectives,
      target_audience: audience,
      budget_eur: budget
    });

  if (error) {
    logger.error('Supabase insert failed', error);
    return client.chat.postMessage({
      channel: user,
      text: `❌ Sorry, I couldn’t save your campaign: ${error.message}`
    });
  }

  // Confirm back in Slack
  await client.chat.postMessage({
    channel: user,
    text: `🎉 Your campaign *${name}* has been saved!`
  });

  // (Optional) Forward to Telegram
  // await telegram.telegram.sendMessage(
  //   process.env.TELEGRAM_CHAT_ID,
  //   `New campaign: *${name}*\n${summary}\nObjectives: ${objectives}`
  // );
});

// 3️⃣ Start up!
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
  // if you want to launch your Telegraf bot:
  // await telegram.launch();
})();
