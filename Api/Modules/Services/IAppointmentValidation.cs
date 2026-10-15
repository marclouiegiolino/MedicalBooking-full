namespace Medical.Api.Modules.Appointments
{
    public interface IAppointmentService
    {
        Task<string?> ValidateForeignKeysAsync(Appointment appointment);

        Task<string?> CreateAsync(
            Appointment appointment,
            long currentUserId,
            bool isAdmin);

        Task<string?> UpdateAsync(
            Appointment appointment,
            long currentUserId,
            bool isAdmin,
            bool isDoctor);

        Task<string?> DeleteAsync(
            long appointmentId,
            long currentUserId,
            bool isAdmin,
            bool isDoctor);

        Task<object> GetLiveTodayAsync(
            string? date,
            long? currentUserId,
            bool isAdmin,
            bool isDoctor);
    }
}