const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { chromium } = require('@playwright/test');
const resources = require('../backend/src/domain/resources');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/ui-upgrade/after');
fs.mkdirSync(output, { recursive: true });
const app = express();
app.use(express.static(path.join(root, 'frontend')));
const rows = Object.fromEntries(Object.entries(resources).map(([name, spec]) => [name, [{ id: 1, ...Object.fromEntries(Object.entries(spec.fields).map(([key, field]) => [key, field.default || (field.type === 'enum' ? field.values[0] : field.type === 'id' ? 1 : field.type === 'money' ? '250000.00' : field.type === 'datetime' ? '2099-01-01 08:00:00' : field.type === 'date' ? '2026-10-23' : key === 'email' ? 'ui@example.test' : key === 'name' ? 'Câu lạc bộ Sáng tạo' : key === 'title' ? 'Kết nối cộng đồng' : key === 'full_name' ? 'Nguyễn Minh Anh' : 'Dữ liệu kiểm thử giao diện')])) }]]));
async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const browser = await chromium.launch({ headless: true });
  let checks = 0;
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const role of ['admin', 'manager', 'viewer']) {
      const context = await browser.newContext();
      let mode = 'normal';
      let anonymous = false;
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const pathname = url.pathname;
        let data;
        if (pathname === '/api/auth/me' && anonymous) return route.fulfill({ status: 401, json: { success: false } });
        if (pathname === '/api/auth/me') data = { user: { id: 1, username: 'ui_test', full_name: 'Minh Anh', email: 'ui@example.test', role }, csrfToken: 'ui-test-only' };
        else if (pathname === '/api/catalog') data = resources;
        else if (pathname === '/api/health') return route.fulfill({ json: { status: 'ok', message: 'Hệ thống hoạt động' } });
        else if (pathname === '/api/dashboard') data = { clubs: 3, members: 48, activities: 12, meetings: 4, confirmed_contributions: '2500000.00', upcoming_meetings: [{ title: 'Kết nối cộng đồng', start_time: '2099-01-01 08:00:00', location: 'Phòng sinh hoạt' }] };
        else if (pathname.endsWith('/summary')) data = [{ status: 'confirmed', total: '250000.00', count: 1 }];
        else if (pathname === '/api/users') data = [{ id: 1, username: 'ui_test', full_name: 'Minh Anh', email: 'ui@example.test', role, status: 'active', created_at: '2026-10-23' }];
        else {
          const name = pathname.split('/').filter(Boolean).find(value => rows[value]);
          data = rows[name] || [];
          if (/\/\d+$/.test(pathname)) data = data[0];
        }
        if (mode === 'error' && pathname === '/api/manage/clubs') return route.fulfill({ status: 503, json: { success: false, message: 'Lỗi kết nối kiểm thử' } });
        if (mode === 'empty' && pathname === '/api/manage/clubs') data = [];
        if (pathname === '/api/manage/clubs' && url.searchParams.get('limit') === '100') {
          if (mode === 'lookup-error') return route.fulfill({ status: 503, json: { success: false, message: 'Không tải được danh sách câu lạc bộ' } });
          if (mode === 'lookup-empty') data = [];
          if (mode === 'lookup-pages') {
            const next = url.searchParams.get('page') === '2';
            data = next ? [{ id: '9007199254740993', name: 'CLB trang hai <script>', status: 'active' }] : [...rows.clubs, { id: 2, name: 'CLB đã ngừng', status: 'inactive' }];
            return route.fulfill({ json: { success: true, data, pagination: { page: next ? 2 : 1, totalPages: 2 } } });
          }
        }
        return route.fulfill({ json: { success: true, data, pagination: { page: 1, total: Array.isArray(data) ? data.length : 1, totalPages: 1, limit: 20 } } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const screens = ['index', 'dashboard', 'clubs', 'members', 'activities', 'meetings', 'contributions', 'profile', ...(role === 'admin' ? ['users'] : [])];
      for (const screen of screens) {
        anonymous = screen === 'login';
        for (const width of [1440, 768, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(`${base}/${screen}.html`);
          await page.waitForTimeout(180);
          if (role === 'admin') await page.screenshot({ path: path.join(output, `${screen}-${width}.png`), fullPage: true });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${screen}/${role}/${width}: horizontal overflow`);
          if (screen !== 'index') {
            await page.locator('#identity-name').filter({ hasText: 'Minh Anh' }).waitFor({ state: 'attached' });
            assert.equal(await page.locator('#navigation a[href="users.html"]').count(), role === 'admin' ? 1 : 0);
            if (resources[screen]) assert.equal(await page.locator('#create').isVisible(), role !== 'viewer');
            if (width === 390) {
              await page.locator('#menu-toggle').click();
              assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
              await page.keyboard.press('Escape');
              assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
            }
          }
          checks++;
        }
      }
      if (role === 'admin') {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(base + '/clubs.html');
        await page.locator('#create').click();
        await page.locator('#field-name').waitFor({ state: 'visible' });
        await page.screenshot({ path: path.join(output, 'club-form.png') });
        await page.locator('#cancel-editor').click();
        assert.equal(await page.locator('#editor').isVisible(), false);
        await page.locator('#theme-toggle').click();
        await page.reload();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        await page.screenshot({ path: path.join(output, 'clubs-dark.png') });
        await page.goto(base + '/users.html');
        await page.locator('#open-create-modal-btn').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#user-modal').isVisible(), false);
        mode = 'empty';
        await page.goto(base + '/clubs.html');
        await page.getByText('Không có dữ liệu phù hợp.').waitFor();
        await page.screenshot({ path: path.join(output, 'empty-dark.png') });
        mode = 'error';
        await page.reload();
        await page.getByText('Lỗi kết nối kiểm thử').first().waitFor();
        await page.screenshot({ path: path.join(output, 'error-dark.png') });
        checks += 5;
        mode = 'lookup-pages';
        await page.goto(base + '/members.html'); await page.locator('#create').click();
        await page.locator('#field-club_id').selectOption('9007199254740993');
        assert.equal(await page.locator('#field-club_id option:checked').textContent(), 'CLB trang hai <script>');
        assert.equal(await page.locator('#field-club_id option[value="2"]').isDisabled(), true);
        await page.locator('#field-full_name').fill('Kiểm thử danh sách phân trang');
        await page.locator('#field-email').fill('selection@example.test');
        const submitted = page.waitForRequest(request => new URL(request.url()).pathname === '/api/members' && request.method() === 'POST');
        await page.locator('#save').click();
        assert.equal((await submitted).postDataJSON().club_id, '9007199254740993');
        mode = 'lookup-empty';
        await page.goto(base + '/members.html'); await page.locator('#create').click();
        await page.locator('#field-club_id').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#field-club_id option').count(), 1);
        assert.equal(await page.locator('#field-club_id').evaluate(node => node.checkValidity()), false);
        await page.locator('#cancel-editor').click();
        mode = 'lookup-error'; await page.reload();
        await page.getByText('Không tải được danh sách câu lạc bộ').waitFor();
        assert.equal(await page.locator('#field-club_id').count(), 0);
        assert.equal(await page.locator('#create').isVisible(), false);
        checks += 3;
        mode = 'normal';
        for (const screen of [...screens, 'login']) {
          anonymous = screen === 'login';
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`${base}/${screen}.html`);
            await page.waitForTimeout(180);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${screen}/dark/${width}: horizontal overflow`);
            await page.screenshot({ path: path.join(output, `${screen}-dark-${width}.png`), fullPage: true });
            checks++;
          }
        }
      }
      assert.deepEqual(errors, [], `${role}: browser exceptions`);
      await context.close();
    }
    {
      const page = await browser.newPage();
      await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { success: false } }));
      await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { success: false, message: 'Thông tin đăng nhập không chính xác' } }));
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base + '/login.html');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(output, `login-${width}.png`) });
        checks++;
      }
      await page.locator('#username').fill('ui_test');
      await page.locator('#password').fill('ui-test-only');
      await page.locator('#submit-btn').click();
      await page.getByRole('alert').filter({ hasText: 'Thông tin đăng nhập không chính xác' }).waitFor();
      await page.goto(base + '/dashboard.html');
      await page.waitForURL('**/login.html');
      checks += 2;
    }
    console.log(`UI fixture checks: ${checks} PASS; API mocked, no database accessed`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
