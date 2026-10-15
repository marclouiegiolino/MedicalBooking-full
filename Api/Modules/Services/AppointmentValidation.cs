using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.AppointmentType;
using Medical.Api.Modules.User;
using Medical.Api.Modules.DoctorSchedule;
using PatientsModel = Medical.Api.Modules.Patients.Patients;
using DoctorScheduleModel = Medical.Api.Modules.DoctorSchedule.DoctorSchedule;
using IPatientsRepo = Medical.Api.Modules.Patients.IPatientsRepository;

namespace Medical.Api.Modules.Appointments
{
    public class AppointmentService : IAppointmentService
    {
        private readonly IAppointmentRepository     _repository;
        private readonly IDoctorRepository          _doctorRepository;
        private readonly IAppointmentTypeRepository _appointmentTypeRepository;
        private readonly IPatientsRepo              _patientsRepository;
        private readonly IUserRepository            _userRepository;
        private readonly IDoctorScheduleRepository  _scheduleRepository;

        public AppointmentService(
            IAppointmentRepository repository,
            IDoctorRepository doctorRepository,
            IAppointmentTypeRepository appointmentTypeRepository,
            IPatientsRepo patientsRepository,
            IUserRepository userRepository,
            IDoctorScheduleRepository scheduleRepository)
        {
            _repository                = repository;
            _doctorRepository          = doctorRepository;
            _appointmentTypeRepository = appointmentTypeRepository;
            _patientsRepository        = patientsRepository;
            _userRepository            = userRepository;
            _scheduleRepository        = scheduleRepository;
        }

        // ============================================================
        // FOREIGN KEY VALIDATION
        // ============================================================

        public async Task<string?> ValidateForeignKeysAsync(Appointment appointment)
        {
            if (appointment.PatientId <= 0)
                return "patient_id is required and must be greater than 0.";

            var patient = await _patientsRepository.GetByIdAsync(appointment.PatientId);
            if (patient is null)
                return $"Patient profile with ID {appointment.PatientId} does not exist.";

            if (appointment.DoctorId <= 0)
                return "doctor_id is required and must be greater than 0.";

            var doctor = await _doctorRepository.GetByIdAsync(appointment.DoctorId);
            if (doctor is null)
                return $"Doctor with ID {appointment.DoctorId} does not exist.";

            if (appointment.AppointmentTypeId <= 0)
                return "appointment_type_id is required and must be greater than 0.";

            var appointmentType = await _appointmentTypeRepository.GetByIdAsync(appointment.AppointmentTypeId);
            if (appointmentType is null)
                return $"Appointment type with ID {appointment.AppointmentTypeId} does not exist.";

            return null;
        }

        // ============================================================
        // CREATE
        // ============================================================

        /// <summary>
        /// Prepares and persists a new appointment.
        /// Returns a validation/business-rule error string, or null on success.
        /// </summary>
        public async Task<string?> CreateAsync(
            Appointment appointment,
            long currentUserId,
            bool isAdmin)
        {
            // Resolve / auto-create patient profile
            if (!isAdmin || appointment.PatientId <= 0)
            {
                var patient = await _patientsRepository.GetByUserIdAsync(currentUserId);
                if (patient is null)
                {
                    var user = await _userRepository.GetByIdAsync((int)currentUserId);
                    var newPatient = new PatientsModel
                    {
                        UserId    = currentUserId,
                        Guid      = System.Guid.NewGuid().ToString(),
                        FirstName = user?.UserName ?? "Patient",
                        LastName  = "User"
                    };
                    await _patientsRepository.AddAsync(newPatient);
                    patient = newPatient;
                }
                appointment.PatientId = patient.PatientId;
            }
            else if (isAdmin && appointment.PatientId <= 0)
            {
                return "Admin must provide a valid patient_id.";
            }

            // Default status = Pending
            if (appointment.StatusId <= 0)
                appointment.StatusId = 1;

            // FK validation
            var fkError = await ValidateForeignKeysAsync(appointment);
            if (fkError is not null) return fkError;

            // Daily limit check
            var datePart = (appointment.AppointmentDate ?? string.Empty).Split('T')[0];
            if (!string.IsNullOrWhiteSpace(datePart))
            {
                const int DailyLimit = 10;
                var dailyCount = await _repository.GetDailyAppointmentCountAsync(
                    appointment.DoctorId, datePart);

                if (dailyCount >= DailyLimit)
                    return $"CONFLICT:This doctor has reached the maximum of {DailyLimit} appointments for {datePart}. Please choose another date.|count={dailyCount}|limit={DailyLimit}";
            }

            await _repository.AddAsync(appointment);

            // Auto-ensure doctor schedule entry for the booked day-of-week
            await EnsureDoctorScheduleAsync(appointment);

            return null;
        }

        // ============================================================
        // UPDATE
        // ============================================================

        /// <summary>
        /// Updates an existing appointment with role-based rules.
        /// Returns a validation/business-rule error string, or null on success.
        /// </summary>
        public async Task<string?> UpdateAsync(
            Appointment appointment,
            long currentUserId,
            bool isAdmin,
            bool isDoctor)
        {
            var existing = await _repository.GetByIdAsync(appointment.AppointmentId);
            if (existing is null)
                return "NOT_FOUND";

            // Completed (3), Cancelled (4), and No-Show (5) appointments cannot be edited
            if (existing.StatusId == 3 || existing.StatusId == 4 || existing.StatusId == 5)
                return "Completed, cancelled, or no-show appointments cannot be edited.";

            if (!isAdmin && !isDoctor)
            {
                // Regular user: must own the appointment
                if (existing.PatientId != currentUserId)
                    return "FORBID";

                // Cannot re-assign to another patient
                appointment.PatientId = existing.PatientId;
            }
            else if (isDoctor)
            {
                // Doctors cannot reassign the patient
                appointment.PatientId = existing.PatientId;
            }

            var fkError = await ValidateForeignKeysAsync(appointment);
            if (fkError is not null) return fkError;

            await _repository.UpdateAsync(appointment);
            return null;
        }

        // ============================================================
        // DELETE
        // ============================================================

        /// <summary>
        /// Deletes an appointment with role-based rules.
        /// Returns a business-rule error string, or null on success.
        /// </summary>
        public async Task<string?> DeleteAsync(
            long appointmentId,
            long currentUserId,
            bool isAdmin,
            bool isDoctor)
        {
            var existing = await _repository.GetByIdAsync(appointmentId);
            if (existing is null)
                return "NOT_FOUND";

            // Completed (3), Cancelled (4), and No-Show (5) appointments cannot be deleted
            if (existing.StatusId == 3 || existing.StatusId == 4 || existing.StatusId == 5)
                return "Completed, cancelled, or no-show appointments cannot be deleted.";

            if (isDoctor)
                return "DOCTOR_FORBIDDEN";

            if (!isAdmin)
            {
                if (existing.PatientId != currentUserId)
                    return "FORBID";
            }

            await _repository.DeleteAsync(appointmentId);
            return null;
        }

        // ============================================================
        // LIVE TODAY
        // ============================================================

        public async Task<object> GetLiveTodayAsync(
            string? date,
            long? currentUserId,
            bool isAdmin,
            bool isDoctor)
        {
            string targetDate = !string.IsNullOrWhiteSpace(date)
                ? date.Trim().Split('T')[0]
                : DateTime.UtcNow.ToString("yyyy-MM-dd");

            var allAppointments = (await _repository.GetAllAsync())
                .Where(a => !a.IsDeleted && a.StatusId != 4)
                .ToList();

            var todayAppointments = allAppointments
                .Where(a => !string.IsNullOrWhiteSpace(a.AppointmentDate)
                         && a.AppointmentDate.StartsWith(targetDate))
                .ToList();

            // Resolve caller's doctor/patient ID for role-scoped slice
            long? callerDoctorId  = null;
            long? callerPatientId = null;

            if (currentUserId.HasValue && !isAdmin)
            {
                if (isDoctor)
                {
                    var doc = await _doctorRepository.GetByUserIdAsync(currentUserId.Value);
                    if (doc != null) callerDoctorId = doc.DoctorId;
                }
                else
                {
                    var pat = await _patientsRepository.GetByUserIdAsync(currentUserId.Value);
                    if (pat != null) callerPatientId = pat.PatientId;
                }
            }

            var relevantToday = todayAppointments;
            if (callerDoctorId.HasValue)
                relevantToday = todayAppointments.Where(a => a.DoctorId == callerDoctorId.Value).ToList();
            else if (callerPatientId.HasValue)
                relevantToday = todayAppointments.Where(a => a.PatientId == callerPatientId.Value).ToList();

            // Doctor occupancy stats
            var allDoctors  = await _doctorRepository.GetAllAsync();
            var doctorStats = new List<object>();

            foreach (var doc in allDoctors)
            {
                int bookedToday = todayAppointments.Count(a => a.DoctorId == doc.DoctorId);
                int limit = 16;

                try
                {
                    var schedules = await _scheduleRepository.GetByDoctorIdAsync(doc.DoctorId);
                    if (DateTime.TryParse(targetDate, out DateTime dt))
                    {
                        string dow      = dt.DayOfWeek.ToString();
                        var    daySched = schedules.FirstOrDefault(s =>
                            string.Equals(s.DayOfWeek, dow, StringComparison.OrdinalIgnoreCase));

                        if (daySched != null && daySched.MaxAppointments > 0)
                            limit = daySched.MaxAppointments;
                    }
                }
                catch { /* Keep default capacity. */ }

                doctorStats.Add(new
                {
                    doctorId      = doc.DoctorId,
                    doctorName    = $"Dr. {doc.FirstName} {doc.LastName}".Trim(),
                    specialtyId   = doc.SpecialtyId,
                    isTimedIn     = doc.IsTimedIn,
                    bookedCount   = bookedToday,
                    capacity      = limit,
                    remainingSlots = Math.Max(0, limit - bookedToday),
                    isFull        = bookedToday >= limit
                });
            }

            int pendingCount   = relevantToday.Count(a => a.StatusId == 1);
            int confirmedCount = relevantToday.Count(a => a.StatusId == 2);
            int completedCount = relevantToday.Count(a => a.StatusId == 3);
            int activeTodayCount = pendingCount + confirmedCount;

            return new
            {
                serverDate         = targetDate,
                serverTimeUtc      = DateTime.UtcNow.ToString("o"),
                todayCount         = relevantToday.Count,
                activeTodayCount,
                pendingCount,
                confirmedCount,
                completedCount,
                hospitalTodayTotal = todayAppointments.Count,
                appointments       = relevantToday.OrderBy(a => a.AppointmentTime).ToList(),
                doctors            = doctorStats
            };
        }

        // ============================================================
        // PRIVATE HELPERS
        // ============================================================

        private async Task EnsureDoctorScheduleAsync(Appointment appointment)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(appointment.AppointmentDate)) return;

                var datePart = appointment.AppointmentDate.Split('T')[0];
                if (!DateTime.TryParse(datePart, out DateTime apptDate)) return;

                string dayOfWeek = apptDate.DayOfWeek.ToString();

                var existing      = await _scheduleRepository.GetByDoctorIdAsync(appointment.DoctorId);
                bool alreadyHasDay = existing.Any(s =>
                    string.Equals(s.DayOfWeek, dayOfWeek, StringComparison.OrdinalIgnoreCase));

                if (!alreadyHasDay)
                {
                    var newSchedule = new DoctorScheduleModel
                    {
                        DoctorId        = appointment.DoctorId,
                        DayOfWeek       = dayOfWeek,
                        StartTime       = "08:00",
                        EndTime         = "17:00",
                        SlotDuration    = 30,
                        MaxAppointments = 16,
                        IsActive        = true
                    };
                    await _scheduleRepository.AddAsync(newSchedule);
                }
            }
            catch
            {
                // Non-critical: swallow errors so booking still succeeds.
            }
        }
    }
}