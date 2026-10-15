using Medical.Api.Modules.Appointments;
using Medical.Api.Modules.Doctor;
using Medical.Api.Modules.MedicalRequest;
using Medical.Api.Modules.Notification;
using Medical.Api.Modules.Patients;

namespace Medical.Api.Modules.Services
{
    /// <summary>
    /// Background service that runs every minute and auto-cancels appointments
    /// whose scheduled date+time have passed. Notifies both the patient and the doctor.
    ///
    /// Status reference (matches the DB `status` table):
    ///   1 = Pending / Scheduled
    ///   2 = Confirmed
    ///   3 = Cancelled  ← used for auto-cancel by this service
    ///   4 = Completed
    ///   5 = No-Show
    ///
    /// Only statuses 1 and 2 are considered "active" — completed (4), cancelled (3), and
    /// no-show (5) appointments are left alone.
    ///
    /// EXCEPTION: If the doctor has issued a medical request (lab, radiology, etc.) for
    /// the patient during that appointment's consultation, the appointment is considered
    /// actively managed. In that case the appointment is kept as Pending (status 1) and
    /// is never auto-cancelled by this service.
    /// </summary>
    public sealed class AppointmentOverdueService : BackgroundService
    {
        // ── Status ID constants ───────────────────────────────────────────────
        // Change these if your DB uses different values.
        private static readonly long[] ActiveStatusIds  = [1, 2];   // Pending, Confirmed
        private const long             PendingStatusId   = 1;        // Pending / Scheduled
        private const long             CancelledStatusId = 4;        // Cancelled (auto)

        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AppointmentOverdueService> _logger;

        public AppointmentOverdueService(
            IServiceScopeFactory scopeFactory,
            ILogger<AppointmentOverdueService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger       = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[OverdueService] Started — checking every {interval}.", CheckInterval);

            // Small initial delay so all scoped services are fully registered
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunCheckAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "[OverdueService] Unexpected error during overdue check.");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }
        }

        private async Task RunCheckAsync(CancellationToken ct)
        {
            // Use a fresh DI scope so Scoped services (repositories) work correctly
            await using var scope = _scopeFactory.CreateAsyncScope();

            var appointmentRepo    = scope.ServiceProvider.GetRequiredService<IAppointmentRepository>();
            var medicalRequestRepo = scope.ServiceProvider.GetRequiredService<IMedicalRequestRepository>();
            var patientRepo        = scope.ServiceProvider.GetRequiredService<IPatientsRepository>();
            var doctorRepo         = scope.ServiceProvider.GetRequiredService<IDoctorRepository>();
            var notifications      = scope.ServiceProvider.GetRequiredService<INotificationService>();

            IEnumerable<Appointment> overdue;
            try
            {
                overdue = await appointmentRepo.GetOverdueAsync(ActiveStatusIds);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[OverdueService] Could not query overdue appointments.");
                return;
            }

            // Filter in C# using local time so PHT-stored appointment times are
            // compared correctly (SQLite datetime('now') returns UTC which is 8 h behind PHT).
            var localNow = DateTime.Now;
            var overdueList = overdue
                .Where(a =>
                {
                    if (string.IsNullOrWhiteSpace(a.AppointmentDate)) return false;
                    var datePart = a.AppointmentDate.Length >= 10
                        ? a.AppointmentDate[..10] : a.AppointmentDate;
                    var timePart = string.IsNullOrWhiteSpace(a.AppointmentTime) ? "00:00:00" : a.AppointmentTime.Trim();
                    return DateTime.TryParse($"{datePart} {timePart}", out var aptLocal)
                           && aptLocal < localNow;
                })
                .ToList();

            if (overdueList.Count == 0) return;

            _logger.LogInformation("[OverdueService] Found {count} overdue appointment(s) to process.", overdueList.Count);

            foreach (var appt in overdueList)
            {
                if (ct.IsCancellationRequested) break;

                try
                {
                    // ── Guard: if the doctor has issued a medical request for this
                    //    appointment's consultation, keep it Pending — do NOT cancel it.
                    bool hasMedicalRequest = false;
                    try
                    {
                        hasMedicalRequest = await medicalRequestRepo.HasActiveRequestsForAppointmentAsync(appt.AppointmentId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex,
                            "[OverdueService] Could not check medical requests for appointment #{id}. Skipping cancellation.",
                            appt.AppointmentId);
                        continue; // safe: skip rather than wrongly cancel
                    }

                    if (hasMedicalRequest)
                    {
                        // Ensure the appointment stays Pending (status 1) in case it
                        // was somehow set to Confirmed (2) after the medical request was issued.
                        if (appt.StatusId != PendingStatusId)
                        {
                            appt.StatusId = PendingStatusId;
                            await appointmentRepo.UpdateAsync(appt);
                            _logger.LogInformation(
                                "[OverdueService] Appointment #{id} has an active medical request — reset to Pending.",
                                appt.AppointmentId);
                        }
                        else
                        {
                            _logger.LogInformation(
                                "[OverdueService] Appointment #{id} has an active medical request — keeping as Pending, skipping auto-cancel.",
                                appt.AppointmentId);
                        }
                        continue;
                    }

                    // ── Guard 2: patient has outstanding pending medical requests ──
                    // Protects follow-up appointments booked while a previous visit's
                    // lab/radiology results are still pending.
                    bool hasPendingPatientRequests = false;
                    try
                    {
                        hasPendingPatientRequests = await medicalRequestRepo.HasPendingRequestsByPatientAsync(appt.PatientId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex,
                            "[OverdueService] Could not check patient-level medical requests for appointment #{id}. Skipping cancellation.",
                            appt.AppointmentId);
                        continue; // safe: skip rather than wrongly cancel
                    }

                    if (hasPendingPatientRequests)
                    {
                        if (appt.StatusId != PendingStatusId)
                        {
                            appt.StatusId = PendingStatusId;
                            await appointmentRepo.UpdateAsync(appt);
                            _logger.LogInformation(
                                "[OverdueService] Appointment #{id} — patient has outstanding pending medical requests — reset to Pending.",
                                appt.AppointmentId);
                        }
                        else
                        {
                            _logger.LogInformation(
                                "[OverdueService] Appointment #{id} — patient has outstanding pending medical requests — keeping as Pending, skipping auto-cancel.",
                                appt.AppointmentId);
                        }
                        continue;
                    }

                    // ── 1. Mark cancelled ─────────────────────────────────────
                    appt.StatusId = CancelledStatusId;
                    await appointmentRepo.UpdateAsync(appt);

                    var dateLabel = $"{appt.AppointmentDate[..Math.Min(10, appt.AppointmentDate.Length)]} {appt.AppointmentTime}".Trim();

                    // ── 2. Notify patient ─────────────────────────────────────
                    try
                    {
                        var patient = await patientRepo.GetByIdAsync(appt.PatientId);
                        if (patient?.UserId is long patientUserId)
                        {
                            await notifications.SendAsync(
                                userId:           patientUserId,
                                title:            "Appointment Auto-Cancelled",
                                message:          $"Your appointment scheduled for {dateLabel} was automatically cancelled because it was not attended. Please book a new appointment if needed.",
                                notificationType: "appointment",
                                referenceType:    "appointment",
                                referenceId:      appt.AppointmentId);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[OverdueService] Failed to notify patient for appointment {id}.", appt.AppointmentId);
                    }

                    // ── 3. Notify doctor ──────────────────────────────────────
                    try
                    {
                        var doctor = await doctorRepo.GetByIdAsync(appt.DoctorId);
                        if (doctor?.UserId is long doctorUserId)
                        {
                            var patientName = string.Empty;
                            try
                            {
                                var pat = await patientRepo.GetByIdAsync(appt.PatientId);
                                patientName = pat is not null
                                    ? $"{pat.FirstName} {pat.LastName}".Trim()
                                    : $"Patient #{appt.PatientId}";
                            }
                            catch { patientName = $"Patient #{appt.PatientId}"; }

                            await notifications.SendAsync(
                                userId:           doctorUserId,
                                title:            "Appointment Auto-Cancelled",
                                message:          $"The appointment with {patientName} scheduled for {dateLabel} was automatically cancelled due to no-show.",
                                notificationType: "appointment",
                                referenceType:    "appointment",
                                referenceId:      appt.AppointmentId);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[OverdueService] Failed to notify doctor for appointment {id}.", appt.AppointmentId);
                    }

                    _logger.LogInformation(
                        "[OverdueService] Auto-cancelled appointment #{id} (patient {pid}, doctor {did}) for {date}.",
                        appt.AppointmentId, appt.PatientId, appt.DoctorId, dateLabel);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[OverdueService] Failed to process appointment #{id}.", appt.AppointmentId);
                }
            }
        }
    }
}
