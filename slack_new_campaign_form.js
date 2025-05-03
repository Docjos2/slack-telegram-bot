// slack_new_campaign_form.js
require('dotenv').config();

const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('telegraf'); // if you want to notify Telegram

//
// 1) Supabase client
//
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

//
// 2) Bolt in Socket Mode
//
const app = new App({
  token:         process.env.SLACK_BOT_TOKEN,       // xoxb-…
  signingSecret: process.env.SLACK_SIGNING_SECRET,  // your signing secret
  socketMode:    true,                              // ← enable Socket Mode
  appToken:      process.env.SLACK_APP_TOKEN        // xapp-… from App-Level Tokens
});

//
// 3) /new_campaign — open the modal
//
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
            type:      'input',
            block_id:  'campaign_name',
            element:   { type: 'plain_text_input', action_id: 'value' },
            label:     { type: 'plain_text', text: 'Campaign Name' }
          },

          // Campaign Summary
          {
            type:      'input',
            block_id:  'description',
            element:   {
              type:         'plain_text_input',
              action_id:    'value',
              multiline:    true
            },
            label:     { type: 'plain_text', text: 'Campaign Summary' }
          },

          // Objectives & KPIs
          {
            type:      'input',
            block_id:  'objectives',
            element:   {
              type:        'checkboxes',
              action_id:   'value',
              options: [
                { text: { type:'plain_text',text:'Brand Awareness' }, value:'Brand Awareness' },
                { text: { type:'plain_text',text:'Lead Gen' },       value:'Lead Gen' },
                { text: { type:'plain_text',text:'Engagement' },     value:'Engagement' }
              ]
            },
            label:     { type:'plain_text', text:'Objectives & KPIs' }
          },

          // Target Audience (optional)
          {
            type:      'input',
            block_id:  'target_audience',
            optional:  true,
            element:   {
              type:      'plain_text_input',
              action_id: 'value',
              multiline: true
            },
            label:     { type:'plain_text', text:'Target Audience' }
          },

          // Budget
          {
            type:      'input',
            block_id:  'budget',
            element:   {
              type:                 'number_input',
              action_id:            'value',
              is_decimal_allowed:   false,
              min_value:            '100'
            },
            label:     { type:'plain_text', text:'Budget (EUR)' }
          },

          // Channels
          {
            type:      'input',
            block_id:  'channels',
            element:   {
              type:        'multi_static_select',
              action_id:   'value',
              placeholder: { type:'plain_text',text:'Select channels' },
              options: [
                { text:{type:'plain_text',text:'Email'},     value:'Email' },
                { text:{type:'plain_text',text:'Social'},    value:'Social' },
                { text:{type:'plain_text',text:'Display Ads'},value:'Display Ads' },
                { text:{type:'plain_text',text:'Search'},    value:'Search' }
              ]
            },
            label:     { type:'plain_text',text:'Channels' }
          },

          // Start Date
          {
            type:      'input',
            block_id:  'start_date',
            element:   {
              type:      'datepicker',
              action_id:'value',
              placeholder:{ type:'plain_text',text:'Select a date' }
            },
            label:     { type:'plain_text',text:'Start Date' }
          },

          // End Date
          {
            type:      'input',
            block_id:  'end_date',
            element:   {
              type:      'datepicker',
              action_id:'value',
              placeholder:{ type:'plain_text',text:'Select a date' }
            },
            label:     { type:'plain_text',text:'End Date' }
          },

          // Asset URLs / Notes (optional)
          {
            type:      'input',
            block_id:  'assets_links',
            optional:  true,
            element:   {
              type:      'plain_text_input',
              action_id:'value',
              multiline: true
            },
            label:     { type:'plain_text',text:'Asset URLs / Notes' }
          }
        ]
      }
    });
  } catch (err) {
    logger.error(err);
  }
});

//
// 4) Handle the submission
//
app.view('new_campaign_modal', async ({ ack, view, body, client, logger }) => {
  await ack();
  const user = body.user.id;
  const vals = view.state.values;

  // extract values
  const campaign_name   = vals.campaign_name.value.value;
  const description     = vals.description.value.value;
  const objectives      = vals.objectives.value.selected_options.map(o=>o.value);
  const target_audience = vals.target_audience?.value.value || null;
  const budget          = parseInt(vals.budget.value.value,10);
  const channels        = vals.channels.value.selected_options.map(o=>o.value);
  const start_date      = vals.start_date.value.selected_date;
  const end_date        = vals.end_date.value.selected_date;
  const assets_links    = vals.assets_links?.value.value || null;

  // write to Supabase
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
    logger.error('Supabase insert error:', error);
    // optionally tell the user
    await client.chat.postEphemeral({
      channel: body.user.id,
      user,
      text:    '⚠️ Oops, something went wrong saving your campaign. Please try again.'
    });
    return;
  }

  // confirmation DM
  await client.chat.postMessage({
    channel: user,
    text:    `🎉 Your campaign *${campaign_name}* has been saved!`
  });

  // OPTIONAL: forward to Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    const msg = [
      `📣 New campaign request: *${campaign_name}*`,
      `*Summary:* ${description}`,
      `*Budget:* €${budget}`,
      `*Start:* ${start_date}   *End:* ${end_date}`,
      `*Channels:* ${channels.join(', ')}`,
    ].join('\n');
    bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, { parse_mode:'Markdown' });
  }
});

//
// 5) Start your app
//
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
})();
