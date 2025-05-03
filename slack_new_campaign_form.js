// Step 1 submission: push Step 2 (carry Step 1 values forward)
app.view('new_campaign_step1', async ({ ack, view, client, logger }) => {
  await ack();

  // 1) capture Step 1 values
  const step1 = view.state.values;

  // 2) push Step 2, embedding step1 in private_metadata
  try {
    await client.views.push({
      trigger_id: view.trigger_id,
      view: {
        type:             'modal',
        callback_id:      'new_campaign_step2',
        title:            { type: 'plain_text', text: 'New Campaign - 2/3' },
        submit:           { type: 'plain_text', text: 'Next' },
        close:            { type: 'plain_text', text: 'Cancel' },
        private_metadata: JSON.stringify({ step1 }),
        blocks: [ /* your Step 2 blocks… */ ]
      }
    });
  } catch (err) {
    logger.error(err);
  }
});

// Step 2 submission: push Step 3 (carry Step 1 & Step 2 values forward)
app.view('new_campaign_step2', async ({ ack, view, client, logger }) => {
  await ack();

  // 1) retrieve previous steps
  const metadata = JSON.parse(view.private_metadata);
  const step1     = metadata.step1;
  const step2     = view.state.values;

  // 2) push Step 3, embedding both step1 & step2
  try {
    await client.views.push({
      trigger_id:      view.trigger_id,
      view: {
        type:             'modal',
        callback_id:      'new_campaign_step3',
        title:            { type: 'plain_text', text: 'New Campaign - 3/3' },
        submit:           { type: 'plain_text', text: 'Submit' },
        close:            { type: 'plain_text', text: 'Cancel' },
        private_metadata: JSON.stringify({ step1, step2 }),
        blocks: [ /* your Step 3 blocks… */ ]
      }
    });
  } catch (err) {
    logger.error(err);
  }
});

// Final submission: read private_metadata to build full payload
app.view('new_campaign_step3', async ({ ack, view, body, client, logger }) => {
  await ack();

  // 1) parse all previous steps
  const { step1, step2 } = JSON.parse(view.private_metadata);
  const step3            = view.state.values;

  // 2) merge them into one values object
  const values = { ...step1, ...step2, ...step3 };

  // 3) build your payload exactly as before, e.g.:
  const payload = {
    user_id:        body.user.id,
    campaign_name:  values.campaign_name.value.value,
    brand_product:  values.brand_product.value.value,
    background:     values.background.value.value,
    objectives:     values.objectives.value.selected_options.map(o => o.value),
    kpis:           values.kpis.value.value.split('\n'),
    target_audience:values.target_audience.value.value,
    message_pillars:values.message_pillars.value.value.split(',').map(s => s.trim()),
    budget:         parseInt(values.budget.value.value, 10),
    milestones:     values.milestones.value.value.split('\n').map(l => {
                      const [date, note] = l.split(':');
                      return { date: date.trim(), note: (note||'').trim() };
                    }),
    channels:       values.channels.value.selected_options.map(o => o.value),
    tactical_requirements: values.tactical_requirements?.value.value || null,
    legal_notes:    values.legal_notes?.value.value || null,
    stakeholder_approvals: values.stakeholder_approvals.value.selected_options.map(o => o.value),
    reporting_requirements: values.reporting_requirements.value.value,
    report_distribution: values.report_distribution.value.selected_options.map(o => o.value),
    assets_links:   values.assets_links?.value.value || null
  };

  // 4) insert into Supabase
  const { error } = await supabase.from('campaigns').insert(payload);

  // 5) confirm or error
  if (error) {
    logger.error('Supabase error:', error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user:    body.user.id,
      text:    `❌ Failed to save campaign: ${error.message}`
    });
  } else {
    await client.chat.postMessage({
      channel: body.user.id,
      text:    `✅ Your campaign *${payload.campaign_name}* has been saved!`
    });
  }
});
