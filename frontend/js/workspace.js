document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  const content = document.getElementById('content');
  const notice = document.getElementById('notice');
  const dialog = document.getElementById('editor');
  const form = document.getElementById('record-form');
  const fields = document.getElementById('fields');
  const error = document.getElementById('form-error');
  const create = document.getElementById('create');
  const labels = { id:'Mã', name:'Tên CLB', description:'Mô tả', founded_date:'Ngày thành lập', status:'Trạng thái', club_id:'Câu lạc bộ', member_id:'Thành viên', full_name:'Họ và tên', email:'Email', phone:'Điện thoại', student_code:'Mã sinh viên', joined_date:'Ngày tham gia', role:'Vai trò', title:'Tiêu đề', location:'Địa điểm', start_time:'Bắt đầu', end_time:'Kết thúc', max_participants:'Số người tối đa', agenda:'Nội dung', notes:'Ghi chú', amount:'Số tiền', contribution_date:'Ngày đóng góp', payment_method:'Phương thức', created_at:'Ngày tạo', updated_at:'Cập nhật' };
  const values = { active:'Hoạt động', inactive:'Ngừng hoạt động', member:'Thành viên', leader:'Chủ nhiệm', vice_leader:'Phó chủ nhiệm', planned:'Dự kiến', ongoing:'Đang diễn ra', completed:'Hoàn tất', cancelled:'Đã hủy', scheduled:'Đã lên lịch', pending:'Chờ xác nhận', confirmed:'Đã xác nhận', cash:'Tiền mặt', bank_transfer:'Chuyển khoản', other:'Khác' };
  const pages = { dashboard:'Tổng quan', clubs:'Câu lạc bộ', members:'Thành viên', activities:'Hoạt động', meetings:'Lịch họp', contributions:'Đóng góp', profile:'Hồ sơ' };
  let user, csrf, catalog, currentPage = 1, editingId = null, generation = 0;
  let search, status, club, listing, pagination;
  let references = { clubs: [], members: [] }, editorOpening = false;
  const endpoint = name => name === 'clubs' ? '/api/manage/clubs' : `/api/${name}`;
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
  const button = (label, action) => { const node = el('button', label, 'btn btn-outline btn-sm'); node.type = 'button'; node.addEventListener('click', action); return node; };
  async function api(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', 'X-CSRF-Token':csrf || '', ...options.headers } });
    const result = await response.json();
    if (response.status === 401) { window.location.href = 'login.html'; throw new Error('Phiên đã hết hạn. Vui lòng đăng nhập lại.'); }
    if (!response.ok || result.success === false) throw new Error(result.message || 'Không thể xử lý yêu cầu');
    return result;
  }
  function display(key, value) {
    if (value === null || value === undefined) return '—';
    if (key === 'club_id' || key === 'member_id') {
      const name = key === 'club_id' ? 'clubs' : 'members';
      const row = references[name].find(item => String(item.id) === String(value));
      return row ? referenceLabel(name, row) : 'Không tìm thấy ' + labels[key].toLowerCase();
    }
    if (key.endsWith('_time') || key.endsWith('_at')) { const date = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z')); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN'); }
    return values[value] || String(value);
  }
  async function referenceRows(name) {
    const rows = [];
    for (let pageNumber = 1; ; pageNumber++) {
      const result = await api(endpoint(name) + '?limit=100&page=' + pageNumber);
      rows.push(...result.data);
      if (pageNumber >= result.pagination.totalPages) return rows;
    }
  }
  async function refreshReferences() {
    if (page === 'clubs') return;
    const clubs = await referenceRows('clubs');
    const members = page === 'contributions' ? await referenceRows('members') : [];
    references = { clubs, members };
    if (club) populateReference(club, 'club_id', club.value, true);
  }
  function referenceLabel(name, row) {
    if (name === 'clubs') {
      const duplicate = references.clubs.filter(item => item.name === row.name).length > 1;
      return row.name + (duplicate ? ' (#' + row.id + ')' : '');
    }
    const parent = references.clubs.find(item => String(item.id) === String(row.club_id));
    return row.full_name + ' — ' + row.email + (parent ? ' · ' + referenceLabel('clubs', parent) : '');
  }
  function populateReference(select, key, selected = '', filter = false) {
    select.setCustomValidity('');
    const name = key === 'club_id' ? 'clubs' : 'members';
    const rows = references[name];
    select.replaceChildren(new Option(filter ? 'Tất cả câu lạc bộ' : 'Chọn ' + labels[key].toLowerCase(), ''));
    for (const row of rows) {
      const parent = name === 'members' ? references.clubs.find(item => String(item.id) === String(row.club_id)) : null;
      const inactive = row.status === 'inactive' || parent?.status === 'inactive';
      const option = new Option(referenceLabel(name, row) + (inactive ? ' · Ngừng hoạt động' : ''), String(row.id));
      option.disabled = !filter && inactive && String(row.id) !== String(selected);
      select.append(option);
    }
    if (selected && !rows.some(row => String(row.id) === String(selected))) {
      select.append(new Option('Liên kết hiện tại không còn trong danh sách', String(selected)));
      select.setCustomValidity('Vui lòng chọn lại ' + labels[key].toLowerCase());
    }
    select.value = String(selected);
    select.addEventListener('change', () => select.setCustomValidity(''), { once: true });
  }
  document.getElementById('signout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method:'POST' }); window.location.href = 'login.html'; } catch (err) { notice.textContent = err.message; }
  });
  document.getElementById('close-editor').addEventListener('click', () => dialog.close());
  try {
    const auth = await api('/api/auth/me'); user = auth.data.user; csrf = auth.data.csrfToken;
    window.ClubUI.mount(user, page);
    if (page === 'dashboard') { await dashboard(); return; }
    if (page === 'profile') { profile(); return; }
    catalog = (await api('/api/catalog')).data;
    if (!catalog[page]) throw new Error('Trang không tồn tại');
    if (['admin', 'manager'].includes(user.role)) create.classList.remove('hidden');
    create.addEventListener('click', () => openEditor().catch(showError));
    await resourcePage();
  } catch (err) { create.classList.add('hidden'); content.textContent = err.message; content.append(button('Thử lại', () => window.location.reload())); }

  async function dashboard() {
    content.textContent = 'Đang tải số liệu...';
    const data = (await api('/api/dashboard')).data;
    content.textContent = '';
    const grid = el('div', undefined, 'metric-grid');
    for (const [key, label] of [['clubs','Câu lạc bộ'],['members','Thành viên'],['activities','Hoạt động'],['meetings','Lịch họp'],['confirmed_contributions','Đóng góp đã xác nhận']]) {
      const card = el('div', undefined, 'metric');
      const icon = el('span', undefined, 'metric-icon');
      icon.append(window.ClubUI.icon(key === 'confirmed_contributions' ? 'contributions' : key));
      card.append(icon, el('span', label), el('strong', key === 'confirmed_contributions' ? String(data[key]).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : data[key]));
      grid.append(card);
    }
    const meetings = el('section', undefined, 'card');
    const header = el('div', undefined, 'section-header');
    header.append(el('h2', 'Lịch họp sắp tới'), button('Làm mới', () => dashboard().catch(err => { notice.textContent = err.message; })));
    const list = el('div', undefined, 'meeting-list');
    if (!data.upcoming_meetings.length) list.append(el('p', 'Chưa có lịch họp sắp tới.', 'state-container state-empty'));
    for (const meeting of data.upcoming_meetings) {
      const item = el('div', undefined, 'meeting-item');
      const icon = el('span', undefined, 'metric-icon'); icon.append(window.ClubUI.icon('meetings'));
      const copy = el('div', undefined, 'meeting-copy');
      copy.append(el('strong', meeting.title), el('small', `${display('start_time',meeting.start_time)} · ${meeting.location || 'Chưa có địa điểm'}`));
      item.append(icon, copy); list.append(item);
    }
    meetings.append(header, list); content.append(grid, meetings);
  }

  function profile() {
    content.textContent = '';
    const summary = el('div', undefined, 'profile-summary');
    const avatar = el('span', document.getElementById('avatar').textContent, 'avatar');
    const info = el('div'); info.append(el('h2', user.full_name || user.username), el('p', `${user.username} · ${user.email} · ${user.role}`));
    summary.append(avatar, info); content.append(summary, el('h2', 'Đổi mật khẩu'), el('p', 'Sử dụng mật khẩu ít nhất 8 ký tự. Các phiên khác sẽ được thu hồi sau khi đổi.', 'section-subtitle'));
    const passwordForm = el('form', undefined, 'profile');
    for (const [key,label] of [['current_password','Mật khẩu hiện tại'],['new_password','Mật khẩu mới'],['confirm_password','Xác nhận mật khẩu mới']]) { const input=el('input',undefined,'form-control'); input.id=key; input.name=key; input.type='password'; input.required=true; input.maxLength=1024; input.autocomplete=key === 'current_password'?'current-password':'new-password'; if(key!=='current_password') input.minLength=8; const caption=el('label',label); caption.htmlFor=key; passwordForm.append(caption,input); }
    const submit=el('button','Đổi mật khẩu','btn btn-primary'); submit.type='submit'; passwordForm.append(submit); content.append(passwordForm);
    passwordForm.addEventListener('submit',async event=>{ event.preventDefault(); const data=Object.fromEntries(new FormData(passwordForm)); if(data.new_password!==data.confirm_password) { notice.textContent='Xác nhận mật khẩu không khớp'; return; } submit.disabled=true; try { await api('/api/auth/password',{method:'PUT',body:JSON.stringify({current_password:data.current_password,new_password:data.new_password})}); passwordForm.reset(); notice.textContent='Đã đổi mật khẩu và thu hồi các phiên khác.'; } catch(err) { notice.textContent=err.message; } finally {submit.disabled=false;} });
  }

  async function resourcePage() {
    await refreshReferences();
    content.textContent='';
    const toolbar=el('div',undefined,'toolbar');
    search=el('input',undefined,'form-control'); search.placeholder='Tìm kiếm...'; search.setAttribute('aria-label','Tìm kiếm'); search.maxLength=200;
    status=el('select',undefined,'form-control'); status.setAttribute('aria-label','Trạng thái'); status.append(new Option('Tất cả trạng thái','')); for(const value of catalog[page].fields.status.values) status.append(new Option(values[value]||value,value));
    toolbar.append(search,status);
    if(page!=='clubs') {club=el('select',undefined,'form-control');club.setAttribute('aria-label','Lọc theo câu lạc bộ');populateReference(club,'club_id','',true);club.addEventListener('change',()=>{currentPage=1;load().catch(showError);});toolbar.append(club);}
    toolbar.append(button('Tìm / làm mới',()=>{currentPage=1; load().catch(showError);}));
    listing=el('div'); pagination=el('div',undefined,'pagination-bar'); content.append(toolbar,listing,pagination);
    status.addEventListener('change',()=>{currentPage=1;load().catch(showError);});
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){currentPage=1;load().catch(showError);}});
    await load();
  }
  function showError(err){ notice.textContent=err.message; }
  async function load(){
    const version=++generation; listing.replaceChildren(el('div','Đang tải...','state-container')); listing.setAttribute('aria-busy','true'); pagination.textContent='';
    const query=new URLSearchParams({page:String(currentPage),limit:'20'}); if(search.value.trim()) query.set('q',search.value.trim()); if(status.value) query.set('status',status.value); if(club?.value) query.set('club_id',club.value);
    let result;
    try { result=await api(endpoint(page)+'?'+query); } catch(err){if(version===generation){listing.setAttribute('aria-busy','false');listing.replaceChildren(el('p',err.message,'state-container state-error'));listing.append(button('Thử lại',()=>load().catch(showError)));}return;}
    if(version!==generation)return;
    listing.textContent=''; listing.setAttribute('aria-busy','false');
    if(!result.data.length){const empty=el('div',undefined,'state-container state-empty');empty.append(el('p','Không có dữ liệu phù hợp.','empty-title'),el('p','Thử thay đổi từ khóa hoặc bộ lọc để tìm lại.','empty-desc'));listing.append(empty);}
    else {
      const wrap=el('div',undefined,'table-responsive'); wrap.tabIndex=0;wrap.setAttribute('aria-label','Bảng dữ liệu, cuộn ngang để xem thêm');const table=el('table',undefined,'data-table'); table.setAttribute('aria-label',pages[page]);const head=el('tr');
      const columns=['id',...Object.keys(catalog[page].fields).filter(key=>!['description','agenda','notes'].includes(key))]; for(const key of columns)head.append(el('th',labels[key]||key));head.append(el('th','Thao tác'));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');
      for(const row of result.data){const tr=el('tr');for(const key of columns){const cell=el('td');if(key==='status'){const badge=el('span',display(key,row[key]),'badge '+(['active','confirmed','completed'].includes(row[key])?'badge-active':['cancelled','inactive'].includes(row[key])?'badge-inactive':'badge-manager'));cell.append(badge);}else cell.textContent=display(key,row[key]);tr.append(cell);}const actions=el('td');const group=el('div',undefined,'row-actions');group.append(button('Chi tiết',()=>details(row.id).catch(showError)));if(['admin','manager'].includes(user.role)){group.append(button('Sửa',()=>openEditor(row).catch(showError)),button('Ngừng / Hủy',async()=>{if(!confirm('Ngừng hoạt động hoặc hủy bản ghi này? Lịch sử vẫn được giữ.'))return;try{await api(endpoint(page)+'/'+row.id,{method:'DELETE'});notice.textContent='Đã cập nhật trạng thái';await load();}catch(err){showError(err);}}));}actions.append(group);tr.append(actions);tbody.append(tr);}table.append(tbody);wrap.append(table);listing.append(wrap);
    }
    const info=result.pagination;pagination.append(el('span',`${info.total} bản ghi · Trang ${info.page}/${info.totalPages}`));const controls=el('div',undefined,'pagination-controls');const prev=button('Trước',()=>{currentPage--;load().catch(showError);});prev.disabled=currentPage<=1;const next=button('Sau',()=>{currentPage++;load().catch(showError);});next.disabled=currentPage>=info.totalPages;controls.append(prev,next);pagination.append(controls);
    if(page==='contributions'){try{const summary=(await api('/api/contributions/summary?'+query)).data;if(version===generation)pagination.append(el('p',summary.map(row=>`${values[row.status]}: ${row.total} (${row.count} bản ghi)`).join(' · ')||'Chưa có đóng góp'));}catch(err){showError(err);}}
  }

  document.getElementById('cancel-editor').addEventListener('click', () => dialog.close());

  async function details(id){const row=(await api(endpoint(page)+'/'+id)).data;editingId=null;fields.textContent='';document.getElementById('editor-title').textContent='Chi tiết #'+id;const dl=el('dl',undefined,'detail-grid');for(const [key,value]of Object.entries(row)){dl.append(el('dt',labels[key]||key),el('dd',display(key,value)));}fields.append(dl);error.textContent='';document.getElementById('save').classList.add('hidden');dialog.showModal();}
  async function openEditor(row){
    if(editorOpening)return;
    editorOpening=true;create.disabled=true;
    try { await refreshReferences(); } finally { editorOpening=false;create.disabled=false; }
    editingId=row?.id||null;fields.textContent='';error.textContent='';document.getElementById('save').classList.remove('hidden');document.getElementById('editor-title').textContent=row?'Chỉnh sửa #'+row.id:'Thêm '+catalog[page].label.toLowerCase();
    for(const[key,spec]of Object.entries(catalog[page].fields)){
      const caption=el('label',(labels[key]||key)+(spec.required?' *':''));caption.htmlFor='field-'+key;let input;
      if(spec.type==='id'){input=el('select',undefined,'form-control');populateReference(input,key,row?.[key]??'');}
      else if(spec.type==='enum'){input=el('select',undefined,'form-control');for(const value of spec.values)input.append(new Option(values[value]||value,value));}
      else if(spec.max>1000)input=el('textarea',undefined,'form-control');
      else{input=el('input',undefined,'form-control');input.type=spec.type==='date'?'date':spec.type==='datetime'?'datetime-local':spec.type==='email'?'email':['id','integer','money'].includes(spec.type)?'number':'text';if(['id','integer'].includes(spec.type)){input.min='1';input.step='1';}if(spec.type==='money'){input.min='.01';input.step='.01';}}
      input.id='field-'+key;input.name=key;input.required=Boolean(spec.required);if(spec.max)input.maxLength=spec.max;
      let value=row?.[key]??spec.default??'';
      if(spec.type==='datetime'&&value){const d=new Date(String(value).replace(' ','T')+'Z');const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);value=local.toISOString().slice(0,16);}
      input.value=value;fields.append(caption,input);
      if(spec.type==='id'){const helper=el('small',key==='club_id'?'Chọn câu lạc bộ hiện có. Nếu chưa có, hãy tạo câu lạc bộ trước.':'Chọn thành viên theo họ tên, email và câu lạc bộ. Nếu chưa có, hãy thêm thành viên trước.','form-text');fields.append(helper);}
    }
    dialog.showModal();
  }
  form.addEventListener('submit',async event=>{event.preventDefault();const save=document.getElementById('save');save.disabled=true;error.textContent='';try{const data=Object.fromEntries(new FormData(form));for(const[key,spec]of Object.entries(catalog[page].fields)){if(data[key]==='')data[key]=null;else if(spec.type==='datetime')data[key]=new Date(data[key]).toISOString().slice(0,19).replace('T',' ');}await api(endpoint(page)+(editingId?'/'+editingId:''),{method:editingId?'PUT':'POST',body:JSON.stringify(data)});dialog.close();notice.textContent='Đã lưu thành công';await load();}catch(err){error.textContent=err.message;}finally{save.disabled=false;}});
});
