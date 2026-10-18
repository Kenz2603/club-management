const resources = {
  clubs: { label: 'Câu lạc bộ', search: ['name', 'description'], inactive: 'inactive', fields: {
    name: { type: 'text', max: 150, required: true }, description: { type: 'text', max: 10000 }, founded_date: { type: 'date' }, status: { type: 'enum', values: ['active', 'inactive'], default: 'active' }
  } },
  members: { label: 'Thành viên', search: ['full_name', 'email', 'student_code'], inactive: 'inactive', reference: ['club_id', 'clubs'], fields: {
    club_id: { type: 'id', required: true }, full_name: { type: 'text', max: 150, required: true }, email: { type: 'email', required: true }, phone: { type: 'text', max: 20 }, student_code: { type: 'text', max: 50 }, joined_date: { type: 'date' }, role: { type: 'enum', values: ['member', 'leader', 'vice_leader'], default: 'member' }, status: { type: 'enum', values: ['active', 'inactive'], default: 'active' }
  } },
  activities: { label: 'Hoạt động', search: ['title', 'description', 'location'], inactive: 'cancelled', reference: ['club_id', 'clubs'], fields: {
    club_id: { type: 'id', required: true }, title: { type: 'text', max: 200, required: true }, description: { type: 'text', max: 10000 }, location: { type: 'text', max: 255 }, start_time: { type: 'datetime', required: true }, end_time: { type: 'datetime', required: true }, max_participants: { type: 'integer' }, status: { type: 'enum', values: ['planned', 'ongoing', 'completed', 'cancelled'], default: 'planned' }
  } },
  meetings: { label: 'Lịch họp', search: ['title', 'agenda', 'location'], inactive: 'cancelled', reference: ['club_id', 'clubs'], fields: {
    club_id: { type: 'id', required: true }, title: { type: 'text', max: 200, required: true }, agenda: { type: 'text', max: 10000 }, location: { type: 'text', max: 255 }, start_time: { type: 'datetime', required: true }, end_time: { type: 'datetime', required: true }, status: { type: 'enum', values: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' }, notes: { type: 'text', max: 10000 }
  } },
  contributions: { label: 'Đóng góp', search: ['description'], inactive: 'cancelled', reference: ['member_id', 'members'], fields: {
    member_id: { type: 'id', required: true }, amount: { type: 'money', required: true }, contribution_date: { type: 'date', required: true }, payment_method: { type: 'enum', values: ['cash', 'bank_transfer', 'other'], default: 'cash' }, status: { type: 'enum', values: ['pending', 'confirmed', 'cancelled'], default: 'pending' }, description: { type: 'text', max: 10000 }
  } }
};
module.exports = resources;
