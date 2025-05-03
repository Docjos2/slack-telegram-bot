// slack_new_campaign_form.js
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
  token:         process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:    true,
  appToken:      process.env.SLACK_APP_TOKEN
});

// /new_campaign command - Step 1: Business Context & Goals
app.command('/new_campaign', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'new_campaign_step1',
        title: { type: 'plain_text', text: 'New Campaign - 1/3' },
        submit: { type: 'plain_text', text: 'Next' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          { type: 'input', block_id: 'campaign_name', element: { type: 'plain_text_input', action_id: 'value' }, label: { type: 'plain_text', text: 'Campaign Name' } },
          { type: 'input', block_id: 'brand_product', element: { type: 'plain_text_input', action_id: 'value' }, label: { type: 'plain_text', text: 'Brand / Product' } },
          { type: 'input', block_id: 'background', element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Background / Why Now?' } },
          { type: 'input', block_id: 'objectives', element: { type: 'checkboxes', action_id: 'value', options: [
            { text: { type: 'plain_text', text: 'Brand Awareness' }, value: 'Brand Awareness' },
            { text: { type: 'plain_text', text: 'Lead Gen' }, value: 'Lead Gen' },
            { text: { type: 'plain_text', text: 'Sales' }, value: 'Sales' },
            { text: { type: 'plain_text', text: 'Retention' }, value: 'Retention' }
          ] }, label: { type: 'plain_text', text: 'Primary Objective(s)' } },
          { type: 'input', block_id: 'kpis', element: { type: 'plain_text_input', action_id: 'value', multiline: true, placeholder: { type: 'plain_text', text: 'e.g. “Website visits → +20%”' } }, label: { type: 'plain_text', text: 'KPIs & Targets' } }
        ]
      }
    });
  } catch (err) { logger.error(err); }
});

// Step 1 submission: push Step 2
app.view('new_campaign_step1', async ({ ack, view, client }) => {
  await ack();
  const step1 = view.state.values;
  await client.views.push({
    trigger_id: view.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'new_campaign_step2',
      title: { type: 'plain_text', text: 'New Campaign - 2/3' },
      submit: { type: 'plain_text', text: 'Next' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        { type: 'input', block_id: 'target_audience', element: { type: 'plain_text_input', action_id: 'value', multiline: true }, label: { type: 'plain_text', text: 'Target Audience(s)' } },
        { type: 'input', block_id: 'message_pillars', element: { type: 'plain_text_input', action_id: 'value', placeholder: { type:'plain_text', text:'Comma-separated, e.g. “Trust, Innovation”' } }, label: { type:'plain_text', text:'Key Message Pillars' } },
        { type: 'input', block_id: 'budget', element: { type: 'number_input', action_id:'value', is_decimal_allowed:false }, label: { type:'plain_text', text:'Budget (EUR)' } },
        { type: 'input', block_id: 'milestones', element: { type:'plain_text_input', action_id:'value', multiline:true, placeholder:{ type:'plain_text',text:'YYYY-MM-DD: Note' } }, label:{ type:'plain_text',text:'Milestones / Check-ins' } }
      ]
    }
  });
});

// Step 2 submission: push Step 3
app.view('new_campaign_step2', async ({ ack, view, client }) => {
  await ack();
  await client.views.push({
    trigger_id: view.trigger_id,
    view: {
      type:'modal', callback_id:'new_campaign_step3', title:{type:'plain_text',text:'New Campaign - 3/3'}, submit:{type:'plain_text',text:'Submit'}, close:{type:'plain_text',text:'Cancel'},
      blocks:[
        {type:'input',block_id:'channels',element:{type:'multi_static_select',action_id:'value',options:[
          {text:{type:'plain_text',text:'Email'},value:'Email'},
          {text:{type:'plain_text',text:'Social'},value:'Social'},
          {text:{type:'plain_text',text:'PPC'},value:'PPC'}
        ]},label:{type:'plain_text',text:'Channels'}},
        {type:'input',block_id:'tactical_requirements',optional:true,element:{type:'plain_text_input',action_id:'value',multiline:true},label:{type:'plain_text',text:'Tactical Requirements'}},
        {type:'input',block_id:'legal_notes',optional:true,element:{type:'plain_text_input',action_id:'value',multiline:true},label:{type:'plain_text',text:'Legal / Compliance Notes'}},
        {type:'input',block_id:'stakeholder_approvals',element:{type:'multi_static_select',action_id:'value',options:[
          {text:{type:'plain_text',text:'Client Lead'},value:'client_lead'},
          {text:{type:'plain_text',text:'Team Lead'},value:'team_lead'},
          {text:{type:'plain_text',text:'Legal'},value:'legal'}
        ]},label:{type:'plain_text',text:'Stakeholder Approvals'}},
        {type:'input',block_id:'reporting_requirements',optional:true,element:{type:'plain_text_input',action_id:'value',multiline:true},label:{type:'plain_text',text:'Reporting Requirements'}},
        {type:'input',block_id:'report_distribution',optional:true,element:{type:'multi_static_select',action_id:'value',options:[
          {text:{type:'plain_text',text:'Email'},value:'email'},
          {text:{type:'plain_text',text:'Slack'},value:'slack'},
          {text:{type:'plain_text',text:'Dashboard'},value:'dashboard'}
        ]},label:{type:'plain_text',text:'Distribution of Reporting'}},
        {type:'input',block_id:'assets_links',optional:true,element:{type:'plain_text_input',action_id:'value',multiline:true},label:{type:'plain_text',text:'Existing Assets / Notes'}}
      ]
    }
  });
});

// Final submission - insert into Supabase
app.view('new_campaign_step3', async ({ ack, view, body, client, logger }) => {
  await ack();
  const u=body.user.id; const s1=view.private_metadata?JSON.parse(view.private_metadata):{};
  const values= {...s1,...view.state.values};
  const payload = {
    user_id: u,
    campaign_name: values.campaign_name.value.value,
    brand_product: values.brand_product.value.value,
    background: values.background.value.value,
    objectives: values.objectives.value.selected_options.map(o=>o.value),
    kpis: values.kpis.value.value.split('\n'),
    target_audience: values.target_audience.value.value,
    message_pillars: values.message_pillars.value.value.split(',').map(s=>s.trim()),
    budget: parseInt(values.budget.value.value,10),
    milestones: values.milestones.value.value.split('\n').map(l=>{const[a,n]=l.split(':');return{date:a.trim(),note:n.trim()}}),
    channels: values.channels.value.selected_options.map(o=>o.value),
    tactical_requirements: values.tactical_requirements?.value.value||null,
    legal_notes: values.legal_notes?.value.value||null,
    stakeholder_approvals: values.stakeholder_approvals.value.selected_options.map(o=>o.value),
    reporting_requirements: values.reporting_requirements.value.value,
    report_distribution: values.report_distribution.value.selected_options.map(o=>o.value),
    assets_links: values.assets_links.value.value||null
  };
  const {error}= await supabase.from('campaigns').insert(payload);
  if(error){ logger.error(error); await client.chat.postEphemeral({channel: u,user:u,text:`Error: ${error.message}`}); }
  else{ await client.chat.postMessage({channel:u,text:`✅ Saved *${payload.campaign_name}*`}); }
});

// Start the app
(async()=>{await app.start();console.log('⚡️ Bolt app is running');})();

