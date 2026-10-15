using Medical.Api.Main;

namespace Medical.Api.Modules.Consultation
{
    public interface IConsultationRepository
    {
        Task<IEnumerable<Consultation>> GetAllAsync();
        Task<Consultation?> GetByIdAsync(long id);
        Task<IEnumerable<Consultation>> GetByPatientIdAsync(long patientId);
        Task<IEnumerable<Consultation>> GetByDoctorIdAsync(long doctorId);
        Task<IEnumerable<Consultation>> GetByAppointmentIdAsync(long appointmentId);
        Task AddAsync(Consultation entity);
        Task UpdateAsync(Consultation entity);
        Task SoftDeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Consultation>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}
