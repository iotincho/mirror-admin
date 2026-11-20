/* Revisión del prototipo aislado; no ejecuta la aplicación administrativa. */
const { chromium } = require(process.env.JOURNALS_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const origin = process.env.JOURNALS_PROTOTYPE_ORIGIN || 'http://127.0.0.1:8768';
  const output = process.env.JOURNALS_PROTOTYPE_SCREENSHOTS || path.join(__dirname, 'screenshots');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.JOURNALS_CHROMIUM_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], requests = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const action = name => page.locator(`[data-action="${name}"]`).last();
  const sheet = page.locator('#sheet');
  const field = name => sheet.locator(`[data-field="${name}"]`);
  async function scenario(value) {
    await page.locator('#scenario').selectOption(value);
    await page.waitForFunction(() => !document.querySelector('#modal').open);
  }
  async function screenshot(name) {
    await page.screenshot({ path: path.join(output, name), fullPage: !(await sheet.isVisible()), style: 'body { position: relative; } .review-tools { position: absolute; bottom: 0; }' });
  }
  async function noOverflow(width) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
    if (await sheet.isVisible()) assert.equal(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `Sheet overflow at ${width}`);
  }
  try {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Journals', exact: true }).waitFor();
    assert.equal(await page.locator('.stage-row').count(), 4);
    await screenshot('active-desktop.png');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(width);
      await action('edit-current').click();
      await sheet.getByRole('heading', { name: 'Ajustar etapa', exact: true }).waitFor();
      await noOverflow(width);
      if (width === 390) await screenshot('stage-editor-mobile.png');
      await action('dismiss').click();
      if (width === 390) { await page.evaluate(() => scrollTo(0, 0)); await screenshot('active-mobile.png'); }
    }
    checks.push('Vista y editor sin desbordamiento a 320/390/768/1440 px');

    await page.locator('[data-action="edit-stage"]').first().click();
    assert.equal(await field('objective').getAttribute('readonly'), '');
    await action('dismiss').click();
    checks.push('Etapa completada de sólo lectura');

    await action('edit-current').click();
    await field('objective').fill('Explorar qué significa la confianza al expresar desacuerdo.');
    await action('to-changes').click();
    assert.equal(await action('save').isDisabled(), true);
    await action('review-draft').click();
    await page.getByRole('button', { name: 'Suave', exact: true }).click();
    await page.getByRole('button', { name: 'Profunda', exact: true }).click();
    await page.getByRole('button', { name: 'Intermedia', exact: true }).click();
    await page.locator('#review-check').check();
    await action('approve-catalog').click();
    await action('save').click();
    await page.getByRole('status').filter({ hasText: 'Revisión 4' }).waitFor();
    assert.equal(await page.locator('#sheet').isVisible(), false);
    checks.push('Cambio de objetivo con revisión explícita del respaldo antes de guardar');

    await scenario('empty');
    await action('activate').click();
    await action('wizard-next').click();
    await screenshot('activation-calendar.png');
    await page.locator('#wizard-zone').selectOption('UTC');
    await action('wizard-next').click();
    assert.equal(await action('confirm-activation').isDisabled(), true);
    await page.locator('#activate-check').check();
    await action('confirm-activation').click();
    assert.equal(await page.locator('.stage-row').count(), 4);
    assert.equal(await page.locator('.stage-row.current h3').textContent(), 'Qué quiero explorar');
    checks.push('Activación desde template con calendario, zona y confirmación');

    await scenario('paused');
    await action('resume').click();
    await action('confirm-modal').click();
    assert.match(await page.locator('.stage-row.current').textContent(), /12 nov/);
    await action('pause').click();
    await action('confirm-modal').click();
    await page.getByText('Un tiempo para pausar', { exact: true }).waitFor();
    checks.push('Reanudación conserva tiempo restante y desplaza dos días; pausa explícita');

    await scenario('active');
    await action('advance').click();
    await action('confirm-modal').click();
    assert.equal(await page.locator('.stage-row.current h3').textContent(), 'Cómo aparece en mi vida');
    assert.equal(await action('advance').isDisabled(), true);
    await action('close-run').click();
    await action('confirm-modal').click();
    await action('activate').waitFor();
    await action('activate').click();
    await action('wizard-next').click();
    await action('wizard-next').click();
    await page.locator('#activate-check').check();
    await action('confirm-activation').click();
    await page.getByRole('heading', { name: 'Recorridos anteriores', exact: true }).waitFor();
    checks.push('Avance, cierre y nueva instancia con recorrido anterior conservado');

    await scenario('active');
    await action('edit-current').click();
    await field('days').fill('0');
    await action('to-changes').click();
    await sheet.getByRole('alert').waitFor();
    await field('days').fill('9');
    await action('add-stage').click();
    await field('name').fill('Volver sobre lo explorado');
    await field('objective').fill('Dar espacio a dudas que quedaron abiertas.');
    await action('move-up').click();
    assert.equal(await sheet.locator('#editor-stage').inputValue(), '3');
    await action('remove-stage').click();
    await action('confirm-modal').click();
    await action('to-changes').click();
    assert.equal(await action('save').isEnabled(), true);
    await action('save').click();
    await page.getByRole('status').filter({ hasText: 'Revisión 4' }).waitFor();
    assert.match(await page.locator('.stage-row.current').textContent(), /12 nov/);
    checks.push('Validación de duración, agregar/reordenar/quitar futura y fechas desplazadas');

    for (const value of ['save-error', 'conflict', 'conflict-field', 'ambiguous']) {
      await scenario(value);
      await action('to-changes').click();
      await page.locator('#defer-check').check();
      await action('save').click();
      if (value === 'save-error') {
        await sheet.getByRole('alert').waitFor();
        assert.equal(await field('objective').count(), 0);
        await action('save').click();
      } else if (value === 'conflict' || value === 'conflict-field') {
        await action('recover-draft').waitFor();
        if (value === 'conflict-field') {
          assert.equal(await action('recover-draft').isDisabled(), true);
          await page.locator('[data-conflict-id][value="draft"]').check();
          await screenshot('revision-conflict.png');
        }
        await action('recover-draft').click();
        assert.match(await sheet.textContent(), /12 nov/);
        await action('save').click();
      } else {
        await action('check-result').waitFor();
        await action('check-result').click();
      }
      await page.waitForFunction(() => !document.querySelector('#sheet').open);
      if (value === 'conflict') assert.match(await page.locator('.stage-row.current').textContent(), /9 días/);
    }
    checks.push('Error, revisión concurrente sin perder borrador y recuperación de confirmación perdida');

    for (const value of ['review', 'completed', 'closed', 'loading', 'error', 'disabled', 'inactive', 'missing']) {
      await scenario(value);
      for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(width); }
    }
    await scenario('disabled');
    assert.equal(await action('edit-current').isDisabled(), true);
    await scenario('error');
    await action('retry').click();
    await page.locator('.stage-row').first().waitFor();
    checks.push('Estados de revisión, cierre, carga, error, funcionalidad/cuenta deshabilitadas e inexistencia');

    await scenario('active');
    await action('history').click();
    await action('snapshot').click();
    await sheet.getByRole('heading', { name: 'Configuración histórica', exact: true }).waitFor();
    await action('dismiss').click();
    checks.push('Historial de configuración y snapshot de sólo lectura');
    assert.deepEqual(errors, []);
    assert.equal(requests.every(url => url.startsWith(origin)), true, 'Unexpected external request');
    const result = { status: 'passed', checks, widths: [320, 390, 768, 1440], browserErrors: errors, externalRequests: 0, backendConnected: false };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
