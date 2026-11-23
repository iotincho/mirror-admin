/* Opt-in: build + actual administrative API backed by a disposable synthetic database. */
const { chromium } = require(process.env.JOURNALS_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  assert.equal(process.env.JOURNALS_BROWSER_SYNTHETIC, '1', 'Requires explicit synthetic-environment opt-in');
  const origin = process.env.JOURNALS_BROWSER_ORIGIN || 'http://127.0.0.1:18766';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
  const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
  const output = process.env.JOURNALS_BROWSER_SCREENSHOTS || '/tmp/mirror-admin-journals-stage5';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.JOURNALS_CHROMIUM_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const panel = () => page.getByRole('dialog').first();
  const root = id => `${origin}/api/admin/users/${id}/journals`;
  async function account(id) { const response = await context.request.get(root(id)); assert.equal(response.status(), 200); return response.json(); }
  async function api(method, url, body) { const result = await context.request.fetch(url, { method, headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: body }); assert.equal(result.status(), 200, await result.text()); return result.json(); }
  async function navigate(id) { await page.goto(`${origin}/#/users/${id}/show?tab=journals`); await page.getByRole('tab', { name: 'Journals', exact: true }).waitFor(); }
  async function screenshot(name) { await page.screenshot({ path: path.join(output, name), fullPage: !(await panel().isVisible().catch(() => false)) }); }
  async function openCurrent() { await page.getByRole('button', { name: 'Ajustar esta etapa', exact: true }).click(); await panel().getByLabel('Objetivo de exploración', { exact: true }).waitFor(); }
  async function reviewChanges() { await panel().getByRole('button', { name: 'Revisar cambios', exact: true }).click(); await panel().getByRole('heading', { name: 'Revisar el ajuste', exact: true }).waitFor(); }
  async function waitClosed() { await page.getByRole('heading', { name: 'Revisar el ajuste', exact: true }).waitFor({ state: 'hidden' }); await page.getByText(/Cambio confirmado · Revisión/).first().waitFor(); }
  try {
    const fixture = await context.request.get(`${origin}/api/admin/users/${owner}`);
    assert.equal((await fixture.json()).email, 'journal-pilot-1@example.com', 'Not the synthetic fixture account');
    await navigate(owner);
    await page.getByRole('button', { name: 'Ajustar esta etapa', exact: true }).waitFor();
    await screenshot('account-desktop.png');
    for (const width of [320, 390, 768, 1440]) {
      console.log('Review width', width);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      if (await page.locator('.RaSidebar-paper[role="dialog"]').isVisible().catch(() => false)) await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow ${width}`);
      await openCurrent();
      assert.equal(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `Editor overflow ${width}`);
      if (width === 390) await screenshot('stage-mobile.png');
      await panel().getByRole('button', { name: 'Cancelar', exact: true }).click();
      if (width === 390) { await page.evaluate(() => scrollTo(0, 0)); await screenshot('account-mobile.png'); }
    }
    checks.push('Vista y editor con SQL real a 320/390/768/1440 px');

    await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
    assert.equal(await panel().getByLabel('Objetivo de exploración', { exact: true }).getAttribute('readonly'), '');
    await panel().getByRole('button', { name: 'Cerrar', exact: true }).click();
    checks.push('Etapa completada de sólo lectura');

    await openCurrent();
    await panel().getByLabel('Objetivo de exploración', { exact: true }).fill(`Explorar cómo aparece la confianza en situaciones cotidianas ${randomUUID().slice(0, 6)}.`);
    await reviewChanges();
    await panel().getByRole('button', { name: /^Revisar ·/ }).click();
    await panel().getByRole('button', { name: 'Suave', exact: true }).click();
    await panel().getByRole('button', { name: 'Profunda', exact: true }).click();
    await panel().getByRole('checkbox', { name: /Revisé todos los temas/ }).check();
    await panel().getByRole('button', { name: 'Confirmar revisión', exact: true }).click();
    await panel().getByRole('button', { name: 'Guardar ajuste', exact: true }).click();
    await waitClosed();
    let row = (await account(owner)).items.find(item => item.run.status === 'active');
    assert.equal(row.catalog_review_required.length, 0);
    await page.reload(); await page.getByRole('button', { name: 'Ajustar esta etapa', exact: true }).waitFor();
    checks.push('Ajuste y aprobación del respaldo persistidos tras recarga');

    const beforeLost = row.run.revision, keys = [];
    let failOnce = true;
    await page.route('**/api/admin/users/*/journals/*', async route => {
      if (route.request().method() === 'PATCH' && new URL(route.request().url()).pathname === new URL(`${root(owner)}/${row.run.id}`).pathname) {
        keys.push(route.request().headers()['idempotency-key']);
        if (failOnce) { failOnce = false; await route.fetch(); return route.fulfill({ status: 503, json: { detail: 'journal_storage_unavailable' } }); }
      }
      await route.continue();
    });
    await openCurrent();
    await panel().getByLabel('Indicaciones para las preguntas', { exact: true }).fill('Invitar a observar situaciones concretas, sin apurar una conclusión.');
    await reviewChanges();
    await panel().getByRole('checkbox', { name: /Guardaré el ajuste/ }).check();
    await panel().getByRole('button', { name: 'Guardar ajuste', exact: true }).click();
    await panel().getByRole('button', { name: 'Comprobar resultado', exact: true }).waitFor();
    await panel().getByRole('button', { name: 'Cerrar editor', exact: true }).click();
    await navigate(other);
    await page.getByRole('button', { name: /Activar un journal|Ajustar esta etapa|Nuevo recorrido/ }).first().waitFor();
    assert.equal(await page.getByText(/Falta confirmar un guardado/).count(), 0);
    await navigate(owner);
    await page.getByRole('button', { name: 'Comprobar resultado', exact: true }).click();
    await page.getByText(`Cambio confirmado · Revisión ${beforeLost + 1}`, { exact: true }).waitFor();
    row = (await account(owner)).items.find(item => item.run.status === 'active');
    assert.equal(row.run.revision, beforeLost + 1);
    assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
    await page.unroute('**/api/admin/users/*/journals/*');
    checks.push('Respuesta perdida tras commit: misma clave, sin duplicados y aislada entre cuentas');

    // Restore the stage catalog with the dedicated editor.
    await page.getByRole('button', { name: 'Revisar respaldo', exact: true }).click();
    await panel().getByRole('checkbox', { name: /Revisé todos los temas/ }).check();
    await panel().getByRole('button', { name: 'Confirmar revisión', exact: true }).click();
    await panel().getByRole('button', { name: 'Guardar ajuste', exact: true }).click();
    await waitClosed();

    row = (await account(owner)).items.find(item => item.run.status === 'active');
    await openCurrent();
    await panel().getByLabel('Indicaciones para las preguntas', { exact: true }).fill('Dejar lugar a ejemplos y dudas sin sugerir explicaciones.');
    const first = row.stages.findIndex(stage => stage.id === row.editable_stage_id);
    await api('PATCH', `${root(owner)}/${row.run.id}`, { expected_revision: row.run.revision, purpose: row.run.purpose, instructions: row.instructions, remaining_stages: row.stages.slice(first).map((stage, i) => ({ ...stage.definition, duration_days: stage.definition.duration_days + (i === 0 ? 2 : 0) })), reviewed_catalogs: [] });
    await panel().getByRole('button', { name: 'Revisar cambios', exact: true }).click();
    await panel().getByRole('heading', { name: 'El recorrido cambió', exact: true }).waitFor();
    await screenshot('revision-conflict.png');
    await panel().getByRole('button', { name: 'Recuperar borrador', exact: true }).click();
    await panel().getByRole('checkbox', { name: /Guardaré el ajuste/ }).check();
    await panel().getByRole('button', { name: 'Guardar ajuste', exact: true }).click();
    await waitClosed();
    const merged = (await account(owner)).items.find(item => item.run.status === 'active');
    assert.equal(merged.stages[first].definition.duration_days, row.stages[first].definition.duration_days + 2);
    assert.equal(merged.stages[first].definition.instructions, 'Dejar lugar a ejemplos y dudas sin sugerir explicaciones.');
    checks.push('Revisión concurrente combina borrador local y duración del servidor');

    await page.getByRole('button', { name: 'Ver historial', exact: true }).click();
    await panel().getByRole('button', { name: 'Ver esta configuración', exact: true }).first().click();
    await panel().getByText('SÓLO LECTURA', { exact: false }).waitFor();
    await panel().getByRole('button', { name: 'Cerrar', exact: true }).click();
    checks.push('Historial y snapshot de revisión propios');

    // A second synthetic account starts from an empty journey collection.
    for (const item of (await account(other)).items.filter(item => ['active', 'paused'].includes(item.run.status))) await api('POST', `${root(other)}/${item.run.id}/actions`, { expected_revision: item.run.revision, action: 'close' });
    await navigate(other); await page.reload();
    await page.getByRole('button', { name: /Activar un journal|Nuevo recorrido/ }).first().click();
    await panel().getByRole('button', { name: 'Continuar', exact: true }).click();
    await panel().getByRole('heading', { name: 'Etapas con avance automático', exact: true }).waitFor();
    await screenshot('activation-calendar.png');
    await panel().getByRole('button', { name: 'Continuar', exact: true }).click();
    await panel().getByRole('checkbox', { name: /Revisé el template/ }).check();
    await panel().getByRole('button', { name: 'Activar recorrido', exact: true }).click();
    await page.getByText('Cambio confirmado · Revisión 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar recorrido', exact: true }).click();
    await page.getByRole('button', { name: 'Reanudar', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await page.getByRole('button', { name: 'Reanudar recorrido', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cerrar recorrido', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar recorrido', exact: true }).click();
    await page.getByText('Cambio confirmado · Revisión 4', { exact: true }).waitFor();
    checks.push('Activación real, pausa, reanudación y cierre con recibos confirmados');

    assert.deepEqual(errors, []);
    const result = { checks, browserErrors: errors, database: 'disposable PostgreSQL', backend: 'real administration API', widths: [320, 390, 768, 1440], providersCalled: false, lostResponseReplayedOnce: true };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.log((await page.locator('body').innerText()).slice(-1400)); throw error; } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
