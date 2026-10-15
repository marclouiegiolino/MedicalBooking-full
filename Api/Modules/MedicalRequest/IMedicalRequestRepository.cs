using Medical.Api.Main;

namespace Medical.Api.Modules.MedicalRequest
{
    public interface IMedicalRequestRepository
    {
        Task<IEnumerable<MedicalRequest>> GetAllAsync();
        Task<MedicalRequest?> GetByIdAsync(long id);
        /// <summary>Get all requests where the owning patient's user_id matches.</summary>
        Task<List<MedicalRequest>> GetByUserIdAsync(long userId);
        /// <summary>Get all requests for a given patient_id.</summary>
        Task<List<MedicalRequest>> GetByPatientIdAsync(long patientId);
        /// <summary>Get all requests created by a given doctor_id.</summary>
        Task<List<MedicalRequest>> GetByDoctorIdAsync(long doctorId);
        Task AddAsync(MedicalRequest entity);
        Task UpdateAsync(MedicalRequest entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<MedicalRequest>> GetPaginatedAsync(int pageNumber, int pageSize);

        /// <summary>
        /// Returns true if there is at least one non-deleted medical request linked
        /// to the consultation that belongs to <paramref name="appointmentId"/>.
        /// Used by the overdue service to protect appointments from auto-cancellation
        /// when a doctor has already issued a medical request for that visit.
        /// </summary>
        Task<bool> HasActiveRequestsForAppointmentAsync(long appointmentId);

        /// <summary>
        /// Returns true if the patient has at least one non-deleted medical request
        /// whose result has not yet been received (status is still Pending = 1).
        /// Used by the overdue service to protect appointments from auto-cancellation
        /// when there are outstanding lab/radiology requests for the patient.
        /// </summary>
        Task<bool> HasPendingRequestsByPatientAsync(long patientId);
    }
}
