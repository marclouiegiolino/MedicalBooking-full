// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  userId: number;
  username: string;
  roleId: number;
}

export interface RegisterUserRequest {
  username: string;
  password: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

export interface ForgotPasswordRequest {
  username: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  userId: number;
  user_id?: number;
  guid: string;
  userName: string;
  user_name?: string;
  userRoleId: number;
  user_role_id?: number;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

export type UserManResponse = UserResponse;

export interface CreateUserRequest {
  userName: string;
  user_name?: string;
  password?: string;
  userPass?: string;
  user_pass?: string;
  userRoleId: number;
  user_role_id?: number;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

export type CreateUserManRequest = CreateUserRequest;

export interface UpdateUserRequest {
  userId?: number;
  user_id?: number;
  userName: string;
  user_name?: string;
  newPassword?: string;
  new_password?: string;
  password?: string;
  userPass?: string;
  user_pass?: string;
  userRoleId?: number;
  user_role_id?: number;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

export type UpdateUserManRequest = UpdateUserRequest;

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface UserRole {
  roleId: number;
  roleName: string;
}

export interface JobRole {
  roleId: number;
  role_id?: number;
  roleName: string;
  role_name?: string;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface Staff {
  staffId: number;
  staff_id?: number;
  guid?: string;
  userId: number;
  user_id?: number;
  accessId: number;
  access_id?: number;
  roleId: number;
  role_id?: number;
  departmentId?: number | null;
  department_id?: number | null;
  employeeNo?: string;
  employee_no?: string;
  firstName: string;
  first_name?: string;
  middleName?: string;
  middle_name?: string;
  lastName: string;
  last_name?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export interface Patient {
  patientId: number;
  patient_id?: number;
  guid?: string;
  userId: number;
  user_id?: number;
  firstName: string;
  first_name?: string;
  middleName?: string;
  middle_name?: string;
  lastName: string;
  last_name?: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  birthDate?: string;
  birth_date?: string;
  gender?: string;
  phone?: string;
  address?: string;
  bloodType?: string;
  blood_type?: string;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

export type Patients = Patient;

// ─── Doctor ───────────────────────────────────────────────────────────────────

export interface Doctor {
  doctorId: number;
  doctor_id?: number;
  userId: number;
  user_id?: number;
  guid?: string;
  departmentId: number;
  department_id?: number;
  departmentName?: string;
  department_name?: string;
  specialtyId: number;
  specialty_id?: number;
  specialtyName?: string;
  specialty_name?: string;
  firstName: string;
  first_name?: string;
  middleName?: string;
  middle_name?: string;
  lastName: string;
  last_name?: string;
  consultationFee?: number;
  consultation_fee?: number;
  licenseNumber?: string;
  license_number?: string;
  isTimedIn?: boolean;
  is_timed_in?: boolean;
  hospitalId?: number;
  hospital_id?: number;
  profilePicturePath?: string;
  profile_picture_path?: string;
}

// ─── Hospital Information ───────────────────────────────────────────────────

export interface HospitalInformation {
  hospitalId: number;
  hospital_id?: number;
  hospitalName: string;
  hospital_name?: string;
  address?: string;
  phoneNumber?: string;
  phone_number?: string;
  email?: string;
  logoPath?: string;
  logo_path?: string;
  updatedAt?: string;
  updated_at?: string;
  latitude: number;
  longitude: number;
  serviceRadius: number;
  service_radius?: number;
  /** Computed distance in km from user / patient location */
  distanceKm?: number;
  distance_km?: number;
  /** True if distance is within hospital's service radius */
  isWithinServiceRadius?: boolean;
  is_within_service_radius?: boolean;
}

export interface GeocodeResult {
  found: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  displayName?: string;
  display_name?: string;
  message?: string;
}

export interface NearbyByAddressResult {
  found: boolean;
  address: string;
  latitude?: number;
  longitude?: number;
  displayName?: string;
  display_name?: string;
  message?: string;
  hospitals: HospitalInformation[];
}

// ─── Doctor Schedule ──────────────────────────────────────────────────────────

export interface DoctorSchedule {
  scheduleId: number;
  doctorId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxAppointments: number;
  isActive: boolean;
}

export interface CreateDoctorScheduleRequest {
  doctorId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxAppointments: number;
  isActive?: boolean;
}

// ─── Department ───────────────────────────────────────────────────────────────

export interface Department {
  departmentId: number;
  departmentName: string;
  description?: string;
}

// ─── Specialty ────────────────────────────────────────────────────────────────

export interface Specialty {
  specialtyId: number;
  specialtyName: string;
  description?: string;
}

// ─── Appointment Type ─────────────────────────────────────────────────────────

export interface AppointmentType {
  appointmentTypeId: number;
  appointmentName?: string;
  typeName?: string;
  description?: string;
}

// ─── Appointment ──────────────────────────────────────────────────────────────

export interface Appointment {
  appointmentId: number;
  patientId: number;
  doctorId: number;
  appointmentTypeId: number;
  appointmentDate: string;
  appointmentTime?: string;
  statusId?: number;
  status?: string;
  remarks?: string;
  notes?: string;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface CreateAppointmentRequest {
  doctorId: number;
  appointmentTypeId: number;
  appointmentDate: string;
  appointmentTime?: string;
  reason?: string;
  notes?: string;
}

export interface DoctorLiveStat {
  doctorId: number;
  doctorName: string;
  specialtyId?: number;
  isTimedIn?: boolean;
  bookedCount: number;
  capacity: number;
  remainingSlots: number;
  isFull: boolean;
}

export interface AppointmentLiveStats {
  serverDate: string;
  serverTimeUtc: string;
  todayCount: number;
  activeTodayCount?: number;
  pendingCount: number;
  confirmedCount: number;
  completedCount: number;
  hospitalTodayTotal: number;
  appointments: Appointment[];
  doctors: DoctorLiveStat[];
}


// ─── Consultation ─────────────────────────────────────────────────────────────

export interface Consultation {
  consultationId: number;
  guid?: string;
  appointmentId: number;
  doctorId: number;
  patientId: number;
  diagnosis?: string;
  consultationNotes?: string;
  treatmentPlan?: string;
  prescription?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

// ─── Emergency Contact ────────────────────────────────────────────────────────

export interface EmergencyContact {
  contactId?: number;
  contact_id?: number;
  emergencyContactId?: number;
  patientId?: number;
  patient_id?: number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  contactName?: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface CreateEmergencyContactRequest {
  patientId?: number;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
}

export interface UpdateEmergencyContactRequest {
  contactId?: number;
  patientId?: number;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
}

// ─── Insurance ────────────────────────────────────────────────────────────────

export interface Insurance {
  insuranceId: number;
  insurance_id?: number;
  guid?: string;
  patientId: number;
  patient_id?: number;
  providerName: string;
  provider_name?: string;
  policyNumber: string;
  policy_number?: string;
  coverageType?: string;
  coverage_type?: string;
  validUntil?: string;
  valid_until?: string;
  isPrimary: boolean;
  is_primary?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface CreateInsuranceRequest {
  patientId?: number;
  providerName: string;
  policyNumber: string;
  coverageType?: string;
  validUntil?: string;
  isPrimary?: boolean;
}

export interface UpdateInsuranceRequest {
  insuranceId?: number;
  patientId?: number;
  providerName: string;
  policyNumber: string;
  coverageType?: string;
  validUntil?: string;
  isPrimary?: boolean;
}


// ─── Medical Information ──────────────────────────────────────────────────────

export interface MedicalInformation {
  medicalInfoId: number;
  medical_info_id?: number;
  patientId: number;
  patient_id?: number;
  allergies?: string;
  medicalHistory?: string;
  medical_history?: string;
  medications?: string;
}


// ─── Medical Request ──────────────────────────────────────────────────────────

export interface MedicalRequest {
  requestId: number;
  guid?: string;
  consultationId: number;
  patientId?: number;
  doctorId?: number;
  requestTypeId: number;
  statusId?: number;
  status?: string;
  notes?: string;
  requestDate?: string;
  createdAt?: string;
}

export interface MedicalRequestType {
  requestTypeId: number;
  requestName: string;
  typeName?: string;
}

// ─── Medical Attachment ───────────────────────────────────────────────────────

export interface MedicalAttachment {
  attachmentId: number;
  requestId: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  fileType?: string;
}

// ─── Medical Result ───────────────────────────────────────────────────────────

export interface MedicalResult {
  resultId: number;
  requestId: number;
  resultDate: string;
  findings: string;
  status: string;
  performedBy?: string;
}

// ─── Paginated Response ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// ─── Role constants ───────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: 1,
  STAFF: 2,
  USER: 3,
} as const;

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  notificationId: number;
  guid: string;
  userId: number;
  title: string;
  message: string;
  notificationType: string;
  referenceType: string;
  referenceId: number;
  isRead: boolean;
  createdAt: string;
}

export interface BroadcastRequest {
  user_ids?: number[];
  send_to_all?: boolean;
  title: string;
  message: string;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface Review {
  reviewId?: number;
  review_id?: number;
  doctorId?: number;
  doctor_id?: number;
  patientId?: number;
  patient_id?: number;
  rating: number;
  comment: string;
  createdAt?: string;
  created_at?: string;
  doctorName?: string;
  patientName?: string;
}

export interface CreateReviewRequest {
  doctorId?: number;
  doctor_id?: number;
  patientId?: number;
  patient_id?: number;
  rating: number;
  comment: string;
}

export interface UpdateReviewRequest {
  reviewId?: number;
  review_id?: number;
  doctorId?: number;
  doctor_id?: number;
  patientId?: number;
  patient_id?: number;
  rating?: number;
  comment?: string;
}
