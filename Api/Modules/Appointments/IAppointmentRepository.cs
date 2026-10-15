using Medical.Api.Main;

namespace Medical.Api.Modules.Appointments
{
    public interface IAppointmentRepository
    {
        Task<IEnumerable<Appointment>> GetAllAsync();
        Task<Appointment?> GetByIdAsync(long id);
        Task<IEnumerable<Appointment>> GetByPatientIdAsync(long patientId);
        Task<IEnumerable<Appointment>> GetByDoctorIdAsync(long doctorId);
        Task<IEnumerable<Appointment>> GetByAppointmentTypeIdAsync(long appointmentTypeId);
        Task<IEnumerable<string>> GetBookedSlotsAsync(long doctorId, string date);
        Task<int> GetDailyAppointmentCountAsync(long doctorId, string date);
        Task AddAsync(Appointment entity);
        Task UpdateAsync(Appointment entity);
        Task DeleteAsync(long id);
        Task<bool> ExistsAsync(long id);
        Task<PaginationModel<Appointment>> GetPaginatedAsync(int pageNumber, int pageSize);
        Task<IEnumerable<Appointment>> GetOverdueAsync(IEnumerable<long> activeStatusIds);
    }
}
