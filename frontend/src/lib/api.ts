import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5055';

export function resolveApiImageUrl(path?: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Local frontend assets located in Next.js public directory
  if (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('images/') ||
    trimmed.startsWith('/icons/') ||
    trimmed.startsWith('icons/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('assets/')
  ) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // For uploaded images (/uploads/...), return relative path so Next.js rewrites proxy them cleanly
  // across all devices (desktop and mobile phones browsing via LAN/Wi-Fi).
  if (cleanPath.startsWith('/uploads/')) {
    return cleanPath;
  }

  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}${cleanPath}`;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function cleanValue(val: unknown): unknown {
  if (typeof val === 'string') {
    return val.replace(/\t/g, ' ').replace(/[\x00-\x1F]/g, '');
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return normalizePayload(val);
  }
  return val;
}

function normalizePayload(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data) || (typeof FormData !== 'undefined' && data instanceof FormData)) return data;
  const raw = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    const cleaned = cleanValue(raw[key]);
    result[key] = cleaned;

    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (snakeKey !== key) {
      result[snakeKey] = cleaned;
    }
  }
  return result;
}

function normalizeDataDeep(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => normalizeDataDeep(item));
  }
  if (typeof data === 'object') {
    if (typeof FormData !== 'undefined' && data instanceof FormData) return data;
    const raw = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(raw)) {
      const val = normalizeDataDeep(raw[key]);
      result[key] = val;

      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (snakeKey !== key) {
        result[snakeKey] = val;
      }

      const camelKey = key.replace(/_([a-z])/g, (_, g: string) => g.toUpperCase());
      if (camelKey !== key) {
        result[camelKey] = val;
      }
    }
    return result;
  }
  return data;
}

// Attach JWT token and normalize payload keys on every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('medibook_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (config.data && typeof config.data === 'object' && !(typeof FormData !== 'undefined' && config.data instanceof FormData)) {
    config.data = normalizePayload(config.data);
  }
  return config;
});

// Handle 401 — redirect to login, and normalize response data keys (snake_case <-> camelCase)
apiClient.interceptors.response.use(
  (res) => {
    if (res.data) {
      res.data = normalizeDataDeep(res.data);
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('medibook_token');
      localStorage.removeItem('medibook_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: { username: string; password: string }) =>
    apiClient.post('/api/auth/login', data),
  registerUser: (data: { username: string; password: string; firstName?: string; middleName?: string; lastName?: string }) =>
    apiClient.post('/api/auth/register-user', data),
  register: (data: { username: string; password: string; roleId: number }) =>
    apiClient.post('/api/auth/register', data),
  logout: () => apiClient.post('/api/auth/logout'),
  forgotPassword: (data: { username: string }) =>
    apiClient.post('/api/auth/forgot-password', data),
  resetPassword: (data: { token: string; newPassword: string }) =>
    apiClient.post('/api/auth/reset-password', data),
};

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointmentApi = {
  getAll: () => apiClient.get('/api/appointment'),
  getMine: () => apiClient.get('/api/appointment/my'),
  getById: (id: number) => apiClient.get(`/api/appointment/${id}`),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/appointment/paginated?pageNumber=${page}&pageSize=${size}`),
  getBookedSlots: (doctorId: number, date: string) =>
    apiClient.get(`/api/appointment/booked-slots?doctorId=${doctorId}&date=${date}`),
  getDailyCount: (doctorId: number, date: string) =>
    apiClient.get(`/api/appointment/daily-count?doctorId=${doctorId}&date=${date}`),
  getLiveToday: (date?: string) =>
    apiClient.get(`/api/appointment/live-today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  create: (data: object) => apiClient.post('/api/appointment', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/appointment/${id}`, { appointment_id: id, appointmentId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/appointment/${id}`),
};


// ─── Appointment Types ────────────────────────────────────────────────────────

export const appointmentTypeApi = {
  getAll: () => apiClient.get('/api/appointmenttype'),
  getById: (id: number) => apiClient.get(`/api/appointmenttype/${id}`),
  create: (data: object) => apiClient.post('/api/appointmenttype', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/appointmenttype/${id}`, { appointment_type_id: id, appointmentTypeId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/appointmenttype/${id}`),
};

// ─── Request Types ────────────────────────────────────────────────────────────

export const requestTypeApi = {
  getAll: () => apiClient.get('/api/requesttype').catch(() => apiClient.get('/api/requesttypes')),
  getById: (id: number) => apiClient.get(`/api/requesttype/${id}`).catch(() => apiClient.get(`/api/requesttypes/${id}`)),
  create: (data: object) => apiClient.post('/api/requesttype', data).catch(() => apiClient.post('/api/requesttypes', data)),
  update: (id: number, data: object) =>
    apiClient.put(`/api/requesttype/${id}`, { request_type_id: id, requestTypeId: id, ...data })
      .catch(() => apiClient.put(`/api/requesttypes/${id}`, { request_type_id: id, requestTypeId: id, ...data })),
  delete: (id: number) => apiClient.delete(`/api/requesttype/${id}`).catch(() => apiClient.delete(`/api/requesttypes/${id}`)),
};

// ─── User Roles ───────────────────────────────────────────────────────────────

export const userRoleApi = {
  getAll: () => apiClient.get('/api/userrole').catch(() => apiClient.get('/api/userroles')),
  getById: (id: number) => apiClient.get(`/api/userrole/${id}`).catch(() => apiClient.get(`/api/userroles/${id}`)),
  create: (data: object) => apiClient.post('/api/userrole', data).catch(() => apiClient.post('/api/userroles', data)),
  update: (id: number, data: object) =>
    apiClient.put(`/api/userrole/${id}`, { role_id: id, user_role_id: id, userRoleId: id, ...data })
      .catch(() => apiClient.put(`/api/userroles/${id}`, { role_id: id, user_role_id: id, userRoleId: id, ...data })),
  delete: (id: number) => apiClient.delete(`/api/userrole/${id}`).catch(() => apiClient.delete(`/api/userroles/${id}`)),
};

// ─── Job Roles ────────────────────────────────────────────────────────────────

export const jobRoleApi = {
  getAll: () => apiClient.get('/api/jobrole'),
  getById: (id: number) => apiClient.get(`/api/jobrole/${id}`),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/jobrole/paginated?pageNumber=${page}&pageSize=${size}`),
  create: (data: object) => apiClient.post('/api/jobrole', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/jobrole/${id}`, { role_id: id, roleId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/jobrole/${id}`),
};

// ─── Staff ────────────────────────────────────────────────────────────────────

export const staffApi = {
  getAll: () => apiClient.get('/api/staff'),
  getById: (id: number) => apiClient.get(`/api/staff/${id}`),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/staff/paginated?pageNumber=${page}&pageSize=${size}`),
  create: (data: object) => apiClient.post('/api/staff', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/staff/${id}`, { staff_id: id, staffId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/staff/${id}`),
};

// ─── Doctors ──────────────────────────────────────────────────────────────────

export const doctorApi = {
  getAll: () => apiClient.get('/api/doctor'),
  getById: (id: number) => apiClient.get(`/api/doctor/${id}`),
  getMyProfile: () => apiClient.get('/api/doctor/my-profile'),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/doctor/paginated?pageNumber=${page}&pageSize=${size}`),
  create: (data: object) => apiClient.post('/api/doctor', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/doctor/${id}`, { doctor_id: id, doctorId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/doctor/${id}`),

  /** Upload a profile picture for a doctor (multipart/form-data).
   *  The doctor themselves or an Admin can call this. */
  uploadProfilePicture: (doctorId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/api/doctor/${doctorId}/profile-picture`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Remove a doctor's profile picture. */
  deleteProfilePicture: (doctorId: number) =>
    apiClient.delete(`/api/doctor/${doctorId}/profile-picture`),
};

// ─── Doctor Schedules ─────────────────────────────────────────────────────────

export const doctorScheduleApi = {
  getAll: () => apiClient.get('/api/doctorschedule'),
  getMine: () => apiClient.get('/api/doctorschedule/my'),
  getById: (id: number) => apiClient.get(`/api/doctorschedule/${id}`),
  getByDoctorId: (doctorId: number) => apiClient.get(`/api/doctorschedule/doctor/${doctorId}`),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/doctorschedule/paginated?pageNumber=${page}&pageSize=${size}`),
  create: (data: object) => apiClient.post('/api/doctorschedule', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/doctorschedule/${id}`, { schedule_id: id, scheduleId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/doctorschedule/${id}`),
};

// ─── Patients ─────────────────────────────────────────────────────────────────

export const patientApi = {
  getAll: () => apiClient.get('/api/patient'),
  getById: (id: number) => apiClient.get(`/api/patient/${id}`),
  getMyProfile: () => apiClient.get('/api/patient/my'),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/patient/paginated?pageNumber=${page}&pageSize=${size}`),
  create: (data: object) => apiClient.post('/api/patient', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/patient/${id}`, { patient_id: id, patientId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/patient/${id}`),
};

// ─── Department ───────────────────────────────────────────────────────────────

export const departmentApi = {
  getAll: () => apiClient.get('/api/department'),
  getById: (id: number) => apiClient.get(`/api/department/${id}`),
  create: (data: object) => apiClient.post('/api/department', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/department/${id}`, { department_id: id, departmentId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/department/${id}`),
};

// ─── Specialty ────────────────────────────────────────────────────────────────

export const specialtyApi = {
  getAll: () => apiClient.get('/api/specialty'),
  getById: (id: number) => apiClient.get(`/api/specialty/${id}`),
  create: (data: object) => apiClient.post('/api/specialty', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/specialty/${id}`, { specialty_id: id, specialtyId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/specialty/${id}`),
};

// ─── Consultations ────────────────────────────────────────────────────────────

export const consultationApi = {
  getAll: () => apiClient.get('/api/consultation'),
  getMine: () => apiClient.get('/api/consultation/my'),
  getById: (id: number) => apiClient.get(`/api/consultation/${id}`),
  getByAppointment: (appointmentId: number) => apiClient.get(`/api/consultation/by-appointment/${appointmentId}`),
  create: (data: object) => apiClient.post('/api/consultation', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/consultation/${id}`, { consultation_id: id, consultationId: id, ...data }),
  complete: (id: number) => apiClient.patch(`/api/consultation/${id}/complete`),
  delete: (id: number) => apiClient.delete(`/api/consultation/${id}`),
};

// ─── Emergency Contact ────────────────────────────────────────────────────────

export const emergencyContactApi = {
  getAll: () => apiClient.get('/api/emergencycontact'),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/emergencycontact/paginated?pageNumber=${page}&pageSize=${size}`),
  getMine: () => apiClient.get('/api/emergencycontact/my'),
  getByPatientId: (patientId: number) => apiClient.get(`/api/emergencycontact/patient/${patientId}`),
  getById: (id: number) => apiClient.get(`/api/emergencycontact/${id}`),
  create: (data: object) => apiClient.post('/api/emergencycontact', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/emergencycontact/${id}`, { contact_id: id, emergencyContactId: id, ...data }),
  delete: (id: number) => apiClient.delete(`/api/emergencycontact/${id}`),
};

// ─── Insurance ────────────────────────────────────────────────────────────────

export const insuranceApi = {
  getAll: () => apiClient.get('/api/insurance'),
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/insurance/paginated?pageNumber=${page}&pageSize=${size}`),
  getMine: () => apiClient.get('/api/insurance/my'),
  getByPatientId: (patientId: number) => apiClient.get(`/api/insurance/patient/${patientId}`),
  getById: (id: number) => apiClient.get(`/api/insurance/${id}`),
  create: (data: object) => apiClient.post('/api/insurance', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/insurance/${id}`, { insurance_id: id, insuranceId: id, ...data }),
  setPrimary: (id: number) =>
    apiClient.put(`/api/insurance/${id}/set-primary`, {}),
  delete: (id: number) => apiClient.delete(`/api/insurance/${id}`),
};


// ─── Medical Information ──────────────────────────────────────────────────────

export const medicalInfoApi = {
  getAll: () => apiClient.get('/api/medicalinformation'),
  getMine: () => apiClient.get('/api/medicalinformation/my'),
  getById: (id: number) => apiClient.get(`/api/medicalinformation/${id}`),
  getByPatientId: (patientId: number) => apiClient.get(`/api/medicalinformation/patient/${patientId}`),
  create: (data: object) => apiClient.post('/api/medicalinformation', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/medicalinformation/${id}`, { medical_info_id: id, medicalInfoId: id, ...data }),
};


// ─── Medical Request ──────────────────────────────────────────────────────────

export const medicalRequestApi = {
  getAll: () => apiClient.get('/api/medicalrequest'),
  getMine: () => apiClient.get('/api/medicalrequest/my'),
  getById: (id: number) => apiClient.get(`/api/medicalrequest/${id}`),
  create: (data: object) => apiClient.post('/api/medicalrequest', data),
  update: (id: number, data: object) =>
    apiClient.put(`/api/medicalrequest/${id}`, { request_id: id, requestId: id, ...data }),
  updateStatus: (id: number, statusId: number) =>
    apiClient.patch(`/api/medicalrequest/${id}/status`, { status_id: statusId }),
  delete: (id: number) => apiClient.delete(`/api/medicalrequest/${id}`),
};

// ─── Medical Attachment ───────────────────────────────────────────────────────

export const medicalAttachmentApi = {
  getAll: () => apiClient.get('/api/medicalattachment'),
  getMine: () => apiClient.get('/api/medicalattachment/my'),
  getById: (id: number) => apiClient.get(`/api/medicalattachment/${id}`),
  create: (data: object) => apiClient.post('/api/medicalattachment', data),
  /** Upload a real file (multipart/form-data) tied to a medical request */
  upload: (requestId: number, file: File) => {
    const form = new FormData();
    form.append('request_id', String(requestId));
    form.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('medibook_token') : null;
    return apiClient.post('/api/medicalattachment/upload', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  },
  delete: (id: number) => apiClient.delete(`/api/medicalattachment/${id}`),
};

// ─── Medical Result ───────────────────────────────────────────────────────────

export const medicalResultApi = {
  getAll: () => apiClient.get('/api/medicalresult'),
  getMine: () => apiClient.get('/api/medicalresult/my'),
  getById: (id: number) => apiClient.get(`/api/medicalresult/${id}`),
};

// ─── User Management & Profile ───────────────────────────────────────────────

export const userApi = {
  /** Get current authenticated user profile */
  getProfile: () => apiClient.get('/api/user/profile').catch(() => apiClient.get('/api/user/me')),

  /** Update current authenticated user profile */
  updateProfile: (data: object) => apiClient.put('/api/user/profile', data).catch(() => apiClient.put('/api/user/me', data)),

  /** Upload profile picture for current authenticated user */
  uploadProfilePicture: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/user/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Upload profile picture for a specific user (Admin or owner) */
  uploadProfilePictureForUser: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/api/user/${id}/profile-picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Get all users (Admin only) */
  getAll: () => apiClient.get('/api/user').catch(() => apiClient.get('/api/userman')),

  /** Get user by ID */
  getById: (id: number) => apiClient.get(`/api/user/${id}`).catch(() => apiClient.get(`/api/userman/${id}`)),

  /** Paginated users (Admin only) */
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/user/paginated?pageNumber=${page}&pageSize=${size}`)
      .catch(() => apiClient.get(`/api/userman/paginated?pageNumber=${page}&pageSize=${size}`)),

  /** Create user (Admin only) */
  create: (data: object) => apiClient.post('/api/user', data).catch(() => apiClient.post('/api/userman', data)),

  /** Update user (Admin or owner) */
  update: (id: number, data: object) =>
    apiClient.put(`/api/user/${id}`, { user_id: id, userId: id, ...data })
      .catch(() => apiClient.put(`/api/userman/${id}`, { user_id: id, userId: id, ...data })),

  /** Delete user (Admin only) */
  delete: (id: number) => apiClient.delete(`/api/user/${id}`).catch(() => apiClient.delete(`/api/userman/${id}`)),
};

export const userManApi = userApi;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationApi = {
  /** All notifications for the current user, newest first */
  getMy: () => apiClient.get('/api/notification/my'),

  /** Unread count badge — { unread_count: number } */
  getUnreadCount: () => apiClient.get('/api/notification/my/unread-count'),

  /** Single notification by ID (own only) */
  getById: (id: number) => apiClient.get(`/api/notification/${id}`),

  /** Mark one notification as read */
  markAsRead: (id: number) => apiClient.patch(`/api/notification/${id}/read`),

  /** Mark all current user's notifications as read */
  markAllAsRead: () => apiClient.patch('/api/notification/my/read-all'),

  /** Dismiss (delete) a notification */
  dismiss: (id: number) => apiClient.delete(`/api/notification/${id}`),

  /** Admin-only: broadcast announcement */
  broadcast: (data: { user_ids?: number[]; send_to_all?: boolean; title: string; message: string }) =>
    apiClient.post('/api/notification/broadcast', data),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviewApi = {
  /** Get all reviews */
  getAll: () => apiClient.get('/api/review'),

  /** Get review by ID */
  getById: (id: number) => apiClient.get(`/api/review/${id}`),

  /** Paginated reviews */
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/review/paginated?pageNumber=${page}&pageSize=${size}`),

  /** Create review (Patient or Admin) */
  create: (data: object) => apiClient.post('/api/review', data),

  /** Update review (Owner patient or Admin) */
  update: (id: number, data: object) =>
    apiClient.put(`/api/review/${id}`, { review_id: id, reviewId: id, ...data }),

  /** Delete review (Owner patient or Admin) */
  delete: (id: number) => apiClient.delete(`/api/review/${id}`),
};

// ─── Hospital Information ─────────────────────────────────────────────────────

export const hospitalInformationApi = {
  /** Get all hospital information */
  getAll: () => apiClient.get('/api/hospitalinformation'),

  /** Get hospital information by ID */
  getById: (id: number) => apiClient.get(`/api/hospitalinformation/${id}`),

  /** Paginated hospital information */
  getPaginated: (page = 1, size = 10) =>
    apiClient.get(`/api/hospitalinformation/paginated?pageNumber=${page}&pageSize=${size}`),

  /** Create hospital information (Admin only) */
  create: (data: object) => apiClient.post('/api/hospitalinformation', data),

  /** Update hospital information (Admin only) */
  update: (id: number, data: object) =>
    apiClient.put(`/api/hospitalinformation/${id}`, { hospital_id: id, hospitalId: id, ...data }),

  /** Delete hospital information (Admin only) */
  delete: (id: number) => apiClient.delete(`/api/hospitalinformation/${id}`),

  /** Get hospitals near a given coordinate within radius km */
  getNearby: (lat: number, lng: number, radius = 10) =>
    apiClient.get(`/api/hospitalinformation/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),

  /** Geocode an address using OpenStreetMap Nominatim via backend */
  geocode: (address: string) =>
    apiClient.get(`/api/hospitalinformation/geocode?address=${encodeURIComponent(address)}`),

  /** Automatically detect nearby hospitals for an address */
  getNearbyByAddress: (address: string, radius = 0) =>
    apiClient.get(`/api/hospitalinformation/nearby-by-address?address=${encodeURIComponent(address)}&radius=${radius}`),
};



