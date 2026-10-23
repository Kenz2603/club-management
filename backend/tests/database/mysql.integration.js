const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../../src/config/database');
const app = require('../../src/app');
const { hashPassword } = require('../../src/utils/password');
const { randomBytes } = require('node:crypto');
if(process.env.MYSQL_DATABASE!=='club_management_test'||process.env.DB_HOST!=='127.0.0.1') throw new Error('Isolated test database required');
let server,base,admin,manager,viewer,club,member,activity,meeting,contribution;
const password=randomBytes(16).toString('hex');
async function request(path,method='GET',body,auth){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}: {})},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};}
async function login(username){const result=await request('/api/auth/login','POST',{username,password});assert.equal(result.status,200);return{cookie:result.cookie.split(';')[0],csrf:result.body.data.csrfToken};}
test.before(async()=>{for(const role of ['admin','manager','viewer'])await pool.query('INSERT INTO users (username,email,password_hash,full_name,role) VALUES (?,?,?,?,?)',[role,role+'@example.test',await hashPassword(password),role,role]);server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;admin=await login('admin');manager=await login('manager');viewer=await login('viewer');});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});

test('real MySQL: public signup hashes password, creates only viewer and supports login without membership', async () => {
  const username = 'signup_' + randomBytes(6).toString('hex');
  const input = { username, email: username + '@example.test', full_name: 'Đăng ký kiểm thử', password, confirm_password: password };
  const [before] = await pool.query('SELECT COUNT(*) AS total FROM members');
  const result = await request('/api/auth/register', 'POST', input);
  assert.equal(result.status, 201);
  assert.equal(result.cookie, null);
  assert.equal(result.body.data.user.role, 'viewer');
  assert.equal(JSON.stringify(result.body).includes('password'), false);
  const [rows] = await pool.query('SELECT password_hash, role, status FROM users WHERE username = ?', [username]);
  assert.equal(await require('../../src/utils/password').verifyPassword(password, rows[0].password_hash), true);
  assert.equal(rows[0].role, 'viewer');
  assert.equal(rows[0].status, 'active');
  const [sessions] = await pool.query('SELECT id FROM user_sessions WHERE user_id = ?', [result.body.data.user.id]);
  assert.equal(sessions.length, 0);
  const auth = await login(username);
  assert.equal((await request('/api/users', 'GET', undefined, auth)).status, 403);
  assert.equal((await request('/api/clubs', 'POST', { name: 'Forbidden' }, auth)).status, 403);
  assert.equal((await request('/api/auth/register', 'POST', { ...input, role: 'admin' })).status, 400);
  assert.equal((await request('/api/auth/register', 'POST', { ...input, email: 'different@example.test' })).status, 409);
  assert.equal((await request('/api/auth/register', 'POST', { ...input, username: 'another_signup' })).status, 409);
  const [after] = await pool.query('SELECT COUNT(*) AS total FROM members');
  assert.equal(after[0].total, before[0].total);
});

test('real MySQL: simultaneous signup conflicts preserve unique account', async () => {
  const username = 'race_' + randomBytes(6).toString('hex');
  const input = { username, email: username + '@example.test', full_name: 'Concurrent signup', password, confirm_password: password };
  const results = await Promise.all([request('/api/auth/register', 'POST', input), request('/api/auth/register', 'POST', input)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, input.email]);
  assert.equal(rows.length, 1);
});

test('real browser: signup inline errors, password visibility, responsive registration and viewer login', async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/login.html');
    await page.getByRole('link', { name: 'Tạo tài khoản', exact: true }).click();
    await page.locator('#register-submit').click();
    await page.locator('#error-full_name').filter({ hasText: 'Nhập họ và tên' }).waitFor();
    assert.equal(await page.locator('#full_name').getAttribute('aria-invalid'), 'true');
    const username = 'browser_signup_' + randomBytes(5).toString('hex');
    await page.locator('#full_name').fill('Người đăng ký trình duyệt');
    await page.locator('#email').fill(username + '@example.test');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#confirm_password').fill('wrong');
    await page.locator('#register-submit').click();
    await page.locator('#error-confirm_password').filter({ hasText: 'không khớp' }).waitFor();
    await page.locator('[data-password="password"]').click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.locator('[data-password="password"]').click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'password');
    await page.locator('#password').fill('');
    await page.locator('#confirm_password').fill('');
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1050 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/register-${width}.png`, fullPage: true });
    }
    await page.locator('#theme-toggle').click();
    await page.screenshot({ path: 'artifacts/register-dark-mobile.png', fullPage: true });
    await page.locator('#password').fill(password);
    await page.locator('#confirm_password').fill(password);
    await page.locator('#register-submit').click();
    await page.locator('#register-success').filter({ hasText: 'Đăng ký thành công' }).waitFor();
    await page.waitForURL('**/login.html?registered=1');
    await page.locator('#registration-notice').waitFor({ state: 'visible' });
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#submit-btn').click();
    await page.waitForURL('**/index.html');
    await page.goto(base + '/clubs.html');
    await page.locator('#identity-role').filter({ hasText: 'Người xem' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('#create').isVisible(), false);
    assert.equal(await page.locator('#navigation a[href="users.html"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('real MySQL: health and legacy contract',async()=>{assert.equal((await request('/api/health')).status,200);const result=await request('/api/clubs');assert.equal(result.status,200);assert.equal(result.body.pagination,undefined);});
test('real MySQL: create relational business records',async()=>{
 let result=await request('/api/clubs','POST',{name:'CLB kiểm thử'},manager);assert.equal(result.status,201);club=result.body.data;
 result=await request('/api/members','POST',{club_id:club.id,full_name:'Thành viên thật',email:'member@example.test'},manager);assert.equal(result.status,201);member=result.body.data;
 result=await request('/api/activities','POST',{club_id:club.id,title:'Hoạt động thử',start_time:'2099-01-01 01:00:00',end_time:'2099-01-01 02:00:00'},manager);assert.equal(result.status,201);activity=result.body.data;
 result=await request('/api/meetings','POST',{club_id:club.id,title:'Họp kiểm thử',start_time:'2099-01-02 01:00:00',end_time:'2099-01-02 02:00:00'},manager);assert.equal(result.status,201);meeting=result.body.data;
 result=await request('/api/contributions','POST',{member_id:member.id,amount:'100.50',contribution_date:'2026-10-18',status:'confirmed'},manager);assert.equal(result.status,201);contribution=result.body.data;
});
test('real MySQL: viewer reads, cannot write or escalate',async()=>{assert.equal((await request('/api/members','GET',undefined,viewer)).status,200);assert.equal((await request('/api/clubs','POST',{name:'Forbidden'},viewer)).status,403);assert.equal((await request('/api/users/3','PUT',{role:'admin'},viewer)).status,403);});
test('real MySQL: updates and pagination with bound injection attempt',async()=>{assert.equal((await request('/api/members/'+member.id,'PUT',{full_name:'Đã cập nhật'},manager)).status,200);const result=await request('/api/members?q='+encodeURIComponent("' OR 1=1 --"),'GET',undefined,viewer);assert.equal(result.body.data.length,0);assert.equal((await request('/api/manage/clubs?limit=1','GET',undefined,viewer)).body.pagination.limit,1);});
test('real MySQL: unique, FK and CHECK constraints enforced',async()=>{
 assert.equal((await request('/api/members','POST',{club_id:club.id,full_name:'Trùng',email:'member@example.test'},manager)).status,409);
 await assert.rejects(pool.query('INSERT INTO members (club_id,full_name,email) VALUES (?,?,?)',['999999','Invalid','x@example.test']),error=>error.code==='ER_NO_REFERENCED_ROW_2');
 await assert.rejects(pool.query('INSERT INTO contributions (member_id,amount,contribution_date) VALUES (?,-1,CURRENT_DATE)',[member.id]),error=>error.code==='ER_CHECK_CONSTRAINT_VIOLATED');
 assert.equal((await request('/api/activities/'+activity.id,'PUT',{end_time:'2000-01-01 00:00:00'},manager)).status,400);
});
test('real MySQL: dashboard and exact contribution totals',async()=>{const data=(await request('/api/dashboard','GET',undefined,viewer)).body.data;assert.equal(Number(data.members),1);assert.equal(data.confirmed_contributions,'100.50');assert.equal(data.upcoming_meetings.length,1);const summary=(await request('/api/contributions/summary?club_id='+club.id,'GET',undefined,viewer)).body.data;assert.equal(summary[0].total,'100.50');});
test('real browser: login, business form, mobile layout, profile and logout',async()=>{
 const{chromium}=require('@playwright/test');const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto(base+'/login.html');await page.locator('#username').fill('manager');await page.locator('#password').fill(password);await page.locator('#submit-btn').click();await page.waitForURL('**/index.html');await page.goto(base+'/clubs.html');await page.locator('#create').waitFor({state:'visible'});await page.locator('#create').click();await page.locator('#field-name').fill('CLB từ trình duyệt');await page.locator('#save').click();await page.locator('#notice').filter({hasText:'Đã lưu thành công'}).waitFor();await page.getByRole('cell',{name:'CLB từ trình duyệt',exact:true}).waitFor();await page.screenshot({path:'artifacts/e2e-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.goto(base+'/dashboard.html');await page.locator('.metric').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'artifacts/e2e-mobile.png',fullPage:true});await page.goto(base+'/profile.html');await page.locator('#new_password').waitFor();await page.locator('#signout').click();await page.waitForURL('**/login.html');}finally{await browser.close();}
});
test('real browser: viewer permissions and admin user management',async()=>{
 const{chromium}=require('@playwright/test');const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto(base+'/login.html');await page.locator('#username').fill('viewer');await page.locator('#password').fill(password);await page.locator('#submit-btn').click();await page.waitForURL('**/index.html');
  await page.goto(base+'/members.html');await page.locator('#identity').filter({hasText:'viewer'}).waitFor();assert.equal(await page.locator('#create').isVisible(),false);assert.equal(await page.getByRole('link',{name:'Tài khoản',exact:true}).count(),0);await page.locator('#signout').click();await page.waitForURL('**/login.html');
  await page.locator('#username').fill('admin');await page.locator('#password').fill(password);await page.locator('#submit-btn').click();await page.waitForURL('**/users.html');await page.locator('#open-create-modal-btn').click();await page.locator('#user-modal-username').fill('browser_user');await page.locator('#user-modal-email').fill('browser@example.test');await page.locator('#user-modal-fullname').fill('Tài khoản trình duyệt');await page.locator('#user-modal-password').fill(randomBytes(16).toString('hex'));await page.locator('#save-user-btn').click();await page.getByRole('cell',{name:'browser_user',exact:true}).waitFor();await page.locator('#search-input').fill('browser_user');await page.getByRole('cell',{name:'browser_user',exact:true}).waitFor();
 }finally{await browser.close();}
});
test('real browser: select club/member names while preserving foreign keys and edit selection', async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/login.html');
    await page.locator('#username').fill('manager'); await page.locator('#password').fill(password);
    await page.locator('#submit-btn').click(); await page.waitForURL('**/index.html');
    await page.goto(base + '/members.html');
    await page.locator('#create').click();
    assert.equal(await page.locator('#field-club_id').evaluate(node => node.tagName), 'SELECT');
    await page.locator('#field-club_id').selectOption(String(club.id));
    assert.match(await page.locator('#field-club_id option:checked').textContent(), /CLB kiểm thử/);
    await page.locator('#field-full_name').fill('Thành viên chọn theo tên');
    await page.locator('#field-email').fill('name-selector@example.test');
    await page.screenshot({ path: 'artifacts/reference-member-form.png', fullPage: true });
    const createdResponse = page.waitForResponse(response => response.url() === base + '/api/members' && response.request().method() === 'POST');
    await page.locator('#save').click();
    const created = await createdResponse;
    assert.equal(created.status(), 201);
    assert.equal(created.request().postDataJSON().club_id, String(club.id));
    const selectedMember = (await created.json()).data;
    const row = page.getByRole('row').filter({ hasText: 'name-selector@example.test' });
    await row.getByRole('button', { name: 'Sửa', exact: true }).click();
    assert.equal(await page.locator('#field-club_id').inputValue(), String(club.id));
    await page.locator('#cancel-editor').click();
    const filter = page.getByRole('combobox', { name: 'Lọc theo câu lạc bộ', exact: true });
    const filtered = page.waitForResponse(response => response.url().includes('/api/members?') && new URL(response.url()).searchParams.get('club_id') === String(club.id));
    await filter.selectOption(String(club.id)); await filtered;
    for (const screen of ['activities', 'meetings']) {
      await page.goto(base + '/' + screen + '.html'); await page.locator('#create').click();
      await page.locator('#field-club_id').selectOption(String(club.id));
      assert.match(await page.locator('#field-club_id option:checked').textContent(), /CLB kiểm thử/);
      await page.locator('#cancel-editor').click();
    }
    await page.goto(base + '/contributions.html'); await page.locator('#create').click();
    await page.locator('#field-member_id').selectOption(String(selectedMember.id));
    assert.match(await page.locator('#field-member_id option:checked').textContent(), /Thành viên chọn theo tên.*name-selector@example.test.*CLB kiểm thử/);
    await page.locator('#field-amount').fill('25.00');
    await page.locator('#field-contribution_date').fill('2026-10-23');
    await page.screenshot({ path: 'artifacts/reference-contribution-form.png', fullPage: true });
    const saved = page.waitForResponse(response => response.url() === base + '/api/contributions' && response.request().method() === 'POST');
    await page.locator('#save').click();
    const response = await saved; assert.equal(response.status(), 201);
    assert.equal(response.request().postDataJSON().member_id, String(selectedMember.id));
    await page.getByRole('cell').filter({ hasText: 'Thành viên chọn theo tên' }).waitFor();
  } finally { await browser.close(); }
});

test('real MySQL: soft deletion retains history and adjusts totals',async()=>{assert.equal((await request('/api/contributions/'+contribution.id,'DELETE',undefined,manager)).body.data.status,'cancelled');const[rows]=await pool.query('SELECT id FROM contributions WHERE id=?',[contribution.id]);assert.equal(rows.length,1);assert.equal((await request('/api/dashboard','GET',undefined,viewer)).body.data.confirmed_contributions,'0.00');});
test('real MySQL: password transaction revokes other sessions only',async()=>{const other=await login('viewer');const next=randomBytes(16).toString('hex');assert.equal((await request('/api/auth/password','PUT',{current_password:password,new_password:next},viewer)).status,200);assert.equal((await request('/api/auth/me','GET',undefined,other)).status,401);assert.equal((await request('/api/auth/me','GET',undefined,viewer)).status,200);});
test('real MySQL: last admin cannot demote self',async()=>{const[rows]=await pool.query("SELECT id FROM users WHERE username='admin'");assert.equal((await request('/api/users/'+rows[0].id,'PUT',{role:'viewer'},admin)).status,409);});
test('real MySQL: simultaneous admin demotions retain an active admin',async()=>{
 const users=require('../../src/services/users.service');
 const [insert]=await pool.query('INSERT INTO users (username,email,password_hash,full_name,role) VALUES (?,?,?,?,?)',['second_admin','second@example.test',await hashPassword(password),'Second','admin']);
 const [admins]=await pool.query("SELECT id FROM users WHERE role='admin' AND status='active' ORDER BY id");
 const result=await Promise.allSettled([users.updateUser(admins[0].id,{role:'viewer'},insert.insertId),users.updateUser(insert.insertId,{role:'viewer'},admins[0].id)]);
 const [count]=await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND status='active'");
 assert.equal(Number(count[0].total),1);assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
 await pool.query("UPDATE users SET role='admin' WHERE username='admin'");
 admin=await login('admin');
});
test('real MySQL: admin disable revokes sessions',async()=>{const[rows]=await pool.query("SELECT id FROM users WHERE username='manager'");assert.equal((await request('/api/users/'+rows[0].id+'/status','PATCH',{status:'disabled'},admin)).status,200);assert.equal((await request('/api/auth/me','GET',undefined,manager)).status,401);});

{
  const passwordUtils = require('../../src/utils/password');
  const auth = require('../../src/services/auth.service');
  const users = require('../../src/services/users.service');
  const { hashSessionToken } = require('../../src/utils/session');
  const req = { ip: '127.0.0.1', headers: { 'user-agent': 'isolated-transaction-test' } };

  async function within(promise) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Transaction test barrier timed out')), 5000);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function createUser() {
    const username = 'tx_' + randomBytes(8).toString('hex');
    const password = randomBytes(16).toString('hex');
    const [result] = await pool.query(
      'INSERT INTO users (username,email,password_hash,full_name,role) VALUES (?,?,?,?,?)',
      [username, username + '@example.test', await passwordUtils.hashPassword(password), 'Transaction test', 'viewer']
    );
    return { id: result.insertId, username, password };
  }

  for (const change of ['disable', 'reset password', 'change password']) {
    test(`real MySQL: ${change} completes during login verification and rejects the stale login`, async (t) => {
      const user = await createUser();
      const nextPassword = randomBytes(16).toString('hex');
      const verified = Promise.withResolvers();
      const resume = Promise.withResolvers();
      const verify = passwordUtils.verifyPassword;
      let first = true;
      t.mock.method(passwordUtils, 'verifyPassword', async (...args) => {
        const pause = first;
        first = false;
        const matched = await verify(...args);
        if (pause) {
          assert.equal(matched, true);
          verified.resolve();
          await resume.promise;
        }
        return matched;
      });
      const pending = auth.login(user.username, user.password, req).then(
        value => ({ value }), error => ({ error })
      );
      let mutation;
      try {
        await within(verified.promise);
        if (change === 'disable') mutation = users.updateUserStatus(user.id, 'disabled', 0);
        if (change === 'reset password') mutation = users.resetUserPassword(user.id, nextPassword);
        if (change === 'change password') mutation = auth.changePassword(user.id, user.password, nextPassword, 0);
        await within(mutation);
        resume.resolve();
        const result = await within(pending);
        assert.equal(result.error?.statusCode, 401);
        const [sessions] = await pool.query('SELECT id FROM user_sessions WHERE user_id = ?', [user.id]);
        assert.equal(sessions.length, 0);
        if (change !== 'disable') {
          const fresh = await auth.login(user.username, nextPassword, req);
          assert.equal(Number(fresh.user.id), Number(user.id));
        }
      } finally {
        resume.resolve();
        await Promise.allSettled([pending, mutation]);
      }
    });
  }

  for (const change of ['disable', 'reset password']) {
    test(`real MySQL: concurrent ${change} revokes a session when login takes the user lock first`, async (t) => {
      const user = await createUser();
      const nextPassword = randomBytes(16).toString('hex');
      const locked = Promise.withResolvers();
      const competingLock = Promise.withResolvers();
      const resume = Promise.withResolvers();
      const getConnection = pool.getConnection.bind(pool);
      let connectionCount = 0;
      t.mock.method(pool, 'getConnection', async () => {
        const connection = await getConnection();
        const isLogin = ++connectionCount === 1;
        const query = connection.query.bind(connection);
        t.mock.method(connection, 'query', async (sql, params) => {
          if (isLogin && sql.includes('INSERT INTO user_sessions')) {
            locked.resolve();
            await resume.promise;
          }
          if (!isLogin && sql.includes('FOR UPDATE')) competingLock.resolve();
          return query(sql, params);
        });
        return connection;
      });
      const pending = auth.login(user.username, user.password, req);
      let mutation;
      try {
        await within(locked.promise);
        mutation = change === 'disable'
          ? users.updateUserStatus(user.id, 'disabled', 0)
          : users.resetUserPassword(user.id, nextPassword);
        await within(competingLock.promise);
        resume.resolve();
        const [result] = await within(Promise.all([pending, mutation]));
        const [sessions] = await pool.query(
          'SELECT revoked_at FROM user_sessions WHERE user_id = ? AND token_hash = ?',
          [user.id, hashSessionToken(result.sessionToken)]
        );
        assert.equal(sessions.length, 1);
        assert.ok(sessions[0].revoked_at);
      } finally {
        resume.resolve();
        await Promise.allSettled([pending, mutation]);
      }
    });
  }

  test('real MySQL: last_login_at failure rolls back the session insert', async (t) => {
    const user = await createUser();
    const original = new Error('Injected last_login_at write failure');
    const getConnection = pool.getConnection.bind(pool);
    const mock = t.mock.method(pool, 'getConnection', async () => {
      const connection = await getConnection();
      const query = connection.query.bind(connection);
      t.mock.method(connection, 'query', async (sql, params) => {
        if (sql.includes('UPDATE users SET last_login_at')) throw original;
        return query(sql, params);
      });
      return connection;
    });
    await assert.rejects(auth.login(user.username, user.password, req), error => error === original);
    const [sessions] = await pool.query('SELECT id FROM user_sessions WHERE user_id = ?', [user.id]);
    const [rows] = await pool.query('SELECT last_login_at FROM users WHERE id = ?', [user.id]);
    assert.equal(sessions.length, 0);
    assert.equal(rows[0].last_login_at, null);
    mock.mock.restore();
    assert.equal(Number((await auth.login(user.username, user.password, req)).user.id), Number(user.id));
  });
}
