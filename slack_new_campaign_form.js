require('dotenv').config();
const { App } = require('@slack/bolt');
const { createClient } = require('@supabase/supabase-js');

// 1) Initialize Supabase client\const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2) Initialize your Bolt app in Socket Mode
const app = new App({
  token:         process.env.SLACK_BOT_TOKEN,       // xoxb-…
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:    true,
  appToken:      process.env.SLACK_APP_TOKEN         // xapp-…
});

// 3) Slash command listener—opens the full modal
app.command('/new_campaign', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id:  body.trigger_id,
      view: {
        type:        'modal',
        callback_id: 'new_campaign_modal',
        title:       { type: 'plain_text', text: 'New Campaign Brief' },
        submit:      { type: 'plain_text', text: 'Submit' },
        close:       { type: 'plain_text', text: 'Cancel' },
        blocks: [
          // Campaign Name
          { type: 'input', block_id: 'campaign_name', element: { type: 'plain_text_input', action_id: 'value' }, label: { type: 'plain_text', text: 'Campaign Name' } },
          // Background / Why Now?
          { type: 'input', block_id: 'background', element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Background / Why Now?' } },
          // Campaign Summary
          { type: 'input', block_id: 'description', element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Campaign Summary' } },
          // Brand / Product
          { type: 'input', block_id: 'brand_product', element: { type: 'plain_text_input', action_id: 'value' }, label: { type: 'plain_text', text: 'Brand / Product' } },
          // Objectives & KPIs (rich)
          { type: 'input', block_id: 'kpis', element: { type: 'plain_text_input', action_id: 'value', multiline: true, placeholder: { type: 'plain_text', text: 'List KPIs and targets, e.g. “Leads > 500 per month”' } }, label: { type: 'plain_text', text: 'KPIs & Targets' } },
          // Key Message Pillars
          { type: 'input', block_id: 'message_pillars', element: { type: 'plain_text_input', action_id: 'value', placeholder: { type: 'plain_text', text: 'Comma-separated pillars, e.g. “Trust, Innovation”' } }, label: { type: 'plain_text', text: 'Key Message Pillars' } },
          // Milestones / Check-ins
          { type: 'input', block_id: 'milestones', element: { type: 'plain_text_input', action_id: 'value', multiline: true, placeholder: { type: 'plain_text', text: 'List dates and notes, e.g. “2025-06-01: Mid-campaign review”' } }, label: { type: 'plain_text', text: 'Milestones / Check-ins' } },
          // Tactical Requirements
          { type: 'input', block_id: 'tactical_requirements', optional: true, element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Tactical Requirements' } },
          // Legal / Compliance Notes
          { type: 'input', block_id: 'legal_notes', optional: true, element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Legal / Compliance Notes' } },
          // Stakeholder Approvals
          { type: 'input', block_id: 'stakeholder_approvals', element: { type: 'multi_static_select', action_id: 'value', placeholder: { type: 'plain_text', text: 'Select approvers' }, options: [
              { text: { type: 'plain_text', text: 'Client Lead' }, value: 'client_lead' },
              { text: { type: 'plain_text', text: 'Legal Team' }, value: 'legal_team' },
              { text: { type: 'plain_text', text: 'Finance' },     value: 'finance' }
            ] }, label: { type: 'plain_text', text: 'Stakeholder Approvals' } },
          // Reporting Requirements
          { type: 'input', block_id: 'reporting_requirements', element: { type: 'plain_text_input', action_id: 'value', multiline: true, placeholder: { type: 'plain_text', text: 'E.g. “Weekly summary deck”' } }, label: { type: 'plain_text', text: 'Reporting Requirements' } },
          // Report Distribution
          { type: 'input', block_id: 'report_distribution', element: { type: 'multi_static_select', action_id: 'value', placeholder: { type: 'plain_text', text: 'Select distribution channels' }, options: [
              { text: { type: 'plain_text', text: 'Email' }, value: 'email' },
              { text: { type: 'plain_text', text: 'Slack Channel' }, value: 'slack_channel' },
              { text: { type: 'plain_text', text: 'Dashboard' }, value: 'dashboard' }
            ] }, label: { type: 'plain_text', text: 'Report Distribution' } },
          // Target Audience (optional)
          { type: 'input', block_id: 'target_audience', optional: true, element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Target Audience' } },
          // Budget
          { type: 'input', block_id: 'budget', element: { type: 'number_input', action_id: 'value', is_decimal_allowed: false, min_value: '0' }, label: { type: 'plain_text', text: 'Budget (EUR)' } },
          // Channels
          { type: 'input', block_id: 'channels', element: { type: 'multi_static_select', action_id: 'value', placeholder: { type: 'plain_text', text: 'Select channels' }, options: [
              { text: { type: 'plain_text', text: 'Email' }, value: 'email' },
              { text: { type: 'plain_text', text: 'Social Media' }, value: 'social_media' },
              { text: { type: 'plain_text', text: 'Paid Ads' }, value: 'paid_ads' }
            ] }, label: { type: 'plain_text', text: 'Channels' } },
          // Start & End
          { type: 'input', block_id: 'start_date', element: { type: 'datepicker', action_id: 'value', placeholder: { type: 'plain_text', text: 'Select a date' } }, label: { type: 'plain_text', text: 'Start Date' } },
          { type: 'input', block_id: 'end_date', element: { type: 'datepicker', action_id: 'value', placeholder: { type: 'plain_text', text: 'Select a date' } }, label: { type: 'plain_text', text: 'End Date' } },
          // Assets URLs / Notes
          { type: 'input', block_id: 'assets_links', optional: true, element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Asset URLs / Notes' } }
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

  // Build payload from all fields
  const payload = {
    user_id:                userId,
    campaign_name:          v.campaign_name.value.value,
    background:             v.background.value.value,
    description:            v.description.value.value,
    brand_product:          v.brand_product.value.value,
    kpis:                   v.kpis.value.value.split('\n').map(line => line.trim()),
    message_pillars:        v.message_pillars.value.value.split(',').map(s => s.trim()),
    milestones:             v.milestones.value.value.split('\n').map(l => {
      const [date, note] = l.split(':'); return { date: date.trim(), note: (note||'').trim() };
    }),
    tactical_requirements:  v.tactical_requirements?.value.value || null,
    legal_notes:            v.legal_notes?.value.value || null,
    stakeholder_approvals:  v.stakeholder_approvals.value.selected_options.map(o=>o.value),
    reporting_requirements: v.reporting_requirements.value.value,
    report_distribution:    v.report_distribution.value.selected_options.map(o=>o.value),
    target_audience:        v.target_audience?.value.value || null,
    budget:                 parseInt(v.budget.value.value, 10),
    channels:               v.channels.value.selected_options.map(o=>o.value),
    start_date:             v.start_date.value.selected_date,
    end_date:               v.end_date.value.selected_date,
    assets_links:           v.assets_links?.value.value || null
  };

  const { error } = await supabase.from('campaigns').insert(payload);
  if (error) {
    await client.chat.postEphemeral({ channel: userId, user: userId, text: `❌ Failed to save campaign: ${error.message}` });
  } else {
    await client.chat.postMessage({ channel: userId, text: `🎉 Your campaign *${payload.campaign_name}* has been saved!` });
    // optional: forward to Telegram
  }
});

// 5) Start your app
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running in Socket Mode!');
})();

