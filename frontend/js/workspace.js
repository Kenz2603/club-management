document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  const content = document.getElementById('content');
  const notice = document.getElementById('notice');
  const dialog = document.getElementById('editor');
  const form = document.getElementById('record-form');
  const fields = document.getElementById('fields');
  const error = document.getElementById('form-error');
  const create = document.getElementById('create');
  const labels = { id:'Mã', name:'Tên CLB', description:'Mô tả', founded_date:'Ngày thành lập', status:'Trạng thái', club_id:'CLB (ID)', member_id:'Thành viên (ID)', full_name:'Họ và tên', email:'Email', phone:'Điện thoại', student_code:'Mã sinh viên', joined_date:'Ngày tham gia', role:'Vai trò', title:'Tiêu đề', location:'Địa điểm', start_time:'Bắt đầu', end_time:'Kết thúc', max_participants:'Số người tối đa', agenda:'Nội dung', notes:'Ghi chú', amount:'Số tiền', contribution_date:'Ngày đóng góp', payment_method:'Phương thức', created_at:'Ngày tạo', updated_at:'Cập nhật' };
  const values = { active:'Hoạt động', inactive:'Ngừng hoạt động', member:'Thành viên', leader:'Chủ nhiệm', vice_leader:'Phó chủ nhiệm', planned:'Dự kiến', ongoing:'Đang diễn ra', completed:'Hoàn tất', cancelled:'Đã hủy', scheduled:'Đã lên lịch', pending:'Chờ xác nhận', confirmed:'Đã xác nhận', cash:'Tiền mặt', bank_transfer:'Chuyển khoản', other:'Khác' };
  const pages = { dashboard:'Tổng quan', clubs:'Câu lạc bộ', members:'Thành viên', activities:'Hoạt động', meetings:'Lịch họp', contributions:'Đóng góp', profile:'Hồ sơ' };
  let user, csrf, catalog, currentPage = 1, editingId = null, generation = 0;
  let search, status, club, listing, pagination;
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
    if (key.endsWith('_time') || key.endsWith('_at')) { const date = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z')); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN'); }
    return values[value] || String(value);
  }
  document.getElementById('signout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method:'POST' }); window.location.href = 'login.html'; } catch (err) { notice.textContent = err.message; }
  });
  document.getElementById('close-editor').addEventListener('click', () => dialog.close());
  try {
    const auth = await api('/api/auth/me'); user = auth.data.user; csrf = auth.data.csrfToken;
    document.getElementById('identity').textContent = `${user.full_name} (${user.role})`;
    const navigation = document.getElementById('navigation');
    for (const [key, label] of Object.entries(pages)) { const link = el('a', label); link.href = key + '.html'; if (key === page) link.setAttribute('aria-current', 'page'); navigation.append(link); }
    if (user.role === 'admin') { const link = el('a', 'Tài khoản'); link.href = 'users.html'; navigation.append(link); }
    if (page === 'dashboard') { await dashboard(); return; }
    if (page === 'profile') { profile(); return; }
    catalog = (await api('/api/catalog')).data;
    if (!catalog[page]) throw new Error('Trang không tồn tại');
    if (['admin', 'manager'].includes(user.role)) create.classList.remove('hidden');
    create.addEventListener('click', () => openEditor().catch(showError));
    await resourcePage();
  } catch (err) { content.textContent = err.message; content.append(button('Thử lại', () => window.location.reload())); }

  async function dashboard() {
    content.textContent = 'Đang tải số liệu...';
    const data = (await api('/api/dashboard')).data;
    content.textContent = '';
    const grid = el('div', undefined, 'metric-grid');
    for (const [key, label] of [['clubs','Câu lạc bộ'],['members','Thành viên'],['activities','Hoạt động'],['meetings','Lịch họp'],['confirmed_contributions','Đóng góp đã xác nhận']]) { const card = el('div', label, 'metric'); card.append(el('strong', key === 'confirmed_contributions' ? String(data[key]).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : data[key])); grid.append(card); }
    content.append(grid, el('h2', 'Lịch họp sắp tới'));
    if (!data.upcoming_meetings.length) content.append(el('p', 'Chưa có lịch họp sắp tới.'));
    for (const meeting of data.upcoming_meetings) content.append(el('p', `${meeting.title} · ${display('start_time',meeting.start_time)} · ${meeting.location || 'Chưa có địa điểm'}`));
    content.append(button('Làm mới', () => dashboard().catch(err => { notice.textContent = err.message; })));
  }

  function profile() {
    content.textContent = '';
    content.append(el('p', `${user.username} · ${user.email} · ${user.role}`), el('h2', 'Đổi mật khẩu'));
    const passwordForm = el('form', undefined, 'profile');
    for (const [key,label] of [['current_password','Mật khẩu hiện tại'],['new_password','Mật khẩu mới'],['confirm_password','Xác nhận mật khẩu mới']]) { const input=el('input',undefined,'form-control'); input.id=key; input.name=key; input.type='password'; input.required=true; input.maxLength=1024; input.autocomplete=key === 'current_password'?'current-password':'new-password'; if(key!=='current_password') input.minLength=8; const caption=el('label',label); caption.htmlFor=key; passwordForm.append(caption,input); }
    const submit=el('button','Đổi mật khẩu','btn btn-primary'); submit.type='submit'; passwordForm.append(submit); content.append(passwordForm);
    passwordForm.addEventListener('submit',async event=>{ event.preventDefault(); const data=Object.fromEntries(new FormData(passwordForm)); if(data.new_password!==data.confirm_password) { notice.textContent='Xác nhận mật khẩu không khớp'; return; } submit.disabled=true; try { await api('/api/auth/password',{method:'PUT',body:JSON.stringify({current_password:data.current_password,new_password:data.new_password})}); passwordForm.reset(); notice.textContent='Đã đổi mật khẩu và thu hồi các phiên khác.'; } catch(err) { notice.textContent=err.message; } finally {submit.disabled=false;} });
  }

  async function resourcePage() {
    content.textContent='';
    const toolbar=el('div',undefined,'toolbar');
    search=el('input',undefined,'form-control'); search.placeholder='Tìm kiếm...'; search.setAttribute('aria-label','Tìm kiếm'); search.maxLength=200;
    status=el('select',undefined,'form-control'); status.setAttribute('aria-label','Trạng thái'); status.append(new Option('Tất cả trạng thái','')); for(const value of catalog[page].fields.status.values) status.append(new Option(values[value]||value,value));
    toolbar.append(search,status);
    if(page!=='clubs') {club=el('input',undefined,'form-control'); club.placeholder='Lọc theo ID câu lạc bộ'; club.type='number'; club.min='1'; club.setAttribute('aria-label','Lọc theo ID câu lạc bộ'); toolbar.append(club);}
    toolbar.append(button('Tìm / làm mới',()=>{currentPage=1; load().catch(showError);}));
    listing=el('div'); pagination=el('div',undefined,'pagination-bar'); content.append(toolbar,listing,pagination);
    status.addEventListener('change',()=>{currentPage=1;load().catch(showError);});
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){currentPage=1;load().catch(showError);}});
    await load();
  }
  function showError(err){ notice.textContent=err.message; }
  async function load(){
    const version=++generation; listing.textContent='Đang tải...'; pagination.textContent='';
    const query=new URLSearchParams({page:String(currentPage),limit:'20'}); if(search.value.trim()) query.set('q',search.value.trim()); if(status.value) query.set('status',status.value); if(club?.value) query.set('club_id',club.value);
    let result;
    try { result=await api(endpoint(page)+'?'+query); } catch(err){if(version===generation){listing.textContent=err.message;listing.append(button('Thử lại',()=>load().catch(showError)));}return;}
    if(version!==generation)return;
    listing.textContent='';
    if(!result.data.length){listing.append(el('p','Không có dữ liệu phù hợp.'));}
    else {
      const wrap=el('div',undefined,'table-responsive'); const table=el('table',undefined,'data-table'); const head=el('tr');
      const columns=['id',...Object.keys(catalog[page].fields).filter(key=>!['description','agenda','notes'].includes(key))]; for(const key of columns)head.append(el('th',labels[key]||key));head.append(el('th','Thao tác'));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');
      for(const row of result.data){const tr=el('tr');for(const key of columns)tr.append(el('td',display(key,row[key])));const actions=el('td');const group=el('div',undefined,'row-actions');group.append(button('Chi tiết',()=>details(row.id).catch(showError)));if(['admin','manager'].includes(user.role)){group.append(button('Sửa',()=>openEditor(row).catch(showError)),button('Ngừng / Hủy',async()=>{if(!confirm('Ngừng hoạt động hoặc hủy bản ghi này? Lịch sử vẫn được giữ.'))return;try{await api(endpoint(page)+'/'+row.id,{method:'DELETE'});notice.textContent='Đã cập nhật trạng thái';await load();}catch(err){showError(err);}}));}actions.append(group);tr.append(actions);tbody.append(tr);}table.append(tbody);wrap.append(table);listing.append(wrap);
    }
    const info=result.pagination;pagination.append(el('span',`${info.total} bản ghi · Trang ${info.page}/${info.totalPages}`));const controls=el('div',undefined,'pagination-controls');const prev=button('Trước',()=>{currentPage--;load().catch(showError);});prev.disabled=currentPage<=1;const next=button('Sau',()=>{currentPage++;load().catch(showError);});next.disabled=currentPage>=info.totalPages;controls.append(prev,next);pagination.append(controls);
    if(page==='contributions'){try{const summary=(await api('/api/contributions/summary?'+query)).data;if(version===generation)pagination.append(el('p',summary.map(row=>`${values[row.status]}: ${row.total} (${row.count} bản ghi)`).join(' · ')||'Chưa có đóng góp'));}catch(err){showError(err);}}
  }

  async function details(id){const row=(await api(endpoint(page)+'/'+id)).data;editingId=null;fields.textContent='';document.getElementById('editor-title').textContent='Chi tiết #'+id;const dl=el('dl',undefined,'detail-grid');for(const [key,value]of Object.entries(row)){dl.append(el('dt',labels[key]||key),el('dd',display(key,value)));}fields.append(dl);error.textContent='';document.getElementById('save').classList.add('hidden');dialog.showModal();}
  async function openEditor(row){
    editingId=row?.id||null;fields.textContent='';error.textContent='';document.getElementById('save').classList.remove('hidden');document.getElementById('editor-title').textContent=row?'Chỉnh sửa #'+row.id:'Thêm '+catalog[page].label.toLowerCase();
    for(const[key,spec]of Object.entries(catalog[page].fields)){
      const caption=el('label',(labels[key]||key)+(spec.required?' *':''));caption.htmlFor='field-'+key;let input;
      if(spec.type==='enum'){input=el('select',undefined,'form-control');for(const value of spec.values)input.append(new Option(values[value]||value,value));}
      else if(spec.max>1000)input=el('textarea',undefined,'form-control');
      else{input=el('input',undefined,'form-control');input.type=spec.type==='date'?'date':spec.type==='datetime'?'datetime-local':spec.type==='email'?'email':['id','integer','money'].includes(spec.type)?'number':'text';if(['id','integer'].includes(spec.type)){input.min='1';input.step='1';}if(spec.type==='money'){input.min='.01';input.step='.01';}}
      input.id='field-'+key;input.name=key;input.required=Boolean(spec.required);if(spec.max)input.maxLength=spec.max;
      let value=row?.[key]??spec.default??'';
      if(spec.type==='datetime'&&value){const d=new Date(String(value).replace(' ','T')+'Z');const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);value=local.toISOString().slice(0,16);}
      input.value=value;fields.append(caption,input);
      if(spec.type==='id'){const helper=el('small','Nhập ID có trong danh sách tương ứng; hệ thống kiểm tra liên kết khi lưu.','form-text');fields.append(helper);}
    }
    dialog.showModal();
  }
  form.addEventListener('submit',async event=>{event.preventDefault();const save=document.getElementById('save');save.disabled=true;error.textContent='';try{const data=Object.fromEntries(new FormData(form));for(const[key,spec]of Object.entries(catalog[page].fields)){if(data[key]==='')data[key]=null;else if(spec.type==='datetime')data[key]=new Date(data[key]).toISOString().slice(0,19).replace('T',' ');}await api(endpoint(page)+(editingId?'/'+editingId:''),{method:editingId?'PUT':'POST',body:JSON.stringify(data)});dialog.close();notice.textContent='Đã lưu thành công';await load();}catch(err){error.textContent=err.message;}finally{save.disabled=false;}});
});
